// Salgspakke-PDF — investor- og kjøper-rettet rapport som samler:
//   - Sammendrag (kjøp, oppussing, ROI)
//   - Oppgraderinger (budsjett vs faktisk, status)
//   - Kostnadsoversikt fra kvitteringer (per kategori)
//   - Før/etter-bilder
//   - Dokumentstatus (sjekkliste + vedlagte)
//
// Bygges server-side så vi kan laste bilder direkte fra Supabase Storage uten
// å gå via signed URL-API. Helt uavhengig av eksisterende pdf.ts og pdfNorsk.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoligData, OppussingBudsjett, OppussingPost, Prosjekt, Prosjektbilde, Kvittering, Dokument, DokumentSjekkpunkt } from '../types'
import {
  KVITTERING_KATEGORI_ETIKETT, KVITTERING_KATEGORIER,
  type KvitteringKategori,
} from './kvittering'
import {
  DOKUMENT_ETIKETT,
  SJEKKPUNKT_STATUS_LBL,
  type DokumentType, type SjekkpunktStatus,
} from './dokument'
import { BUCKET_BILDER } from './bilder'

export type SalgspakkeOpt = {
  inkluderBilder?: boolean         // default true
  inkluderKvitteringer?: boolean   // default true (sum per kategori)
  inkluderDokumenter?: boolean     // default true
  inkluderSjekkliste?: boolean     // default true
}

const STD_OPT: Required<SalgspakkeOpt> = {
  inkluderBilder: true,
  inkluderKvitteringer: true,
  inkluderDokumenter: true,
  inkluderSjekkliste: true,
}

const fmtEur = (n: number | null | undefined) =>
  (n === null || n === undefined || !Number.isFinite(n) || n === 0) ? '-' : 'EUR ' + Math.round(n).toLocaleString('nb-NO')

const fmtNok = (n: number | null | undefined) =>
  (n === null || n === undefined || !Number.isFinite(n) || n === 0) ? '-' : 'NOK ' + Math.round(n).toLocaleString('nb-NO')

const fmtDato = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

function rapportFilnavn(navn: string): string {
  const safe = navn.replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_').slice(0, 60)
  return `salgspakke_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`
}

async function lastBildeBase64(
  admin: SupabaseClient,
  bucket: string,
  sti: string,
): Promise<string | null> {
  try {
    const { data: blob } = await admin.storage.from(bucket).download(sti)
    if (!blob) return null
    const buffer = Buffer.from(await blob.arrayBuffer())
    return 'data:image/jpeg;base64,' + buffer.toString('base64')
  } catch { return null }
}

export async function byggSalgspakkePdf(
  prosjektId: string,
  admin: SupabaseClient,
  opt: SalgspakkeOpt = {},
): Promise<{ filnavn: string; base64: string } | null> {
  const o = { ...STD_OPT, ...opt }

  // === HENT DATA ===
  const { data: pRad } = await admin.from('prosjekter').select('*').eq('id', prosjektId).single()
  if (!pRad) return null
  const p = pRad as Prosjekt
  const bd = (p.bolig_data || {}) as BoligData
  const erNorsk = p.marked === 'norge'
  const fmt = erNorsk ? fmtNok : fmtEur

  // Oppussing
  let budsjett: OppussingBudsjett | null = null
  let poster: OppussingPost[] = []
  const { data: bRad } = await admin.from('oppussing_budsjett').select('*').eq('bolig_id', p.id).maybeSingle()
  if (bRad) {
    budsjett = bRad as OppussingBudsjett
    const { data: pp } = await admin.from('oppussing_poster').select('*').eq('budsjett_id', budsjett.id).order('rekkefolge')
    poster = (pp || []) as OppussingPost[]
  }

  // Kvitteringer (alltid summer for kostnadsoversikt; full liste hvis valgt)
  const { data: kvRader } = await admin.from('kvitteringer')
    .select('id, kategori, valuta, belop_inkl_mva, leverandor, dato, oppussing_post_id, ocr_status')
    .eq('prosjekt_id', p.id)
  const kvitteringer = (kvRader || []) as Pick<Kvittering, 'id' | 'kategori' | 'valuta' | 'belop_inkl_mva' | 'leverandor' | 'dato' | 'oppussing_post_id' | 'ocr_status'>[]

  // Sum kvitteringer per oppussingspost (brukt i Oppgraderinger-seksjonen)
  const kvSumPerPost: Record<string, number> = {}
  for (const k of kvitteringer) {
    if (k.oppussing_post_id && k.belop_inkl_mva) {
      kvSumPerPost[k.oppussing_post_id] = (kvSumPerPost[k.oppussing_post_id] || 0) + k.belop_inkl_mva
    }
  }

  // Dokumenter
  let dokumenter: Pick<Dokument, 'id' | 'tittel' | 'type' | 'utstedt_dato' | 'gyldig_til'>[] = []
  if (o.inkluderDokumenter) {
    const { data: dRader } = await admin.from('dokumenter')
      .select('id, tittel, type, utstedt_dato, gyldig_til')
      .eq('prosjekt_id', p.id)
      .order('opprettet', { ascending: true })
    dokumenter = (dRader || []) as typeof dokumenter
  }

  // Sjekkliste
  let sjekkpunkter: Pick<DokumentSjekkpunkt, 'id' | 'dokument_type' | 'status' | 'frist'>[] = []
  if (o.inkluderSjekkliste) {
    const { data: sRader } = await admin.from('dokument_sjekkpunkter')
      .select('id, dokument_type, status, frist')
      .eq('prosjekt_id', p.id)
    sjekkpunkter = (sRader || []) as typeof sjekkpunkter
  }

  // Bilder med før/etter (kun marketing eller koblet til oppussingspost)
  type BildePar = {
    original: Prosjektbilde
    originalBase64: string | null
    generert: Prosjektbilde | null
    generertBase64: string | null
    knyttetPost: OppussingPost | null
  }
  const bildePar: BildePar[] = []
  if (o.inkluderBilder) {
    const { data: bilderRader } = await admin.from('prosjekt_bilder')
      .select('id, prosjekt_id, type, kategori, storage_sti, original_bilde_id, er_marketing')
      .eq('prosjekt_id', p.id)
      .order('opprettet', { ascending: true })
    const alle = (bilderRader || []) as Prosjektbilde[]
    const originaler = alle.filter(b => b.type === 'original')
    const genererte = alle.filter(b => b.type === 'generert')

    // Velg ut originaler som er marketing eller har en koblet oppussingspost eller har generert variant
    const relevante = originaler.filter(orig => {
      if (orig.er_marketing) return true
      const harGenerert = genererte.some(g => g.original_bilde_id === orig.id)
      const harPost = poster.some(p => p.kilde_bilde_id === orig.id)
      return harGenerert || harPost
    }).slice(0, 8)  // begrens til 8 par for å unngå mega-PDF

    for (const orig of relevante) {
      const gen = genererte.find(g => g.original_bilde_id === orig.id) || null
      const post = poster.find(pp => pp.kilde_bilde_id === orig.id) || null
      const [origB64, genB64] = await Promise.all([
        lastBildeBase64(admin, BUCKET_BILDER, orig.storage_sti),
        gen ? lastBildeBase64(admin, BUCKET_BILDER, gen.storage_sti) : Promise.resolve(null),
      ])
      bildePar.push({ original: orig, originalBase64: origB64, generert: gen, generertBase64: genB64, knyttetPost: post })
    }
  }

  // === BYGG PDF ===
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  let y = 0
  const sjekkSidebrudd = (plass = 10) => {
    if (y + plass > 275) { doc.addPage(); y = 20 }
  }

  function header() {
    doc.setFillColor(14, 23, 38)  // navy
    doc.rect(0, 0, 210, 36, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18); doc.setFont('helvetica', 'bold')
    doc.text('Leganger & Osvaag Eiendom', 20, 15)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text('Salgspakke - ' + p.navn, 20, 24)
    doc.setFontSize(9)
    doc.text('Generert ' + new Date().toLocaleDateString('nb-NO') + '  |  ' + (erNorsk ? 'Norge' : 'Spania') + '  |  Status: ' + p.status, 20, 31)
    doc.setTextColor(0, 0, 0)
  }

  function seksjon(tittel: string) {
    sjekkSidebrudd(14)
    doc.setFillColor(184, 154, 111)  // gull
    doc.rect(15, y, 180, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    doc.text(tittel.toUpperCase(), 20, y + 5)
    y += 11
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
  }

  function rad(lbl: string, val: string, i: number, bold = false) {
    sjekkSidebrudd(8)
    if (i % 2 === 0) { doc.setFillColor(250, 250, 246); doc.rect(15, y - 3, 180, 7, 'F') }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(lbl, 20, y + 2)
    doc.text(val, 190, y + 2, { align: 'right' })
    y += 7
    doc.setFont('helvetica', 'normal')
  }

  function avsnitt(tekst: string, fontSize = 10) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(fontSize); doc.setTextColor(60, 60, 60)
    const linjer = doc.splitTextToSize(tekst, 175)
    for (const l of linjer as string[]) {
      sjekkSidebrudd(6)
      doc.text(l, 20, y); y += 5
    }
    y += 2
  }

  // === FORSIDE ===
  header()
  y = 56
  doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(14, 23, 38)
  doc.text(p.navn, 20, y)
  y += 12
  if (bd.beliggenhet) {
    doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
    doc.text(String(bd.beliggenhet), 20, y); y += 10
  }
  y += 8

  // Nøkkeltall stripe
  const totInv = (p.kjøpesum || 0) + (p.kjøpskostnader || 0) + (p.oppussing_faktisk || 0) + (p.møblering || 0)
  const fortjeneste = (p.forventet_salgsverdi || 0) - totInv
  const roiPct = totInv > 0 && p.forventet_salgsverdi ? ((p.forventet_salgsverdi - totInv) / totInv) * 100 : 0

  function noekkel(x: number, lbl: string, val: string, farge: [number, number, number] = [14, 23, 38]) {
    doc.setFillColor(250, 250, 246); doc.rect(x, y, 55, 28, 'F')
    doc.setDrawColor(220, 215, 200); doc.setLineWidth(0.3); doc.rect(x, y, 55, 28, 'S')
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120)
    doc.text(lbl, x + 4, y + 7)
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...farge)
    doc.text(val, x + 4, y + 18)
  }
  noekkel(20, 'TOTAL INVESTERT', fmt(totInv))
  noekkel(80, 'FORVENTET SALG', fmt(p.forventet_salgsverdi || null))
  noekkel(140, 'BRUTTO FORTJENESTE', fmt(fortjeneste), fortjeneste >= 0 ? [45, 125, 70] : [200, 16, 46])
  y += 36
  noekkel(20, 'ROI', roiPct ? roiPct.toFixed(1) + '%' : '-', roiPct >= 0 ? [45, 125, 70] : [200, 16, 46])
  noekkel(80, 'AREAL', bd.areal ? bd.areal + ' m²' : '-')
  noekkel(140, 'KOST PER M²', bd.areal && totInv ? fmt(totInv / Number(bd.areal)) : '-')
  y += 40

  // Boligdetaljer
  seksjon('Boligdetaljer')
  const bRader = [
    ['Type', String(bd.type || '-')],
    ['Beliggenhet', String(bd.beliggenhet || '-')],
    ['Soverom / Bad', (bd.soverom ?? '-') + ' / ' + (bd.bad ?? '-')],
    ['Areal', bd.areal ? bd.areal + ' m²' : '-'],
    ['Standard', bd.standard || '-'],
    ['Kjøpt', fmtDato(p.dato_kjopt)],
  ]
  bRader.forEach(([l, v], i) => rad(l, v, i))

  // === SAMMENDRAG ===
  doc.addPage(); y = 20
  seksjon('Investering og kostnader')
  const investRader: Array<[string, string, boolean]> = [
    ['Kjøpesum', fmt(p.kjøpesum), false],
    ['Kjøpskostnader', fmt(p.kjøpskostnader), false],
    ['Oppussing budsjett', fmt(p.oppussingsbudsjett), false],
    ['Oppussing faktisk', fmt(p.oppussing_faktisk), false],
    ['Møblering', fmt(p.møblering), false],
    ['Total investert', fmt(totInv), true],
    ['Forventet salgsverdi', fmt(p.forventet_salgsverdi || null), false],
    ['Brutto fortjeneste', fmt(fortjeneste), true],
    ['ROI', roiPct ? roiPct.toFixed(1) + '%' : '-', true],
  ]
  investRader.forEach(([l, v, b], i) => rad(l, v, i, b))
  y += 4

  // === OPPGRADERINGER ===
  if (poster.length > 0) {
    seksjon('Oppgraderinger og oppussingsposter')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 120, 120)
    doc.text('POST', 20, y); doc.text('STATUS', 100, y)
    doc.text('BUDSJETT', 145, y, { align: 'right' }); doc.text('FAKTISK', 190, y, { align: 'right' })
    y += 5
    doc.setDrawColor(220, 215, 200); doc.line(15, y, 195, y); y += 4
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)

    let sumBud = 0, sumFak = 0
    for (let i = 0; i < poster.length; i++) {
      const post = poster[i]
      sjekkSidebrudd(8)
      if (i % 2 === 0) { doc.setFillColor(250, 250, 246); doc.rect(15, y - 3, 180, 7, 'F') }
      const status = post.status === 'ferdig' ? 'Ferdig' : post.status === 'pagar' ? 'Pågår' : 'Ikke startet'
      const fak = (typeof post.faktisk_kostnad === 'number' && Number.isFinite(post.faktisk_kostnad))
        ? post.faktisk_kostnad
        : (kvSumPerPost[post.id] || 0)
      sumBud += post.kostnad || 0
      sumFak += fak

      doc.text(post.navn.slice(0, 50), 20, y + 2)
      doc.text(status, 100, y + 2)
      doc.text(fmt(post.kostnad), 145, y + 2, { align: 'right' })
      const overskredet = post.kostnad > 0 && fak > post.kostnad * 1.10
      if (overskredet) doc.setTextColor(200, 16, 46)
      doc.text(fmt(fak), 190, y + 2, { align: 'right' })
      doc.setTextColor(60, 60, 60)
      y += 7
    }
    doc.setDrawColor(220, 215, 200); doc.line(15, y - 1, 195, y - 1); y += 3
    doc.setFont('helvetica', 'bold')
    doc.text('Sum', 20, y + 2)
    doc.text(fmt(sumBud), 145, y + 2, { align: 'right' })
    doc.setTextColor(sumFak > sumBud ? 200 : 60, sumFak > sumBud ? 16 : 60, sumFak > sumBud ? 46 : 60)
    doc.text(fmt(sumFak), 190, y + 2, { align: 'right' })
    doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal')
    y += 10
  }

  // === KOSTNADSOVERSIKT — kvitteringer per kategori ===
  if (o.inkluderKvitteringer && kvitteringer.length > 0) {
    seksjon('Kostnadsoversikt fra kvitteringer')

    // Sum per kategori (begge valuta beholdt separat)
    const sumPerKat: Record<string, Record<string, number>> = {}
    let totalEur = 0, totalNok = 0, antall = 0
    for (const k of kvitteringer) {
      if (!k.kategori || !k.belop_inkl_mva || !k.valuta) continue
      const kat = k.kategori
      if (!sumPerKat[kat]) sumPerKat[kat] = {}
      sumPerKat[kat][k.valuta] = (sumPerKat[kat][k.valuta] || 0) + k.belop_inkl_mva
      if (k.valuta === 'EUR') totalEur += k.belop_inkl_mva
      if (k.valuta === 'NOK') totalNok += k.belop_inkl_mva
      antall++
    }

    avsnitt(`${antall} kvittering${antall !== 1 ? 'er' : ''} registrert${totalEur > 0 || totalNok > 0 ? ' — totalt:' : ''}`, 9)
    if (totalEur > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text('EUR ' + Math.round(totalEur).toLocaleString('nb-NO'), 25, y)
      y += 6
    }
    if (totalNok > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text('NOK ' + Math.round(totalNok).toLocaleString('nb-NO'), 25, y)
      y += 6
    }
    doc.setFont('helvetica', 'normal')
    y += 3

    let idx = 0
    for (const kat of KVITTERING_KATEGORIER) {
      const sums = sumPerKat[kat]
      if (!sums) continue
      const lbl = KVITTERING_KATEGORI_ETIKETT[kat as KvitteringKategori]
      const verdier: string[] = []
      if (sums.EUR) verdier.push('EUR ' + Math.round(sums.EUR).toLocaleString('nb-NO'))
      if (sums.NOK) verdier.push('NOK ' + Math.round(sums.NOK).toLocaleString('nb-NO'))
      rad(lbl, verdier.join(' / '), idx++)
    }
    y += 4
  }

  // === BILDER FØR/ETTER ===
  if (o.inkluderBilder && bildePar.length > 0) {
    doc.addPage(); y = 20
    seksjon('Bilder - før og etter')

    for (const par of bildePar) {
      sjekkSidebrudd(80)
      const tittel = par.knyttetPost ? par.knyttetPost.navn : (par.original.kategori || 'Bilde')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(14, 23, 38)
      doc.text(tittel, 20, y)
      y += 5
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120)
      if (par.generert) doc.text('Før (originalbilde) / Etter (AI-visualisering)', 20, y)
      else doc.text('Bilde', 20, y)
      y += 4

      // To bilder side om side, eller én hvis ingen generert
      const bildeBredde = par.generert ? 85 : 175
      const bildeHoyde = par.generert ? 60 : 110
      try {
        if (par.originalBase64) {
          doc.addImage(par.originalBase64, 'JPEG', 20, y, bildeBredde, bildeHoyde, undefined, 'MEDIUM')
        }
        if (par.generertBase64 && par.generert) {
          doc.addImage(par.generertBase64, 'JPEG', 110, y, bildeBredde, bildeHoyde, undefined, 'MEDIUM')
        }
        y += bildeHoyde + 8
      } catch {
        // Hvis bildet ikke kan legges til (korrupt e.l.), skip stille
        y += 6
      }
    }
  }

  // === DOKUMENTSJEKKLISTE ===
  if (o.inkluderSjekkliste && sjekkpunkter.length > 0) {
    sjekkSidebrudd(40)
    if (y > 200) { doc.addPage(); y = 20 }
    seksjon('Dokumentsjekkliste')
    sjekkpunkter.forEach((s, i) => {
      const lbl = DOKUMENT_ETIKETT[s.dokument_type as DokumentType] || s.dokument_type
      const status = SJEKKPUNKT_STATUS_LBL[s.status as SjekkpunktStatus] || s.status
      const v = s.frist ? `${status}  -  Frist: ${fmtDato(s.frist)}` : status
      rad(lbl, v, i)
    })
    y += 4
  }

  // === VEDLAGTE DOKUMENTER ===
  if (o.inkluderDokumenter && dokumenter.length > 0) {
    sjekkSidebrudd(40)
    if (y > 220) { doc.addPage(); y = 20 }
    seksjon('Vedlagte dokumenter')
    dokumenter.forEach((d, i) => {
      const lbl = DOKUMENT_ETIKETT[d.type as DokumentType] || d.type
      const dato = d.utstedt_dato ? '  -  ' + fmtDato(d.utstedt_dato) : ''
      rad(d.tittel, lbl + dato, i)
    })
  }

  // === FOOTER på siste side ===
  doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'italic')
  doc.text('Generert av Leganger & Osvaag prospektsystem  -  Tallene er estimater og ikke en juridisk garanti.', 105, 287, { align: 'center' })

  // Til base64 — Node-buffer
  const arrayBuffer = doc.output('arraybuffer')
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return { filnavn: rapportFilnavn(p.navn), base64 }
}
