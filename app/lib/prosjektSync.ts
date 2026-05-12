// Bidirectional sync mellom `prosjekter`-tabellen (kilde for Oversikt og
// Årsrapport) og `utleieanalyse`-tabellen (kilde for Utleie-fanen).
//
// Vi synker kun felter som faktisk lagres begge steder, slik at brukeren
// aldri har to tall som ikke matcher:
//   1. Leie/mnd  — leieinntekt_mnd  ↔  langtidsleie_maned (kun ved leietype='langtid')
//   2. Lån/mnd   — lån_mnd          ↔  lan.maanedlig_renter_avdrag
//
// Drift (felles/strøm/forsikring/forvaltning) bor i `prosjekter`, og
// `airbnb_data.kostnader_arlig` brukes som AI-prognose i Utleie-fanen
// — de er ikke duplikat data og synkes ikke.

import type { Prosjekt, Utleieanalyse, LanInfo } from '../types'

type SyncbareFelterProsjekt = Pick<Prosjekt, 'leieinntekt_mnd' | 'lån_mnd'>

// Hva som skal oppdateres i utleieanalyse basert på prosjekt
export function utleieanalyseFraProsjekt(p: Prosjekt, eksisterende: Utleieanalyse): Partial<Utleieanalyse> {
  const oppdatering: Partial<Utleieanalyse> = {}

  // Leie — kun for langtid (korttid bruker scenarier som ikke er i denne tabellen)
  if (eksisterende.leietype === 'langtid' && (p.leieinntekt_mnd || 0) > 0) {
    oppdatering.langtidsleie_maned = p.leieinntekt_mnd
  }

  // Lån — oppdater månedsbetalingen, behold rente/nedbetalingstid
  if ((p.lån_mnd || 0) > 0) {
    const lan: LanInfo = {
      ...(eksisterende.lan || {}),
      maanedlig_renter_avdrag: p.lån_mnd,
    }
    oppdatering.lan = lan
  }

  return oppdatering
}

// Hva som skal oppdateres i prosjekt basert på utleieanalyse
export function prosjektFraUtleieanalyse(a: Utleieanalyse): Partial<SyncbareFelterProsjekt> {
  const oppdatering: Partial<SyncbareFelterProsjekt> = {}

  // Leie — kun ved langtid (korttid har sesongvariasjon, ikke fast månedstall)
  if (a.leietype === 'langtid' && typeof a.langtidsleie_maned === 'number' && a.langtidsleie_maned > 0) {
    oppdatering.leieinntekt_mnd = Math.round(a.langtidsleie_maned)
  }

  // Lån
  if (a.lan?.maanedlig_renter_avdrag) {
    oppdatering.lån_mnd = Math.round(a.lan.maanedlig_renter_avdrag)
  }

  return oppdatering
}

// Sjekker om økonomi-felt på prosjektet er endret — brukes til å unngå
// unødvendige Supabase-skrivinger.
export function harProsjektEndringer(forrige: Prosjekt, ny: Prosjekt): boolean {
  return forrige.leieinntekt_mnd !== ny.leieinntekt_mnd
    || forrige.lån_mnd !== ny.lån_mnd
}

// Tilsvarende for utleieanalyse
export function harUtleieEndringer(forrige: Utleieanalyse, ny: Utleieanalyse): boolean {
  if (forrige.leietype !== ny.leietype) return true
  if ((forrige.langtidsleie_maned || 0) !== (ny.langtidsleie_maned || 0)) return true
  if ((forrige.lan?.maanedlig_renter_avdrag || 0) !== (ny.lan?.maanedlig_renter_avdrag || 0)) return true
  return false
}
