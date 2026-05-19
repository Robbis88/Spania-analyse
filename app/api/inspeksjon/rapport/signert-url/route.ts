import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAuth } from '../../../../lib/requireAuth'

const VARIGHET_S = 60 * 60  // 1 time
const BUCKET = 'inspeksjon'

// Returner signerte URL-er for å vise rapport-bilder i admin-UI. Tar imot
// en liste med storage-stier (samme som returneres fra last-opp) og gir
// tilbake en `urler`-map sti → signedUrl.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json()
    const stier: string[] = Array.isArray(body?.stier)
      ? body.stier.filter((x: unknown) => typeof x === 'string')
      : []
    if (stier.length === 0) return NextResponse.json({ urler: {} })

    const admin = hentSupabaseAdmin()
    const { data: signerte, error } = await admin.storage.from(BUCKET).createSignedUrls(stier, VARIGHET_S)
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })

    const urler: Record<string, string> = {}
    for (const s of signerte || []) {
      if (s.path && s.signedUrl) urler[s.path] = s.signedUrl
    }
    return NextResponse.json({ urler })
  } catch (e) {
    console.error('Inspeksjon signert-url feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Signert URL feilet' }, { status: 500 })
  }
}

// Slett et bilde — bestilling-ansvarlig admin kan fjerne ved redigering av rapport.
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json()
    const sti = body?.sti
    if (typeof sti !== 'string' || !sti.startsWith('rapport/')) {
      return NextResponse.json({ feil: 'Ugyldig sti' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const { error } = await admin.storage.from(BUCKET).remove([sti])
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Inspeksjon bilde-slett feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Sletting feilet' }, { status: 500 })
  }
}
