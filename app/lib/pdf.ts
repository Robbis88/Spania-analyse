import type { Prosjekt } from '../types'
import { månedligKostnad } from './beregninger'

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
