export const KATEGORIER = [
  'Bad', 'Kjøkken', 'Soverom', 'Stue', 'Gang/entré',
  'Uteplass/terrasse', 'Basseng', 'Hage', 'Fasade utvendig', 'Tak', 'Annet',
] as const
export type Kategori = typeof KATEGORIER[number]

export const BUCKET_BILDER = 'prosjektbilder'

export const TILLATTE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAKS_STORRELSE_BYTES = 10 * 1024 * 1024

export const MAKS_BREDDE_PIKSLER = 2048

export function filendelse(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function lagStorageSti(prosjektId: string, bildeId: string, ext: string): string {
  return `${prosjektId}/${bildeId}.${ext}`
}
