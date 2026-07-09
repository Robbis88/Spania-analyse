// Konstanter og hjelpere for Bilagsinnboksen (integrasjonsklar regnskapsimport).
// Se BILAG_IMPORT.md. Dokumenter ligger i samme private bucket som tilbud/
// kvitteringer, under prefiks `bilag/<id>`.

export const BILAG_BUCKET = 'dokumenter'

export const BILAG_TILLATTE_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
] as const

export const BILAG_MAKS_BYTES = 15 * 1024 * 1024

export const BILAG_STATUSER = ['ny', 'foreslatt', 'godkjent', 'laast', 'avvist'] as const

export const BILAG_STATUS_ETIKETT: Record<string, string> = {
  ny: 'Ny',
  foreslatt: 'AI-forslag',
  godkjent: 'Godkjent',
  laast: 'Låst',
  avvist: 'Avvist',
}

// Farge per status (statuslys i innboksen).
export const BILAG_STATUS_FARGE: Record<string, 'gra' | 'gull' | 'gronn' | 'mork' | 'rod'> = {
  ny: 'gra',
  foreslatt: 'gull',
  godkjent: 'gronn',
  laast: 'mork',
  avvist: 'rod',
}

export function bilagFilendelse(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function bilagStorageSti(id: string, ext: string): string {
  return `bilag/${id}.${ext}`
}
