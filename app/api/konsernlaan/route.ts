import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import { loggAktivitet } from '../../lib/logg'

// Konsernlån (Loeiendom AS -> LO-casas osv.)
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const { data, error } = await admin
      .from('konsernlaan')
      .select('*')
      .order('startdato', { ascending: true })
    if (error) return NextResponse.json({ feil: 'Kunne ikke hente konsernlån: ' + error.message }, { status: 500 })
    return NextResponse.json({ konsernlaan: data || [] })
  } catch (e) {
    console.error('Konsernlån GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente konsernlån' }, { status: 500 })
  }
}

// Opprett eller oppdater (id => oppdater, ellers opprett)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const b = await req.json()
    const rad = {
      fra_selskap: b.fra_selskap || null,
      til_selskap: b.til_selskap || null,
      hovedstol: Number(b.hovedstol) || 0,
      valuta: b.valuta === 'EUR' ? 'EUR' : 'NOK',
      rente_pct: Number(b.rente_pct) || 0,
      startdato: b.startdato || null,
      nedbetalinger: Array.isArray(b.nedbetalinger) ? b.nedbetalinger : [],
      notat: typeof b.notat === 'string' ? b.notat : null,
    }
    if (!rad.startdato) return NextResponse.json({ feil: 'startdato mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()
    if (b.id) {
      const { error } = await admin.from('konsernlaan').update(rad).eq('id', b.id)
      if (error) return NextResponse.json({ feil: 'Lagring feilet: ' + error.message }, { status: 500 })
      await loggAktivitet({ handling: 'oppdaterte konsernlån', tabell: 'konsernlaan', rad_id: b.id, detaljer: { hovedstol: rad.hovedstol } })
      return NextResponse.json({ suksess: true, id: b.id })
    }
    const { data, error } = await admin.from('konsernlaan').insert([rad]).select('id').single()
    if (error) return NextResponse.json({ feil: 'Lagring feilet: ' + error.message }, { status: 500 })
    await loggAktivitet({ handling: 'opprettet konsernlån', tabell: 'konsernlaan', rad_id: data?.id, detaljer: { hovedstol: rad.hovedstol } })
    return NextResponse.json({ suksess: true, id: data?.id })
  } catch (e) {
    console.error('Konsernlån POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('konsernlaan').delete().eq('id', id)
    if (error) return NextResponse.json({ feil: 'Sletting feilet: ' + error.message }, { status: 500 })
    await loggAktivitet({ handling: 'slettet konsernlån', tabell: 'konsernlaan', rad_id: id, detaljer: {} })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Konsernlån DELETE feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Sletting feilet' }, { status: 500 })
  }
}
