import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'portal-tilgang'
const TRETTI_DAGER = 60 * 60 * 24 * 30

// Mottar passord, validerer mot PORTAL_PASSORD og setter cookie
// så middleware slipper brukeren videre. HTTPOnly = ikke lesbart fra JS.
export async function POST(req: NextRequest) {
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
    res.cookies.set(COOKIE, passordForventet, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TRETTI_DAGER,
      path: '/',
    })
    return res
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
