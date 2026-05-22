import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../lib/requireAuth'
import { hentCatastro } from '../../lib/catastro'

// Henter eiendomsfakta fra spansk Catastro (gratis OVC-API) ut fra
// referencia catastral. Auth-beskyttet siden den brukes fra admin/Boliganalyse.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { refcat } = await req.json()
    if (typeof refcat !== 'string' || !refcat.trim()) {
      return NextResponse.json({ feil: 'refcat mangler' }, { status: 400 })
    }
    const resultat = await hentCatastro(refcat)
    if (!resultat.ok) return NextResponse.json({ feil: resultat.feil }, { status: 404 })
    return NextResponse.json({ ok: true, eiendom: resultat.eiendom })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Catastro-feil:', m)
    return NextResponse.json({ feil: m }, { status: 500 })
  }
}
