// Pure-funksjon for bank-score (gjeldsgrad, belåningsgrad, betjeningsevne, stresstest).
// Gjenbrukes både i NorskeBoliger-komponenten og i pdfNorsk.byggNorskPdfFraProsjekt.
//
// Norske banker bruker SIFO-livsopphold + total gjeldsbetjening i sin
// betjeningsanalyse. Vi bruker omtrentlige 2025-nivåer:
//   1 voksen alene:    11 000 kr/mnd
//   2 voksne sammen:   17 000 kr/mnd
//   Per barn under 18:  5 500 kr/mnd

import type { Kalk, Finansiering, UtleieBeregning } from './norskKalkulator'

export type Inntektskilde = { beskrivelse: string; belop_mnd: number }
export type AnnetLan = {
  beskrivelse: string
  type: 'billan' | 'studielan' | 'kreditt' | 'annet_boliglan' | 'annet'
  saldo: number
  mnd_betaling: number
}

export type Husholdning = {
  antall_voksne: number
  antall_barn: number
  inntekter: Inntektskilde[]
  skattesats_pst: number
  andre_lan: AnnetLan[]
  annen_sikkerhet_aktiv: boolean
  annen_bolig_verdi: number
  annen_bolig_lan: number
  annen_bolig_beskrivelse: string
}

export function regnLivsopphold(antallVoksne: number, antallBarn: number): number {
  const voksenGrunnlag = antallVoksne >= 2 ? 17000 : antallVoksne === 1 ? 11000 : 0
  return voksenGrunnlag + (antallBarn * 5500)
}

export type BankScore = {
  // Inntekter
  sumInntektMnd: number; sumInntektAr: number; utleieMnd: number; totalInntektMnd: number
  skatt_anslag_mnd: number; netto_inntekt_mnd: number
  // Sikkerhet
  annenSikkerhetNetto: number
  // Lån og betjening
  lanebehov: number; mndBetaling: number; nettoMndBetaling: number
  andreLanSum: number; andreLanMndSum: number
  totalGjeld: number; totalMndBetjening: number
  // Livsopphold
  livsopphold: number; disponibelEtterAlt: number
  // Score-deler
  gjeldsgrad: number; gjeldsgradScore: number
  belaningsgrad: number; belaningsgradScore: number
  betjeningRatio: number; betjeningScore: number
  stressMnd: number; stressNettoMnd: number; stressTotalMnd: number; stressDisponibel: number; stressScore: number
  total: number; lys: string; lysTekst: string
}

export function regnBankScore(
  husholdning: Husholdning,
  utleieBeregning: UtleieBeregning,
  finansiering: Finansiering | null,
  kalk: Kalk,
): BankScore {
  // === INNTEKTER ===
  const sumInntektMnd = husholdning.inntekter.reduce((s, i) => s + (i.belop_mnd || 0), 0)
  const sumInntektAr = sumInntektMnd * 12
  const utleieMnd = utleieBeregning.netto_mnd
  const totalInntektMnd = sumInntektMnd + utleieMnd
  const skatt_anslag_mnd = sumInntektMnd * (husholdning.skattesats_pst / 100)
  const netto_inntekt_mnd = totalInntektMnd - skatt_anslag_mnd

  // === SIKKERHET ===
  const annenSikkerhetNetto = husholdning.annen_sikkerhet_aktiv
    ? Math.max(0, husholdning.annen_bolig_verdi - husholdning.annen_bolig_lan)
    : 0

  // === LÅN ===
  const lanebehov = finansiering ? finansiering.lanebehov : (kalk.kjopesum * (1 - kalk.egenkapital_pst / 100))
  const mndBetaling = finansiering ? finansiering.mndBetaling : (() => {
    const r = kalk.rente_pst / 100 / 12
    return lanebehov > 0 && r > 0 ? (lanebehov * r) / (1 - Math.pow(1 + r, -25 * 12)) : 0
  })()
  const nettoMndBetaling = Math.max(0, mndBetaling - utleieMnd)
  const andreLanSum = husholdning.andre_lan.reduce((s, l) => s + (l.saldo || 0), 0)
  const andreLanMndSum = husholdning.andre_lan.reduce((s, l) => s + (l.mnd_betaling || 0), 0)

  // Total gjeld inkluderer eksisterende lån + nytt boliglån — minus tilgjengelig ekstra sikkerhet
  const justertNyttLan = Math.max(0, lanebehov - annenSikkerhetNetto)
  const totalGjeld = justertNyttLan + andreLanSum
  const totalMndBetjening = nettoMndBetaling + andreLanMndSum

  // === LIVSOPPHOLD ===
  const livsopphold = regnLivsopphold(husholdning.antall_voksne, husholdning.antall_barn)
  const disponibelEtterAlt = netto_inntekt_mnd - totalMndBetjening - livsopphold

  // === SCORE-DELER ===

  // 1. Gjeldsgrad ≤5x årsinntekt (Finanstilsynet)
  const gjeldsgrad = sumInntektAr > 0 ? (totalGjeld / sumInntektAr) : 0
  const gjeldsgradScore = sumInntektAr === 0 ? 0
    : gjeldsgrad <= 4 ? 100 : gjeldsgrad <= 5 ? 70 : gjeldsgrad <= 6 ? 35 : 10

  // 2. Belåningsgrad
  const belaningsgrad = finansiering ? finansiering.belaningsgrad : 0
  const belaningsgradScore = belaningsgrad === 0 ? 0
    : belaningsgrad <= 75 ? 100 : belaningsgrad <= 85 ? 60 : 25

  // 3. Betjeningsevne — disponibel etter livsopphold og all gjeld må være positiv
  const betjeningRatio = netto_inntekt_mnd > 0 ? (totalMndBetjening + livsopphold) / netto_inntekt_mnd : 1
  const betjeningScore = netto_inntekt_mnd === 0 ? 0
    : disponibelEtterAlt < 0 ? 5
    : betjeningRatio < 0.65 ? 100
    : betjeningRatio < 0.80 ? 75
    : betjeningRatio < 0.95 ? 45
    : 15

  // 4. Stresstest — rente +3pp på hovedboliglån
  const stressRente = (kalk.rente_pst + 3) / 100 / 12
  const stressMnd = lanebehov > 0 && stressRente > 0
    ? (lanebehov * stressRente) / (1 - Math.pow(1 + stressRente, -25 * 12))
    : 0
  const stressNettoMnd = Math.max(0, stressMnd - utleieMnd)
  const stressTotalMnd = stressNettoMnd + andreLanMndSum
  const stressDisponibel = netto_inntekt_mnd - stressTotalMnd - livsopphold
  const stressScore = netto_inntekt_mnd === 0 ? 0
    : stressDisponibel < 0 ? 5
    : stressDisponibel >= 5000 ? 100
    : stressDisponibel >= 2000 ? 65
    : 30

  const total = Math.round(
    gjeldsgradScore * 0.25 + belaningsgradScore * 0.25 + betjeningScore * 0.30 + stressScore * 0.20
  )
  const lys = total >= 75 ? '🟢' : total >= 55 ? '🟡' : '🔴'
  const lysTekst = total >= 75 ? 'Sterkt finansieringsgrunnlag'
    : total >= 55 ? 'Trolig akseptabelt — kan kreve dialog'
    : 'Vanskelig å få godkjent'

  return {
    sumInntektMnd, sumInntektAr, utleieMnd, totalInntektMnd, skatt_anslag_mnd, netto_inntekt_mnd,
    annenSikkerhetNetto,
    lanebehov, mndBetaling, nettoMndBetaling,
    andreLanSum, andreLanMndSum, totalGjeld, totalMndBetjening,
    livsopphold, disponibelEtterAlt,
    gjeldsgrad, gjeldsgradScore,
    belaningsgrad, belaningsgradScore,
    betjeningRatio, betjeningScore,
    stressMnd, stressNettoMnd, stressTotalMnd, stressDisponibel, stressScore,
    total, lys, lysTekst,
  }
}
