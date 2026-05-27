// Bankvennlig PDF for off-market — en ren lønnsomhetscase ment som vedlegg til
// finansieringssøknad. Viser eiendomsfakta, budkalkylen (salgspris minus alle
// kostnader), finansiering (lån/egenkapital) og nøkkeltall. Bruker SAMME
// beregning som UI-en (beregnBudkalkyle) så tallene aldri spriker.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Prosjekt } from '../types'
import { beregnBudkalkyle, type Budkalkyle } from './offmarket'

const fmtNok = (n: number | undefined | null) =>
  (n || n === 0) ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'

type GeonorgeAdresse = {
  adressetekst?: string; postnummer?: string | null; poststed?: string | null
  kommunenavn?: string | null; gardsnummer?: number | null; bruksnummer?: number | null
}
type KjenteFakta = {
  boligtype?: string; eierform?: string; bra_m2?: number; p_rom_m2?: number
  byggear?: number; soverom?: number; bad?: number; energimerke?: string
  fellesgjeld_nok?: number; tomt_m2?: number
}
type SammenlignbarData = {
  url?: string
  beskrivelse?: string
  prisantydning_nok?: number
  faktisk_salgspris_nok?: number
  bra_m2?: number
  notat?: string
}
type OffmarketData = {
  adresse_input?: string
  kjente_fakta?: KjenteFakta
  innhenting?: { treff?: GeonorgeAdresse[]; valgt?: GeonorgeAdresse | null }
  valgt_treff_idx?: number
  sammenlignbare_data?: SammenlignbarData[]
  budkalkyle?: Budkalkyle
}

function safeFilnavn(navn: string): string {
  return navn.replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_').slice(0, 50)
}

export async function byggBankPdf(
  prosjektId: string,
  admin: SupabaseClient,
): Promise<{ filnavn: string; base64: string } | null> {
  const { data: pRad } = await admin.from('prosjekter').select('*').eq('id', prosjektId).single()
  if (!pRad) return null
  const p = pRad as Prosjekt
  if (!p.off_market) return null

  const omd = (p.off_market_data || {}) as OffmarketData
  const fakta = omd.kjente_fakta || {}
  const treff = (omd.innhenting?.treff || [])[omd.valgt_treff_idx ?? 0] || omd.innhenting?.valgt || null
  const k = (omd.budkalkyle || {}) as Budkalkyle
  const r = beregnBudkalkyle(k)
  const samm = (omd.sammenlignbare_data || []) as SammenlignbarData[]

  // Hent oppussingspostene så banken ser hva totalen består av, ikke bare summen.
  type OppPost = { navn: string | null; kostnad: number | null; notat: string | null }
  let oppussingPoster: OppPost[] = []
  const { data: budRad } = await admin.from('oppussing_budsjett').select('id').eq('bolig_id', prosjektId).maybeSingle()
  if (budRad) {
    const { data: pr } = await admin.from('oppussing_poster')
      .select('navn, kostnad, notat').eq('budsjett_id', (budRad as { id: string }).id).order('rekkefolge')
    oppussingPoster = (pr || []) as OppPost[]
  }

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const SIDE_BREDDE = 210
  const MARG = 18
  const INNHOLD_BREDDE = SIDE_BREDDE - MARG * 2
  const SIDE_HOYDE = 297
  let y = 0

  // === Header ===
  doc.setFillColor(14, 23, 38)
  doc.rect(0, 0, SIDE_BREDDE, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15); doc.setFont('helvetica', 'bold')
  doc.text('Lonnsomhetscase - bankvedlegg', MARG, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(p.navn, MARG, 22)
  doc.setFontSize(8); doc.setTextColor(184, 154, 111)
  doc.text('Generert ' + new Date().toLocaleDateString('nb-NO') + ' - Leganger & Osvaag Eiendom', MARG, 30)
  doc.setTextColor(0, 0, 0)
  y = 48

  const sjekkPlass = (mer: number) => {
    if (y + mer > SIDE_HOYDE - 20) { doc.addPage(); y = 22 }
  }

  const seksjon = (tittel: string) => {
    sjekkPlass(16)
    doc.setFillColor(248, 245, 235)
    doc.rect(MARG, y - 5, INNHOLD_BREDDE, 9, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(122, 74, 8)
    doc.text(tittel.toUpperCase(), MARG + 3, y + 1)
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    y += 10
  }

  // Beløpslinje: etikett venstre, beløp høyrejustert. bold/farge for sum-rader.
  const belop = (lbl: string, val: string, opts?: { bold?: boolean; farge?: [number, number, number]; strek?: boolean }) => {
    sjekkPlass(7)
    if (opts?.strek) {
      doc.setDrawColor(184, 154, 111)
      doc.setLineWidth(0.4)
      doc.line(MARG, y - 4, MARG + INNHOLD_BREDDE, y - 4)
    }
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal'); doc.setFontSize(opts?.bold ? 11 : 9.5)
    if (opts?.farge) doc.setTextColor(...opts.farge)
    doc.text(lbl, MARG, y)
    doc.text(val, MARG + INNHOLD_BREDDE, y, { align: 'right' })
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    y += opts?.bold ? 8 : 6
  }

  const linje = (lbl: string, val: string) => {
    sjekkPlass(6)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text(lbl + ':', MARG, y)
    doc.setFont('helvetica', 'normal')
    const valLinjer = doc.splitTextToSize(val || '–', INNHOLD_BREDDE - 55) as string[]
    doc.text(valLinjer[0], MARG + 55, y)
    y += 5
    for (let i = 1; i < valLinjer.length; i++) { sjekkPlass(5); doc.text(valLinjer[i], MARG + 55, y); y += 5 }
  }

  // === Eiendom og fakta ===
  seksjon('Eiendom og fakta')
  linje('Adresse', treff?.adressetekst || omd.adresse_input || p.navn)
  if (treff?.postnummer) linje('Postnr/sted', `${treff.postnummer} ${treff.poststed || ''}`)
  if (treff?.kommunenavn) linje('Kommune', treff.kommunenavn)
  if (treff?.gardsnummer != null) linje('Matrikkel', `gnr ${treff.gardsnummer}/bnr ${treff.bruksnummer}`)
  if (fakta.boligtype) linje('Boligtype', fakta.boligtype)
  if (fakta.eierform) linje('Eierform', fakta.eierform)
  if (fakta.bra_m2) linje('BRA', `${fakta.bra_m2} m²`)
  if (fakta.byggear) linje('Byggeår', String(fakta.byggear))
  if (fakta.energimerke) linje('Energimerke', fakta.energimerke)
  if (fakta.fellesgjeld_nok) linje('Fellesgjeld', fmtNok(fakta.fellesgjeld_nok))
  if (k.bud_lav_nok || k.bud_hoy_nok) linje('Budintervall', `${fmtNok(k.bud_lav_nok)} - ${fmtNok(k.bud_hoy_nok)}`)
  y += 4

  // === Lønnsomhetskalkyle ===
  seksjon('Lonnsomhetskalkyle')
  belop('Forventet salgspris (meglerestimat)', fmtNok(r.salgspris), { bold: true })
  belop('- Bud / kjopesum', '-' + fmtNok(r.bud))
  belop('- Kjopskostnader', '-' + fmtNok(r.kjopskostnader))
  belop('- Oppussingsbudsjett', '-' + fmtNok(r.oppussing))
  belop(`- Meglerhonorar (${k.meglerhonorar_pst || 0} %${k.meglerhonorar_fast_nok ? ' + faste tillegg' : ''})`, '-' + fmtNok(r.meglerhonorar))
  belop('- Styling', '-' + fmtNok(r.styling))
  belop(`- Lanekostnad (renter ${k.periode_mnd || 0} mnd)`, '-' + fmtNok(r.lanekostnad))
  belop('= Netto fortjeneste', fmtNok(r.nettoFortjeneste), {
    bold: true, strek: true,
    farge: r.nettoFortjeneste >= 0 ? [45, 125, 70] : [200, 16, 46],
  })
  y += 4

  // === Oppussingsbudsjett (detaljert) ===
  if (oppussingPoster.length) {
    seksjon('Oppussingsbudsjett - poster')
    let sum = 0
    for (const post of oppussingPoster) {
      const kost = post.kostnad || 0
      sum += kost
      belop(post.navn || 'Post', fmtNok(kost))
      if (post.notat) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120)
        for (const l of doc.splitTextToSize(post.notat, INNHOLD_BREDDE - 6) as string[]) { sjekkPlass(5); doc.text(l, MARG + 4, y); y += 4.3 }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0)
      }
    }
    belop('Sum oppussingsbudsjett', fmtNok(sum), { bold: true, strek: true })
    y += 4
  }

  // === Finansiering ===
  seksjon('Finansiering og avkastning')
  belop('Kapitalbehov (opp front)', fmtNok(r.kapitalbehov))
  belop('Egenkapital ved start', fmtNok(r.egenkapital), r.egenkapital < 0 ? { farge: [200, 16, 46] } : undefined)
  belop('+ Lan gjennom prosessen', fmtNok(r.lan))
  belop('= Finansiering totalt', fmtNok(r.finansieringTotal), { bold: true, strek: true })
  belop(
    r.finansieringsdiff >= 0 ? 'Buffer (overfinansiert)' : 'Manko (underfinansiert)',
    (r.finansieringsdiff >= 0 ? '+' : '') + fmtNok(r.finansieringsdiff),
    { farge: r.finansieringsdiff >= 0 ? [45, 125, 70] : [200, 16, 46] },
  )
  belop('Nominell rente', (k.rente_pst || 0) + ' % p.a.')
  belop('Eierperiode', (k.periode_mnd || 0) + ' mnd')
  belop('Avkastning pa egenkapital', r.avkastningEkPst != null ? r.avkastningEkPst.toFixed(0) + ' %' : '-', { bold: true })
  belop('Margin av salgssum', r.margiPst != null ? r.margiPst.toFixed(1) + ' %' : '-')
  y += 4

  // === Sammenlignbare salg ===
  if (samm.length) {
    seksjon('Sammenlignbare salg i omradet')
    // Snitt-tall som underbygger forventet salgspris.
    const medM2 = samm.filter(s => s.faktisk_salgspris_nok && s.bra_m2)
    const snittM2 = medM2.length
      ? Math.round(medM2.reduce((a, s) => a + (s.faktisk_salgspris_nok! / s.bra_m2!), 0) / medM2.length)
      : null
    const medAvvik = samm.filter(s => s.prisantydning_nok && s.faktisk_salgspris_nok)
    const snittAvvik = medAvvik.length
      ? medAvvik.reduce((a, s) => a + ((s.faktisk_salgspris_nok! - s.prisantydning_nok!) / s.prisantydning_nok! * 100), 0) / medAvvik.length
      : null
    if (snittM2 != null || snittAvvik != null) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(90, 97, 113)
      const deler: string[] = []
      if (snittM2 != null) deler.push(`Snitt oppnadd: ${fmtNok(snittM2)}/m2`)
      if (snittAvvik != null) deler.push(`snitt ${snittAvvik >= 0 ? '+' : ''}${snittAvvik.toFixed(1)} % vs antydning`)
      sjekkPlass(6)
      doc.text(deler.join('  -  '), MARG, y); y += 7
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0)
    }
    for (const s of samm) {
      sjekkPlass(13)
      const tittel = s.beskrivelse || s.url || 'Sammenlignbar bolig'
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
      doc.text(doc.splitTextToSize(tittel, INNHOLD_BREDDE)[0] as string, MARG, y); y += 5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 97, 113)
      const detaljer: string[] = []
      if (s.prisantydning_nok) detaljer.push(`Antydning: ${fmtNok(s.prisantydning_nok)}`)
      if (s.faktisk_salgspris_nok) detaljer.push(`Solgt: ${fmtNok(s.faktisk_salgspris_nok)}`)
      if (s.prisantydning_nok && s.faktisk_salgspris_nok) {
        const avvik = (s.faktisk_salgspris_nok - s.prisantydning_nok) / s.prisantydning_nok * 100
        detaljer.push(`${avvik >= 0 ? '+' : ''}${avvik.toFixed(1)} %`)
      }
      if (s.bra_m2) detaljer.push(`${s.bra_m2} m2`)
      if (s.faktisk_salgspris_nok && s.bra_m2) detaljer.push(`${Math.round(s.faktisk_salgspris_nok / s.bra_m2).toLocaleString('nb-NO')} kr/m2`)
      if (detaljer.length) { doc.text(detaljer.join('  -  '), MARG, y); y += 5 }
      if (s.notat) {
        for (const l of doc.splitTextToSize(s.notat, INNHOLD_BREDDE) as string[]) { sjekkPlass(5); doc.text(l, MARG, y); y += 4.5 }
      }
      doc.setTextColor(0, 0, 0)
      y += 2
    }
    y += 4
  }

  // === Notat ===
  if (k.notat) {
    seksjon('Kommentar')
    doc.setFontSize(9)
    const linjer = doc.splitTextToSize(k.notat, INNHOLD_BREDDE) as string[]
    for (const l of linjer) { sjekkPlass(6); doc.text(l, MARG, y); y += 5 }
    y += 4
  }

  // Footer
  const sider = doc.getNumberOfPages()
  for (let s = 1; s <= sider; s++) {
    doc.setPage(s)
    doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(`Lonnsomhetscase  -  ${p.navn}  -  side ${s}/${sider}`, MARG, SIDE_HOYDE - 8)
    doc.text('Estimat basert pa egne forutsetninger - ikke en formell verdivurdering', SIDE_BREDDE - MARG, SIDE_HOYDE - 8, { align: 'right' })
  }

  const ut = doc.output('arraybuffer')
  const base64 = Buffer.from(ut).toString('base64')
  return {
    filnavn: `bankvedlegg_${safeFilnavn(p.navn)}_${new Date().toISOString().slice(0, 10)}.pdf`,
    base64,
  }
}
