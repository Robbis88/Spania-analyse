'use client'
// C6 — EUR/NOK-omregning for Lo Casas-visning. Henter kurs fra frankfurter.app
// (gratis, ingen nøkkel), cacher i localStorage i 24t, faller tilbake til en
// rimelig kurs offline. Erstatter useValuta som lå i den slettede i18n.ts (Fase A).

import { useEffect, useState } from 'react'

const CACHE_KEY = 'lo-eurnok-kurs'
const FALLBACK_EUR_NOK = 11.6
const MAKS_ALDER_MS = 24 * 60 * 60 * 1000

function lesCache(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { v, t } = JSON.parse(raw) as { v: number; t: number }
    if (typeof v === 'number' && v > 0 && Date.now() - t < MAKS_ALDER_MS) return v
  } catch { /* ignorer */ }
  return null
}

// Returnerer hvor mange NOK én EUR er verdt.
export function useEurNokKurs(): number {
  const [kurs, setKurs] = useState<number>(() => lesCache() ?? FALLBACK_EUR_NOK)

  useEffect(() => {
    let avbrutt = false
    fetch('https://api.frankfurter.app/latest?from=EUR&to=NOK')
      .then(r => r.json())
      .then((d: { rates?: { NOK?: number } }) => {
        const v = d?.rates?.NOK
        if (!avbrutt && typeof v === 'number' && v > 0) {
          setKurs(v)
          try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ v, t: Date.now() })) } catch { /* ignorer */ }
        }
      })
      .catch(() => { /* beholder cache/fallback */ })
    return () => { avbrutt = true }
  }, [])

  return kurs
}

// «€120 000 (~1,4 MNOK)» — kort NOK-ekvivalent i parentes.
export function eurMedNok(belopEur: number, eurNok: number): string {
  const eur = '€' + Math.round(belopEur).toLocaleString('nb-NO')
  const nok = belopEur * eurNok
  const nokKort = nok >= 1_000_000 ? (nok / 1_000_000).toFixed(1).replace('.', ',') + ' MNOK' : Math.round(nok).toLocaleString('nb-NO') + ' kr'
  return `${eur} (~${nokKort})`
}
