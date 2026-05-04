import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { BUCKET_DOKUMENTER } from '../../../lib/kvittering'

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
    const { data: rad } = await admin.from('kvitteringer').select('id, prosjekt_id, storage_sti, filnavn').eq('id', id).maybeSingle()
    if (!rad) return NextResponse.json({ feil: 'Kvittering ikke funnet' }, { status: 404 })

    if (rad.storage_sti) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([rad.storage_sti])
    }
    const { error } = await admin.from('kvitteringer').delete().eq('id', id)
    if (error) return NextResponse.json({ feil: 'Slett feilet' }, { status: 500 })

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: auth.bruker,
      handling: 'slettet kvittering',
      tabell: 'kvitteringer',
      rad_id: id,
      detaljer: { prosjekt_id: rad.prosjekt_id, filnavn: rad.filnavn },
    }])

    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Kvittering slett feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Slett feilet' }, { status: 500 })
  }
}
