import type { AirbnbData, BoligData, OppussingBudsjett, OppussingPost, Prosjekt, Prosjektbilde, Utleieanalyse } from '../types'
import { månedligKostnad } from './beregninger'
import { lopendeTotal, totalPoster } from './oppussing'
import { aarligYield, beregnAar } from './utleie'
import { STILER, TILLEGG_ETIKETT, type TilleggType } from './bilder'

export type BildeParPdf = {
  original: Prosjektbilde
  originalBase64: string | null
  genererte: Array<{ bilde: Prosjektbilde; base64: string | null }>
  oppussingsposter: OppussingPost[]
  tilleggsposter: Array<{ navn: string; tillegg_type: string | null; kostnad: number }>
}

export async function lastNedPDF(p: Prosjekt, ar: number) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const fmt2 = (n: number) => n ? 'EUR ' + Math.round(n).toLocaleString('nb-NO') : '-'

  const arsinntekt = p.måneder.filter(m => m.måned.startsWith(ar.toString())).reduce((s, m) => s + m.inntekt, 0)
  const arskostnadLogg = p.måneder.filter(m => m.måned.startsWith(ar.toString())).reduce((s, m) => s + m.kostnad, 0)
  const fastKostAr = månedligKostnad(p) * 12
  const totalKost = arskostnadLogg + fastKostAr
  const netto = arsinntekt - totalKost
  const totInv = p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering

  doc.setFillColor(26, 26, 46)
  doc.rect(0, 0, 210, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Leganger Eiendom', 20, 15)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Arsrapport ' + ar + ' – ' + p.navn, 20, 25)

  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)
  doc.text('Generert: ' + new Date().toLocaleDateString('nb-NO') + '  |  Status: ' + p.status + (p.dato_kjopt ? '  |  Kjøpt: ' + p.dato_kjopt : ''), 20, 42)

  let y = 52
  doc.setFillColor(240, 240, 255)
  doc.rect(15, y, 180, 8, 'F')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 26, 46)
  doc.text('INVESTERING', 20, y + 5.5)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  const invRader = [
    ['Kjøpesum', fmt2(p.kjøpesum)],
    ['Kjøpskostnader', fmt2(p.kjøpskostnader)],
    ['Oppussing budsjett', fmt2(p.oppussingsbudsjett)],
    ['Oppussing faktisk', fmt2(p.oppussing_faktisk)],
    ['Møblering', fmt2(p.møblering)],
  ]
  invRader.forEach(([lbl, val], i) => {
    if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
    doc.text(lbl, 20, y + 2); doc.text(val, 190, y + 2, { align: 'right' }); y += 7
  })
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(230, 230, 250)
  doc.rect(15, y - 3, 180, 8, 'F')
  doc.text('Total investering', 20, y + 2); doc.text(fmt2(totInv), 190, y + 2, { align: 'right' })
  y += 14

  doc.setFillColor(230, 245, 237)
  doc.rect(15, y, 180, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 26, 46)
  doc.setFontSize(11)
  doc.text('INNTEKTER ' + ar, 20, y + 5.5)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  const maneder = p.måneder.filter(m => m.måned.startsWith(ar.toString()))
  const manedNavn = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']
  if (maneder.length === 0) { doc.text('Ingen inntekter registrert for ' + ar, 20, y + 2); y += 7 }
  maneder.forEach((m, i) => {
    const mNr = parseInt(m.måned.split('-')[1]) - 1
    if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
    doc.text(manedNavn[mNr] + (m.notat ? ' – ' + m.notat : ''), 20, y + 2)
    doc.text(fmt2(m.inntekt), 190, y + 2, { align: 'right' }); y += 7
  })
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(45, 125, 70)
  doc.setTextColor(255, 255, 255)
  doc.rect(15, y - 3, 180, 8, 'F')
  doc.text('Sum inntekter', 20, y + 2); doc.text(fmt2(arsinntekt), 190, y + 2, { align: 'right' })
  doc.setTextColor(0, 0, 0); y += 14

  doc.setFillColor(253, 232, 236)
  doc.rect(15, y, 180, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 26, 46)
  doc.setFontSize(11)
  doc.text('KOSTNADER ' + ar, 20, y + 5.5)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  const kostRader = [
    ['Lånebetaling (12 mnd)', fmt2(p.lån_mnd * 12)],
    ['Fellesutgifter (12 mnd)', fmt2(p.fellesutgifter_mnd * 12)],
    ['Strøm (12 mnd)', fmt2(p.strøm_mnd * 12)],
    ['Forsikring (12 mnd)', fmt2(p.forsikring_mnd * 12)],
    ['Forvaltning (12 mnd)', fmt2(p.forvaltning_mnd * 12)],
  ].filter(r => r[1] !== '-')
  if (arskostnadLogg > 0) kostRader.push(['Variable kostnader (logg)', fmt2(arskostnadLogg)])
  kostRader.forEach(([lbl, val], i) => {
    if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
    doc.text(lbl, 20, y + 2); doc.text(val, 190, y + 2, { align: 'right' }); y += 7
  })
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(200, 16, 46)
  doc.setTextColor(255, 255, 255)
  doc.rect(15, y - 3, 180, 8, 'F')
  doc.text('Sum kostnader', 20, y + 2); doc.text(fmt2(totalKost), 190, y + 2, { align: 'right' })
  doc.setTextColor(0, 0, 0); y += 14

  doc.setFillColor(netto >= 0 ? 45 : 200, netto >= 0 ? 125 : 16, netto >= 0 ? 70 : 46)
  doc.rect(15, y, 180, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('RESULTAT ' + ar, 20, y + 10)
  doc.setFontSize(11)
  doc.text('Netto resultat:', 20, y + 20)
  doc.setFontSize(16)
  doc.text(fmt2(netto), 190, y + 20, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Yield: ' + (totInv > 0 ? ((arsinntekt / totInv) * 100).toFixed(1) : '0') + '%  |  Total investert: ' + fmt2(totInv), 20, y + 32)

  doc.save(p.navn.replace(/\s/g, '_') + '_arsrapport_' + ar + '.pdf')
}

export type ProsjektrapportData = {
  prosjekt: Prosjekt
  oppussingBudsjett?: OppussingBudsjett | null
  oppussingPoster?: OppussingPost[]
  utleieanalyse?: Utleieanalyse | null
  airbnbData?: AirbnbData | null
  bildePar?: BildeParPdf[]
}

const EUR = (n: number) => n ? 'EUR ' + Math.round(n).toLocaleString('nb-NO') : '-'

export async function prosjektrapportBase64(data: ProsjektrapportData): Promise<string> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const p = data.prosjekt
  const bd = (p.bolig_data || {}) as BoligData

  // Header
  doc.setFillColor(26, 42, 62)
  doc.rect(0, 0, 210, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text('Leganger & Osvaag Eiendom', 20, 15)
  doc.setFontSize(11); doc.setFont('helvetica', 'normal')
  doc.text('Prosjektanalyse – ' + p.navn, 20, 24)
  doc.setFontSize(9)
  doc.text('Generert ' + new Date().toLocaleDateString('nb-NO') + '  |  Kategori: ' + (p.kategori === 'flipp' ? 'Boligflipp' : 'Boligutleie') + '  |  Status: ' + p.status, 20, 31)

  doc.setTextColor(0, 0, 0)
  let y = 46

  const seksjon = (tittel: string) => {
    doc.setFillColor(240, 237, 228)
    doc.rect(15, y, 180, 8, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.setTextColor(26, 42, 62)
    doc.text(tittel, 20, y + 5.5)
    y += 12
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
  }

  const rad = (lbl: string, val: string, i: number, bold = false) => {
    if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(15, y - 3, 180, 7, 'F') }
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(lbl, 20, y + 2)
    doc.text(val, 190, y + 2, { align: 'right' })
    y += 7
    doc.setFont('helvetica', 'normal')
  }

  const avsnitt = (tekst: string) => {
    const linjer = doc.splitTextToSize(tekst, 175)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60)
    linjer.forEach((l: string) => { doc.text(l, 20, y); y += 5 })
    y += 2
  }

  seksjon('BOLIGDETALJER')
  const boligRader = [
    ['Type', String(bd.type || '-')],
    ['Beliggenhet', String(bd.beliggenhet || '-')],
    ['Areal', bd.areal ? bd.areal + ' m²' : '-'],
    ['Soverom / Bad', (bd.soverom ?? '-') + ' / ' + (bd.bad ?? '-')],
    ['Avstand strand', bd.avstand_strand ? bd.avstand_strand + ' m' : '-'],
    ['Basseng / Parkering', (bd.basseng || '-') + ' / ' + (bd.parkering || '-')],
    ['Havutsikt', bd.havutsikt || 'nei'],
    ['Standard', bd.standard || '-'],
  ]
  boligRader.forEach(([l, v], i) => rad(l, v, i))
  y += 4

  seksjon('KJØPSINFO')
  const totInv = p.kjøpesum + p.kjøpskostnader
  const kjopRader = [
    ['Kjøpesum', EUR(p.kjøpesum)],
    ['Kjøpskostnader', EUR(p.kjøpskostnader)],
    ['Total investert', EUR(totInv)],
  ]
  kjopRader.forEach(([l, v], i) => rad(l, v, i, i === kjopRader.length - 1))
  y += 4

  if (p.ai_vurdering) {
    seksjon('AI-VURDERING')
    avsnitt(p.ai_vurdering)
    y += 2
  }

  if (p.kategori === 'flipp' && data.oppussingBudsjett) {
    const b = data.oppussingBudsjett
    const poster = data.oppussingPoster || []
    const posterSum = totalPoster(poster)
    const lopSum = lopendeTotal(b)
    const total = totInv + posterSum + lopSum
    const brutto = b.estimert_salgspris ? b.estimert_salgspris - total : 0
    const roi = total > 0 && b.estimert_salgspris ? ((brutto / total) * 100) : 0

    if (y > 250) { doc.addPage(); y = 20 }
    seksjon('OPPUSSINGSBUDSJETT')
    const oppRader: [string, string][] = [
      ['Standard', b.standard],
      ['Varighet', b.antall_maneder + ' mnd'],
      ['Sum poster', EUR(posterSum)],
      ['Løpende kostnader (' + b.antall_maneder + ' mnd)', EUR(lopSum)],
      ['Totalkostnad', EUR(total)],
    ]
    oppRader.forEach(([l, v], i) => rad(l, v, i))
    y += 2

    if (b.estimert_salgspris) {
      rad('Estimert salgspris (AI)', EUR(b.estimert_salgspris), 0, true)
      rad('Brutto fortjeneste', EUR(brutto), 1, true)
      rad('ROI', roi.toFixed(1) + ' %', 2, true)
      y += 2
      if (b.estimat_begrunnelse) { avsnitt('Begrunnelse: ' + b.estimat_begrunnelse) }
    }

    if (poster.length > 0) {
      if (y > 260) { doc.addPage(); y = 20 }
      seksjon('OPPUSSINGSPOSTER')
      poster.forEach((pp, i) => rad(pp.navn + (pp.notat ? ' (' + pp.notat + ')' : ''), EUR(pp.kostnad), i))
      y += 4
    }
  }

  if (p.kategori === 'utleie' && data.utleieanalyse && data.airbnbData) {
    const ua = data.utleieanalyse
    const ad = data.airbnbData
    const iAar = new Date().getFullYear()
    const nesteAar = iAar + 1
    const o1 = beregnAar(iAar, ad, ua)
    const o2 = beregnAar(nesteAar, ad, ua)

    if (y > 240) { doc.addPage(); y = 20 }
    seksjon('UTLEIEANALYSE')
    const utlRader: [string, string][] = [
      ['Leietype', ua.leietype === 'korttid' ? 'Korttidsleie' : 'Langtidsleie'],
      ['Scenario', ua.scenario],
      ['Total kjøpspris', EUR(ua.total_kjopspris || 0)],
      ['Kjøpsmåned / Utleiestart', (ua.kjopsmaaned || '-') + ' / ' + (ua.utleiestart || '-')],
      ['Etablert fra og med år', String(ua.progresjon_til_etablert_ar)],
    ]
    utlRader.forEach(([l, v], i) => rad(l, v, i))
    y += 2

    if (y > 250) { doc.addPage(); y = 20 }
    seksjon('RESULTAT ' + iAar)
    rad('Brutto leieinntekt', EUR(o1.brutto_inntekt), 0)
    rad('Løpende kostnader', EUR(o1.kostnader_lopende), 1)
    rad('Netto uten lån', EUR(o1.netto_uten_lan), 2, true)
    if (o1.lan_ar > 0) rad('Netto med lån', EUR(o1.netto_med_lan), 3, true)
    y += 2

    if (y > 250) { doc.addPage(); y = 20 }
    seksjon('RESULTAT ' + nesteAar)
    rad('Brutto leieinntekt', EUR(o2.brutto_inntekt), 0)
    rad('Løpende kostnader', EUR(o2.kostnader_lopende), 1)
    rad('Netto uten lån', EUR(o2.netto_uten_lan), 2, true)
    if (o2.lan_ar > 0) rad('Netto med lån', EUR(o2.netto_med_lan), 3, true)
    const y2 = aarligYield(o2.brutto_inntekt, ua.total_kjopspris || 0)
    rad('Yield brutto (kjøpspris)', y2.toFixed(1) + ' %', 4, true)
  }

  // BILDESEKSJON — før/etter visualiseringer per kildebilde
  const par = data.bildePar || []
  if (par.length > 0) {
    doc.addPage()
    y = 20
    seksjon('FØR / ETTER VISUALISERINGER')

    for (const pp of par) {
      const harGenerert = pp.genererte.some(g => g.base64)
      const totalForslagKost = pp.oppussingsposter.reduce((s, x) => s + (x.kostnad || 0), 0)
        + pp.tilleggsposter.reduce((s, x) => s + (x.kostnad || 0), 0)

      // Trenger ca 100mm vertikal plass per par. Sidebrudd hvis nødvendig.
      if (y > 200) { doc.addPage(); y = 20 }

      // Tittel: kategori + filnavn + ev. kostnadssum
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 42, 62)
      const tittel = (pp.original.kategori || 'Bilde') + (totalForslagKost > 0 ? '  —  Estimert: ' + EUR(totalForslagKost) : '')
      doc.text(tittel, 20, y)
      y += 6

      // Før- og etter-bilder side ved side. 85mm bredde hver, 60mm høy.
      const bildebredde = 85
      const bildehoyde = 60
      const venstreX = 20
      const hoyreX = 20 + bildebredde + 5

      // Før
      if (pp.originalBase64) {
        try { doc.addImage(pp.originalBase64, 'JPEG', venstreX, y, bildebredde, bildehoyde) } catch {}
      } else {
        doc.setFillColor(245, 245, 245); doc.rect(venstreX, y, bildebredde, bildehoyde, 'F')
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
      doc.text('FØR', venstreX + 2, y + bildehoyde - 2)

      // Etter (siste genererte variant)
      const sisteGenerert = pp.genererte.filter(g => g.base64).slice(-1)[0]
      if (sisteGenerert?.base64) {
        try { doc.addImage(sisteGenerert.base64, 'JPEG', hoyreX, y, bildebredde, bildehoyde) } catch {}
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(106, 76, 147)
        const stilDef = sisteGenerert.bilde.stil ? STILER.find(s => s.id === sisteGenerert.bilde.stil) : null
        const etikett = 'ETTER' + (stilDef ? ' — ' + stilDef.navn : '')
        doc.text(etikett, hoyreX + 2, y + bildehoyde - 2)
      } else if (harGenerert) {
        doc.setFillColor(245, 245, 245); doc.rect(hoyreX, y, bildebredde, bildehoyde, 'F')
      } else {
        doc.setFillColor(252, 250, 245); doc.rect(hoyreX, y, bildebredde, bildehoyde, 'F')
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(150, 150, 150)
        doc.text('Ingen visualisering generert', hoyreX + 6, y + bildehoyde / 2)
      }
      y += bildehoyde + 3

      // Forslagsliste under bildene
      const forslag: Array<[string, number]> = [
        ...pp.oppussingsposter.map(o => [o.navn, o.kostnad] as [string, number]),
        ...pp.tilleggsposter.map(t => [
          (t.tillegg_type ? (TILLEGG_ETIKETT[t.tillegg_type as TilleggType] || t.navn) : t.navn) + ' (tillegg)',
          t.kostnad,
        ] as [string, number]),
      ]
      if (forslag.length > 0) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60)
        for (const [navn, kost] of forslag) {
          if (y > 280) { doc.addPage(); y = 20 }
          doc.text('• ' + navn, 22, y)
          if (kost > 0) doc.text(EUR(kost), 190, y, { align: 'right' })
          y += 5
        }
      }
      y += 8
    }
  }

  // Footer
  const pagesCount = doc.getNumberOfPages()
  for (let i = 1; i <= pagesCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text('loeiendom.com  |  post@loeiendom.com  |  Side ' + i + ' av ' + pagesCount, 105, 290, { align: 'center' })
  }

  const uri = doc.output('datauristring')
  const komma = uri.indexOf(',')
  return komma >= 0 ? uri.slice(komma + 1) : uri
}

export function rapportFilnavn(prosjektNavn: string): string {
  const iDag = new Date().toISOString().slice(0, 10)
  const rent = prosjektNavn.replace(/[^A-Za-z0-9æøåÆØÅ_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return 'Analyse_' + rent + '_' + iDag + '.pdf'
}
