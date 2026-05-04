import { NextRequest, NextResponse } from 'next/server'
import { fjernSesjonsCookie, settSesjonsCookie } from '../../lib/requireAuth'
import { sjekkRateLimit } from '../../lib/rateLimit'

function parseBrukere(): Record<string, string> | null {
  const raw = process.env.APP_USERS
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>
  } catch {
    console.error('APP_USERS er ikke gyldig JSON')
  }
  return null
}

function lagOk(bruker: string): NextResponse {
  const res = NextResponse.json({ ok: true, bruker })
  settSesjonsCookie(res, bruker)
  return res
}

export async function POST(req: NextRequest) {
  // Strenge rate-limit på login-forsøk for å bremse brute-force
  const rl = sjekkRateLimit(req, 'auth', { maks: 10, vinduMs: 60_000 })
  if (!rl.ok) return rl.respons

  let brukernavn = ''
  let passord = ''
  try {
    const body = await req.json()
    brukernavn = typeof body.brukernavn === 'string' ? body.brukernavn : ''
    passord = typeof body.passord === 'string' ? body.passord : ''
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const brukere = parseBrukere()

  if (brukere) {
    const nokkel = brukernavn.toLowerCase()
    const forventet = brukere[nokkel]
    if (forventet && passord === forventet) return lagOk(nokkel)
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Fallback til gammel enkeltbruker-modus
  const forventetBrukernavn = process.env.APP_USERNAME
  const forventetPassord = process.env.APP_PASSWORD
  if (!forventetBrukernavn || !forventetPassord) {
    console.error('Verken APP_USERS eller APP_USERNAME/APP_PASSWORD er satt')
    return NextResponse.json({ ok: false, feil: 'Server ikke konfigurert' }, { status: 500 })
  }
  if (brukernavn === forventetBrukernavn && passord === forventetPassord) {
    return lagOk(forventetBrukernavn)
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  fjernSesjonsCookie(res)
  return res
}
