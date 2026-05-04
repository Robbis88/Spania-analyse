// Årsrapport for én eiendom — for regnskapsfører.
// Lister månedlig inntekt/kostnad fra eiendom_cashflow + sum og snitt.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Prosjekt, EiendomCashflow } from '../types'

const MND_NAVN = ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember']

const fmtNok = (n: number) => Math.round(n).toLocaleString('nb-NO')

function rapportFilnavn(navn: string, ar: number): string {
  const safe = navn.replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_').slice(0, 50)
  return `cashflow_${safe}_${ar}.pdf`
}

export async function byggCashflowPdf(
  prosjektId: string,
  ar: number,
  admin: SupabaseClient,
): Promise<{ filnavn: string; base64: string } | null> {
  const { data: pRad } = await admin.from('prosjekter').select('*').eq('id', prosjektId).single()
  if (!pRad) return null
  const p = pRad as Prosjekt
  const erNorsk = p.marked === 'norge'
  const valuta = erNorsk ? 'NOK' : 'EUR'

  const { data: cfRader } = await admin
    .from('eiendom_cashflow')
    .select('id, maaned, inntekt, kostnad, notat')
    .eq('prosjekt_id', prosjektId)
  const cf = ((cfRader || []) as EiendomCashflow[])
    .filter(c => c.maaned && c.maaned.startsWith(String(ar)))

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  // Header
  doc.setFillColor(14, 23, 38)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text('Cashflow-rapport ' + ar, 20, 14)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text(p.navn, 20, 22)
  doc.setFontSize(8)
  doc.text('Generert ' + new Date().toLocaleDateString('nb-NO') + ' - Leganger & Osvaag Eiendom', 20, 28)

  doc.setTextColor(0, 0, 0)
  let y = 44

  // Adresse
  if (p.bolig_data && typeof p.bolig_data === 'object' && 'beliggenhet' in p.bolig_data) {
    const adr = String((p.bolig_data as { beliggenhet?: string }).beliggenhet || '')
    if (adr) {
      doc.setFontSize(10); doc.setTextColor(80, 80, 80)
      doc.text('Adresse: ' + adr, 20, y); y += 8
    }
  }

  // Bygg full liste over 12 måneder (registrerte + tomme)
  const radPerMnd: Record<string, EiendomCashflow | undefined> = {}
  for (const c of cf) radPerMnd[c.maaned] = c
  const aller: Array<{ maaned: string; rad?: EiendomCashflow }> = []
  for (let m = 1; m <= 12; m++) {
    const key = `${ar}-${String(m).padStart(2, '0')}`
    aller.push({ maaned: key, rad: radPerMnd[key] })
  }

  // Tabell-header
  doc.setFillColor(184, 154, 111)  // gull
  doc.rect(15, y, 180, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('MÅNED', 20, y + 5.5)
  doc.text('INNTEKT', 95, y + 5.5, { align: 'right' })
  doc.text('KOSTNAD', 130, y + 5.5, { align: 'right' })
  doc.text('NETTO', 165, y + 5.5, { align: 'right' })
  doc.text(valuta, 192, y + 5.5, { align: 'right' })
  y += 12
  doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)

  // Tabell-rader
  let sumInntekt = 0, sumKostnad = 0
  let i = 0
  for (const { maaned, rad } of aller) {
    if (y > 245) { doc.addPage(); y = 20 }
    if (i % 2 === 0) { doc.setFillColor(250, 250, 246); doc.rect(15, y - 4, 180, 7, 'F') }
    const mndNum = Number(maaned.slice(5, 7))
    doc.text(MND_NAVN[mndNum - 1], 20, y + 2)
    const inn = rad?.inntekt || 0
    const kost = rad?.kostnad || 0
    const netto = inn - kost
    sumInntekt += inn
    sumKostnad += kost
    if (rad) {
      doc.text(fmtNok(inn), 95, y + 2, { align: 'right' })
      doc.text(fmtNok(kost), 130, y + 2, { align: 'right' })
      if (netto < 0) doc.setTextColor(200, 16, 46)
      else if (netto > 0) doc.setTextColor(45, 125, 70)
      doc.text(fmtNok(netto), 165, y + 2, { align: 'right' })
      doc.setTextColor(60, 60, 60)
    } else {
      doc.setTextColor(180, 180, 180)
      doc.text('-', 95, y + 2, { align: 'right' })
      doc.text('-', 130, y + 2, { align: 'right' })
      doc.text('-', 165, y + 2, { align: 'right' })
      doc.setTextColor(60, 60, 60)
    }
    y += 7
    i++
  }

  // Sum-linje
  y += 3
  doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.5); doc.line(15, y - 1, 195, y - 1)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('SUM ' + ar, 20, y + 5)
  doc.text(fmtNok(sumInntekt), 95, y + 5, { align: 'right' })
  doc.text(fmtNok(sumKostnad), 130, y + 5, { align: 'right' })
  const sumNetto = sumInntekt - sumKostnad
  if (sumNetto < 0) doc.setTextColor(200, 16, 46)
  else doc.setTextColor(45, 125, 70)
  doc.text(fmtNok(sumNetto), 165, y + 5, { align: 'right' })
  doc.setTextColor(60, 60, 60)
  y += 14

  // Sammendrags-blokk
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.setFillColor(250, 250, 246); doc.rect(15, y, 180, 32, 'F')
  doc.text('Antall registrerte måneder', 22, y + 7)
  doc.setFont('helvetica', 'bold'); doc.text(String(cf.length), 188, y + 7, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.text('Snitt netto per registrert måned', 22, y + 14)
  doc.setFont('helvetica', 'bold')
  const snitt = cf.length > 0 ? sumNetto / cf.length : 0
  doc.text(fmtNok(snitt) + ' ' + valuta, 188, y + 14, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.text('Brutto inntekt per måned (snitt)', 22, y + 21)
  doc.setFont('helvetica', 'bold')
  const bruttoSnitt = cf.length > 0 ? sumInntekt / cf.length : 0
  doc.text(fmtNok(bruttoSnitt) + ' ' + valuta, 188, y + 21, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.text('Drift per måned (snitt)', 22, y + 28)
  doc.setFont('helvetica', 'bold')
  const driftSnitt = cf.length > 0 ? sumKostnad / cf.length : 0
  doc.text(fmtNok(driftSnitt) + ' ' + valuta, 188, y + 28, { align: 'right' })

  // Notater for hver måned
  const medNotat = cf.filter(c => c.notat?.trim())
  if (medNotat.length > 0) {
    y += 42
    if (y > 245) { doc.addPage(); y = 20 }
    doc.setFillColor(184, 154, 111); doc.rect(15, y, 180, 7, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
    doc.text('NOTATER', 20, y + 5)
    y += 11
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
    for (const c of medNotat.sort((a, b) => a.maaned.localeCompare(b.maaned))) {
      if (y > 270) { doc.addPage(); y = 20 }
      const mndNum = Number(c.maaned.slice(5, 7))
      doc.setFont('helvetica', 'bold')
      doc.text(MND_NAVN[mndNum - 1] + ':', 20, y)
      doc.setFont('helvetica', 'normal')
      const linjer = doc.splitTextToSize(c.notat || '', 150) as string[]
      let første = true
      for (const l of linjer) {
        doc.text(l, 50, y)
        y += 5
        if (første) { første = false } else { /* fortsett */ }
      }
      y += 1
    }
  }

  // Footer
  doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'italic')
  doc.text('Oversikt for regnskapsfører  -  Tallene er registrert manuelt og bør avstemmes mot kontoutdrag.', 105, 287, { align: 'center' })

  const arrayBuffer = doc.output('arraybuffer')
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return { filnavn: rapportFilnavn(p.navn, ar), base64 }
}
