import { NextRequest, NextResponse } from 'next/server'
import { sjekkRateLimit } from '../../lib/rateLimit'
import { portalToken } from '../../lib/portalAuth'

const COOKIE = 'portal-tilgang'
const TRETTI_DAGER = 60 * 60 * 24 * 30

// Mottar passord, validerer mot PORTAL_PASSORD og setter cookie
// med en utledet token (ikke selve passordet) så cookien ikke avslører
// hemmeligheten selv hvis den lekkes ut av HTTPOnly-rammen.
export async function POST(req: NextRequest) {
  const rl = sjekkRateLimit(req, 'portal-tilgang', { maks: 10, vinduMs: 60_000 })
  if (!rl.ok) return rl.respons
  try {
    const passordForventet = process.env.PORTAL_PASSORD
    if (!passordForventet) {
      // Ingen passord satt — alle har tilgang
      return NextResponse.json({ suksess: true })
    }

    const { passord } = await req.json()
    if (typeof passord !== 'string' || passord !== passordForventet) {
      return NextResponse.json({ feil: 'Feil passord' }, { status: 401 })
    }

    const res = NextResponse.json({ suksess: true })
    res.cookies.set(COOKIE, await portalToken(passordForventet), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TRETTI_DAGER,
      path: '/',
    })
    return res
  } catch (e) {
    console.error('Portal-tilgang feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Tilgang feilet' }, { status: 500 })
  }
}
