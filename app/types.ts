export type Melding = { role: 'user' | 'assistant'; content: string }

export type Oppgave = {
  id: string
  tittel: string
  ansvar: string
  prioritet: 'hast' | 'normal' | 'lav'
  status: 'aktiv' | 'ferdig'
  frist: string
  opprettet: string
}

export type Måned = { måned: string; inntekt: number; kostnad: number; notat: string }

export type BoligData = {
  type?: string
  beliggenhet?: string
  soverom?: string | number
  bad?: string | number
  areal?: string | number
  avstand_strand?: string | number
  basseng?: string
  parkering?: string
  havutsikt?: string
  standard?: string
  pris?: string | number
  ekstra?: string
  markedspris_standard_m2?: number
  markedspris_bra_m2?: number
  markedspris_luksus_m2?: number
  markedspris_begrunnelse?: string
  oppussing_vurdering?: string
  anbefalt_strategi?: string
  vft_score?: number
}

export type AirbnbScore = {
  lokasjon?: number
  eiendom?: number
  pris_vs_marked?: number
  airbnb_potensial?: number
  cashflow?: number
  oppussing_potensial?: number
  risiko?: number
  total?: number
  lys?: string
  lysTekst?: string
  lysInfo?: string
  brutto_ar1?: number
  brutto_etablert?: number
  netto_estimat?: number
  maks_oppussing_5pst?: number
  maks_oppussing_6pst?: number
  maks_oppussing_7pst?: number
  tips?: string[]
}

export type Prosjekt = {
  id: string
  bruker: string
  navn: string
  status: string
  dato_kjopt: string
  kategori: 'flipp' | 'utleie'
  kjøpesum: number
  kjøpskostnader: number
  oppussingsbudsjett: number
  oppussing_faktisk: number
  møblering: number
  forventet_salgsverdi: number
  leieinntekt_mnd: number
  lån_mnd: number
  fellesutgifter_mnd: number
  strøm_mnd: number
  forsikring_mnd: number
  forvaltning_mnd: number
  notater: string
  måneder: Måned[]
  bolig_data?: BoligData | null
  ai_vurdering?: string | null
  airbnb_analyse?: string | null
  airbnb_score?: AirbnbScore | null
}

export type OppussingStandard = 'standard' | 'bra' | 'luksus'

export type LopendePerManed = {
  renter_avdrag?: number
  strom?: number
  forsikring?: number
  felleskost?: number
  ibi?: number
  annet?: number
}

export type OppussingBudsjett = {
  id: string
  bolig_id: string
  standard: OppussingStandard
  antall_maneder: number
  lopende_per_maned: LopendePerManed
  estimert_salgspris: number | null
  estimat_begrunnelse: string | null
  estimat_usikkerhet: string | null
  estimat_oppdatert: string | null
  estimat_poster_sum: number | null
  opprettet: string
}

export type OppussingPost = {
  id: string
  budsjett_id: string
  navn: string
  kostnad: number
  notat: string | null
  rekkefolge: number
}

export type SalgInput = {
  salgspris: number
  megler_pst: number
  advokat_pst: number
  plusvalia: number
  skatteresidens: 'eu' | 'ikke_eu'
  ventetid_ar: number
}

export type Bolig = {
  type: string
  beliggenhet: string
  soverom: string
  bad: string
  areal: string
  avstand_strand: string
  basseng: string
  parkering: string
  havutsikt: string
  standard: string
  pris: string
  ekstra: string
  markedspris_bra_m2: string
  oppbudsjett: string
}

export const tomtProsjekt = (): Prosjekt => ({
  id: Date.now().toString(),
  bruker: 'leganger',
  navn: '',
  status: 'Under vurdering',
  kategori: 'utleie',
  dato_kjopt: '',
  kjøpesum: 0,
  kjøpskostnader: 0,
  oppussingsbudsjett: 0,
  oppussing_faktisk: 0,
  møblering: 0,
  forventet_salgsverdi: 0,
  leieinntekt_mnd: 0,
  lån_mnd: 0,
  fellesutgifter_mnd: 0,
  strøm_mnd: 0,
  forsikring_mnd: 0,
  forvaltning_mnd: 0,
  notater: '',
  måneder: [],
})

export const tomBolig = (): Bolig => ({
  type: '', beliggenhet: '', soverom: '', bad: '', areal: '', avstand_strand: '',
  basseng: 'felles', parkering: 'privat', havutsikt: 'nei', standard: 'moderne',
  pris: '', ekstra: '', markedspris_bra_m2: '', oppbudsjett: '',
})
