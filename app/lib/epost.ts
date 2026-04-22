import { Resend } from 'resend'

export const FRA_ADRESSE = 'Leganger Eiendom <post@loeiendom.com>'

export const FORMAAL = [
  'bank_finansieringssamtale',
  'megler_boligsporsmal',
  'megler_befaring',
  'megler_bud',
  'selger_kontakt',
  'haandverker_tilbud',
  'annet',
] as const
export type Formaal = typeof FORMAAL[number]

export const MOTTAKER_TYPE = ['bank', 'selger', 'megler', 'haandverker', 'annet'] as const
export type MottakerType = typeof MOTTAKER_TYPE[number]

export const FORMAAL_ETIKETT: Record<Formaal, string> = {
  bank_finansieringssamtale: 'Bank – finansieringssamtale',
  megler_boligsporsmal: 'Megler – boligspørsmål',
  megler_befaring: 'Megler – befaring',
  megler_bud: 'Megler – bud',
  selger_kontakt: 'Selger – kontakt',
  haandverker_tilbud: 'Håndverker – tilbud',
  annet: 'Annet',
}

const STANDARD_SIGNATUR_LINJER = [
  'Leganger & Osvaag Eiendom',
  'post@loeiendom.com',
  'loeiendom.com',
]

export function byggSignatur(bruker: string): string {
  const navn = bruker.charAt(0).toUpperCase() + bruker.slice(1).toLowerCase()
  const linjerRaw = process.env.EPOST_SIGNATUR_LINJER
  const linjer = linjerRaw ? linjerRaw.split('|').map(l => l.trim()).filter(Boolean) : STANDARD_SIGNATUR_LINJER
  return ['---', navn, ...linjer].join('\n')
}

export function byggInnholdMedSignatur(innhold: string, bruker: string): string {
  return innhold.trimEnd() + '\n\n' + byggSignatur(bruker)
}

const EPOST_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function validerEpostadresse(e: string): boolean {
  return typeof e === 'string' && EPOST_REGEX.test(e.trim())
}

export function hentResendKlient(): Resend {
  const noekkel = process.env.RESEND_API_KEY
  if (!noekkel) throw new Error('RESEND_API_KEY er ikke satt')
  return new Resend(noekkel)
}

export function erGyldigFormaal(f: unknown): f is Formaal {
  return typeof f === 'string' && (FORMAAL as readonly string[]).includes(f)
}

export function erGyldigMottakerType(m: unknown): m is MottakerType {
  return typeof m === 'string' && (MOTTAKER_TYPE as readonly string[]).includes(m)
}
