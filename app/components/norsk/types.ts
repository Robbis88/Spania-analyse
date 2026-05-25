// Delte typer for norsk flippe-/utleie-kalkulator. Tidligere definert
// inline i NorskeBoliger.tsx — flyttet hit så sub-komponenter kan importere
// uten å bli en del av samme megafil.

export type Modus = 'ren' | 'bo'

export type Paakostning = {
  beskrivelse: string  // f.eks. "Nytt bad 2022", "Kjøkken 2020"
  aar: number          // når kostnaden ble utført
  belop: number        // kostnad i NOK
  type?: 'paakostning' | 'vedlikehold' // default 'paakostning' for bakoverkompatibilitet
}

export type EksisterendeBolig = {
  modus: 'selg' | 'behold'
  // Selg-felter
  salgssum: number
  restgjeld: number
  meglerhonorar_pst: number
  marknadsforing: number
  skattefri: boolean
  // Behold-og-leie-ut-felter
  verdi_naa: number             // markedsverdi i dag
  opprinnelig_kjopspris: number // hva du betalte da du kjøpte (for inngangsverdi-beregning)
  mnd_lan_betaling: number      // mnd betaling på eksisterende boliglån
  rente_pst_gammel: number      // rente på det gamle boliglånet (presis avdragsplan)
  restlopetid_aar_gammel: number // restløpetid på gammelt lån
  utleie_horisont_aar: number   // hvor lenge planlegger du å leie ut
  utleie_mnd_brutto: number     // forventet brutto leieinntekt
  utleie_belegg_pst: number     // 95% typisk for langtid
  utleie_drift_pst: number      // 15-20% til vedlikehold/forsikring/etc
  utleie_skattepliktig: boolean // når den ikke er primærbolig — typisk skattepliktig
  arlig_prisvekst_pst: number   // forventet prisvekst på den gamle boligen
  paakostninger: Paakostning[]  // påkostninger som øker inngangsverdi
}

export type Sammenligning = {
  selgFrigjort: number
  beholdVerdivekst: number
  beholdAvdragSum: number
  beholdNettoLeie: number
  beholdEkstraRente: number
  beholdEKGammel: number
  beholdTotalt: number
  selgTotalt: number
  differanse: number
  anbefaling: 'behold' | 'selg' | 'likt'
  aar: number
}

// Husholdning — input til bank-vurdering (inntekter, lån, sikkerhet)
import type { Inntektskilde, AnnetLan } from '../../lib/norskBankScore'

export type Husholdning = {
  antall_voksne: number    // 1 eller 2 typisk
  antall_barn: number      // antall barn under 18
  inntekter: Inntektskilde[]
  skattesats_pst: number   // for å regne netto av brutto-inntekt
  andre_lan: AnnetLan[]
  annen_sikkerhet_aktiv: boolean
  annen_bolig_verdi: number
  annen_bolig_lan: number
  annen_bolig_beskrivelse: string
}

// Local fmt-helper: kalkulator-semantikk hvor «0 kr» er en gyldig
// verdi (intensjonelt skille fra «–» som betyr «ikke fylt inn»).
export const fmtNokKalk = (n: number): string =>
  Math.round(n).toLocaleString('nb-NO') + ' kr'
