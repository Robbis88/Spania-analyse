import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { DOKUMENT_TYPER } from '../../../lib/dokument'

const TILLATTE_FELT = new Set([
  'tittel', 'type', 'utstedt_dato', 'gyldig_til', 'notat', 'tagger',
])

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { id, endringer } = await req.json()
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    }
    if (!endringer || typeof endringer !== 'object') {
      return NextResponse.json({ feil: 'endringer mangler' }, { status: 400 })
    }

    const oppdatering: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(endringer as Record<string, unknown>)) {
      if (!TILLATTE_FELT.has(k)) continue
      if (k === 'type' && (typeof v !== 'string' || !(DOKUMENT_TYPER as readonly string[]).includes(v))) continue
      if (k === 'tittel' && (typeof v !== 'string' || !v.trim())) continue
      if (k === 'tagger' && !Array.isArray(v)) continue
      oppdatering[k] = v
    }

    if (Object.keys(oppdatering).length === 0) {
      return NextResponse.json({ feil: 'Ingen gyldige felt' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('dokumenter').update(oppdatering).eq('id', id)
    if (error) return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })

    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Dokument oppdater feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Oppdatering feilet' }, { status: 500 })
  }
}
