// Konstanter og hjelpere for opplastede tilbud (B8). Ligger i samme private
// bucket som dokumenter/kvitteringer, under prefiks `tilbud/<prosjekt_id>/`.

export const BUCKET_DOKUMENTER = 'dokumenter'

export const TILBUD_TILLATTE_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
] as const

export const TILBUD_MAKS_STORRELSE_BYTES = 15 * 1024 * 1024

export const TILBUD_OCR_MODELL = 'claude-sonnet-4-5'

export const ARBEIDSTYPER = [
  'totalrenovering', 'bad', 'kjokken', 'elektriker', 'rorlegger', 'maling',
  'gulv', 'tak_fasade', 'mur_betong', 'vinduer_dorer', 'hage_uteplass', 'riving', 'annet',
] as const
export type Arbeidstype = typeof ARBEIDSTYPER[number]

export const ARBEIDSTYPE_ETIKETT: Record<Arbeidstype, string> = {
  totalrenovering: 'Totalrenovering',
  bad: 'Bad',
  kjokken: 'Kjøkken',
  elektriker: 'Elektriker',
  rorlegger: 'Rørlegger',
  maling: 'Maling',
  gulv: 'Gulv',
  tak_fasade: 'Tak / fasade',
  mur_betong: 'Mur / betong',
  vinduer_dorer: 'Vinduer / dører',
  hage_uteplass: 'Hage / uteplass',
  riving: 'Riving',
  annet: 'Annet',
}

export function tilbudFilendelse(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function tilbudStorageSti(prosjektId: string, id: string, ext: string): string {
  return `tilbud/${prosjektId}/${id}.${ext}`
}
