// Enkel in-memory rate-limit per IP, gruppert etter "bøtte"
// (auth, portal-tilgang, leie-foresporsel, ...). God nok for én Vercel-instans
// og lav trafikk — bremser brute-force og åpenbar misbruk.
//
// Begrensninger: state lever per node-prosess. Skalering til flere instanser
// krever Redis e.l. — utenfor scope nå.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

type Spor = { tider: number[] }
const RYDD_HVER_MS = 5 * 60_000  // 5 min mellom GC

const butikker = new Map<string, Map<string, Spor>>()
let sisteRydd = Date.now()

function hentIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'ukjent'
}

function maybeGc(naa: number, vinduMs: number) {
  if (naa - sisteRydd < RYDD_HVER_MS) return
  sisteRydd = naa
  for (const [bot, m] of butikker) {
    for (const [ip, spor] of m) {
      spor.tider = spor.tider.filter(t => naa - t < vinduMs)
      if (spor.tider.length === 0) m.delete(ip)
    }
    if (m.size === 0) butikker.delete(bot)
  }
}

type Resultat = { ok: true } | { ok: false; respons: NextResponse }

export function sjekkRateLimit(
  req: NextRequest,
  botte: string,
  opt: { maks: number; vinduMs: number },
): Resultat {
  const naa = Date.now()
  maybeGc(naa, opt.vinduMs)
  const ip = hentIp(req)
  let m = butikker.get(botte)
  if (!m) { m = new Map(); butikker.set(botte, m) }
  let spor = m.get(ip)
  if (!spor) { spor = { tider: [] }; m.set(ip, spor) }
  spor.tider = spor.tider.filter(t => naa - t < opt.vinduMs)
  if (spor.tider.length >= opt.maks) {
    const eldste = spor.tider[0]
    const venteSek = Math.max(1, Math.ceil((opt.vinduMs - (naa - eldste)) / 1000))
    return {
      ok: false,
      respons: NextResponse.json(
        { feil: 'For mange forsøk. Prøv igjen senere.' },
        { status: 429, headers: { 'Retry-After': String(venteSek) } },
      ),
    }
  }
  spor.tider.push(naa)
  return { ok: true }
}
