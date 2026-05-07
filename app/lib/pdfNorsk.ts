// PDF-bygger for norsk flippe-prospekt. Lagder en pen rapport med
// boligfakta, score, kalkulator-resultater, oppussingsposter, sensitivitet,
// bud-strategi og før/etter-bilder — klar til bankmøte eller co-investor.

import type { Prosjektbilde } from '../types'
import type { supabase as supabaseType } from './supabase'
import {
  regnEffektivKalk, regnEksisterende, regnUtleie, regnUt, regnFinansiering,
  type Kalk as KalkAlias, type EksisterendeBolig, type BoPlan, type UtleieDel,
  type OppussingsPost as OppussingsPostAlias, type Modus,
} from './norskKalkulator'
import { regnBankScore, regnTotalScore, type Husholdning } from './norskBankScore'

type SupabaseKlient = typeof supabaseType

type BildePar = {
  original: Prosjektbilde
  originalBase64: string | null
  generertBase64: string | null
  generertStil: string | null
  kostnadsforslag: number
}

async function urlTilBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

type Beregning = {
  totalKjopspris: number; dokavg: number; kjopskostnader: number; totalKjop: number
  oppussingTotal: number; lanebelop: number; renterTotal: number; fellesutgTotal: number; holdekostnad: number
  totalInvestering: number; meglerhonorar: number; salgskostnader: number; nettoSalg: number
  skattegrunnlag: number; skatt: number; nettoFortjeneste: number; egenkapital: number; roi: number
}

type Kalk = {
  kjopesum: number; fellesgjeld: number; dokumentavgift_pst: number; tinglysing: number
  oppussing_kost: number; mobler_styling: number
  holdetid_mnd: number; rente_pst: number; egenkapital_pst: number; fellesutg_mnd: number
  nedbetalingstid_aar?: number
  salgspris: number; meglerhonorar_pst: number; marknadsforing: number
  skattefri: boolean; skattesats_pst: number
}

type AnalyseLite = {
  tittel?: string
  pris_antydning_nok?: number
  type?: string
  eierform?: string
  by?: string
  bydel?: string
  adresse?: string
  areal_bra?: number
  soverom?: number
  bad?: number
  byggear?: number
  energimerke?: string
  fellesgjeld_nok?: number
  fellesutgifter_mnd_nok?: number
  markedspris_nasitt_m2_nok?: number
  markedspris_bra_m2_nok?: number
  markedspris_topp_m2_nok?: number
  markedspris_begrunnelse?: string
  oppussing_vurdering?: string
  ai_vurdering?: string
  anbefalt_strategi?: string
  score?: {
    lokasjon?: number; eiendomsstand?: number; pris_vs_marked?: number
    oppussingspotensial?: number; risiko?: number; total?: number
    lys?: string; lys_tekst?: string; tips?: string[]
  }
  bud_strategi?: {
    anbefalt_startbud_nok?: number
    anbefalt_maks_bud_nok?: number
    maks_bud_pst_av_prisantydning?: number
    begrunnelse?: string
  }
}

type OppussingsPost = { navn: string; kostnad: number; notat: string }

type MeglerVurdering = {
  navn: string; firma: string; telefon: string; epost: string
  verdi_nok: number; dato: string; notat: string
}

type TotalScore = {
  flippeScore: number; harFlippeScore: boolean
  bankScore: number; harBankScore: boolean
  meglerSnitt: number; meglerRealisme: number; avvikPst: number; harMeglerSnitt: boolean; antallMeglere: number
  total: number; lys: string; lysTekst: string
}

type BoFlipp = {
  eksisterende: {
    modus?: 'selg' | 'behold'
    salgssum: number; restgjeld: number
    meglerhonorar_pst: number; marknadsforing: number; skattefri: boolean
    // Behold-felter
    verdi_naa?: number
    opprinnelig_kjopspris?: number
    mnd_lan_betaling?: number
    rente_pst_gammel?: number
    utleie_horisont_aar?: number
    utleie_mnd_brutto?: number
    utleie_belegg_pst?: number
    utleie_drift_pst?: number
    utleie_skattepliktig?: boolean
    arlig_prisvekst_pst?: number
  }
  netto: { meglerhonorar: number; salgskostnader: number; skatt: number; nettoTilDisposisjon: number
    // Behold-beregninger
    brutto_leie_mnd?: number; drift_mnd?: number; skatt_leie_mnd?: number; netto_leie_mnd?: number
    netto_belastning_mnd?: number; verdi_etter_horisont?: number; verdiokning_total?: number
    leie_total?: number; horisont_aar?: number
    sum_paakostninger?: number; inngangsverdi?: number
    fremtidig_skatt?: number; fremtidig_skatt_uten_paakost?: number; skatt_spart_paakost?: number
    sum_vedlikehold_i_horisont?: number; vedlikehold_fradrag_per_mnd?: number
  }
  finansiering: {
    totalUtlegg: number; tilgjengeligEK: number; lanebehov: number
    overskudd: number; belaningsgrad: number; mndBetaling: number
  }
  utleie?: {
    aktiv: boolean
    leie_mnd: number; belegg_pst: number; drift_pst: number
    etableringskost: number; skattefri: boolean
    brutto_mnd: number; netto_mnd: number
    brutto_total: number; netto_total: number; skatt: number
    nettoBidrag: number
  }
  // Tidligere kostnader på boligen — påkostninger og vedlikehold
  paakostninger?: Array<{ beskrivelse: string; aar: number; belop: number; type?: 'paakostning' | 'vedlikehold' }>
  // Sammenligning selg vs behold
  sammenligning?: {
    selgFrigjort: number; beholdVerdivekst: number; beholdAvdragSum: number
    beholdNettoLeie: number; beholdEkstraRente: number; beholdEKGammel: number
    beholdTotalt: number; selgTotalt: number; differanse: number
    anbefaling: 'behold' | 'selg' | 'likt'; aar: number
  }
}

type BankVurdering = {
  inntekter: Array<{ beskrivelse: string; belop_mnd: number }>
  antallVoksne: number; antallBarn: number
  andreLan: Array<{ beskrivelse: string; type: string; saldo: number; mnd_betaling: number }>
  sumInntektMnd: number; sumInntektAr: number; utleieMnd: number; totalInntektMnd: number
  skatt_anslag_mnd: number; netto_inntekt_mnd: number
  annenSikkerhetNetto: number
  annenSikkerhet?: { aktiv: boolean; verdi: number; lan: number; beskrivelse: string }
  lanebehov: number; mndBetaling: number; nettoMndBetaling: number
  andreLanSum: number; andreLanMndSum: number; totalGjeld: number; totalMndBetjening: number
  livsopphold: number; disponibelEtterAlt: number
  gjeldsgrad: number; gjeldsgradScore: number
  belaningsgrad: number; belaningsgradScore: number
  betjeningRatio: number; betjeningScore: number
  stressMnd: number; stressNettoMnd: number; stressTotalMnd: number; stressDisponibel: number; stressScore: number
  total: number; lys: string; lysTekst: string
}

const NOK = (n: number) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '-'
const PCT = (n: number) => n.toFixed(1) + ' %'

// Strukturert takst-analyse fra Claude — speiler TakstData-typen i UI
export type TakstPdfData = {
  vurdert_markedsverdi_nok?: number
  laneverdi_nok?: number
  byggear?: number
  areal_bra_m2?: number
  energimerke?: string
  eierform?: string
  tilstandsgrader?: Array<{ del: string; tg: 0 | 1 | 2 | 3; kommentar?: string; estimat_nok?: number }>
  rode_flagg?: Array<{ alvorlighet: 'kritisk' | 'advarsel' | 'info'; tittel: string; beskrivelse: string }>
  anbefalte_oppussingsposter?: Array<{ navn: string; kostnad_estimat_nok: number; begrunnelse: string; prioritet?: 'hast' | 'normal' | 'lav' }>
  forhandlingsvurdering?: {
    anbefalt_avvik_pst?: number
    anbefalt_avvik_kr?: number
    begrunnelse?: string
    forhandlingsspaker?: string[]
  }
  mangler_i_rapporten?: Array<{ punkt: string; hvorfor_viktig: string }>
  aldersrelaterte_risikoer?: Array<{ risiko: string; hvordan_sjekke: string; estimat_om_funnet_nok?: number }>
  sporsmal_til_megler?: string[]
  takst_kvalitet?: { grundighet?: string; kommentar?: string }
  samlet_oppussingsbehov?: { minimum_nok?: number; realistisk_nok?: number; maksimum_nok?: number }
  ai_oppsummering?: string
  filnavn?: string
}

export async function byggNorskFlippePdf(args: {
  analyse: AnalyseLite
  kalk: Kalk
  beregning: Beregning
  oppussingsposter: OppussingsPost[]
  boFlipp?: BoFlipp | null
  bankVurdering?: BankVurdering | null
  meglerVurderinger?: MeglerVurdering[]
  totalScore?: TotalScore | null
  takst?: TakstPdfData | null          // strukturert takst-analyse (PDF dropper egen seksjon)
  finnUrl?: string                     // Finn-lenke til annonsen
  prosjektId?: string                  // hvis satt: hent bilder fra Supabase
  supabaseKlient?: SupabaseKlient      // valgfri — kun nødvendig hvis prosjektId er satt
}): Promise<{ base64: string; filnavn: string }> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const a = args.analyse
  const k = args.kalk
  const b = args.beregning

  // === HEADER ===
  doc.setFillColor(14, 23, 38)
  doc.rect(0, 0, 210, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('Leganger & Osvaag Eiendom', 20, 15)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  const overskrift = args.boFlipp ? 'Bo-og-flipp-prospekt' : 'Norsk flippe-prospekt'
  doc.text(overskrift + ' — ' + (a.tittel || a.adresse || 'Bolig'), 20, 24)
  doc.setFontSize(9)
  doc.text('Generert ' + new Date().toLocaleDateString('nb-NO') + (a.eierform ? '  |  ' + a.eierform : '') + (a.type ? '  |  ' + a.type : ''), 20, 31)

  doc.setTextColor(0, 0, 0)
  let y = 46

  const sjekk = (plass = 10) => { if (y + plass > 275) { doc.addPage(); y = 20 } }

  // === TOTAL PROSJEKTSCORE — øverst som executive summary for banken ===
  if (args.totalScore && args.totalScore.total > 0) {
    const ts = args.totalScore
    const lysFarge: [number, number, number] =
      ts.lys.includes('🟢') ? [45, 125, 70] : ts.lys.includes('🔴') ? [200, 16, 46] : [176, 94, 10]
    sjekk(44)
    doc.setFillColor(lysFarge[0], lysFarge[1], lysFarge[2])
    doc.rect(15, y, 180, 32, 'F')

    // Score til høyre — stort tall plassert separat for å unngå overlapp
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(28)
    doc.text(`${ts.total}/100`, 188, y + 21, { align: 'right' })

    // Tittel + statustekst på venstre side, kuttet ved 130mm så det ikke krasjer
    doc.setFontSize(10)
    doc.text('TOTAL PROSJEKTSCORE', 20, y + 9)
    doc.setFontSize(12)
    const lysLinjer = doc.splitTextToSize(ts.lysTekst, 120)
    doc.text(lysLinjer, 20, y + 19)
    y += 36

    doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    const subscores: string[] = []
    if (ts.harFlippeScore) subscores.push(`Flippe-potensial: ${(ts.flippeScore / 10).toFixed(1)}/10`)
    if (ts.harBankScore) subscores.push(`Bank: ${ts.bankScore}/100`)
    if (ts.harMeglerSnitt) subscores.push(`Markeds-realisme: ${ts.meglerRealisme}/100 (${ts.antallMeglere} megler${ts.antallMeglere > 1 ? 'e' : ''}, avvik ${ts.avvikPst.toFixed(1)} %)`)
    if (subscores.length > 0) {
      doc.setTextColor(80, 80, 80)
      doc.text('Underliggende: ' + subscores.join('   |   '), 20, y); y += 8
    }
    y += 4
  }

  const seksjon = (tittel: string) => {
    sjekk(20)
    doc.setFillColor(240, 237, 228)
    doc.rect(15, y, 180, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(14, 23, 38)
    doc.text(tittel, 20, y + 5.5)
    y += 12
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60)
  }

  const rad = (lbl: string, val: string, i: number, bold = false) => {
    sjekk(8)
    if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(lbl, 20, y + 2)
    doc.text(val, 190, y + 2, { align: 'right' })
    y += 7
    doc.setFont('helvetica', 'normal')
  }

  const avsnitt = (tekst: string) => {
    if (!tekst) return
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60)
    const linjer = doc.splitTextToSize(tekst, 175)
    linjer.forEach((l: string) => { sjekk(6); doc.text(l, 20, y); y += 5 })
    y += 2
  }

  // === BOLIGFAKTA ===
  seksjon('BOLIGFAKTA')
  const fakta: Array<[string, string]> = []
  if (a.type) fakta.push(['Type', a.type])
  if (a.eierform) fakta.push(['Eierform', a.eierform])
  if (a.adresse) fakta.push(['Adresse', a.adresse])
  if (a.bydel || a.by) fakta.push(['Beliggenhet', [a.bydel, a.by].filter(Boolean).join(', ')])
  if (a.areal_bra) fakta.push(['BRA', a.areal_bra + ' m²'])
  if (a.soverom) fakta.push(['Soverom', String(a.soverom)])
  if (a.bad) fakta.push(['Bad', String(a.bad)])
  if (a.byggear) fakta.push(['Byggeår', String(a.byggear)])
  if (a.energimerke) fakta.push(['Energimerke', a.energimerke])
  if (a.fellesgjeld_nok) fakta.push(['Fellesgjeld', NOK(a.fellesgjeld_nok)])
  if (a.fellesutgifter_mnd_nok) fakta.push(['Fellesutg./mnd', NOK(a.fellesutgifter_mnd_nok)])
  if (a.pris_antydning_nok) fakta.push(['Prisantydning', NOK(a.pris_antydning_nok)])
  fakta.forEach(([l, v], i) => rad(l, v, i, l === 'Prisantydning'))
  y += 4

  // Finn-lenke som klikkbar referanse — nyttig for banken å verifisere annonsen
  if (args.finnUrl) {
    sjekk(12)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
    doc.text('Kilde:', 20, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(24, 95, 165)
    doc.textWithLink(args.finnUrl, 35, y, { url: args.finnUrl })
    y += 8
    doc.setTextColor(60, 60, 60)
  }

  // === MARKEDSANALYSE ===
  if (a.markedspris_begrunnelse || a.markedspris_bra_m2_nok) {
    seksjon('MARKEDSANALYSE')
    if (a.markedspris_begrunnelse) avsnitt(a.markedspris_begrunnelse)
    if (a.markedspris_nasitt_m2_nok) rad('Som er nå (per m²)', NOK(a.markedspris_nasitt_m2_nok), 0)
    if (a.markedspris_bra_m2_nok) rad('Bra standard (per m²)', NOK(a.markedspris_bra_m2_nok), 1)
    if (a.markedspris_topp_m2_nok) rad('Toppstand (per m²)', NOK(a.markedspris_topp_m2_nok), 2)
    y += 4
  }

  // === TAKSTRAPPORT-ANALYSE ===
  // Vises hvis brukeren har lastet opp en takst og kjørt AI-analyse på den.
  // Tar med oppsummering, nøkkeltall, røde flagg, TG-funn, forhandlingsspak,
  // anbefalte oppussingsposter, mangler i rapporten, aldersrisikoer og
  // spørsmål til megler — alt i kompakt form for bank/kjøperdokumentasjon.
  if (args.takst && (args.takst.ai_oppsummering || args.takst.tilstandsgrader?.length || args.takst.rode_flagg?.length)) {
    const t = args.takst
    sjekk(20)
    seksjon('TAKSTRAPPORT-ANALYSE' + (t.filnavn ? ` (${t.filnavn})` : ''))

    if (t.ai_oppsummering) {
      avsnitt(t.ai_oppsummering)
      y += 2
    }

    // Nøkkelfakta-rad
    let i = 0
    if (typeof t.vurdert_markedsverdi_nok === 'number' && t.vurdert_markedsverdi_nok > 0) {
      rad('Vurdert markedsverdi (takst)', NOK(t.vurdert_markedsverdi_nok), i++, true)
    }
    if (typeof t.laneverdi_nok === 'number' && t.laneverdi_nok > 0) {
      rad('Låneverdi', NOK(t.laneverdi_nok), i++)
    }
    if (t.byggear) rad('Byggeår', String(t.byggear), i++)
    if (t.areal_bra_m2) rad('Bruksareal', `${t.areal_bra_m2} m²`, i++)
    if (t.energimerke) rad('Energimerke', t.energimerke, i++)
    if (t.eierform) rad('Eierform', t.eierform, i++)
    if (i > 0) y += 4

    // Forhandlingsvurdering
    if (t.forhandlingsvurdering && (t.forhandlingsvurdering.anbefalt_avvik_kr || t.forhandlingsvurdering.begrunnelse)) {
      const fv = t.forhandlingsvurdering
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(122, 74, 8)
      doc.text('FORHANDLINGSPOSISJON', 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60)
      if (typeof fv.anbefalt_avvik_pst === 'number' || typeof fv.anbefalt_avvik_kr === 'number') {
        const deler: string[] = []
        if (typeof fv.anbefalt_avvik_pst === 'number') deler.push(`${fv.anbefalt_avvik_pst > 0 ? '+' : ''}${fv.anbefalt_avvik_pst.toFixed(1)}%`)
        if (typeof fv.anbefalt_avvik_kr === 'number') deler.push(NOK(fv.anbefalt_avvik_kr))
        rad('Anbefalt avvik fra prisantydning', deler.join('  /  '), 0, true)
      }
      if (fv.begrunnelse) avsnitt(fv.begrunnelse)
      if (fv.forhandlingsspaker && fv.forhandlingsspaker.length > 0) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        sjekk(6)
        doc.text('Forhandlingsspaker:', 20, y); y += 5
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
        for (const s of fv.forhandlingsspaker) {
          const linjer = doc.splitTextToSize('• ' + s, 170)
          for (const l of linjer as string[]) { sjekk(5); doc.text(l, 22, y); y += 4.5 }
        }
        y += 3
      }
    }

    // Røde flagg
    if (t.rode_flagg && t.rode_flagg.length > 0) {
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(122, 12, 30)
      doc.text(`VIKTIGE FORHOLD (${t.rode_flagg.length})`, 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
      for (const rf of t.rode_flagg) {
        sjekk(10)
        const merke = rf.alvorlighet === 'kritisk' ? '[KRITISK]' : rf.alvorlighet === 'advarsel' ? '[ADVARSEL]' : '[INFO]'
        doc.setFont('helvetica', 'bold')
        doc.text(`${merke} ${rf.tittel}`, 20, y); y += 5
        doc.setFont('helvetica', 'normal')
        const linjer = doc.splitTextToSize(rf.beskrivelse, 170)
        for (const l of linjer as string[]) { sjekk(4.5); doc.text(l, 22, y); y += 4.5 }
        y += 2
      }
    }

    // Tilstandsgrader
    if (t.tilstandsgrader && t.tilstandsgrader.length > 0) {
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text(`TILSTANDSGRADER (${t.tilstandsgrader.length})`, 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
      t.tilstandsgrader.forEach((tg, idx) => {
        sjekk(7)
        if (idx % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 6.5, 'F') }
        doc.setFont('helvetica', 'bold')
        doc.text(`TG${tg.tg}`, 20, y + 1.5)
        doc.setFont('helvetica', 'normal')
        doc.text(tg.del, 36, y + 1.5)
        if (typeof tg.estimat_nok === 'number' && tg.estimat_nok > 0) {
          doc.text(NOK(tg.estimat_nok), 188, y + 1.5, { align: 'right' })
        }
        y += 6.5
        if (tg.kommentar) {
          doc.setTextColor(110, 110, 110)
          const linjer = doc.splitTextToSize(tg.kommentar, 165)
          for (const l of linjer as string[]) { sjekk(4); doc.text(l, 36, y); y += 4 }
          doc.setTextColor(60, 60, 60)
        }
      })
      y += 4
    }

    // Samlet oppussingsbehov
    if (t.samlet_oppussingsbehov && (t.samlet_oppussingsbehov.minimum_nok || t.samlet_oppussingsbehov.realistisk_nok)) {
      const sob = t.samlet_oppussingsbehov
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text('SAMLET OPPUSSINGSBEHOV', 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60)
      if (typeof sob.minimum_nok === 'number') rad('Minimum (kun kritisk)', NOK(sob.minimum_nok), 0)
      if (typeof sob.realistisk_nok === 'number') rad('Realistisk (+ buffer)', NOK(sob.realistisk_nok), 1, true)
      if (typeof sob.maksimum_nok === 'number') rad('Maks (worst case)', NOK(sob.maksimum_nok), 2)
      y += 4
    }

    // Anbefalte oppussingsposter (fra takst — separat fra kalkulator)
    if (t.anbefalte_oppussingsposter && t.anbefalte_oppussingsposter.length > 0) {
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text(`ANBEFALTE OPPUSSINGSPOSTER FRA TAKST (${t.anbefalte_oppussingsposter.length})`, 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
      t.anbefalte_oppussingsposter.forEach((p, idx) => {
        sjekk(7)
        if (idx % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 6.5, 'F') }
        doc.setFont('helvetica', 'bold')
        const navn = p.prioritet === 'hast' ? `[HAST] ${p.navn}` : p.navn
        doc.text(navn, 20, y + 1.5)
        doc.text(NOK(p.kostnad_estimat_nok), 188, y + 1.5, { align: 'right' })
        y += 6.5
        if (p.begrunnelse) {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(110, 110, 110)
          const linjer = doc.splitTextToSize(p.begrunnelse, 165)
          for (const l of linjer as string[]) { sjekk(4); doc.text(l, 22, y); y += 4 }
          doc.setTextColor(60, 60, 60)
        }
      })
      y += 4
    }

    // Mangler i rapporten
    if (t.mangler_i_rapporten && t.mangler_i_rapporten.length > 0) {
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text(`MANGLER I RAPPORTEN (${t.mangler_i_rapporten.length})`, 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
      for (const m of t.mangler_i_rapporten) {
        sjekk(8)
        doc.setFont('helvetica', 'bold'); doc.text(m.punkt, 20, y); y += 4.5
        doc.setFont('helvetica', 'normal')
        const linjer = doc.splitTextToSize(m.hvorfor_viktig, 170)
        for (const l of linjer as string[]) { sjekk(4); doc.text(l, 22, y); y += 4 }
        y += 2
      }
    }

    // Aldersrelaterte risikoer
    if (t.aldersrelaterte_risikoer && t.aldersrelaterte_risikoer.length > 0) {
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text(`ALDERSRELATERTE RISIKOER${t.byggear ? ` (bygg ${t.byggear})` : ''}`, 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
      for (const r of t.aldersrelaterte_risikoer) {
        sjekk(8)
        doc.setFont('helvetica', 'bold')
        const ekstra = typeof r.estimat_om_funnet_nok === 'number' && r.estimat_om_funnet_nok > 0 ? `  (+${NOK(r.estimat_om_funnet_nok)} hvis funnet)` : ''
        doc.text(r.risiko + ekstra, 20, y); y += 4.5
        doc.setFont('helvetica', 'normal')
        const linjer = doc.splitTextToSize(r.hvordan_sjekke, 170)
        for (const l of linjer as string[]) { sjekk(4); doc.text(l, 22, y); y += 4 }
        y += 2
      }
    }

    // Spørsmål til megler
    if (t.sporsmal_til_megler && t.sporsmal_til_megler.length > 0) {
      sjekk(16)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text(`SPØRSMÅL TIL MEGLER / SELGER (${t.sporsmal_til_megler.length})`, 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
      t.sporsmal_til_megler.forEach((s, idx) => {
        const linjer = doc.splitTextToSize(`${idx + 1}. ${s}`, 170)
        for (const l of linjer as string[]) { sjekk(4.5); doc.text(l, 20, y); y += 4.5 }
        y += 1
      })
      y += 3
    }

    // Vurdering av takstrapporten
    if (t.takst_kvalitet?.kommentar) {
      sjekk(10)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      const grad = t.takst_kvalitet.grundighet ? ` [${t.takst_kvalitet.grundighet}]` : ''
      doc.text(`VURDERING AV TAKSTRAPPORTEN${grad}`, 20, y); y += 5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110)
      const linjer = doc.splitTextToSize(t.takst_kvalitet.kommentar, 170)
      for (const l of linjer as string[]) { sjekk(4); doc.text(l, 20, y); y += 4 }
      y += 4
      doc.setTextColor(60, 60, 60)
    }
  }

  // === SCORE ===
  if (a.score) {
    seksjon('FLIPPE-SCORE')
    const lys = a.score.lys || ''
    const farge: [number, number, number] =
      lys.includes('🟢') ? [45, 125, 70] : lys.includes('🔴') ? [200, 16, 46] : [176, 94, 10]
    sjekk(16)
    doc.setFillColor(farge[0], farge[1], farge[2])
    doc.rect(15, y, 180, 14, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text((a.score.lys_tekst || '') + '   —   ' + (a.score.total ?? 0).toFixed(1) + '/10', 20, y + 9)
    y += 18
    doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)

    const delkar: Array<[string, number | undefined]> = [
      ['Lokasjon', a.score.lokasjon],
      ['Eiendomsstand', a.score.eiendomsstand],
      ['Pris vs marked', a.score.pris_vs_marked],
      ['Oppussings-potensial', a.score.oppussingspotensial],
      ['Risiko (10 = lav)', a.score.risiko],
    ]
    delkar.forEach(([l, v], i) => rad(l, (v ?? '–') + ' / 10', i))
    y += 2

    if (a.score.tips && a.score.tips.length > 0) {
      sjekk(20)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text('Hva må til for bedre score:', 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
      a.score.tips.forEach(tip => {
        const linjer = doc.splitTextToSize('• ' + tip, 170)
        linjer.forEach((l: string) => { sjekk(6); doc.text(l, 22, y); y += 5 })
      })
      y += 4
    }
  }

  // === BUD-STRATEGI ===
  if (a.bud_strategi) {
    seksjon('BUD-STRATEGI')
    if (a.bud_strategi.anbefalt_startbud_nok) rad('Anbefalt startbud', NOK(a.bud_strategi.anbefalt_startbud_nok), 0, true)
    if (a.bud_strategi.anbefalt_maks_bud_nok) rad('Anbefalt maks-bud', NOK(a.bud_strategi.anbefalt_maks_bud_nok), 1, true)
    if (a.bud_strategi.maks_bud_pst_av_prisantydning) rad('Maks i % av prisantydning', a.bud_strategi.maks_bud_pst_av_prisantydning + ' %', 2)
    if (a.bud_strategi.begrunnelse) { y += 2; avsnitt(a.bud_strategi.begrunnelse) }
  }

  // === OPPUSSINGSPOSTER ===
  if (args.oppussingsposter && args.oppussingsposter.length > 0) {
    seksjon('OPPUSSINGSBUDSJETT')
    args.oppussingsposter.forEach((p, i) => rad(p.navn || ('Post ' + (i + 1)), NOK(p.kostnad || 0), i))
    rad('Sum oppussing', NOK(args.oppussingsposter.reduce((s, p) => s + (p.kostnad || 0), 0)), args.oppussingsposter.length, true)
    y += 4
  }

  // === BO-FLIPP: SALG AV EGEN BOLIG / BEHOLD OG LEIE UT + FINANSIERING ===
  if (args.boFlipp) {
    const bf = args.boFlipp
    const erBehold = bf.eksisterende.modus === 'behold'

    if (erBehold) {
      // === BEHOLD-MODUS ===
      seksjon('EKSISTERENDE BOLIG — BEHOLDES OG LEIES UT')
      rad('Markedsverdi i dag', NOK(bf.eksisterende.verdi_naa || 0), 0)
      if (bf.eksisterende.opprinnelig_kjopspris) rad('Opprinnelig kjøpspris', NOK(bf.eksisterende.opprinnelig_kjopspris), 1)
      rad('Restgjeld på lån', NOK(bf.eksisterende.restgjeld), 2)
      rad('Mnd-betaling lån (renter+avdrag)', NOK(bf.eksisterende.mnd_lan_betaling || 0), 3)
      rad('Rente på gammelt lån', PCT(bf.eksisterende.rente_pst_gammel || 0), 4)
      rad('Forventet leie/mnd (brutto)', NOK(bf.eksisterende.utleie_mnd_brutto || 0), 5)
      rad('Belegg', PCT(bf.eksisterende.utleie_belegg_pst || 0), 6)
      rad('Drift', PCT(bf.eksisterende.utleie_drift_pst || 0), 7)
      rad('Utleie-horisont', (bf.eksisterende.utleie_horisont_aar || 0) + ' år', 8)
      rad('Forventet årlig prisvekst', PCT(bf.eksisterende.arlig_prisvekst_pst || 0), 9)
      y += 4

      // Månedlig cashflow
      seksjon('MÅNEDLIG CASHFLOW PÅ EKSISTERENDE BOLIG')
      rad(`Brutto leie (${bf.eksisterende.utleie_belegg_pst} % belegg)`, NOK(bf.netto.brutto_leie_mnd || 0), 0)
      rad(`Drift (${bf.eksisterende.utleie_drift_pst} %)`, '- ' + NOK(bf.netto.drift_mnd || 0), 1)
      if (bf.netto.vedlikehold_fradrag_per_mnd && bf.netto.vedlikehold_fradrag_per_mnd > 0) {
        rad('Vedlikehold (skattefradrag)', '- ' + NOK(bf.netto.vedlikehold_fradrag_per_mnd), 2)
      }
      if (bf.netto.skatt_leie_mnd && bf.netto.skatt_leie_mnd > 0) {
        rad('Skatt på netto leie (22 %)', '- ' + NOK(bf.netto.skatt_leie_mnd), 3)
      } else {
        rad('Skatt', 'Skattefri', 3)
      }
      rad('Netto leieinntekt', NOK(bf.netto.netto_leie_mnd || 0), 4, true)
      rad('Mnd-betaling lån', '- ' + NOK(bf.eksisterende.mnd_lan_betaling || 0), 5)
      const nettoCash = (bf.netto.netto_leie_mnd || 0) - (bf.eksisterende.mnd_lan_betaling || 0)
      rad('Netto cashflow / mnd', (nettoCash >= 0 ? '+ ' : '- ') + NOK(Math.abs(nettoCash)), 6, true)
      y += 4

      // Over horisonten
      const horisont_aar = bf.netto.horisont_aar || bf.eksisterende.utleie_horisont_aar || 0
      seksjon(`OVER UTLEIE-HORISONT (${horisont_aar} ÅR)`)
      rad('Verdi-vekst (boligen øker)', '+ ' + NOK(bf.netto.verdiokning_total || 0), 0)
      rad('Netto leieinntekt totalt', '+ ' + NOK(bf.netto.leie_total || 0), 1)
      rad(`Verdi etter ${horisont_aar} år`, NOK(bf.netto.verdi_etter_horisont || 0), 2, true)
      y += 4

      // Påkostninger og vedlikehold
      if (bf.paakostninger && bf.paakostninger.length > 0) {
        const paakost = bf.paakostninger.filter(p => (p.type ?? 'paakostning') === 'paakostning')
        const vedlikehold = bf.paakostninger.filter(p => p.type === 'vedlikehold')

        if (paakost.length > 0) {
          seksjon('PÅKOSTNINGER (ØKER INNGANGSVERDI)')
          paakost.forEach((p, i) => rad(`${p.beskrivelse} (${p.aar})`, NOK(p.belop), i))
          rad('Sum påkostninger', NOK(bf.netto.sum_paakostninger || 0), paakost.length, true)
          if (bf.eksisterende.opprinnelig_kjopspris) {
            rad('+ Opprinnelig kjøpspris', NOK(bf.eksisterende.opprinnelig_kjopspris), paakost.length + 1)
            rad('= Inngangsverdi (skattegrunnlag)', NOK(bf.netto.inngangsverdi || 0), paakost.length + 2, true)
          }
          if (bf.netto.skatt_spart_paakost && bf.netto.skatt_spart_paakost > 0) {
            rad(`Sparet kapitalgevinst-skatt ved fremtidig salg`, NOK(bf.netto.skatt_spart_paakost), paakost.length + 3, true)
          }
          y += 4
        }

        if (vedlikehold.length > 0) {
          seksjon('VEDLIKEHOLD (FRADRAG MOT LEIEINNTEKT)')
          vedlikehold.forEach((p, i) => rad(`${p.beskrivelse} (${p.aar})`, NOK(p.belop), i))
          if (bf.netto.sum_vedlikehold_i_horisont && bf.netto.sum_vedlikehold_i_horisont > 0) {
            rad('Sum vedlikehold i utleie-horisont', NOK(bf.netto.sum_vedlikehold_i_horisont), vedlikehold.length, true)
            rad('Sparet skatt på leieinntekt (22 %)', NOK(bf.netto.sum_vedlikehold_i_horisont * 0.22), vedlikehold.length + 1, true)
          }
          y += 4
        }
      }
    } else {
      // === SELG-MODUS ===
      seksjon('SALG AV EKSISTERENDE BOLIG')
      rad('Forventet salgssum', NOK(bf.eksisterende.salgssum), 0)
      rad(`Meglerhonorar (${bf.eksisterende.meglerhonorar_pst} %)`, '- ' + NOK(bf.netto.meglerhonorar), 1)
      rad('Markedsføring/takst', '- ' + NOK(bf.eksisterende.marknadsforing), 2)
      rad('Restgjeld på lån', '- ' + NOK(bf.eksisterende.restgjeld), 3)
      if (!bf.eksisterende.skattefri && bf.netto.skatt > 0) {
        rad('Skatt (22 %)', '- ' + NOK(bf.netto.skatt), 4)
      } else {
        rad('Skatt', 'Skattefri (botid)', 4)
      }
      rad('Netto til disposisjon', NOK(bf.netto.nettoTilDisposisjon), 5, true)
      y += 4
    }

    seksjon('FINANSIERING & LÅNEBEHOV')
    rad('Totalt utlegg (kjøp + oppussing + møblering)', NOK(bf.finansiering.totalUtlegg), 0)
    rad('Tilgjengelig EK fra salg av eget hjem', '- ' + NOK(bf.finansiering.tilgjengeligEK), 1)
    rad('Lånebehov', NOK(bf.finansiering.lanebehov), 2, true)
    if (bf.finansiering.overskudd > 0) {
      rad('Overskudd egenkapital (fri kapital)', NOK(bf.finansiering.overskudd), 3)
    }
    rad('Belåningsgrad', PCT(bf.finansiering.belaningsgrad), 4, true)
    rad(`Mnd-betaling (annuitet 25 år, ${k.rente_pst} %)`, NOK(bf.finansiering.mndBetaling), 5, true)
    if (bf.utleie?.aktiv && bf.utleie.netto_mnd > 0) {
      rad('Netto leieinntekt fra utleiedel', '- ' + NOK(bf.utleie.netto_mnd), 6)
      rad('Reell mnd-kostnad (etter leieinntekt)', NOK(bf.finansiering.mndBetaling - bf.utleie.netto_mnd), 7, true)
    }
    y += 4

    if (bf.utleie?.aktiv && bf.utleie.brutto_total > 0) {
      seksjon('UTLEIE-DEL OVER BO-TIDEN')
      rad(`Leie pr. mnd (estimat)`, NOK(bf.utleie.leie_mnd), 0)
      rad(`Belegg`, PCT(bf.utleie.belegg_pst), 1)
      rad(`Effektiv brutto leie over bo-tiden`, NOK(bf.utleie.brutto_total), 2)
      rad(`Drift (${bf.utleie.drift_pst} %)`, '- ' + NOK(bf.utleie.brutto_total * (bf.utleie.drift_pst / 100)), 3)
      if (bf.utleie.skatt > 0) {
        rad('Skatt (22 %)', '- ' + NOK(bf.utleie.skatt), 4)
      } else {
        rad('Skatt', 'Skattefri (utleiedel < 50 %)', 4)
      }
      rad('Etableringskost (engang)', '- ' + NOK(bf.utleie.etableringskost), 5)
      rad('Bidrag til total fortjeneste', NOK(bf.utleie.nettoBidrag), 6, true)
      y += 4
    }

    // === SAMMENLIGNING SELG vs BEHOLD ===
    if (bf.sammenligning) {
      const s = bf.sammenligning
      seksjon(`SAMMENLIGNING — SELG VS BEHOLD OVER ${s.aar.toFixed(0)} ÅR`)
      rad('SELG-scenario: netto frigjort til ny bolig', NOK(s.selgTotalt), 0, true)
      rad('BEHOLD-scenario: total formue-bidrag', NOK(s.beholdTotalt), 1, true)
      y += 2

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text('Behold — slik bygges formuen:', 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
      rad('+ Verdivekst på gammel bolig', '+ ' + NOK(s.beholdVerdivekst), 0)
      rad('+ Nedbetaling av lån (avdrag)', '+ ' + NOK(s.beholdAvdragSum), 1)
      rad('+ Netto leieinntekt totalt', '+ ' + NOK(s.beholdNettoLeie), 2)
      rad('- Ekstra rentekostnad på ny bolig', '- ' + NOK(s.beholdEkstraRente), 3)
      rad('= Netto formue-bidrag', NOK(s.beholdTotalt), 4, true)
      rad(`EK i gammel bolig om ${s.aar.toFixed(0)} år`, NOK(s.beholdEKGammel), 5)
      y += 4

      // Anbefaling
      sjekk(16)
      const anbFarge: [number, number, number] = s.anbefaling === 'behold' ? [45, 125, 70]
        : s.anbefaling === 'selg' ? [184, 154, 111] : [120, 120, 120]
      doc.setFillColor(anbFarge[0], anbFarge[1], anbFarge[2])
      doc.rect(15, y, 180, 12, 'F')
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
      let anbTekst = ''
      if (s.anbefaling === 'behold') anbTekst = `Behold lonner seg med + ${NOK(s.differanse)} over ${s.aar.toFixed(1)} ar`
      else if (s.anbefaling === 'selg') anbTekst = `Selg lonner seg - behold-scenariet gir ${NOK(s.differanse)} mindre`
      else anbTekst = 'Tilnaermet likt - andre faktorer (risiko, fleksibilitet) blir avgjorende'
      doc.text(anbTekst, 20, y + 8)
      y += 16
    }
  }

  // === KALKULATOR ===
  seksjon('KJØP')
  rad('Kjøpesum', NOK(k.kjopesum), 0)
  if (k.fellesgjeld) rad('Fellesgjeld', NOK(k.fellesgjeld), 1)
  rad(`Dokumentavgift (${k.dokumentavgift_pst} %)`, NOK(b.dokavg), 2)
  rad('Tinglysing', NOK(k.tinglysing), 3)
  rad('Total kjøp', NOK(b.totalKjop), 4, true)
  y += 4

  seksjon('HOLDE-KOSTNADER')
  rad(`Holdetid`, k.holdetid_mnd + ' mnd', 0)
  rad(`Lånebeløp (${100 - k.egenkapital_pst} % belåning)`, NOK(b.lanebelop), 1)
  rad(`Renter (${k.rente_pst} % over ${k.holdetid_mnd} mnd)`, NOK(b.renterTotal), 2)
  if (b.fellesutgTotal) rad(`Fellesutgifter (${k.holdetid_mnd} mnd)`, NOK(b.fellesutgTotal), 3)
  rad('Sum holde-kostnader', NOK(b.holdekostnad), 4, true)
  y += 4

  seksjon('TOTAL INVESTERING')
  rad('Kjøp', NOK(b.totalKjop), 0)
  rad('Oppussing + møblering', NOK(b.oppussingTotal), 1)
  rad('Holde-kostnader', NOK(b.holdekostnad), 2)
  rad('Total investering', NOK(b.totalInvestering), 3, true)
  rad('Egenkapital', NOK(b.egenkapital), 4, true)
  y += 4

  seksjon('SALG')
  rad('Forventet salgssum', NOK(k.salgspris), 0)
  rad(`Meglerhonorar (${k.meglerhonorar_pst} %)`, NOK(b.meglerhonorar), 1)
  rad('Markedsføring/takst', NOK(k.marknadsforing), 2)
  rad('Netto salg', NOK(b.nettoSalg), 3, true)
  if (k.skattefri) {
    rad('Skatt', 'Skattefri (botid)', 4)
  } else {
    rad(`Skatt (${k.skattesats_pst} %)`, NOK(b.skatt), 4)
  }
  y += 6

  // === RESULTAT ===
  sjekk(40)
  const resFarge: [number, number, number] = b.nettoFortjeneste >= 0 ? [26, 77, 43] : [122, 12, 30]
  doc.setFillColor(resFarge[0], resFarge[1], resFarge[2])
  doc.rect(15, y, 180, 32, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('RESULTAT', 20, y + 9)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('Netto fortjeneste:', 20, y + 19)
  doc.setFontSize(15); doc.setFont('helvetica', 'bold')
  doc.text(NOK(b.nettoFortjeneste), 110, y + 19)
  doc.setFontSize(10); doc.setFont('helvetica', 'normal')
  doc.text('ROI på egenkapital:', 20, y + 28)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(PCT(b.roi), 110, y + 28)
  y += 38

  // === MEGLER-VERDIVURDERINGER (ekstern kvalitetssikring av salgspris) ===
  if (args.meglerVurderinger && args.meglerVurderinger.length > 0) {
    const med = args.meglerVurderinger.filter(v => v.verdi_nok > 0)
    if (med.length > 0) {
      if (y > 220) { doc.addPage(); y = 20 }
      seksjon('MEGLER-VERDIVURDERINGER')
      const snitt = med.reduce((s, v) => s + v.verdi_nok, 0) / med.length
      avsnitt(`Forhåndsvurderinger fra ${med.length} ${med.length === 1 ? 'megler' : 'meglere'}. Snitt: ${NOK(snitt)}.`)
      y += 2
      args.meglerVurderinger.forEach((v, i) => {
        sjekk(20)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
        const datoFmt = v.dato ? new Date(v.dato).toLocaleDateString('nb-NO') : ''
        doc.text(`${i + 1}. ${v.navn || 'Ukjent megler'}${v.firma ? ' — ' + v.firma : ''}${datoFmt ? '   (' + datoFmt + ')' : ''}`, 20, y); y += 6
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
        const kontaktLinje = [v.telefon, v.epost].filter(Boolean).join('   ·   ')
        if (kontaktLinje) { doc.text(kontaktLinje, 20, y); y += 5 }
        if (v.verdi_nok > 0) {
          doc.setFont('helvetica', 'bold')
          doc.text('Verdivurdering: ' + NOK(v.verdi_nok), 20, y); y += 5
          doc.setFont('helvetica', 'normal')
        }
        if (v.notat) {
          const linjer = doc.splitTextToSize('"' + v.notat + '"', 175)
          linjer.forEach((l: string) => { sjekk(5); doc.text(l, 20, y); y += 5 })
        }
        y += 4
      })
    }
  }

  // === BANK-VURDERING ===
  if (args.bankVurdering && args.bankVurdering.sumInntektMnd > 0) {
    const bv = args.bankVurdering
    if (y > 220) { doc.addPage(); y = 20 }
    seksjon('BANK-VURDERING')

    // Lys-bånd
    const lysFarge: [number, number, number] =
      bv.lys.includes('🟢') ? [45, 125, 70] : bv.lys.includes('🔴') ? [200, 16, 46] : [176, 94, 10]
    sjekk(16)
    doc.setFillColor(lysFarge[0], lysFarge[1], lysFarge[2])
    doc.rect(15, y, 180, 14, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(bv.lysTekst + '   —   ' + bv.total + '/100', 20, y + 9)
    y += 18
    doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)

    // Husholdning
    sjekk(14)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
    doc.text(`Husholdning: ${bv.antallVoksne} voksen${bv.antallVoksne > 1 ? 'e' : ''}, ${bv.antallBarn} barn under 18`, 20, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)

    // Inntektskilder
    if (bv.inntekter.length > 0) {
      sjekk(20)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(14, 23, 38)
      doc.text('Brutto inntekter:', 20, y); y += 6
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60)
      bv.inntekter.forEach((inn, i) => rad(inn.beskrivelse || `Inntektskilde ${i + 1}`, NOK(inn.belop_mnd) + '/mnd', i))
      rad('Sum brutto', NOK(bv.sumInntektMnd) + '/mnd (' + NOK(bv.sumInntektAr) + '/år)', bv.inntekter.length, true)
      rad('- Skatt (estimat)', '- ' + NOK(bv.skatt_anslag_mnd) + '/mnd', bv.inntekter.length + 1)
      if (bv.utleieMnd > 0) rad('+ Netto leieinntekt utleiedel', '+ ' + NOK(bv.utleieMnd) + '/mnd', bv.inntekter.length + 2)
      rad('Netto inntekt disponibel', NOK(bv.netto_inntekt_mnd) + '/mnd', bv.inntekter.length + 3, true)
      y += 4
    }

    // Andre lån
    if (bv.andreLan.length > 0) {
      sjekk(20)
      seksjon('ANDRE EKSISTERENDE LÅN')
      bv.andreLan.forEach((l, i) => rad(`${l.beskrivelse || l.type} (saldo ${NOK(l.saldo)})`, NOK(l.mnd_betaling) + '/mnd', i))
      rad('Sum mnd-betjening andre lån', NOK(bv.andreLanMndSum) + '/mnd', bv.andreLan.length, true)
      y += 4
    }

    // Annen sikkerhet
    if (bv.annenSikkerhet?.aktiv) {
      seksjon('TILGJENGELIG EKSTRA SIKKERHET')
      if (bv.annenSikkerhet.beskrivelse) avsnitt(bv.annenSikkerhet.beskrivelse)
      rad('Verdi (markedstakst)', NOK(bv.annenSikkerhet.verdi), 0)
      rad('Eksisterende lån', '- ' + NOK(bv.annenSikkerhet.lan), 1)
      rad('Tilgjengelig sikkerhet', NOK(bv.annenSikkerhetNetto), 2, true)
      y += 4
    }

    // Disponibel-analyse (det viktigste for banken)
    seksjon('BETJENINGSANALYSE')
    rad('Netto inntekt', NOK(bv.netto_inntekt_mnd) + '/mnd', 0)
    rad(`- Livsopphold (SIFO, ${bv.antallVoksne}v + ${bv.antallBarn}b)`, '- ' + NOK(bv.livsopphold), 1)
    rad('- Mnd-betaling nytt boliglån', '- ' + NOK(bv.nettoMndBetaling), 2)
    if (bv.andreLanMndSum > 0) rad('- Andre lån', '- ' + NOK(bv.andreLanMndSum), 3)
    rad('= Disponibelt etter alt', NOK(bv.disponibelEtterAlt) + '/mnd', 4, true)
    rad('Stresstest disponibel (rente +3pp)', NOK(bv.stressDisponibel) + '/mnd', 5)
    y += 4

    // Nøkkeltall
    seksjon('NØKKELTALL FOR BANKEN')
    rad('Total gjeld (nytt boliglån + andre)', NOK(bv.totalGjeld), 0)
    rad('Gjeldsgrad', bv.gjeldsgrad.toFixed(1) + 'x årsinntekt' + (bv.gjeldsgrad <= 5 ? ' (innenfor 5x-grensen)' : ' (over Finanstilsynets 5x-grense)'), 1, true)
    rad('Belåningsgrad', PCT(bv.belaningsgrad) + (bv.belaningsgrad <= 75 ? ' (sterk)' : bv.belaningsgrad <= 85 ? ' (akseptabel)' : ' (over grensen)'), 2, true)
    rad('Betjeningsbelastning', PCT(bv.betjeningRatio * 100) + ' av netto inntekt', 3)
    y += 4
  }

  // === AI-VURDERING ===
  if (a.ai_vurdering) {
    seksjon('AI-VURDERING')
    avsnitt(a.ai_vurdering)
    y += 2
  }

  if (a.oppussing_vurdering) {
    seksjon('OPPUSSING — STRATEGI')
    avsnitt(a.oppussing_vurdering)
    y += 2
  }

  // === BILDER (hvis prosjektId + supabase tilgjengelig) ===
  if (args.prosjektId && args.supabaseKlient) {
    const bildePar = await hentBildePar(args.prosjektId, args.supabaseKlient)
    if (bildePar.length > 0) {
      doc.addPage()
      y = 20
      seksjon('FØR / ETTER VISUALISERINGER')

      const bildebredde = 85
      const bildehoyde = 60
      for (const bp of bildePar) {
        if (y > 200) { doc.addPage(); y = 20 }

        // Tittel: kategori
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(14, 23, 38)
        const tittel = bp.original.kategori || 'Bilde'
        doc.text(tittel, 20, y); y += 6

        // Før (venstre)
        if (bp.originalBase64) {
          try { doc.addImage(bp.originalBase64, 'JPEG', 20, y, bildebredde, bildehoyde) } catch { /* ignore */ }
        } else {
          doc.setFillColor(245, 245, 245); doc.rect(20, y, bildebredde, bildehoyde, 'F')
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
        doc.text('FØR', 22, y + bildehoyde - 2)

        // Etter (høyre)
        if (bp.generertBase64) {
          try { doc.addImage(bp.generertBase64, 'JPEG', 110, y, bildebredde, bildehoyde) } catch { /* ignore */ }
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(106, 76, 147)
          doc.text('ETTER' + (bp.generertStil ? ' — ' + bp.generertStil : ''), 112, y + bildehoyde - 2)
        } else {
          doc.setFillColor(252, 250, 245); doc.rect(110, y, bildebredde, bildehoyde, 'F')
          doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(150, 150, 150)
          doc.text('Ingen visualisering', 116, y + bildehoyde / 2)
        }
        y += bildehoyde + 8
      }
    }
  }

  // === FOOTER ===
  const sider = doc.getNumberOfPages()
  for (let i = 1; i <= sider; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text('loeiendom.com  |  post@loeiendom.com  |  Side ' + i + ' av ' + sider, 105, 290, { align: 'center' })
  }

  const uri = doc.output('datauristring')
  const komma = uri.indexOf(',')
  const base64 = komma >= 0 ? uri.slice(komma + 1) : uri

  const navn = (a.tittel || a.adresse || 'Norsk_bolig').replace(/[^A-Za-z0-9æøåÆØÅ_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  const filnavn = 'Flippe-prospekt_' + navn + '_' + new Date().toISOString().slice(0, 10) + '.pdf'

  return { base64, filnavn }
}

// Henter alle originaler + nyeste genererte versjon per original.
// Returnerer base64-versjoner ferdig til å embedes i PDF-en.
async function hentBildePar(prosjektId: string, supabase: SupabaseKlient): Promise<BildePar[]> {
  const { data: rader } = await supabase.from('prosjekt_bilder').select('*').eq('prosjekt_id', prosjektId).order('opprettet', { ascending: true })
  const alle = (rader || []) as Prosjektbilde[]
  const originaler = alle.filter(b => b.type === 'original')

  if (originaler.length === 0) return []

  // Hent signerte URL-er via API
  const alleIds = alle.map(b => b.id)
  const sres = await fetch('/api/bilder/signert-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bilde_ids: alleIds }),
  })
  const sdata = await sres.json()
  const urler: Record<string, string> = sdata?.urler || {}

  const par: BildePar[] = []
  for (const orig of originaler) {
    const genererte = alle.filter(b => b.type === 'generert' && b.original_bilde_id === orig.id)
    const sisteGenerert = genererte.slice(-1)[0]

    const originalBase64 = urler[orig.id] ? await urlTilBase64(urler[orig.id]) : null
    const generertBase64 = sisteGenerert && urler[sisteGenerert.id] ? await urlTilBase64(urler[sisteGenerert.id]) : null

    par.push({
      original: orig,
      originalBase64,
      generertBase64,
      generertStil: sisteGenerert?.stil || null,
      kostnadsforslag: 0,
    })
  }
  return par
}

// Bygger norsk flippe-PDF fra et lagret prosjekt — gjenoppretter all
// state fra norsk_kalkulator_data, regner ut beregning/finansiering/utleie,
// og kaller hovedbyggeren. Brukes f.eks. fra AgentChat når brukeren sender
// e-post med PDF-vedlegg på et norsk prosjekt.
export async function byggNorskPdfFraProsjekt(
  prosjektId: string,
  supabaseKlient: SupabaseKlient,
): Promise<{ base64: string; filnavn: string } | null> {
  const { data } = await supabaseKlient.from('prosjekter').select('*').eq('id', prosjektId).single()
  if (!data) return null
  const p = data as { norsk_kalkulator_data?: Record<string, unknown> | null; navn?: string }
  const d = p.norsk_kalkulator_data
  if (!d) return null

  const analyse = (d.analyse as AnalyseLite) || {}
  const kalk = (d.kalk as KalkAlias) || null
  if (!kalk) return null
  const modus = (d.modus as Modus) || 'ren'
  const eksisterende = (d.eksisterende as EksisterendeBolig) || null
  const boPlan = (d.boPlan as BoPlan) || { bo_tid_mnd: 24, arlig_prisvekst_pst: 4 }
  const utleieDel = (d.utleieDel as UtleieDel) || null
  const oppussingsposter = (d.oppussingsposter as OppussingsPostAlias[]) || []
  const husholdning = (d.husholdning as Husholdning) || null
  const meglerVurderinger = (d.meglerVurderinger as MeglerVurdering[]) || []
  const finnUrl = (typeof d.finnUrl === 'string' ? d.finnUrl : '') || ''
  const takstRaw = d.takstData as TakstPdfData | null | undefined
  const takstFilnavn = typeof d.takstFilnavn === 'string' ? d.takstFilnavn : null
  const takst: TakstPdfData | null = takstRaw ? { ...takstRaw, filnavn: takstFilnavn || takstRaw.filnavn } : null

  const effektivKalk = regnEffektivKalk(kalk, modus, boPlan)
  const utleieBeregning = utleieDel
    ? regnUtleie(modus, utleieDel, boPlan.bo_tid_mnd)
    : { brutto_mnd: 0, netto_mnd: 0, brutto_total: 0, netto_total: 0, etableringskost: 0, skatt: 0 }
  const utleieBidrag = utleieBeregning.netto_total - utleieBeregning.etableringskost
  const beregning = regnUt(effektivKalk, utleieBidrag, modus, boPlan.bo_tid_mnd)
  const eksisterendeBeregning = eksisterende
    ? regnEksisterende(modus, eksisterende)
    : { meglerhonorar: 0, salgskostnader: 0, skatt: 0, nettoTilDisposisjon: 0 }
  const finansiering = eksisterende
    ? regnFinansiering(modus, beregning, eksisterendeBeregning, effektivKalk)
    : null
  const bankScore = husholdning
    ? regnBankScore(husholdning, utleieBeregning, finansiering, effektivKalk)
    : null
  const totalScoreVerdi = regnTotalScore(
    analyse.score?.total,
    bankScore || regnBankScore({ antall_voksne: 0, antall_barn: 0, inntekter: [], skattesats_pst: 0, andre_lan: [], annen_sikkerhet_aktiv: false, annen_bolig_verdi: 0, annen_bolig_lan: 0, annen_bolig_beskrivelse: '' }, utleieBeregning, finansiering, effektivKalk),
    meglerVurderinger,
    effektivKalk.salgspris,
  )

  return byggNorskFlippePdf({
    analyse,
    kalk: effektivKalk,
    beregning,
    oppussingsposter,
    takst,
    boFlipp: modus === 'bo' && finansiering && eksisterende ? {
      eksisterende: {
        modus: eksisterende.modus,
        salgssum: eksisterende.salgssum,
        restgjeld: eksisterende.restgjeld,
        meglerhonorar_pst: eksisterende.meglerhonorar_pst,
        marknadsforing: eksisterende.marknadsforing,
        skattefri: eksisterende.skattefri,
        verdi_naa: eksisterende.verdi_naa,
        opprinnelig_kjopspris: eksisterende.opprinnelig_kjopspris,
        mnd_lan_betaling: eksisterende.mnd_lan_betaling,
        rente_pst_gammel: eksisterende.rente_pst_gammel,
        utleie_horisont_aar: eksisterende.utleie_horisont_aar,
        utleie_mnd_brutto: eksisterende.utleie_mnd_brutto,
        utleie_belegg_pst: eksisterende.utleie_belegg_pst,
        utleie_drift_pst: eksisterende.utleie_drift_pst,
        utleie_skattepliktig: eksisterende.utleie_skattepliktig,
        arlig_prisvekst_pst: eksisterende.arlig_prisvekst_pst,
      },
      netto: eksisterendeBeregning,
      finansiering,
      paakostninger: eksisterende.paakostninger,
      utleie: utleieDel?.aktiv ? {
        aktiv: true,
        leie_mnd: utleieDel.leie_mnd,
        belegg_pst: utleieDel.belegg_pst,
        drift_pst: utleieDel.drift_pst,
        etableringskost: utleieDel.etableringskost,
        skattefri: utleieDel.skattefri,
        brutto_mnd: utleieBeregning.brutto_mnd,
        netto_mnd: utleieBeregning.netto_mnd,
        brutto_total: utleieBeregning.brutto_total,
        netto_total: utleieBeregning.netto_total,
        skatt: utleieBeregning.skatt,
        nettoBidrag: utleieBidrag,
      } : undefined,
    } : null,
    bankVurdering: bankScore && husholdning ? {
      ...bankScore,
      inntekter: husholdning.inntekter,
      antallVoksne: husholdning.antall_voksne,
      antallBarn: husholdning.antall_barn,
      andreLan: husholdning.andre_lan,
      annenSikkerhet: husholdning.annen_sikkerhet_aktiv ? {
        aktiv: true,
        verdi: husholdning.annen_bolig_verdi,
        lan: husholdning.annen_bolig_lan,
        beskrivelse: husholdning.annen_bolig_beskrivelse,
      } : undefined,
    } : null,
    meglerVurderinger,
    totalScore: totalScoreVerdi,
    finnUrl: finnUrl || undefined,
    prosjektId,
    supabaseKlient,
  })
}

