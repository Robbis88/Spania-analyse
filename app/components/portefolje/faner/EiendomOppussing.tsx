'use client'
import { Oppussingsbudsjett } from '../../Oppussingsbudsjett'
import type { EiendomData } from '../useEiendomData'

// Tynn wrapper rundt eksisterende Oppussingsbudsjett.
// Får samme funksjonalitet som Spania/Norge: poster med status, faktisk vs
// budsjett, frist, ansvarlig, kobling til kvitteringer, AI-forslag fra
// bildeanalyse, sensitivitet og salgsestimat.
export function EiendomOppussing({ data, onEndret }: {
  data: EiendomData
  onEndret: () => void | Promise<void>
}) {
  if (!data.prosjekt) return null
  return <Oppussingsbudsjett prosjekt={data.prosjekt} onProsjektOppdatert={onEndret} />
}
