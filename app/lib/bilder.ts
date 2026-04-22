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

// Resizer bilde i nettleseren før opplasting — unngår Vercel sin 4.5 MB body-grense
// og respekterer EXIF-orientering (iPhone-bilder).
export async function resizKlient(fil: File, maksBredde = MAKS_BREDDE_PIKSLER, kvalitet = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(fil, { imageOrientation: 'from-image' })
  const skala = Math.min(1, maksBredde / bitmap.width)
  const w = Math.round(bitmap.width * skala)
  const h = Math.round(bitmap.height * skala)
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  if (!ctx) throw new Error('Kunne ikke opprette canvas-context')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob: Blob = canvas instanceof OffscreenCanvas
    ? await canvas.convertToBlob({ type: 'image/jpeg', quality: kvalitet })
    : await new Promise<Blob>((res, rej) => (canvas as HTMLCanvasElement).toBlob(b => b ? res(b) : rej(new Error('toBlob feilet')), 'image/jpeg', kvalitet))
  const nyttNavn = fil.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nyttNavn, { type: 'image/jpeg', lastModified: Date.now() })
}

export const AI_MODELL_VERSJON = 'claude-sonnet-4-5'

// Grovt kostnadsestimat for bildeanalyse (Claude vision) i EUR.
// Base + megapiksel-avhengig tillegg. Resultat er indikativt, ikke nøyaktig pris.
export function estimerAnalyseKostnadEUR(bilder: { bredde?: number | null; hoyde?: number | null }[]): number {
  return bilder.reduce((sum, b) => {
    const mp = ((b.bredde || 1024) * (b.hoyde || 1024)) / 1_000_000
    const usd = 0.015 + mp * 0.005
    return sum + usd * 0.92
  }, 0)
}

export const TILLEGG_TYPER = [
  'basseng', 'utebad', 'pergola', 'outdoor_kitchen', 'jacuzzi',
  'takterrasse', 'carport', 'terrasse_utvidelse', 'solavskjerming', 'annet',
] as const
export type TilleggType = typeof TILLEGG_TYPER[number]

export const TILLEGG_ETIKETT: Record<TilleggType, string> = {
  basseng: 'Basseng',
  utebad: 'Utebad',
  pergola: 'Pergola',
  outdoor_kitchen: 'Outdoor kitchen',
  jacuzzi: 'Jacuzzi',
  takterrasse: 'Takterrasse',
  carport: 'Carport',
  terrasse_utvidelse: 'Terrasse-utvidelse',
  solavskjerming: 'Solavskjerming',
  annet: 'Annet',
}

export type ReguleringVurdering = 'sannsynlig_ok' | 'ma_sjekkes' | 'sannsynlig_problematisk'

export const REGULERING_ETIKETT: Record<ReguleringVurdering, string> = {
  sannsynlig_ok: 'Sannsynlig OK',
  ma_sjekkes: 'Må sjekkes',
  sannsynlig_problematisk: 'Sannsynlig problematisk',
}

export const REGULERING_FARGE: Record<ReguleringVurdering, { bg: string; border: string; tekst: string }> = {
  sannsynlig_ok: { bg: '#e8f5ed', border: '#2D7D46', tekst: '#1a4d2b' },
  ma_sjekkes: { bg: '#fff8e1', border: '#B05E0A', tekst: '#6b3a0a' },
  sannsynlig_problematisk: { bg: '#fde8ec', border: '#C8102E', tekst: '#7a0c1e' },
}

// Stiler for visualisering. Verdiene lagres på prosjekt_bilder.stil.
// Prompt-fragmentet legges på slutten av genererings-prompten.
// 'egen' lar brukeren skrive fritekst som sendes som egen_prompt-felt.
export const STILER = [
  { id: '', navn: 'Ingen spesifikk stil', prompt: '' },
  { id: 'moderne', navn: 'Moderne / minimalistisk', prompt: 'Modern minimalist style: clean lines, neutral palette, matte finishes, integrated lighting, contemporary fixtures.' },
  { id: 'mediterran', navn: 'Mediterran / klassisk spansk', prompt: 'Mediterranean Spanish style: warm terracotta and white tones, wrought iron details, rustic wood beams, handmade tiles, arched openings where natural.' },
  { id: 'luksus', navn: 'Luksus / high-end', prompt: 'High-end luxury finish: premium materials like marble and stone, brushed brass accents, sophisticated layered lighting, designer fixtures.' },
  { id: 'skandinavisk', navn: 'Skandinavisk', prompt: 'Scandinavian style: light oak, white walls, minimalist clutter-free composition, soft daylight, simple functional furniture.' },
  { id: 'industriell', navn: 'Industriell', prompt: 'Industrial style: exposed concrete and brick, black metal fixtures, Edison-style lighting, raw textures, open layout.' },
  { id: 'boho', navn: 'Boho / middelhavs-nomadisk', prompt: 'Bohemian Mediterranean style: earthy tones, natural linen textiles, rattan and wicker, abundant greenery, eclectic layered décor.' },
  { id: 'egen', navn: '✏️ Egen stil (skriv selv)', prompt: '' },
] as const
export type StilId = typeof STILER[number]['id']
