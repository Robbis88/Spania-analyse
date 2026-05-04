// Server-side auth-validering for API-ruter.
//
// `/api/auth` setter en HTTPOnly cookie ved suksess (signert med HMAC).
// Alle beskyttede API-ruter kaller `requireAuth(req)` som returnerer brukernavnet
// hvis cookien er gyldig, ellers 401-respons.
//
// Hemmelighet velges fra AUTH_SECRET hvis satt — ellers utledes en stabil hash
// fra APP_USERS/APP_PASSWORD (samme verdi gir samme nøkkel på tvers av restart,
// men ny verdi invaliderer alle aktive sesjoner).

import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const SESJON_COOKIE = 'admin-sesjon'
const SESJON_VARIGHET_S = 60 * 60 * 24 * 7  // 7 dager

function hentHemmelighet(): string {
  const eksplisit = process.env.AUTH_SECRET
  if (eksplisit && eksplisit.length >= 16) return eksplisit
  const fallback = (process.env.APP_USERS || '') + '|' + (process.env.APP_PASSWORD || '') + '|leganger-osvaag'
  return createHmac('sha256', 'auth-secret-derive').update(fallback).digest('hex')
}

function base64UrlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(s: string): string {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4))
  return Buffer.from(norm + pad, 'base64').toString('utf8')
}

function signer(payloadB64: string, hemmelighet: string): string {
  return createHmac('sha256', hemmelighet).update(payloadB64).digest('hex')
}

export function lagSesjonsCookie(bruker: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESJON_VARIGHET_S
  const payload = base64UrlEncode(JSON.stringify({ bruker, exp }))
  const sig = signer(payload, hentHemmelighet())
  return `${payload}.${sig}`
}

export function settSesjonsCookie(res: NextResponse, bruker: string): void {
  res.cookies.set(SESJON_COOKIE, lagSesjonsCookie(bruker), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESJON_VARIGHET_S,
    path: '/',
  })
}

export function fjernSesjonsCookie(res: NextResponse): void {
  res.cookies.set(SESJON_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export type AuthResultat =
  | { ok: true; bruker: string }
  | { ok: false; respons: NextResponse }

export function requireAuth(req: NextRequest): AuthResultat {
  const verdi = req.cookies.get(SESJON_COOKIE)?.value
  if (!verdi) return { ok: false, respons: NextResponse.json({ feil: 'Ikke innlogget' }, { status: 401 }) }
  const punkt = verdi.lastIndexOf('.')
  if (punkt === -1) return { ok: false, respons: NextResponse.json({ feil: 'Ugyldig sesjon' }, { status: 401 }) }
  const payload = verdi.slice(0, punkt)
  const sig = verdi.slice(punkt + 1)
  const forventet = signer(payload, hentHemmelighet())
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(forventet, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, respons: NextResponse.json({ feil: 'Ugyldig sesjon' }, { status: 401 }) }
  }
  try {
    const data = JSON.parse(base64UrlDecode(payload)) as { bruker?: string; exp?: number }
    if (!data.bruker || !data.exp || data.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, respons: NextResponse.json({ feil: 'Sesjon utløpt' }, { status: 401 }) }
    }
    return { ok: true, bruker: data.bruker }
  } catch {
    return { ok: false, respons: NextResponse.json({ feil: 'Ugyldig sesjon' }, { status: 401 }) }
  }
}
