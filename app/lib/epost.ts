import { Resend } from 'resend'

export const FRA_ADRESSE = 'Leganger Eiendom <post@loeiendom.com>'
export const SVAR_ADRESSE = 'post@loeiendom.com'

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

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Bygger en enkel HTML-versjon av e-posten. Microsoft/Outlook foretrekker
// at både text/plain og text/html er tilstede — begge tolkes av spam-
// filtre, og mangler på HTML-versjon er en svak negativ signal.
export function byggHtmlFraTekst(tekst: string): string {
  // Del på --- for å markere signatur-skiller med HR
  const deler = tekst.split(/\n---\n/)
  const kropp = deler[0]
  const signatur = deler[1]

  // Auto-lenke enkle URL-er
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g
  function lenk(s: string) {
    return escHtml(s).replace(urlRegex, '<a href="$1" style="color:#185FA5">$1</a>')
  }

  const avsnitt = kropp.split(/\n\n+/).map(a => {
    const linjer = a.split('\n').map(l => lenk(l)).join('<br>')
    return `<p style="margin:0 0 14px 0">${linjer}</p>`
  }).join('\n')

  const signaturHtml = signatur
    ? `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0 12px">\n<div style="color:#666;font-size:13px;line-height:1.5">${signatur.split('\n').map(l => lenk(l)).join('<br>')}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="no">
<head><meta charset="utf-8"><title></title></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6">
<div style="max-width:620px;margin:0 auto;padding:20px">
${avsnitt}
${signaturHtml}
</div>
</body>
</html>`
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
