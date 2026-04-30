// Pure-funksjoner for norsk flippe-kalkulator. Brukes både fra
// NorskeBoliger-komponenten (live i UI) og fra PDF-bygger (når vi
// rekonstruerer beregningen fra lagret state i Supabase).

export type Kalk = {
  kjopesum: number; fellesgjeld: number
  dokumentavgift_pst: number; tinglysing: number
  oppussing_kost: number; mobler_styling: number
  holdetid_mnd: number; rente_pst: number; egenkapital_pst: number; fellesutg_mnd: number
  salgspris: number; meglerhonorar_pst: number; marknadsforing: number
  skattefri: boolean; skattesats_pst: number
}

export type EksisterendeBolig = {
  salgssum: number; restgjeld: number
  meglerhonorar_pst: number; marknadsforing: number; skattefri: boolean
}

export type BoPlan = {
  bo_tid_mnd: number
  arlig_prisvekst_pst: number
}

export type UtleieDel = {
  aktiv: boolean
  leie_mnd: number
  belegg_pst: number
  drift_pst: number
  etableringskost: number
  skattefri: boolean
}

export type Modus = 'ren' | 'bo'

export type OppussingsPost = { navn: string; kostnad: number; notat: string }

export type Beregning = {
  totalKjopspris: number; dokavg: number; kjopskostnader: number; totalKjop: number
  oppussingTotal: number; lanebelop: number; renterTotal: number; fellesutgTotal: number; holdekostnad: number
  totalInvestering: number; meglerhonorar: number; salgskostnader: number; nettoSalg: number
  skattegrunnlag: number; skatt: number; nettoFortjeneste: number; egenkapital: number; roi: number
  utleieBidrag?: number
}

export type EksisterendeBeregning = {
  meglerhonorar: number
  salgskostnader: number
  skatt: number
  nettoTilDisposisjon: number
}

export type UtleieBeregning = {
  brutto_mnd: number
  netto_mnd: number
  brutto_total: number
  netto_total: number
  etableringskost: number
  skatt: number
}

export type Finansiering = {
  totalUtlegg: number
  tilgjengeligEK: number
  lanebehov: number
  overskudd: number
  belaningsgrad: number
  mndBetaling: number
}

export function regnEffektivKalk(kalk: Kalk, modus: Modus, boPlan: BoPlan): Kalk {
  if (modus !== 'bo' || !kalk.salgspris) return kalk
  const aar = boPlan.bo_tid_mnd / 12
  const faktor = Math.pow(1 + boPlan.arlig_prisvekst_pst / 100, aar)
  return {
    ...kalk,
    holdetid_mnd: boPlan.bo_tid_mnd,
    salgspris: Math.round(kalk.salgspris * faktor),
  }
}

export function regnEksisterende(modus: Modus, eks: EksisterendeBolig): EksisterendeBeregning {
  if (modus !== 'bo' || eks.salgssum === 0) {
    return { meglerhonorar: 0, salgskostnader: 0, skatt: 0, nettoTilDisposisjon: 0 }
  }
  const meglerhonorar = (eks.salgssum * eks.meglerhonorar_pst) / 100
  const salgskostnader = meglerhonorar + eks.marknadsforing
  const skattegrunnlag = eks.salgssum - salgskostnader - eks.restgjeld
  const skatt = eks.skattefri || skattegrunnlag <= 0 ? 0 : skattegrunnlag * 0.22
  const nettoTilDisposisjon = eks.salgssum - salgskostnader - eks.restgjeld - skatt
  return { meglerhonorar, salgskostnader, skatt, nettoTilDisposisjon }
}

export function regnUtleie(modus: Modus, utleieDel: UtleieDel, boTidMnd: number): UtleieBeregning {
  if (modus !== 'bo' || !utleieDel.aktiv || utleieDel.leie_mnd === 0) {
    return { brutto_mnd: 0, netto_mnd: 0, brutto_total: 0, netto_total: 0, etableringskost: 0, skatt: 0 }
  }
  const brutto_mnd = utleieDel.leie_mnd * (utleieDel.belegg_pst / 100)
  const drift_mnd = brutto_mnd * (utleieDel.drift_pst / 100)
  const netto_mnd_for_skatt = brutto_mnd - drift_mnd
  const brutto_total = brutto_mnd * boTidMnd
  const drift_total = drift_mnd * boTidMnd
  const skatt = utleieDel.skattefri ? 0 : (brutto_total - drift_total) * 0.22
  const netto_mnd = utleieDel.skattefri ? netto_mnd_for_skatt : netto_mnd_for_skatt * 0.78
  const netto_total = brutto_total - drift_total - skatt
  return { brutto_mnd, netto_mnd, brutto_total, netto_total, etableringskost: utleieDel.etableringskost, skatt }
}

export function regnUt(k: Kalk, utleieBidrag = 0, modus: Modus = 'ren', boTidMnd = 0): Beregning {
  const totalKjopspris = k.kjopesum + k.fellesgjeld
  const dokavg = (k.kjopesum * k.dokumentavgift_pst) / 100
  const kjopskostnader = dokavg + k.tinglysing
  const totalKjop = k.kjopesum + kjopskostnader

  const oppussingTotal = k.oppussing_kost + k.mobler_styling

  const lanebelop = totalKjop * (1 - k.egenkapital_pst / 100)
  const renterPerMnd = (lanebelop * k.rente_pst / 100) / 12
  const renterTotal = renterPerMnd * k.holdetid_mnd
  const fellesutgTotal = k.fellesutg_mnd * k.holdetid_mnd
  const holdekostnad = renterTotal + fellesutgTotal

  const totalInvestering = totalKjop + oppussingTotal + holdekostnad

  const meglerhonorar = (k.salgspris * k.meglerhonorar_pst) / 100
  const salgskostnader = meglerhonorar + k.marknadsforing
  const nettoSalg = k.salgspris - salgskostnader

  const skattegrunnlag = nettoSalg - (k.kjopesum + kjopskostnader + k.oppussing_kost + k.mobler_styling)
  const erSkattefri = k.skattefri || (modus === 'bo' && boTidMnd >= 12)
  const skatt = erSkattefri || skattegrunnlag <= 0 ? 0 : (skattegrunnlag * k.skattesats_pst) / 100

  const nettoFortjeneste = nettoSalg - totalInvestering - skatt + utleieBidrag
  const egenkapital = totalInvestering - lanebelop
  const roi = egenkapital > 0 ? (nettoFortjeneste / egenkapital) * 100 : 0

  return {
    totalKjopspris, dokavg, kjopskostnader, totalKjop,
    oppussingTotal, lanebelop, renterTotal, fellesutgTotal, holdekostnad,
    totalInvestering, meglerhonorar, salgskostnader, nettoSalg,
    skattegrunnlag, skatt, nettoFortjeneste, egenkapital, roi,
    utleieBidrag,
  }
}

export function regnFinansiering(modus: Modus, beregning: Beregning, eksisterendeBeregning: EksisterendeBeregning, kalk: Kalk): Finansiering | null {
  if (modus !== 'bo') return null
  const totalUtlegg = beregning.totalKjop + beregning.oppussingTotal
  const tilgjengeligEK = eksisterendeBeregning.nettoTilDisposisjon
  const lanebehov = Math.max(0, totalUtlegg - tilgjengeligEK)
  const overskudd = Math.max(0, tilgjengeligEK - totalUtlegg)
  const belaningsgrad = kalk.kjopesum > 0 ? (lanebehov / kalk.kjopesum) * 100 : 0
  const renteMnd = kalk.rente_pst / 100 / 12
  const antMnd = 25 * 12
  const mndBetaling = lanebehov > 0 && renteMnd > 0
    ? (lanebehov * renteMnd) / (1 - Math.pow(1 + renteMnd, -antMnd))
    : 0
  return { totalUtlegg, tilgjengeligEK, lanebehov, overskudd, belaningsgrad, mndBetaling }
}
