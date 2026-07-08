import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import { loggAktivitet } from '../../lib/logg'

// Lister alle selskaper (Loeiendom AS, LO-casas, …)
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const { data, error } = await admin
      .from('selskaper')
      .select('id, navn, land, valuta, skatteprofil, fri_likviditet, laanekapasitet, opprettet')
      .order('opprettet', { ascending: true })
    if (error) return NextResponse.json({ feil: 'Kunne ikke hente selskaper: ' + error.message }, { status: 500 })
    return NextResponse.json({ selskaper: data || [] })
  } catch (e) {
    console.error('Selskaper GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente selskaper' }, { status: 500 })
  }
}

// Oppdaterer navn og/eller skatteprofil for ett selskap
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json()
    const id = body?.id
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    }
    const endringer: Record<string, unknown> = {}
    if (typeof body.navn === 'string' && body.navn.trim()) endringer.navn = body.navn.trim()
    if (body.skatteprofil && typeof body.skatteprofil === 'object') endringer.skatteprofil = body.skatteprofil
    if (typeof body.fri_likviditet === 'number') endringer.fri_likviditet = body.fri_likviditet
    if (typeof body.laanekapasitet === 'number') endringer.laanekapasitet = body.laanekapasitet
    if (Object.keys(endringer).length === 0) {
      return NextResponse.json({ feil: 'ingen endringer' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('selskaper').update(endringer).eq('id', id)
    if (error) return NextResponse.json({ feil: 'Lagring feilet: ' + error.message }, { status: 500 })
    await loggAktivitet({ handling: 'oppdaterte selskap', tabell: 'selskaper', rad_id: id, detaljer: endringer })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Selskaper POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
  }
}
