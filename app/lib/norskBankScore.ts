// Pure-funksjon for bank-score (gjeldsgrad, belåningsgrad, betjeningsevne, stresstest).
// Gjenbrukes både i NorskeBoliger-komponenten og i pdfNorsk.byggNorskPdfFraProsjekt.

import type { Kalk, Finansiering, UtleieBeregning } from './norskKalkulator'

export type Husholdning = {
  inntekter: Array<{ beskrivelse: string; belop_mnd: number }>
  annen_sikkerhet_aktiv: boolean
  annen_bolig_verdi: number
  annen_bolig_lan: number
  annen_bolig_beskrivelse: string
}

export type BankScore = {
  sumInntektMnd: number; sumInntektAr: number; utleieMnd: number; totalInntektMnd: number; annenSikkerhetNetto: number
  lanebehov: number; mndBetaling: number; nettoMndBetaling: number
  gjeldsgrad: number; gjeldsgradScore: number
  belaningsgrad: number; belaningsgradScore: number
  betjeningRatio: number; betjeningScore: number
  stressMnd: number; stressNettoMnd: number; stressRatio: number; stressScore: number
  total: number; lys: string; lysTekst: string
}

export function regnBankScore(
  husholdning: Husholdning,
  utleieBeregning: UtleieBeregning,
  finansiering: Finansiering | null,
  kalk: Kalk,
): BankScore {
  const sumInntektMnd = husholdning.inntekter.reduce((s, i) => s + (i.belop_mnd || 0), 0)
  const sumInntektAr = sumInntektMnd * 12
  const utleieMnd = utleieBeregning.netto_mnd
  const totalInntektMnd = sumInntektMnd + utleieMnd
  const annenSikkerhetNetto = husholdning.annen_sikkerhet_aktiv
    ? Math.max(0, husholdning.annen_bolig_verdi - husholdning.annen_bolig_lan)
    : 0

  const lanebehov = finansiering ? finansiering.lanebehov : (kalk.kjopesum * (1 - kalk.egenkapital_pst / 100))
  const mndBetaling = finansiering ? finansiering.mndBetaling : (() => {
    const r = kalk.rente_pst / 100 / 12
    return lanebehov > 0 && r > 0 ? (lanebehov * r) / (1 - Math.pow(1 + r, -25 * 12)) : 0
  })()
  const nettoMndBetaling = Math.max(0, mndBetaling - utleieMnd)

  const justertLanebehov = Math.max(0, lanebehov - annenSikkerhetNetto)
  const gjeldsgrad = sumInntektAr > 0 ? (justertLanebehov / sumInntektAr) : 0
  const gjeldsgradScore = sumInntektAr === 0 ? 0
    : gjeldsgrad <= 4 ? 100 : gjeldsgrad <= 5 ? 70 : gjeldsgrad <= 6 ? 35 : 10

  const belaningsgrad = finansiering ? finansiering.belaningsgrad : 0
  const belaningsgradScore = belaningsgrad === 0 ? 0
    : belaningsgrad <= 75 ? 100 : belaningsgrad <= 85 ? 60 : 25

  const betjeningRatio = totalInntektMnd > 0 ? nettoMndBetaling / totalInntektMnd : 1
  const betjeningScore = totalInntektMnd === 0 ? 0
    : betjeningRatio < 0.30 ? 100 : betjeningRatio < 0.40 ? 75 : betjeningRatio < 0.50 ? 50 : 20

  const stressRente = (kalk.rente_pst + 3) / 100 / 12
  const stressMnd = lanebehov > 0 && stressRente > 0
    ? (lanebehov * stressRente) / (1 - Math.pow(1 + stressRente, -25 * 12))
    : 0
  const stressNettoMnd = Math.max(0, stressMnd - utleieMnd)
  const stressRatio = totalInntektMnd > 0 ? stressNettoMnd / totalInntektMnd : 1
  const stressScore = totalInntektMnd === 0 ? 0
    : stressRatio < 0.40 ? 100 : stressRatio < 0.55 ? 70 : stressRatio < 0.70 ? 40 : 15

  const total = Math.round(
    gjeldsgradScore * 0.25 + belaningsgradScore * 0.25 + betjeningScore * 0.30 + stressScore * 0.20
  )
  const lys = total >= 75 ? '🟢' : total >= 55 ? '🟡' : '🔴'
  const lysTekst = total >= 75 ? 'Sterkt finansieringsgrunnlag'
    : total >= 55 ? 'Trolig akseptabelt — kan kreve dialog'
    : 'Vanskelig å få godkjent'

  return {
    sumInntektMnd, sumInntektAr, utleieMnd, totalInntektMnd, annenSikkerhetNetto,
    lanebehov, mndBetaling, nettoMndBetaling,
    gjeldsgrad, gjeldsgradScore,
    belaningsgrad, belaningsgradScore,
    betjeningRatio, betjeningScore,
    stressMnd, stressNettoMnd, stressRatio, stressScore,
    total, lys, lysTekst,
  }
}
