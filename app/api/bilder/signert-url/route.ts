import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { BUCKET_BILDER } from '../../../lib/bilder'

const VARIGHET_SEKUNDER = 60 * 60 // 1 time

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ids: string[] = Array.isArray(body?.bilde_ids)
      ? body.bilde_ids.filter((x: unknown) => typeof x === 'string')
      : typeof body?.bilde_id === 'string' ? [body.bilde_id] : []

    if (ids.length === 0) {
      return NextResponse.json({ feil: 'bilde_id eller bilde_ids mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: rader } = await admin.from('prosjekt_bilder').select('id, storage_sti').in('id', ids)
    if (!rader || rader.length === 0) return NextResponse.json({ feil: 'Ingen bilder funnet' }, { status: 404 })

    const urler: Record<string, string> = {}
    for (const r of rader) {
      const { data: signert } = await admin.storage.from(BUCKET_BILDER).createSignedUrl(r.storage_sti, VARIGHET_SEKUNDER)
      if (signert?.signedUrl) urler[r.id] = signert.signedUrl
    }

    if (ids.length === 1) {
      return NextResponse.json({ url: urler[ids[0]] || null, urler })
    }
    return NextResponse.json({ urler })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
