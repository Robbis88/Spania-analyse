// Skatteprofil — satser per selskap/land. Defaultene her speiler nøyaktig de
// satsene som tidligere var hardkodet i beregningsfunksjonene, slik at atferden
// er uendret inntil et selskaps profil sier noe annet.
//
// B1.1: beregningsfunksjonene tar nå satser som parameter (med disse som default).
// Formlene er ikke endret — bare tallene er gjort redigerbare.

import type { Skatteprofil, SkatteprofilNorge, SkatteprofilSpania } from '../types'

export const SKATTEPROFIL_NORGE_DEFAULT: SkatteprofilNorge = {
  gevinstskatt_pst: 22,
  dokumentavgift_pst: 2.5,
  botid_fritak_mnd: 12,
  utleie_skatt_pst: 22,
}

export const SKATTEPROFIL_SPANIA_DEFAULT: SkatteprofilSpania = {
  gevinst_eu_pst: 19,
  gevinst_ikke_eu_pst: 24,
  retention_pst: 3,
  vft_krav: true,
}

export function defaultSkatteprofil(land: 'norge' | 'spania'): Skatteprofil {
  return land === 'norge' ? { ...SKATTEPROFIL_NORGE_DEFAULT } : { ...SKATTEPROFIL_SPANIA_DEFAULT }
}

// Type-guards — trygg tilgang uavhengig av hvor profilen kommer fra (DB kan
// inneholde delvise/gamle profiler).
export function erNorge(p: Skatteprofil | null | undefined): p is SkatteprofilNorge {
  return !!p && 'gevinstskatt_pst' in p
}
export function erSpania(p: Skatteprofil | null | undefined): p is SkatteprofilSpania {
  return !!p && 'gevinst_eu_pst' in p
}

// Slår sammen en (muligens delvis) lagret profil med defaults for landet.
export function medDefaults(land: 'norge' | 'spania', lagret?: Partial<Skatteprofil> | null): Skatteprofil {
  return { ...defaultSkatteprofil(land), ...(lagret || {}) } as Skatteprofil
}

// Gevinst-/utleiesats uavhengig av land (Spania: bruker ikke-EU-sats som default).
export function gevinstSatsPst(p: Skatteprofil): number {
  return erNorge(p) ? p.gevinstskatt_pst : p.gevinst_ikke_eu_pst
}
export function utleieSatsPst(p: Skatteprofil): number {
  return erNorge(p) ? p.utleie_skatt_pst : p.gevinst_ikke_eu_pst
}
