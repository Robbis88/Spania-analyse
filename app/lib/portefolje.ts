// Beregninger for Min portefølje. Pure-funksjoner som tar data fra
// portefølje-tabellene og returnerer KPI-er. Brukes i UI-kort, detalj-fane
// og dashboard-aggregator.

import type { EiendomKostnad, EiendomInntekt, EiendomLaan, EiendomVerdivurdering } from '../types'

const ETIKETT_KOSTNAD: Record<string, string> = {
  kommunale: 'Kommunale avgifter',
  forsikring: 'Forsikring',
  felleskostnader: 'Felleskostnader',
  strom: 'Strøm',
  internett: 'Internett',
  vedlikehold: 'Vedlikehold',
  eiendomsskatt: 'Eiendomsskatt',
  regnskap: 'Regnskap / gestor',
  ibi: 'IBI (Spania)',
  comunidad: 'Comunidad (Spania)',
  annet: 'Annet',
}
export const KOSTNAD_ETIKETT = ETIKETT_KOSTNAD

export const KOSTNAD_KATEGORIER = [
  'kommunale','forsikring','felleskostnader','strom','internett',
  'vedlikehold','eiendomsskatt','regnskap','ibi','comunidad','annet',
] as const

export const LAANETYPER = ['annuitet','serie','rammelaan','annet'] as const
export const LAANETYPE_ETIKETT: Record<string, string> = {
  annuitet: 'Annuitetslån',
  serie: 'Serielån',
  rammelaan: 'Rammelån',
  annet: 'Annet',
}

export const VURDERING_KILDER = ['e_takst','takstmann','megler','egen_vurdering','salg','annet'] as const
export const VURDERING_KILDE_ETIKETT: Record<string, string> = {
  e_takst: 'E-takst',
  takstmann: 'Takstmann',
  megler: 'Megler-vurdering',
  egen_vurdering: 'Egen vurdering',
  salg: 'Faktisk salg',
  annet: 'Annet',
}

export const EIERETAPPE_ETIKETT: Record<string, string> = {
  analyse: 'Analyse',
  under_kjop: 'Under kjøp',
  eid: 'Eid',
  under_oppussing: 'Under oppussing',
  salgsklar: 'Salgsklar',
  solgt: 'Solgt',
}

// Normaliser én kostnad til månedlig beløp uavhengig av frekvens.
// Engangs ekskluderes (regnes ikke som løpende månedskost).
export function kostnadPerMnd(k: EiendomKostnad, refDato = new Date()): number {
  if (k.frekvens === 'engangs') return 0
  if (k.startdato && new Date(k.startdato) > refDato) return 0
  if (k.sluttdato && new Date(k.sluttdato) < refDato) return 0
  if (k.frekvens === 'mnd') return k.belop || 0
  if (k.frekvens === 'aar') return (k.belop || 0) / 12
  return 0
}

// Sum av aktive kostnader per måned
export function sumKostnaderPerMnd(kostnader: EiendomKostnad[], refDato = new Date()): number {
  return kostnader.reduce((s, k) => s + kostnadPerMnd(k, refDato), 0)
}

// Velg gjeldende leieinntekt: aktiv kontrakt på refDato med høyest beløp.
// Hvis flere overlapper bruker vi summen (f.eks. korttid + langtid).
export function gjeldendeLeieMnd(inntekter: EiendomInntekt[], refDato = new Date()): number {
  return inntekter
    .filter(i => {
      if (i.startdato && new Date(i.startdato) > refDato) return false
      if (i.sluttdato && new Date(i.sluttdato) < refDato) return false
      return true
    })
    .reduce((s, i) => s + (i.belop_mnd || 0), 0)
}

// Total restgjeld (sum av alle aktive lån)
export function totalRestgjeld(laan: EiendomLaan[]): number {
  return laan.reduce((s, l) => s + (l.restgjeld || 0), 0)
}

// Normaliser et terminbeløp til månedlig ut fra terminfrekvens.
function perMnd(belop: number, frekvens: EiendomLaan['termin_frekvens']): number {
  if (frekvens === 'kvartal') return belop / 3
  if (frekvens === 'aar') return belop / 12
  return belop
}

// Rentedel per måned for ETT lån (den ekte kostnaden). Prioritet:
// eksplisitt rente_belop → beregnet fra restgjeld × rente → 0.
export function renterMndEn(l: EiendomLaan): number {
  if (l.rente_belop != null) return perMnd(l.rente_belop, l.termin_frekvens)
  if (l.restgjeld && l.rente_pst) return (l.restgjeld * (l.rente_pst / 100)) / 12
  return 0
}

// Avdragsdel per måned for ETT lån (bygger egenkapital — ikke en kostnad).
// Avdragsfritt = 0. Ellers: eksplisitt avdrag_belop → terminbeløp minus renter
// (bevarer gammel total nøyaktig) → 0.
export function avdragMndEn(l: EiendomLaan): number {
  if (l.avdragsfritt) return 0
  if (l.avdrag_belop != null) return perMnd(l.avdrag_belop, l.termin_frekvens)
  if (l.termin_belop != null) return Math.max(0, perMnd(l.termin_belop, l.termin_frekvens) - renterMndEn(l))
  return 0
}

// Sum rentekostnad per måned — brukes i RESULTAT/overskudd (leie − kost − renter).
export function totalRenterMnd(laan: EiendomLaan[]): number {
  return laan.reduce((s, l) => s + renterMndEn(l), 0)
}

// Sum avdrag per måned — penger ut som bygger egenkapital (ikke kostnad).
export function totalAvdragMnd(laan: EiendomLaan[]): number {
  return laan.reduce((s, l) => s + avdragMndEn(l), 0)
}

// Total lånebetaling per måned = renter + avdrag (CASHFLOW — penger ut).
// For rader med terminbeløp satt kanselleres rentedelen og resultatet blir
// nøyaktig terminbeløpet, som før — endringen er non-breaking for cashflow.
export function totalLaanKostnadMnd(laan: EiendomLaan[]): number {
  return laan.reduce((s, l) => s + renterMndEn(l) + avdragMndEn(l), 0)
}

// Antall hele måneder fra en startdato til nå (>= 0). Gjennomsnittsmåned.
export function maanederSiden(startISO: string | null, naaMs: number): number {
  if (!startISO) return 0
  const start = new Date(startISO).getTime()
  if (Number.isNaN(start) || start >= naaMs) return 0
  return Math.floor((naaMs - start) / (1000 * 60 * 60 * 24 * 30.4375))
}

// Akkumulert lånebetjening (renter + avdrag) fra hvert låns startdato til nå (B12).
// Kontant-effekt: penger ut av konto. Avdrag-delen motsvares av lavere restgjeld
// (holdes oppdatert manuelt, som LTV), så egenkapital blir nøytral for avdrag og
// negativ for renter. Beregnes live — ingen postering, ingen bakgrunnsjobb.
export function laanBetjeningHittil(laan: EiendomLaan[], naaMs: number): number {
  return laan.reduce((s, l) => s + (renterMndEn(l) + avdragMndEn(l)) * maanederSiden(l.startdato, naaMs), 0)
}

// Akkumulerte renter hittil (kun rentedelen — den ekte kostnaden som tærer egenkapital).
export function renterHittil(laan: EiendomLaan[], naaMs: number): number {
  return laan.reduce((s, l) => s + renterMndEn(l) * maanederSiden(l.startdato, naaMs), 0)
}

// Ser lagret restgjeld ut til å ikke være oppdatert? (B12-avhengighet: avdrag
// forutsetter at restgjeld holdes i sync, ellers blir egenkapital feil.)
// Heuristikk: for et avdragslån bør restgjeld ha falt med avdrag × måneder;
// er den vesentlig høyere (>5 % av hovedstol) ser den utdatert ut.
export function restgjeldVirkerUtdatert(l: EiendomLaan, naaMs: number): boolean {
  if (l.avdragsfritt || !l.startdato || !l.hovedstol || l.restgjeld == null) return false
  const forventetAvdrag = avdragMndEn(l) * maanederSiden(l.startdato, naaMs)
  if (forventetAvdrag <= 0) return false
  const forventetRestgjeld = l.hovedstol - forventetAvdrag
  return l.restgjeld > forventetRestgjeld + l.hovedstol * 0.05
}

// Siste verdivurdering (etter dato). Faller tilbake til 0.
export function sisteVerdi(vurderinger: EiendomVerdivurdering[]): number {
  if (vurderinger.length === 0) return 0
  const sortert = [...vurderinger].sort((a, b) => (b.dato || '').localeCompare(a.dato || ''))
  return sortert[0].verdi || 0
}

// LTV (loan-to-value) i prosent
export function belaningsgrad(restgjeld: number, verdi: number): number {
  if (verdi <= 0) return 0
  return (restgjeld / verdi) * 100
}

// Cashflow per måned: leie - kostnader - lånekostnad
export function cashflowMnd(opt: {
  leieMnd: number
  kostnaderMnd: number
  laanMnd: number
}): number {
  return opt.leieMnd - opt.kostnaderMnd - opt.laanMnd
}

// Yield brutto: årlig leie / verdi (prosent)
export function bruttoYield(leieMnd: number, verdi: number): number {
  if (verdi <= 0) return 0
  return ((leieMnd * 12) / verdi) * 100
}

// Statusfarge basert på cashflow
export function cashflowFarge(cf: number): 'gronn' | 'gul' | 'rod' {
  if (cf >= 1000) return 'gronn'
  if (cf >= -500) return 'gul'
  return 'rod'
}

// Annuitet — månedlig terminbeløp ved gitt rente
export function annuitetMnd(restgjeld: number, rentePst: number, nedbetalingsAar: number): number {
  if (restgjeld <= 0 || nedbetalingsAar <= 0) return 0
  const r = rentePst / 100 / 12
  const n = nedbetalingsAar * 12
  if (r === 0) return restgjeld / n
  return (restgjeld * r) / (1 - Math.pow(1 + r, -n))
}

// Stresstest — terminbeløp per måned ved rentesjokk
export function rentesjokk(laan: EiendomLaan[], paaSlag: number): number {
  return laan.reduce((s, l) => {
    if (l.laanetype !== 'annuitet' || !l.restgjeld || !l.rente_pst || !l.nedbetalingstid_aar) {
      // For ikke-annuitetslån eller manglende felt: fall tilbake til termin_belop
      return s + (l.termin_belop || 0)
    }
    return s + annuitetMnd(l.restgjeld, l.rente_pst + paaSlag, l.nedbetalingstid_aar)
  }, 0)
}
