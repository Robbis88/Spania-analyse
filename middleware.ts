import { NextRequest, NextResponse } from 'next/server'
import { portalToken } from './app/lib/portalAuth'

// Låser den offentlige portalen bak et passord under testing.
// Admin (/admin) har egen innlogging — vi rører ikke den.
// Hvis PORTAL_PASSORD ikke er satt er portalen åpen (som før).

const COOKIE = 'portal-tilgang'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const passord = process.env.PORTAL_PASSORD

  // Ingen passord satt = portal er åpen
  if (!passord) return NextResponse.next()

  // Slipp gjennom unntakene
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/laast') ||
    pathname.startsWith('/api/portal-tilgang') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/agent') ||
    pathname.startsWith('/api/analyse') ||  // dekker /api/analyse, /api/analyse-norge, /api/analyse-takst
    pathname.startsWith('/api/airbnb') ||
    pathname.startsWith('/api/bilder') ||
    pathname.startsWith('/api/epost') ||
    pathname.startsWith('/api/selge') ||
    pathname.startsWith('/api/kvittering') ||
    pathname.startsWith('/api/dokument') ||  // dekker både /api/dokument/* og /api/dokument-sjekkpunkt
    pathname.startsWith('/api/salgspakke') ||
    pathname.startsWith('/api/dashboard') ||
    pathname.startsWith('/api/portefolje') ||
    pathname.startsWith('/api/husholdning-default') ||
    pathname.startsWith('/api/handverker') ||
    pathname.startsWith('/_next') ||
    pathname === '/logo.png' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Sjekk cookie mot utledet token (vi lagrer ikke selve passordet)
  const tilgang = req.cookies.get(COOKIE)?.value
  if (tilgang && tilgang === await portalToken(passord)) return NextResponse.next()

  // Send til låst-siden — bevar redirect
  const url = req.nextUrl.clone()
  url.pathname = '/laast'
  if (pathname !== '/' && !pathname.startsWith('/laast')) {
    url.searchParams.set('redirect', pathname)
  } else {
    url.searchParams.delete('redirect')
  }
  return NextResponse.redirect(url)
}

export const config = {
  // Match alt unntatt statiske assets — eksklusjoner gjøres i logikken over
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
