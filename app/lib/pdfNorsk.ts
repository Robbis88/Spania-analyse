// PDF-bygger for norsk flippe-prospekt. Lagder en pen rapport med
// boligfakta, score, kalkulator-resultater, oppussingsposter, sensitivitet
// og bud-strategi — klar til bankmøte eller co-investor.

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

const NOK = (n: number) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'
const PCT = (n: number) => n.toFixed(1) + ' %'

export async function byggNorskFlippePdf(args: {
  analyse: AnalyseLite
  kalk: Kalk
  beregning: Beregning
  oppussingsposter: OppussingsPost[]
  boFlipp?: BoFlipp | null
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
