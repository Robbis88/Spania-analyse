import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
  const { brukernavn, passord } = await req.json()
  const brukere = parseBrukere()

  if (brukere) {
    const nokkel = (brukernavn || '').toLowerCase()
    const forventet = brukere[nokkel]
    if (forventet && passord === forventet) {
      return NextResponse.json({ ok: true, bruker: nokkel })
    }
    return NextResponse.json({ ok: false })
  }

  // Fallback til gammel enkeltbruker-modus
  const forventetBrukernavn = process.env.APP_USERNAME
  const forventetPassord = process.env.APP_PASSWORD
  if (!forventetBrukernavn || !forventetPassord) {
    return NextResponse.json({ ok: false, feil: 'APP_USERS, APP_USERNAME eller APP_PASSWORD er ikke satt' }, { status: 500 })
  }
  if (brukernavn === forventetBrukernavn && passord === forventetPassord) {
    return NextResponse.json({ ok: true, bruker: forventetBrukernavn })
  }
  return NextResponse.json({ ok: false })
}
