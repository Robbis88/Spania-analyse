// Konstanter for dokumentarkiv. Bruker samme private storage-bucket som
// kvitteringer (BUCKET_DOKUMENTER), under sti-prefiks `dokumenter/<prosjekt_id>/`.

import { BUCKET_DOKUMENTER } from './kvittering'
export { BUCKET_DOKUMENTER }

export const DOKUMENT_TILLATTE_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const
export type DokumentMime = typeof DOKUMENT_TILLATTE_MIME[number]

export const DOKUMENT_MAKS_STORRELSE_BYTES = 25 * 1024 * 1024  // 25 MB — kontrakter med signaturer kan være store

export const DOKUMENT_TYPER = [
  // Spania
  'escritura', 'nota_simple', 'ibi', 'vft_lisens', 'suministros',
  'energiattest', 'comunidad', 'cedula_habitabilidad',
  // Norge
  'takst', 'salgsoppgave', 'egenerklaring', 'ferdigattest',
  'tilstandsrapport', 'seksjoneringspapirer',
  // Felles
  'kjopskontrakt', 'forsikring', 'byggetegninger', 'annet',
] as const
export type DokumentType = typeof DOKUMENT_TYPER[number]

export const DOKUMENT_ETIKETT: Record<DokumentType, string> = {
  // Spania
  escritura: 'Escritura (skjøte)',
  nota_simple: 'Nota Simple',
  ibi: 'IBI (eiendomsskatt)',
  vft_lisens: 'VFT-turistlisens',
  suministros: 'Suministros (strøm/vann/gass)',
  energiattest: 'Energiattest',
  comunidad: 'Comunidad-vedtekter / kostnader',
  cedula_habitabilidad: 'Cédula de habitabilidad',
  // Norge
  takst: 'Takst / verdivurdering',
  salgsoppgave: 'Salgsoppgave / prospekt',
  egenerklaring: 'Egenerklæring',
  ferdigattest: 'Ferdigattest / brukstillatelse',
  tilstandsrapport: 'Tilstandsrapport',
  seksjoneringspapirer: 'Seksjoneringspapirer',
  // Felles
  kjopskontrakt: 'Kjøpekontrakt',
  forsikring: 'Forsikring',
  byggetegninger: 'Byggetegninger',
  annet: 'Annet',
}

// Standardsett som autopopulerer dokument_sjekkpunkter ved første åpning av
// dokumentarkivet. Brukeren kan legge til/fjerne typer manuelt etterpå.
export const STANDARD_SJEKKPUNKTER_SPANIA: DokumentType[] = [
  'escritura', 'nota_simple', 'ibi', 'vft_lisens',
  'energiattest', 'comunidad', 'cedula_habitabilidad',
  'kjopskontrakt', 'forsikring',
]

export const STANDARD_SJEKKPUNKTER_NORGE: DokumentType[] = [
  'takst', 'salgsoppgave', 'egenerklaring', 'tilstandsrapport',
  'energiattest', 'ferdigattest', 'kjopskontrakt', 'forsikring',
]

export type SjekkpunktStatus = 'mangler' | 'i_prosess' | 'ok' | 'ikke_relevant'

export const SJEKKPUNKT_STATUS_LBL: Record<SjekkpunktStatus, string> = {
  mangler: '○ Mangler',
  i_prosess: '◐ I prosess',
  ok: '● OK',
  ikke_relevant: '— Ikke relevant',
}

export const SJEKKPUNKT_STATUS_FARGE: Record<SjekkpunktStatus, { bg: string; tekst: string }> = {
  mangler: { bg: '#fde8ec', tekst: '#7a0c1e' },
  i_prosess: { bg: '#fff8e1', tekst: '#7a4a08' },
  ok: { bg: '#e8f5ed', tekst: '#1a4d2b' },
  ikke_relevant: { bg: '#f0ede5', tekst: '#5a6171' },
}

export function dokumentFilendelse(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'application/msword') return 'doc'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return 'bin'
}

export function dokumentStorageSti(prosjektId: string, id: string, ext: string): string {
  return `dokumenter/${prosjektId}/${id}.${ext}`
}
