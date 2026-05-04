// Konstanter, typer og hjelpefunksjoner for kvittering- og fakturahåndtering.
// Filer ligger i samme private storage-bucket som juridiske dokumenter, men
// under sti-prefiks `kvitteringer/<prosjekt_id>/`.

export const BUCKET_DOKUMENTER = 'dokumenter'

export const KVITTERING_TILLATTE_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
] as const
export type KvitteringMime = typeof KVITTERING_TILLATTE_MIME[number]

export const KVITTERING_MAKS_STORRELSE_BYTES = 15 * 1024 * 1024  // 15 MB — PDF-er kan være større enn bilder

export const KVITTERING_KATEGORIER = [
  'elektriker', 'maling', 'kjokken', 'bad', 'rorlegger',
  'gulv', 'mobler', 'mur_betong', 'tak_fasade',
  'hage_uteplass', 'hvitevarer', 'verktoy', 'avgifter', 'div',
] as const
export type KvitteringKategori = typeof KVITTERING_KATEGORIER[number]

export const KVITTERING_KATEGORI_ETIKETT: Record<KvitteringKategori, string> = {
  elektriker: 'Elektriker',
  maling: 'Maling',
  kjokken: 'Kjøkken',
  bad: 'Bad',
  rorlegger: 'Rørlegger',
  gulv: 'Gulv',
  mobler: 'Møbler',
  mur_betong: 'Mur / betong',
  tak_fasade: 'Tak / fasade',
  hage_uteplass: 'Hage / uteplass',
  hvitevarer: 'Hvitevarer',
  verktoy: 'Verktøy',
  avgifter: 'Avgifter / gebyr',
  div: 'Diverse',
}

export const KVITTERING_ROM = [
  'kjokken', 'bad', 'stue', 'sov', 'gang', 'kjeller', 'loft', 'felles', 'utomhus',
] as const
export type KvitteringRom = typeof KVITTERING_ROM[number]

export const KVITTERING_ROM_ETIKETT: Record<KvitteringRom, string> = {
  kjokken: 'Kjøkken',
  bad: 'Bad',
  stue: 'Stue',
  sov: 'Soverom',
  gang: 'Gang / entré',
  kjeller: 'Kjeller',
  loft: 'Loft',
  felles: 'Fellesareal',
  utomhus: 'Utomhus',
}

export type OcrStatus = 'venter' | 'analysert' | 'feilet'

export const OCR_MODELL = 'claude-sonnet-4-5'

export function kvitteringFilendelse(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function kvitteringStorageSti(prosjektId: string, id: string, ext: string): string {
  return `kvitteringer/${prosjektId}/${id}.${ext}`
}
