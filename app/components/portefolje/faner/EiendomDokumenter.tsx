'use client'
import { Dokumenter } from '../../Dokumenter'
import type { EiendomData } from '../useEiendomData'

// Tynn wrapper rundt eksisterende Dokumenter-komponent.
// Sjekklisten autopopuleres med Norge-spesifikke dokumenttyper basert på
// prosjekt.marked (takst, salgsoppgave, energiattest, ferdigattest osv.).
export function EiendomDokumenter({ data }: { data: EiendomData }) {
  if (!data.prosjekt) return null
  return <Dokumenter prosjektId={data.prosjekt.id} />
}
