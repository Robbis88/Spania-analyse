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
    salgssum: number; restgjeld: number
    meglerhonorar_pst: number; marknadsforing: number; skattefri: boolean
  }
  netto: { meglerhonorar: number; salgskostnader: number; skatt: number; nettoTilDisposisjon: number }
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

const NOK = (n: number) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'
const PCT = (n: number) => n.toFixed(1) + ' %'

export async function byggNorskFlippePdf(args: {
  analyse: AnalyseLite
  kalk: Kalk
  beregning: Beregning
  oppussingsposter: OppussingsPost[]
  boFlipp?: BoFlipp | null
  bankVurdering?: BankVurdering | null
  meglerVurderinger?: MeglerVurdering[]
  totalScore?: TotalScore | null
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
    sjekk(40)
    doc.setFillColor(lysFarge[0], lysFarge[1], lysFarge[2])
    doc.rect(15, y, 180, 28, 'F')
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.text('TOTAL PROSJEKTSCORE', 20, y + 8)
    doc.setFontSize(13)
    doc.text(ts.lysTekst, 20, y + 17)
    doc.setFontSize(28)
    doc.text(`${ts.total}/100`, 175, y + 18, { align: 'right' })
    y += 32

    doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
    const subscores: string[] = []
    if (ts.harFlippeScore) subscores.push(`🔍 Flippe-potensial: ${(ts.flippeScore / 10).toFixed(1)}/10`)
    if (ts.harBankScore) subscores.push(`🏦 Bank-finansierbarhet: ${ts.bankScore}/100`)
    if (ts.harMeglerSnitt) subscores.push(`📋 Markeds-realisme: ${ts.meglerRealisme}/100 (${ts.antallMeglere} megler${ts.antallMeglere > 1 ? 'e' : ''}, avvik ${ts.avvikPst.toFixed(1)} %)`)
    if (subscores.length > 0) {
      doc.setFontSize(9); doc.setTextColor(80, 80, 80)
      doc.text('Underliggende: ' + subscores.join('   ·   '), 20, y); y += 8
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

  // === MARKEDSANALYSE ===
  if (a.markedspris_begrunnelse || a.markedspris_bra_m2_nok) {
    seksjon('MARKEDSANALYSE')
    if (a.markedspris_begrunnelse) avsnitt(a.markedspris_begrunnelse)
    if (a.markedspris_nasitt_m2_nok) rad('Som er nå (per m²)', NOK(a.markedspris_nasitt_m2_nok), 0)
    if (a.markedspris_bra_m2_nok) rad('Bra standard (per m²)', NOK(a.markedspris_bra_m2_nok), 1)
    if (a.markedspris_topp_m2_nok) rad('Toppstand (per m²)', NOK(a.markedspris_topp_m2_nok), 2)
    y += 4
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

  // === BO-FLIPP: SALG AV EGEN BOLIG + FINANSIERING ===
  if (args.boFlipp) {
    const bf = args.boFlipp
    seksjon('SALG AV EKSISTERENDE BOLIG')
    rad('Forventet salgssum', NOK(bf.eksisterende.salgssum), 0)
    rad(`Meglerhonorar (${bf.eksisterende.meglerhonorar_pst} %)`, '− ' + NOK(bf.netto.meglerhonorar), 1)
    rad('Markedsføring/takst', '− ' + NOK(bf.eksisterende.marknadsforing), 2)
    rad('Restgjeld på lån', '− ' + NOK(bf.eksisterende.restgjeld), 3)
    if (!bf.eksisterende.skattefri && bf.netto.skatt > 0) {
      rad('Skatt (22 %)', '− ' + NOK(bf.netto.skatt), 4)
    } else {
      rad('Skatt', 'Skattefri (botid)', 4)
    }
    rad('Netto til disposisjon', NOK(bf.netto.nettoTilDisposisjon), 5, true)
    y += 4

    seksjon('FINANSIERING & LÅNEBEHOV')
    rad('Totalt utlegg (kjøp + oppussing + møblering)', NOK(bf.finansiering.totalUtlegg), 0)
    rad('Tilgjengelig EK fra salg av eget hjem', '− ' + NOK(bf.finansiering.tilgjengeligEK), 1)
    rad('Lånebehov', NOK(bf.finansiering.lanebehov), 2, true)
    if (bf.finansiering.overskudd > 0) {
      rad('Overskudd egenkapital (fri kapital)', NOK(bf.finansiering.overskudd), 3)
    }
    rad('Belåningsgrad', PCT(bf.finansiering.belaningsgrad), 4, true)
    rad(`Mnd-betaling (annuitet 25 år, ${k.rente_pst} %)`, NOK(bf.finansiering.mndBetaling), 5, true)
    if (bf.utleie?.aktiv && bf.utleie.netto_mnd > 0) {
      rad('Netto leieinntekt fra utleiedel', '− ' + NOK(bf.utleie.netto_mnd), 6)
      rad('Reell mnd-kostnad (etter leieinntekt)', NOK(bf.finansiering.mndBetaling - bf.utleie.netto_mnd), 7, true)
    }
    y += 4

    if (bf.utleie?.aktiv && bf.utleie.brutto_total > 0) {
      seksjon('UTLEIE-DEL OVER BO-TIDEN')
      rad(`Leie pr. mnd (estimat)`, NOK(bf.utleie.leie_mnd), 0)
      rad(`Belegg`, PCT(bf.utleie.belegg_pst), 1)
      rad(`Effektiv brutto leie over bo-tiden`, NOK(bf.utleie.brutto_total), 2)
      rad(`Drift (${bf.utleie.drift_pst} %)`, '− ' + NOK(bf.utleie.brutto_total * (bf.utleie.drift_pst / 100)), 3)
      if (bf.utleie.skatt > 0) {
        rad('Skatt (22 %)', '− ' + NOK(bf.utleie.skatt), 4)
      } else {
        rad('Skatt', 'Skattefri (utleiedel < 50 %)', 4)
      }
      rad('Etableringskost (engang)', '− ' + NOK(bf.utleie.etableringskost), 5)
      rad('Bidrag til total fortjeneste', NOK(bf.utleie.nettoBidrag), 6, true)
      y += 4
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
      rad('− Skatt (estimat)', '− ' + NOK(bv.skatt_anslag_mnd) + '/mnd', bv.inntekter.length + 1)
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
      rad('Eksisterende lån', '− ' + NOK(bv.annenSikkerhet.lan), 1)
      rad('Tilgjengelig sikkerhet', NOK(bv.annenSikkerhetNetto), 2, true)
      y += 4
    }

    // Disponibel-analyse (det viktigste for banken)
    seksjon('BETJENINGSANALYSE')
    rad('Netto inntekt', NOK(bv.netto_inntekt_mnd) + '/mnd', 0)
    rad(`− Livsopphold (SIFO, ${bv.antallVoksne}v + ${bv.antallBarn}b)`, '− ' + NOK(bv.livsopphold), 1)
    rad('− Mnd-betaling nytt boliglån', '− ' + NOK(bv.nettoMndBetaling), 2)
    if (bv.andreLanMndSum > 0) rad('− Andre lån', '− ' + NOK(bv.andreLanMndSum), 3)
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
    boFlipp: modus === 'bo' && finansiering && eksisterende ? {
      eksisterende: {
        salgssum: eksisterende.salgssum,
        restgjeld: eksisterende.restgjeld,
        meglerhonorar_pst: eksisterende.meglerhonorar_pst,
        marknadsforing: eksisterende.marknadsforing,
        skattefri: eksisterende.skattefri,
      },
      netto: eksisterendeBeregning,
      finansiering,
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
    prosjektId,
    supabaseKlient,
  })
}

