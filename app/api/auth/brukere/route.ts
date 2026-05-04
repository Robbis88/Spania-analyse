import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/requireAuth'

// Returnerer listen over admin-brukernavn (uten passord) basert på APP_USERS-env.
// Brukes av Norge-flyten for å vise hvilke andre brukere et prosjekt kan skjules for.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons

  const raw = process.env.APP_USERS
  let brukere: string[] = []
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        brukere = Object.keys(parsed as Record<string, unknown>).map(b => b.toLowerCase())
      }
    } catch {
      // Ignorerer ugyldig JSON; fallback til APP_USERNAME
    }
  }
  if (brukere.length === 0 && process.env.APP_USERNAME) {
    brukere = [process.env.APP_USERNAME]
  }

  return NextResponse.json({ brukere, du: auth.bruker })
}
