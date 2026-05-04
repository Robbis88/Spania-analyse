// Felles helper for portal-tilgangs-cookien. Vi lagrer ikke selve PORTAL_PASSORD
// i cookien — i stedet en stabil token utledet via HMAC. Token-en byttes hvis
// passordet eller AUTH_SECRET endres, og avslører ikke passordet om cookien
// kommer på avveie.
//
// Brukes både av middleware (Edge runtime) og /api/portal-tilgang (Node) —
// derfor bruker vi Web Crypto, som finnes i begge.

function hentNokkel(): string {
  const eksplisit = process.env.AUTH_SECRET
  if (eksplisit && eksplisit.length >= 16) return eksplisit
  return (process.env.APP_USERS || '') + '|' + (process.env.APP_PASSWORD || '') + '|leganger-osvaag'
}

function tilHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < view.length; i++) s += view[i].toString(16).padStart(2, '0')
  return s
}

export async function portalToken(passord: string): Promise<string> {
  const enc = new TextEncoder()
  const nokkel = await crypto.subtle.importKey(
    'raw', enc.encode(hentNokkel()),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', nokkel, enc.encode('portal:' + passord))
  return tilHex(sig)
}
