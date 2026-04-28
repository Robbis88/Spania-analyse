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
  airbnb_data?: AirbnbData | null
  salgsanalyse_data?: SalgsanalyseData | null
  salgsanalyse_generert?: string | null
  salgsanalyse_modell_versjon?: string | null
  dokumentcheck_status?: Record<string, DokumentStatus> | null
  publisert_utleie?: boolean
  utleie_pris_natt?: number | null
  utleie_pris_uke?: number | null
  utleie_min_netter?: number | null
  utleie_maks_gjester?: number | null
  utleie_beskrivelse?: string | null
  utleie_kort_beskrivelse?: string | null
  utleie_fasiliteter?: string[] | null
  publisert_salg?: boolean
  salgspris_eur?: number | null
  salg_kort_beskrivelse?: string | null
  salg_beskrivelse?: string | null
  byggear?: number | null
  tomt_m2?: number | null
  kort_avstand?: Record<string, string> | null
  navn_oversettelser?: Record<string, string> | null
  utleie_kort_oversettelser?: Record<string, string> | null
  utleie_beskrivelse_oversettelser?: Record<string, string> | null
  salg_kort_oversettelser?: Record<string, string> | null
  salg_beskrivelse_oversettelser?: Record<string, string> | null
  utleie_fasiliteter_oversettelser?: Record<string, string[]> | null
  oversettelser_oppdatert?: string | null
}

export type UtleieForesporsel = {
  id: string
  prosjekt_id: string | null
  navn: string
  epost: string
  telefon: string | null
  fra_dato: string | null
  til_dato: string | null
  antall_gjester: number | null
  melding: string | null
  sendt_til_epost: string | null
  resend_id: string | null
  opprettet: string
}

export type DokumentStatus = {
  huket: boolean
  notat: string
  oppdatert: string
}

export type SalgsanalyseData = {
  salgsannonse: {
    intro: string
    bullets: string[]
    beskrivelse: string
    omraade: string
    cta: string
  }
  bildeplan: {
    interior: string[]
    eksterior: string[]
    fasiliteter: string[]
    naeromraade: string[]
    tips: string[]
  }
  dokumentcheck: Array<{
    navn: string
    status: 'ok' | 'mangler' | 'maa_sjekkes'
    kommentar: string
  }>
  prisstrategi: {
    estimert_markedspris_eur: number
    estimert_markedspris_begrunnelse: string
    strategi_rask: { pris_eur: number; begrunnelse: string }
    strategi_maks: { pris_eur: number; begrunnelse: string }
    anbefalte_tiltak: string[]
  }
  investeringsanalyse: {
    korttid_arlig_inntekt_eur: number
    korttid_begrunnelse: string
    langtid_arlig_inntekt_eur: number
    langtid_begrunnelse: string
    yield_pst: number
    roi_kommentar: string
    sesong_varierer: string
    vurdering: 'sterk' | 'middels' | 'svak'
  }
  forbedringsforslag: Array<{
    tiltak: string
    kostnad_estimat_eur: number
    verdi_potensial_eur: number
    prioritet: 'hoy' | 'middels' | 'lav'
  }>
  malgruppe: {
    primaer: 'investor' | 'feriebolig' | 'fastboende' | 'utleie'
    sekundaer: 'investor' | 'feriebolig' | 'fastboende' | 'utleie' | 'ingen'
    begrunnelse: string
  }
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
  kilde_bilde_id?: string | null
}

export type AirbnbVurdering = 'sterk' | 'middels' | 'middels_svak' | 'svak'
export type AirbnbAnbefaltLeietype = 'korttid' | 'langtid' | 'begge'

export type AirbnbKonklusjon = {
  vurdering: AirbnbVurdering
  egnethet_score: number
  anbefalt_leietype: AirbnbAnbefaltLeietype
}

export type AirbnbManed = {
  maaned: number
  nattpris_ar1: number
  nattpris_etablert: number
  belegg_ar1: number
  belegg_etablert: number
  brutto_ar1: number
}

export type AirbnbScenario = {
  brutto_ar1: number
  brutto_etablert: number
  netto_etablert: number
  yield_pct: number
  belegg_etablert: number
}

export type AirbnbKostnaderArlig = {
  airbnb_kommisjon?: number
  renhold?: number
  strom_vann?: number
  internett?: number
  comunidad?: number
  forsikring?: number
  ibi?: number
  basura?: number
  vedlikehold?: number
  management?: number
  leietakerregistrering?: number
}

export type AirbnbLangtidsleie = {
  maaned_lav?: number
  maaned_hoy?: number
  arlig_brutto_lav?: number
  arlig_brutto_hoy?: number
}

export type AirbnbMaksOppussing = {
  yield_5_pct?: number
  yield_6_pct?: number
  yield_7_pct?: number
}

export type AirbnbData = {
  versjon: number
  generert: string
  konklusjon: AirbnbKonklusjon
  maaneder: AirbnbManed[]
  scenarier: {
    konservativt: AirbnbScenario
    realistisk: AirbnbScenario
    sterkt: AirbnbScenario
  }
  kostnader_arlig: AirbnbKostnaderArlig
  langtidsleie?: AirbnbLangtidsleie
  maks_oppussing?: AirbnbMaksOppussing
}

export type Leietype = 'korttid' | 'langtid'
export type UtleieScenario = 'konservativt' | 'realistisk' | 'sterkt'

export type LanInfo = {
  lanebelop?: number
  rente_prosent?: number
  nedbetalingstid_ar?: number
  maanedlig_renter_avdrag?: number
}

export type OppussingPerAr = {
  ar: number
  kostnad: number
}

export type AIForslagOppussing = {
  navn: string
  kostnad_estimat_lav: number
  kostnad_estimat_hoy: number
  begrunnelse: string
}

export type AIForslagTillegg = {
  tillegg: string
  beskrivelse: string
  kostnad_estimat_lav: number
  kostnad_estimat_hoy: number
  verdiokning_estimat: string
  regulering_vurdering: 'sannsynlig_ok' | 'ma_sjekkes' | 'sannsynlig_problematisk'
  regulering_begrunnelse: string
  ma_sjekkes_videre: string[]
  begrunnelse: string
}

export type OppussingTillegg = {
  id: string
  bolig_id: string
  navn: string
  tillegg_type: string | null
  kostnad: number
  verdiokning_estimat: string | null
  regulering_vurdering: 'sannsynlig_ok' | 'ma_sjekkes' | 'sannsynlig_problematisk' | null
  regulering_begrunnelse: string | null
  ma_sjekkes_videre: string[] | null
  notat: string | null
  rekkefolge: number
  kilde_bilde_id: string | null
  opprettet: string
}

export type BildeType = 'original' | 'generert'
export type VisualiseringType = 'oppussing' | 'tillegg' | 'kombinert'

export type Prosjektbilde = {
  id: string
  prosjekt_id: string
  type: BildeType
  visualisering_type: VisualiseringType | null
  kategori: string | null
  storage_sti: string
  filnavn: string | null
  bredde: number | null
  hoyde: number | null
  original_bilde_id: string | null
  stil: string | null
  standard: string | null
  tillegg_type: string | null
  tilleggsnotat: string | null
  er_valgt_for_pdf: boolean
  ai_beskrivelse: string | null
  ai_synlige_problemer: unknown
  ai_foreslatte_poster: unknown
  ai_potensielle_tillegg: unknown
  ai_salgbarhet_score: number | null
  ai_analysert: string | null
  ai_modell_versjon: string | null
  replicate_id: string | null
  generert_av: string | null
  opprettet_av: string
  opprettet: string
  er_marketing?: boolean
  marketing_rekkefolge?: number | null
}

export type FaktiskeInntekter = Record<string, number>

export type Utleieanalyse = {
  id: string
  bolig_id: string
  leietype: Leietype
  scenario: UtleieScenario
  progresjon_til_etablert_ar: number
  total_kjopspris: number | null
  kjopsmaaned: string | null
  utleiestart: string | null
  horisont_ar: number
  oppussing_per_ar: OppussingPerAr[]
  lan: LanInfo | null
  langtidsleie_maned: number | null
  faktiske_inntekter: FaktiskeInntekter
  analyse_kilde_id: string | null
  analyse_hentet: string | null
  opprettet: string
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
  bruker: '',
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
