// Pure-funksjoner for norsk flippe-kalkulator. Brukes både fra
// NorskeBoliger-komponenten (live i UI) og fra PDF-bygger (når vi
// rekonstruerer beregningen fra lagret state i Supabase).

export type Kalk = {
  kjopesum: number; fellesgjeld: number
  dokumentavgift_pst: number; tinglysing: number
  oppussing_kost: number; mobler_styling: number
  holdetid_mnd: number; rente_pst: number; egenkapital_pst: number; fellesutg_mnd: number
  nedbetalingstid_aar?: number  // ny boliglån — default 25
  salgspris: number; meglerhonorar_pst: number; marknadsforing: number
  skattefri: boolean; skattesats_pst: number
}

export type EksisterendeBolig = {
  modus?: 'selg' | 'behold'
  salgssum: number; restgjeld: number
  meglerhonorar_pst: number; marknadsforing: number; skattefri: boolean
  // Behold-felter
  verdi_naa?: number
  opprinnelig_kjopspris?: number
  mnd_lan_betaling?: number
  rente_pst_gammel?: number
  restlopetid_aar_gammel?: number
  utleie_horisont_aar?: number
  utleie_mnd_brutto?: number
  utleie_belegg_pst?: number
  utleie_drift_pst?: number
  utleie_skattepliktig?: boolean
  arlig_prisvekst_pst?: number
  paakostninger?: Array<{ beskrivelse: string; aar: number; belop: number; type?: 'paakostning' | 'vedlikehold' }>
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

  // Bank-vurdering nå (kun kjøp + omkostninger — det banken faktisk vurderer)
  kjopslan: number               // det banken låner ut til selve kjøpet
  belaningsgrad_kjop: number     // mot kjøpesum
  mndBetaling_kjop: number       // termin på kun kjøpslånet

  // Egenfinansiering for oppussing + møbler (banken finansierer ikke dette)
  egenfin_oppussing: number      // oppussing + møbler etter at evt. rest-EK er brukt
  ek_brukt_paa_oppussing: number // hvor mye av rest-EK som dekker oppussing

  // Etter oppussing: refinansiering mot ny markedsverdi
  total_lan_etter_oppussing: number   // kjøpslån + oppussing (refinansiert)
  belaningsgrad_etter_oppussing: number  // mot forventet salgspris (markedsverdi etter oppussing)
  mndBetaling_etter_oppussing: number    // termin på det totale refinansierte lånet
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
  const antMnd = (kalk.nedbetalingstid_aar && kalk.nedbetalingstid_aar > 0 ? kalk.nedbetalingstid_aar : 25) * 12
  const annuitet = (laan: number) =>
    laan > 0 && renteMnd > 0 ? (laan * renteMnd) / (1 - Math.pow(1 + renteMnd, -antMnd)) : 0

  const mndBetaling = annuitet(lanebehov)

  // === BANK-VURDERING NÅ (kun kjøp + omkostninger) ===
  // Banken finansierer ikke oppussing/møbler. EK brukes først til å dekke kjøp;
  // resten av EK dekker oppussing.
  const ekBruktPaaKjop = Math.min(tilgjengeligEK, beregning.totalKjop)
  const kjopslan = Math.max(0, beregning.totalKjop - ekBruktPaaKjop)
  const restEk = Math.max(0, tilgjengeligEK - beregning.totalKjop)
  const ekBruktPaaOppussing = Math.min(restEk, beregning.oppussingTotal)
  const egenfinOppussing = Math.max(0, beregning.oppussingTotal - ekBruktPaaOppussing)
  const belaningsgradKjop = kalk.kjopesum > 0 ? (kjopslan / kalk.kjopesum) * 100 : 0
  const mndBetalingKjop = annuitet(kjopslan)

  // === ETTER OPPUSSING (refinansiering mot ny markedsverdi) ===
  const totalLanEtter = kjopslan + beregning.oppussingTotal
  const belaningsgradEtter = kalk.salgspris > 0 ? (totalLanEtter / kalk.salgspris) * 100 : 0
  const mndBetalingEtter = annuitet(totalLanEtter)

  return {
    totalUtlegg, tilgjengeligEK, lanebehov, overskudd, belaningsgrad, mndBetaling,
    kjopslan, belaningsgrad_kjop: belaningsgradKjop, mndBetaling_kjop: mndBetalingKjop,
    egenfin_oppussing: egenfinOppussing, ek_brukt_paa_oppussing: ekBruktPaaOppussing,
    total_lan_etter_oppussing: totalLanEtter,
    belaningsgrad_etter_oppussing: belaningsgradEtter,
    mndBetaling_etter_oppussing: mndBetalingEtter,
  }
}
