import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { BUCKET_DOKUMENTER } from '../../../lib/kvittering'

const VARIGHET_SEKUNDER = 60 * 60

// Returnerer signerte URL-er for én eller flere kvitteringer slik at klienten
// kan vise filene direkte (bilde-tag eller PDF-iframe).
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json()
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((x: unknown) => typeof x === 'string')
      : typeof body?.id === 'string' ? [body.id] : []
    if (ids.length === 0) return NextResponse.json({ feil: 'id eller ids mangler' }, { status: 400 })

    const admin = hentSupabaseAdmin()
    const { data: rader } = await admin.from('kvitteringer').select('id, storage_sti').in('id', ids)
    if (!rader || rader.length === 0) return NextResponse.json({ feil: 'Ingen kvitteringer funnet' }, { status: 404 })

    const stier = rader.map(r => r.storage_sti)
    const urlPerSti = new Map<string, string>()
    if (stier.length > 0) {
      const { data: signerte } = await admin.storage.from(BUCKET_DOKUMENTER).createSignedUrls(stier, VARIGHET_SEKUNDER)
      for (const s of signerte || []) {
        if (s.path && s.signedUrl) urlPerSti.set(s.path, s.signedUrl)
      }
    }

    const urler: Record<string, string> = {}
    for (const r of rader) {
      const u = urlPerSti.get(r.storage_sti)
      if (u) urler[r.id] = u
    }
    return NextResponse.json({ urler })
  } catch (e) {
    console.error('Kvittering signert-url feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Signert URL feilet' }, { status: 500 })
  }
}
