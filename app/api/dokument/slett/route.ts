import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { BUCKET_DOKUMENTER } from '../../../lib/dokument'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { id } = await req.json()
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('dokumenter')
      .select('id, prosjekt_id, storage_sti, type, tittel')
      .eq('id', id).maybeSingle()
    if (!rad) return NextResponse.json({ feil: 'Dokument ikke funnet' }, { status: 404 })

    if (rad.storage_sti) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([rad.storage_sti])
    }
    const { error } = await admin.from('dokumenter').delete().eq('id', id)
    if (error) return NextResponse.json({ feil: 'Slett feilet' }, { status: 500 })

    // Hvis det ikke finnes flere dokumenter av samme type for prosjektet, og
    // det finnes et sjekkpunkt som er 'ok', tilbakestill til 'mangler'.
    const { data: gjenværende } = await admin.from('dokumenter')
      .select('id').eq('prosjekt_id', rad.prosjekt_id).eq('type', rad.type).limit(1)
    if (!gjenværende || gjenværende.length === 0) {
      await admin.from('dokument_sjekkpunkter')
        .update({ status: 'mangler', oppdatert: new Date().toISOString() })
        .eq('prosjekt_id', rad.prosjekt_id)
        .eq('dokument_type', rad.type)
        .eq('status', 'ok')
    }

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: auth.bruker,
      handling: 'slettet dokument',
      tabell: 'dokumenter',
      rad_id: id,
      detaljer: { prosjekt_id: rad.prosjekt_id, type: rad.type, tittel: rad.tittel },
    }])

    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Dokument slett feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Slett feilet' }, { status: 500 })
  }
}
