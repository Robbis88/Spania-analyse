'use client'
import { Kvitteringer } from '../../Kvitteringer'
import type { EiendomData } from '../useEiendomData'

// Tynn wrapper rundt eksisterende Kvitteringer-komponent.
// Norge-portefølje bruker NOK som standard valuta.
export function EiendomKvitteringer({ data }: { data: EiendomData }) {
  if (!data.prosjekt) return null
  return <Kvitteringer prosjektId={data.prosjekt.id} valuta={data.prosjekt.marked === 'norge' ? 'NOK' : 'EUR'} />
}
