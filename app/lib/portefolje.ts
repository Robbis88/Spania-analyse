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

// Total terminbeløp per måned (normalisert fra terminfrekvens)
export function totalLaanKostnadMnd(laan: EiendomLaan[]): number {
  return laan.reduce((s, l) => {
    const t = l.termin_belop || 0
    if (l.termin_frekvens === 'mnd') return s + t
    if (l.termin_frekvens === 'kvartal') return s + t / 3
    if (l.termin_frekvens === 'aar') return s + t / 12
    return s
  }, 0)
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
