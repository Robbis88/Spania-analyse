import type { Prosjekt, SalgInput } from '../types'

export const totalInvestering = (p: Prosjekt) =>
  p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering

export const månedligKostnad = (p: Prosjekt) =>
  p.lån_mnd + p.fellesutgifter_mnd + p.strøm_mnd + p.forsikring_mnd + p.forvaltning_mnd

export const månedligCashflow = (p: Prosjekt) =>
  p.leieinntekt_mnd - månedligKostnad(p)

export const yield_pst = (p: Prosjekt) =>
  totalInvestering(p) > 0 ? ((p.leieinntekt_mnd * 12) / totalInvestering(p) * 100) : 0

export const roi = (p: Prosjekt) =>
  totalInvestering(p) > 0 ? ((p.forventet_salgsverdi - totalInvestering(p)) / totalInvestering(p) * 100) : 0

export function beregnSalg(p: Prosjekt, input: SalgInput) {
  const salgspris = input.salgspris || p.forventet_salgsverdi || 0
  const meglerBelop = salgspris * (input.megler_pst / 100)
  const advokatBelop = salgspris * (input.advokat_pst / 100)
  const salgskostnader = meglerBelop + advokatBelop

  const totalKjop = p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk
  const nettoSalgssum = salgspris - salgskostnader
  const kapitalgevinst = Math.max(0, nettoSalgssum - totalKjop)

  const cgtSats = input.skatteresidens === 'eu' ? 0.19 : 0.24
  const cgt = kapitalgevinst * cgtSats
  const retention3pst = salgspris * 0.03
  const differanseRetention = cgt - retention3pst

  const totalSkatt = cgt + input.plusvalia
  const nettoILomma = nettoSalgssum - totalSkatt - (p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering)
  const nettoFortjeneste = salgspris - salgskostnader - totalSkatt - p.kjøpesum - p.kjøpskostnader - p.oppussing_faktisk - p.møblering

  const totalInvestert = p.kjøpesum + p.kjøpskostnader + p.oppussing_faktisk + p.møblering
  const roiPst = totalInvestert > 0 ? (nettoFortjeneste / totalInvestert) * 100 : 0

  const faktor = 1 - (input.megler_pst / 100) - (input.advokat_pst / 100)
  const breakEvenUtenGevinst = faktor > 0 ? (totalInvestert + input.plusvalia) / faktor : 0

  return {
    salgspris, meglerBelop, advokatBelop, salgskostnader, totalKjop,
    nettoSalgssum, kapitalgevinst, cgt, cgtSats, retention3pst, differanseRetention,
    totalSkatt, nettoFortjeneste, nettoILomma, totalInvestert, roiPst, breakEvenUtenGevinst,
  }
}
