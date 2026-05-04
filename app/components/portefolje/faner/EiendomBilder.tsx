'use client'
import { ProsjektBilder } from '../../ProsjektBilder'
import type { EiendomData } from '../useEiendomData'

// Tynn wrapper rundt ProsjektBilder.
// Brukeren kan laste opp original-bilder, kjøre AI-analyse og generere
// før/etter-visualiseringer (Flux Kontext) — samme flyt som i andre seksjoner.
export function EiendomBilder({ data }: { data: EiendomData }) {
  if (!data.prosjekt) return null
  return <ProsjektBilder prosjektId={data.prosjekt.id} />
}
