// PDF-bygger for off-market due diligence-rapport.
// Sammenstiller offentlige data, AI-vurdering, røde flagg, spørsmålsliste
// til selger, aldersrelaterte risikoer, forhandlingsposisjon og neste steg
// til ett dokument klart for utskrift eller deling med medkjøper/medinvestor.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Prosjekt } from '../types'

const fmtNok = (n: number | undefined | null) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'

type GeonorgeAdresse = {
  adressetekst?: string; postnummer?: string | null; poststed?: string | null
  kommunenavn?: string | null; gardsnummer?: number | null; bruksnummer?: number | null
  lat?: number | null; lon?: number | null
}
type SelgerInfo = { navn?: string; telefon?: string; epost?: string; prisindikasjon_nok?: number; bakgrunn?: string }
type RodtFlagg = { alvorlighet: 'kritisk' | 'advarsel' | 'info'; tittel: string; beskrivelse: string }
type AldersRisiko = { risiko: string; hvordan_sjekke: string; estimat_om_funnet_nok?: number }
type AiAnalyse = {
  ai_oppsummering?: string
  kjop_anbefaling?: 'avstå' | 'forhandle_hardt' | 'ja_med_forbehold' | 'klart_ja'
  verdivurdering?: { lav_nok?: number; sannsynlig_nok?: number; hoy_nok?: number; begrunnelse?: string }
  bilde_vurdering?: { tilstand_samlet?: string; byggear_estimat?: string; kommentar?: string; observerte_risikoer?: string[] }
  rode_flagg?: RodtFlagg[]
  sporsmal_til_selger?: string[]
  sporsmal_til_megler_eller_kommune?: string[]
  aldersrelaterte_risikoer?: AldersRisiko[]
  mangler_i_grunnlag?: string[]
  forhandlingsposisjon?: { anbefalt_maksbud_nok?: number; anbefalt_startbud_nok?: number; begrunnelse?: string; spaker?: string[] }
  neste_steg?: string[]
  sammenlignbare_vurdering?: { antall?: number; gjennomsnitt_m2_pris_nok?: number; kommentar?: string }
}
type OffmarketData = {
  adresse_input?: string
  selger?: SelgerInfo
  innhenting?: { treff?: GeonorgeAdresse[]; valgt?: GeonorgeAdresse | null }
  valgt_treff_idx?: number
  sammenlignbare_data?: Array<{ url: string; tekst: string }>
  ai_analyse?: AiAnalyse
  ai_generert?: string
}

const ANBEFALING_LBL: Record<NonNullable<AiAnalyse['kjop_anbefaling']>, string> = {
  avstå: 'AVSTÅ',
  forhandle_hardt: 'FORHANDLE HARDT',
  ja_med_forbehold: 'JA MED FORBEHOLD',
  klart_ja: 'KLART JA',
}

function safeFilnavn(navn: string): string {
  return navn.replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_').slice(0, 50)
}

export async function byggOffmarketPdf(
  prosjektId: string,
  admin: SupabaseClient,
): Promise<{ filnavn: string; base64: string } | null> {
  const { data: pRad } = await admin.from('prosjekter').select('*').eq('id', prosjektId).single()
  if (!pRad) return null
  const p = pRad as Prosjekt
  if (!p.off_market) return null

  const omd = (p.off_market_data || {}) as OffmarketData
  const ai = omd.ai_analyse || {}
  const treff = (omd.innhenting?.treff || [])[omd.valgt_treff_idx ?? 0] || omd.innhenting?.valgt || null
  const selger = omd.selger || {}

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
  doc.text('Off-market due diligence', MARG, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(p.navn, MARG, 22)
  doc.setFontSize(8); doc.setTextColor(184, 154, 111)
  doc.text('Generert ' + new Date().toLocaleDateString('nb-NO') + ' - Leganger & Osvaag Eiendom', MARG, 30)
  doc.setTextColor(0, 0, 0)
  y = 48

  // Sikre at vi har plass — ellers ny side
  const sjekkPlass = (mer: number) => {
    if (y + mer > SIDE_HOYDE - 20) {
      doc.addPage(); y = 22
    }
  }

  // Seksjons-header
  const seksjon = (tittel: string) => {
    sjekkPlass(16)
    doc.setFillColor(248, 245, 235)
    doc.rect(MARG, y - 5, INNHOLD_BREDDE, 9, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(122, 74, 8)
    doc.text(tittel.toUpperCase(), MARG + 3, y + 1)
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    y += 10
  }

  const tekst = (str: string, opts?: { bold?: boolean; size?: number; farge?: [number, number, number] }) => {
    if (opts?.bold) doc.setFont('helvetica', 'bold')
    if (opts?.size) doc.setFontSize(opts.size)
    if (opts?.farge) doc.setTextColor(...opts.farge)
    const linjer = doc.splitTextToSize(str, INNHOLD_BREDDE) as string[]
    for (const l of linjer) {
      sjekkPlass(6)
      doc.text(l, MARG, y)
      y += 5
    }
    if (opts?.bold) doc.setFont('helvetica', 'normal')
    if (opts?.size) doc.setFontSize(9)
    if (opts?.farge) doc.setTextColor(0, 0, 0)
  }

  const linje = (lbl: string, val: string) => {
    sjekkPlass(6)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text(lbl + ':', MARG, y)
    doc.setFont('helvetica', 'normal')
    const valW = INNHOLD_BREDDE - 50
    const valLinjer = doc.splitTextToSize(val || '–', valW) as string[]
    doc.text(valLinjer[0], MARG + 50, y)
    y += 5
    for (let i = 1; i < valLinjer.length; i++) {
      sjekkPlass(5)
      doc.text(valLinjer[i], MARG + 50, y)
      y += 5
    }
  }

  // === Anbefaling-boks ===
  if (ai.kjop_anbefaling) {
    const lbl = ANBEFALING_LBL[ai.kjop_anbefaling]
    const farge: [number, number, number] =
      ai.kjop_anbefaling === 'avstå' ? [200, 16, 46]
      : ai.kjop_anbefaling === 'forhandle_hardt' ? [176, 94, 10]
      : ai.kjop_anbefaling === 'ja_med_forbehold' ? [184, 154, 111]
      : [45, 125, 70]
    doc.setFillColor(...farge)
    doc.rect(MARG, y, INNHOLD_BREDDE, 14, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text('Anbefaling: ' + lbl, MARG + 4, y + 9)
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    y += 22
  }

  // === Oppsummering ===
  if (ai.ai_oppsummering) {
    seksjon('Oppsummering')
    tekst(ai.ai_oppsummering)
    y += 4
  }

  // === Adresse / matrikkel ===
  seksjon('Adresse og matrikkel')
  if (treff) {
    linje('Adresse', treff.adressetekst || omd.adresse_input || '–')
    linje('Postnr/sted', `${treff.postnummer || '–'} ${treff.poststed || ''}`)
    linje('Kommune', treff.kommunenavn || '–')
    linje('Matrikkel', treff.gardsnummer != null ? `gnr ${treff.gardsnummer}/bnr ${treff.bruksnummer}` : '–')
    linje('Koordinater', treff.lat != null ? `${treff.lat.toFixed(5)}, ${treff.lon?.toFixed(5)}` : '–')
  } else {
    linje('Adresse (input)', omd.adresse_input || '–')
  }
  y += 4

  // === Selger ===
  seksjon('Selger og tilbud')
  linje('Navn', selger.navn || '–')
  linje('Telefon', selger.telefon || '–')
  linje('E-post', selger.epost || '–')
  linje('Prisindikasjon', fmtNok(selger.prisindikasjon_nok))
  if (selger.bakgrunn) { linje('Bakgrunn', selger.bakgrunn) }
  y += 4

  // === Verdivurdering ===
  if (ai.verdivurdering) {
    seksjon('Verdivurdering (AI-estimat)')
    linje('Lav', fmtNok(ai.verdivurdering.lav_nok))
    linje('Sannsynlig', fmtNok(ai.verdivurdering.sannsynlig_nok))
    linje('Høy', fmtNok(ai.verdivurdering.hoy_nok))
    if (ai.verdivurdering.begrunnelse) { y += 2; tekst(ai.verdivurdering.begrunnelse) }
    y += 4
  }

  // === Bilde-vurdering ===
  if (ai.bilde_vurdering && (ai.bilde_vurdering.kommentar || ai.bilde_vurdering.tilstand_samlet)) {
    seksjon('Bilde-vurdering')
    if (ai.bilde_vurdering.tilstand_samlet) linje('Tilstand samlet', ai.bilde_vurdering.tilstand_samlet.replace('_', ' '))
    if (ai.bilde_vurdering.byggear_estimat) linje('Byggeår-estimat', ai.bilde_vurdering.byggear_estimat)
    if (ai.bilde_vurdering.kommentar) { y += 2; tekst(ai.bilde_vurdering.kommentar) }
    if (ai.bilde_vurdering.observerte_risikoer?.length) {
      y += 2; tekst('Observerte risikoer:', { bold: true })
      for (const r of ai.bilde_vurdering.observerte_risikoer) tekst('- ' + r)
    }
    y += 4
  }

  // === Røde flagg ===
  if (ai.rode_flagg?.length) {
    seksjon('Røde flagg')
    for (const f of ai.rode_flagg) {
      const farge: [number, number, number] = f.alvorlighet === 'kritisk' ? [200, 16, 46] : f.alvorlighet === 'advarsel' ? [176, 94, 10] : [90, 97, 113]
      tekst(`[${f.alvorlighet.toUpperCase()}] ${f.tittel}`, { bold: true, farge })
      tekst(f.beskrivelse)
      y += 2
    }
    y += 4
  }

  // === SPØRSMÅL TIL SELGER (hovedinnhold) ===
  if (ai.sporsmal_til_selger?.length) {
    seksjon(`Spørsmål til selger (${ai.sporsmal_til_selger.length})`)
    let i = 1
    for (const s of ai.sporsmal_til_selger) {
      tekst(`${i}. ${s}`)
      y += 1
      i++
    }
    y += 4
  }

  // === Spørsmål til megler/kommune ===
  if (ai.sporsmal_til_megler_eller_kommune?.length) {
    seksjon('Spørsmål til megler eller kommune')
    for (const s of ai.sporsmal_til_megler_eller_kommune) {
      tekst('- ' + s)
    }
    y += 4
  }

  // === Aldersrelaterte risikoer ===
  if (ai.aldersrelaterte_risikoer?.length) {
    seksjon('Aldersrelaterte risikoer')
    for (const r of ai.aldersrelaterte_risikoer) {
      tekst(r.risiko, { bold: true })
      tekst('Sjekk: ' + r.hvordan_sjekke)
      if (r.estimat_om_funnet_nok && r.estimat_om_funnet_nok > 0) {
        tekst('Estimat hvis funnet: ' + fmtNok(r.estimat_om_funnet_nok), { farge: [176, 94, 10] })
      }
      y += 2
    }
    y += 4
  }

  // === Mangler i grunnlaget ===
  if (ai.mangler_i_grunnlag?.length) {
    seksjon('Mangler i grunnlaget')
    for (const m of ai.mangler_i_grunnlag) tekst('- ' + m)
    y += 4
  }

  // === Forhandlingsposisjon ===
  if (ai.forhandlingsposisjon) {
    seksjon('Forhandlingsposisjon')
    if (ai.forhandlingsposisjon.anbefalt_startbud_nok != null) linje('Anbefalt startbud', fmtNok(ai.forhandlingsposisjon.anbefalt_startbud_nok))
    if (ai.forhandlingsposisjon.anbefalt_maksbud_nok != null) linje('Anbefalt maksbud', fmtNok(ai.forhandlingsposisjon.anbefalt_maksbud_nok))
    if (ai.forhandlingsposisjon.begrunnelse) { y += 2; tekst(ai.forhandlingsposisjon.begrunnelse) }
    if (ai.forhandlingsposisjon.spaker?.length) {
      y += 2; tekst('Forhandlingsspaker:', { bold: true })
      for (const s of ai.forhandlingsposisjon.spaker) tekst('- ' + s)
    }
    y += 4
  }

  // === Sammenlignbare salg ===
  if (ai.sammenlignbare_vurdering && (ai.sammenlignbare_vurdering.kommentar || ai.sammenlignbare_vurdering.gjennomsnitt_m2_pris_nok)) {
    seksjon('Sammenlignbare salg')
    if (ai.sammenlignbare_vurdering.antall != null) linje('Antall', String(ai.sammenlignbare_vurdering.antall))
    if (ai.sammenlignbare_vurdering.gjennomsnitt_m2_pris_nok != null) linje('Gj.snitt m²-pris', fmtNok(ai.sammenlignbare_vurdering.gjennomsnitt_m2_pris_nok))
    if (ai.sammenlignbare_vurdering.kommentar) { y += 2; tekst(ai.sammenlignbare_vurdering.kommentar) }
    y += 4
  }

  // === Neste steg ===
  if (ai.neste_steg?.length) {
    seksjon('Neste steg')
    let i = 1
    for (const s of ai.neste_steg) {
      tekst(`${i}. ${s}`)
      i++
    }
    y += 4
  }

  // Footer (samme på alle sider)
  const sider = doc.getNumberOfPages()
  for (let s = 1; s <= sider; s++) {
    doc.setPage(s)
    doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(`Off-market due diligence  -  ${p.navn}  -  side ${s}/${sider}`, MARG, SIDE_HOYDE - 8)
    doc.text('Generert av loeiendom.com - ikke en formell takst eller tilstandsrapport', SIDE_BREDDE - MARG, SIDE_HOYDE - 8, { align: 'right' })
  }

  const ut = doc.output('arraybuffer')
  const base64 = Buffer.from(ut).toString('base64')
  return {
    filnavn: `offmarket_${safeFilnavn(p.navn)}_${new Date().toISOString().slice(0, 10)}.pdf`,
    base64,
  }
}
