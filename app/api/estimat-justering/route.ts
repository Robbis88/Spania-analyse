import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Historikk for et felt (evt. filtrert på marked) — brukes til å mate AI med
// Roberts tidligere justeringer.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { searchParams } = new URL(req.url)
    const felt = searchParams.get('felt')
    const marked = searchParams.get('marked')
    const admin = hentSupabaseAdmin()
    let q = admin.from('estimat_justeringer').select('*').order('tidspunkt', { ascending: false }).limit(30)
    if (felt) q = q.eq('felt', felt)
    const { data, error } = await q
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    let rader = data || []
    if (marked) rader = rader.filter(r => !r.kontekst?.marked || r.kontekst.marked === marked)
    return NextResponse.json({ justeringer: rader })
  } catch (e) {
    console.error('Estimat-justering GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente' }, { status: 500 })
  }
}

// Logg en justering (AI sa X, jeg mente Y) eller fasit (faktisk_verdi).
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const b = await req.json()
    if (!b.prosjekt_id || !b.felt) return NextResponse.json({ feil: 'prosjekt_id/felt mangler' }, { status: 400 })
    const rad = {
      id: nyId(),
      prosjekt_id: String(b.prosjekt_id),
      felt: String(b.felt),
      ai_verdi: typeof b.ai_verdi === 'number' ? b.ai_verdi : null,
      min_verdi: typeof b.min_verdi === 'number' ? b.min_verdi : null,
      faktisk_verdi: typeof b.faktisk_verdi === 'number' ? b.faktisk_verdi : null,
      kontekst: b.kontekst && typeof b.kontekst === 'object' ? b.kontekst : null,
    }
    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('estimat_justeringer').insert([rad])
    if (error) return NextResponse.json({ feil: 'Lagring feilet: ' + error.message }, { status: 500 })
    return NextResponse.json({ suksess: true, id: rad.id })
  } catch (e) {
    console.error('Estimat-justering POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
  }
}
