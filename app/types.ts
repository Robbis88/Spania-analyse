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

// Skatteprofil per selskap (redigerbar i admin). Land-avhengig form.
// Defaults ligger i app/lib/skatteprofil.ts og speiler dagens hardkodede satser.
export type SkatteprofilNorge = {
  gevinstskatt_pst: number
  dokumentavgift_pst: number
  botid_fritak_mnd: number
  utleie_skatt_pst: number
}
export type SkatteprofilSpania = {
  gevinst_eu_pst: number
  gevinst_ikke_eu_pst: number
  retention_pst: number
  vft_krav: boolean
}
export type Skatteprofil = SkatteprofilNorge | SkatteprofilSpania

export type Selskap = {
  id: string
  navn: string
  land: 'norge' | 'spania'
  valuta: 'NOK' | 'EUR'
  skatteprofil: Skatteprofil
  fri_likviditet?: number
  laanekapasitet?: number
  opprettet?: string
}

export type Maal = {
  id: string
  selskap_id: string | null
  beskrivelse: string
  maaltall: number
  enhet: 'antall_boliger' | 'egenkapital' | 'cashflow_mnd'
  frist: string | null
  opprettet?: string
}

export type EstimatJustering = {
  id: string
  prosjekt_id: string
  felt: string
  ai_verdi: number | null
  min_verdi: number | null
  faktisk_verdi?: number | null
  kontekst?: { marked?: string; kommune?: string; type?: string } | null
  tidspunkt?: string
}

export type Tilbud = {
  id: string
  prosjekt_id: string
  bruker?: string
  storage_sti?: string | null
  filnavn?: string | null
  mime_type?: string | null
  ocr_status: 'venter' | 'analysert' | 'feilet' | 'manuelt'
  aktor: string | null
  totalsum: number | null
  valuta: 'NOK' | 'EUR' | null
  poster: Array<{ navn: string; sum: number }> | null
  inkluderer: string | null
  ekskluderer: string | null
  gyldig_til: string | null
  arbeidstype: string | null
  akseptert: boolean
  er_internt: boolean
  notat: string | null
  ocr_radata?: unknown
  ocr_kjort?: string | null
  ocr_feilmelding?: string | null
  opprettet?: string
}

// Enhet i en fler-enhets utleiebolig (B4b) — seksjonering til flere leiligheter.
// Hybrid (B4d): kan kombinere langtidsleie + Airbnb i sesong (student vinter, Airbnb sommer).
export type Enhet = {
  navn?: string | null
  leie_mnd: number
  drift_mnd: number
  korttid_mnd?: number | null        // antall mnd/år på Airbnb (0 = kun langtid)
  korttid_inntekt_mnd?: number | null // Airbnb-inntekt/mnd i sesong (etter renhold/kommisjon)
}

// Oppussingspost (B4c) — én kostnadslinje i flipp-oppussingen.
export type Oppussingspost = { navn?: string | null; kost: number }

export type KontantbevegelseType =
  | 'innskudd' | 'laaneopptak' | 'kjop' | 'omkostninger' | 'oppussing'
  | 'driftskostnad' | 'renter' | 'avdrag' | 'leieinntekt' | 'uttak' | 'annet'

export type Kontantbevegelse = {
  id: string
  selskap_id: string
  prosjekt_id: string | null
  dato: string
  type: KontantbevegelseType
  belop: number            // fortegnssatt: + øker kontanter, − reduserer
  valuta: 'NOK' | 'EUR'
  kilde: string
  kilde_id: string | null
  notat: string | null
  opprettet?: string
}

export type Konsernlaan = {
  id: string
  fra_selskap: string | null
  til_selskap: string | null
  hovedstol: number
  valuta: 'NOK' | 'EUR'
  rente_pct: number
  startdato: string
  nedbetalinger: Array<{ dato: string; belop: number }>
  notat?: string | null
  opprettet?: string
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
  // Norske boliger
  marked?: 'spania' | 'norge'
  selskap_id?: string | null
  markedsleie_mnd?: number | null
  // Tidsstyrt motor (B4): planforutsetninger. ARV = forventet_salgsverdi (over).
  oppussing_varighet_mnd?: number | null   // hvor lenge oppussingen tar (mnd)
  forventet_leie_mnd?: number | null        // planleie før faktiske inntekter finnes
  enheter?: Enhet[] | null                  // fler-enhets utleie (B4b): seksjonering til N leiligheter
  oppussing_poster?: Oppussingspost[] | null // flipp-oppussing linje for linje (B4c)
  oppussing_utleie?: number | null           // lett oppussing for utleie-veien (B4c)
  verdi_utleie?: number | null               // verdi etter lett oppussing, for refi (B4c)
  strategi?: 'flipp' | 'langtid' | 'korttid' | 'uavklart'
  vft_status?: 'har' | 'sokt' | 'mangler' | null
  eierform?: string | null
  fellesgjeld_nok?: number | null
  fellesutgifter_mnd_nok?: number | null
  kommunale_avgifter_aar_nok?: number | null
  energimerke?: string | null
  adresse?: string | null
  // Komplett kalkulator-state for norske prosjekter — lagres som JSONB
  // slik at hele flyten kan lastes inn igjen senere uten datatap.
  norsk_kalkulator_data?: Record<string, unknown> | null
  // Salgsmål brukt i dashboard ROI-anbefaling
  salgsmaal_eur?: number | null
  salgsmaal_nok?: number | null
  // UI-filter: brukernavn som ikke skal se prosjektet i sine lister
  // (ren klient-skjuling, ikke ekte tilgangskontroll)
  skjult_for?: string[] | null
  // Min portefølje-felter (utvidelse 2026-05)
  er_portefolje?: boolean
  eieretappe?: 'analyse' | 'under_kjop' | 'eid' | 'salgsklar' | 'solgt'
  portefolje_ai_data?: Record<string, unknown> | null
  portefolje_ai_generert?: string | null
  portefolje_ai_modell_versjon?: string | null
  // Off-market vurdering (utvidelse 2026-05-24)
  off_market?: boolean
  off_market_data?: Record<string, unknown> | null
}

export type EiendomLaan = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string
  bank: string | null
  laanetype: 'annuitet' | 'serie' | 'rammelaan' | 'annet' | null
  hovedstol: number | null
  restgjeld: number | null
  rente_pst: number | null
  rentetype: 'flytende' | 'fast' | null
  bindingstid_aar: number | null
  termin_belop: number | null           // total per termin (renter + avdrag)
  rente_belop: number | null            // rentedel per termin (valgfri splitt)
  avdrag_belop: number | null           // avdragsdel per termin (valgfri splitt)
  avdragsfritt: boolean                 // rent rentelån — ingen avdrag
  termin_frekvens: 'mnd' | 'kvartal' | 'aar'
  nedbetalingstid_aar: number | null
  startdato: string | null
  notat: string | null
}

export type EiendomLeietaker = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string
  navn: string
  epost: string | null
  telefon: string | null
  notat: string | null
}

export type EiendomInntekt = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string
  type: 'langtidsleie' | 'korttidsleie' | 'annet' | null
  leietaker_id: string | null
  belop_mnd: number | null
  depositum: number | null
  startdato: string | null
  sluttdato: string | null
  notat: string | null
}

export type EiendomKostnad = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string
  kategori: 'kommunale' | 'forsikring' | 'felleskostnader' | 'strom' | 'internett' | 'vedlikehold' | 'eiendomsskatt' | 'ibi' | 'comunidad' | 'annet' | null
  beskrivelse: string | null
  belop: number
  frekvens: 'mnd' | 'aar' | 'engangs'
  startdato: string | null
  sluttdato: string | null
  notat: string | null
}

// Bilagsinnboks — integrasjonsklar modell for fremtidig regnskapsimport.
// Se BILAG_IMPORT.md. Importerte bilag bokføres IKKE på nytt (regnskap = fasit);
// de brukes til styring: prosjektregnskap, kostnadskontroll, cashflow, avvik.
export type BilagStatus = 'ny' | 'foreslatt' | 'godkjent' | 'laast' | 'avvist'

export type BilagAiForslag = {
  prosjekt_id?: string | null
  selskap_id?: string | null
  kategori?: string | null
  underkategori?: string | null
  felt?: Partial<Pick<Bilag, 'leverandor' | 'faktura_dato' | 'forfall_dato' | 'belop' | 'mva' | 'valuta' | 'fakturanummer'>>
  begrunnelse?: string | null
}

export type Bilag = {
  id: string
  bruker: string
  opprettet: string
  selskap_id: string | null
  prosjekt_id: string | null
  leverandor: string | null
  faktura_dato: string | null
  forfall_dato: string | null
  belop: number | null
  mva: number | null
  valuta: 'NOK' | 'EUR'
  bilagsnummer: string | null
  fakturanummer: string | null
  kategori: string | null
  underkategori: string | null
  storage_sti: string | null
  filnavn: string | null
  mime_type: string | null
  ai_forslag: BilagAiForslag | null
  status: BilagStatus
  godkjent_av: string | null
  godkjent_tid: string | null
  kilde: string
  ekstern_id: string | null
  ekstern_data: Record<string, unknown> | null
  import_batch: string | null
  notat: string | null
}

export type EiendomVerdivurdering = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string
  dato: string
  verdi: number
  kilde: 'e_takst' | 'takstmann' | 'megler' | 'egen_vurdering' | 'salg' | 'annet' | null
  utstedt_av: string | null
  notat: string | null
  // Vedlegg — PDF, bilde eller annen dokumentasjon. NULL = ingen fil.
  storage_sti: string | null
  filnavn: string | null
  mime_type: string | null
}

export type Timeloggning = {
  id: string
  bruker: string
  dato: string
  timer: number
  beskrivelse: string | null
  prosjekt_id: string | null
  opprettet: string
}

export type HandverkerFag =
  | 'rorlegger' | 'rorlegger_avlop' | 'elektriker' | 'flislegger' | 'maler' | 'snekker'
  | 'mur_betong' | 'maskin' | 'tak_fasade' | 'vvs' | 'vinduer'
  | 'hage_uteplass' | 'oppvarming' | 'annet'

export type Handverker = {
  id: string
  bruker: string
  opprettet: string
  navn: string
  firma: string | null
  fag: HandverkerFag[]
  omrade: string | null
  telefon: string | null
  epost: string | null
  whatsapp: string | null
  sprak: 'no' | 'en' | 'es'
  timepris_eur: number | null
  evaluering: number | null
  notat: string | null
  aktiv: boolean
}

export type Tilbudsforesporsel = {
  id: string
  bruker: string
  opprettet: string
  handverker_id: string
  prosjekt_id: string | null
  oppussing_post_id: string | null
  tittel: string
  beskrivelse_no: string
  beskrivelse_sendt: string | null
  sendt_sprak: 'no' | 'en' | 'es' | null
  bilde_ids: string[]
  status: 'utkast' | 'sendt' | 'svart' | 'avtalt' | 'avvist' | 'utlopt'
  tilbud_belop_eur: number | null
  oppfolging_dato: string | null
  intern_notat: string | null
  sendt_via: 'epost' | 'whatsapp' | 'annet' | null
  resend_id: string | null
  feilmelding: string | null
  sendt_tidspunkt: string | null
}

export const HANDVERKER_FAG_ETIKETT: Record<HandverkerFag, string> = {
  rorlegger: 'Rørlegger',
  rorlegger_avlop: 'Rørlegger (avløp)',
  elektriker: 'Elektriker',
  flislegger: 'Flislegger',
  maler: 'Maler',
  snekker: 'Snekker',
  mur_betong: 'Mur / betong',
  maskin: 'Maskin / graving',
  tak_fasade: 'Tak / fasade',
  vvs: 'VVS',
  vinduer: 'Vinduer / glass',
  hage_uteplass: 'Hage / uteplass',
  oppvarming: 'Varme / klimaanlegg',
  annet: 'Annet',
}

export type EiendomCashflow = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string
  maaned: string  // YYYY-MM
  inntekt: number
  kostnad: number
  notat: string | null
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
  // Status- og fremdriftsfelt (utvidelse 2026-05)
  status?: 'ikke_startet' | 'pagar' | 'ferdig'
  faktisk_kostnad?: number | null
  frist?: string | null
  ferdig_dato?: string | null
  ansvarlig?: string | null
}

export type Dokument = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string

  tittel: string
  type: string
  storage_sti: string
  filnavn: string | null
  mime_type: string | null

  utstedt_dato: string | null
  gyldig_til: string | null
  notat: string | null
  tagger: string[]
}

export type DokumentSjekkpunkt = {
  id: string
  prosjekt_id: string
  dokument_type: string
  status: 'mangler' | 'i_prosess' | 'ok' | 'ikke_relevant'
  ansvarlig: string | null
  frist: string | null
  notat: string | null
  oppdatert: string
}

export type Kvittering = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string

  storage_sti: string
  filnavn: string | null
  mime_type: string | null

  ocr_status: 'venter' | 'analysert' | 'feilet'
  ocr_kjort: string | null
  ocr_radata: Record<string, unknown> | null
  ocr_feilmelding: string | null

  dato: string | null
  belop_eks_mva: number | null
  mva: number | null
  belop_inkl_mva: number | null
  valuta: 'NOK' | 'EUR' | null
  leverandor: string | null
  leverandor_orgnr: string | null
  dokument_nr: string | null

  kategori: string | null
  rom: string | null
  oppussing_post_id: string | null

  tagger: string[]
  notat: string | null
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
