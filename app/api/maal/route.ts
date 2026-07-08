import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)
const ENHETER = ['antall_boliger', 'egenkapital', 'cashflow_mnd']

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const { data, error } = await admin.from('maal').select('*').order('opprettet', { ascending: true })
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ maal: data || [] })
  } catch (e) {
    console.error('Maal GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente mål' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const b = await req.json()
    if (!b.beskrivelse || !ENHETER.includes(b.enhet) || typeof b.maaltall !== 'number') {
      return NextResponse.json({ feil: 'beskrivelse/enhet/maaltall mangler eller ugyldig' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const felt = {
      selskap_id: b.selskap_id || null,
      beskrivelse: String(b.beskrivelse), maaltall: b.maaltall, enhet: b.enhet,
      frist: b.frist || null,
    }
    if (b.id) {
      const { error } = await admin.from('maal').update(felt).eq('id', b.id)
      if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
      return NextResponse.json({ suksess: true, id: b.id })
    }
    const id = nyId()
    const { error } = await admin.from('maal').insert([{ id, ...felt }])
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ suksess: true, id })
  } catch (e) {
    console.error('Maal POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('maal').delete().eq('id', id)
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Maal DELETE feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Sletting feilet' }, { status: 500 })
  }
}
