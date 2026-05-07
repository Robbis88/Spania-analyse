import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'

// Henter den innloggede brukerens lagrede husholdnings-default
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const { data } = await admin
      .from('husholdning_default')
      .select('data, oppdatert')
      .eq('bruker', auth.bruker)
      .maybeSingle()
    return NextResponse.json({ data: data?.data || null, oppdatert: data?.oppdatert || null })
  } catch (e) {
    console.error('Husholdning-default GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente standard' }, { status: 500 })
  }
}

// Upsert: lagrer eller oppdaterer brukerens default
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { data } = await req.json()
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ feil: 'data mangler' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('husholdning_default').upsert({
      bruker: auth.bruker,
      data,
      oppdatert: new Date().toISOString(),
    }, { onConflict: 'bruker' })
    if (error) return NextResponse.json({ feil: 'Lagring feilet: ' + error.message }, { status: 500 })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Husholdning-default POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
  }
}
