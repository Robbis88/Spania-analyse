import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAuth } from '../../../../lib/requireAuth'

const TILLATTE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const
const MAKS_BYTES = 15 * 1024 * 1024  // 15 MB
const BUCKET = 'inspeksjon'

function filendelse(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/heic') return 'heic'
  return 'bin'
}

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Multipart-opplasting av inspeksjons-bilde. Lagrer fil i privat `inspeksjon`-
// bucket under sti `rapport/<rapport_id>/<id>.<ext>`. Klienten får storage-stien
// tilbake og legger den til i rapport-radens `bilde_stier`-array ved lagring.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const form = await req.formData()
    const rapportId = form.get('rapport_id')
    const fil = form.get('fil')

    if (typeof rapportId !== 'string' || !rapportId) {
      return NextResponse.json({ feil: 'rapport_id mangler' }, { status: 400 })
    }
    if (!(fil instanceof File)) {
      return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    }
    if (!(TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (JPEG, PNG, WebP, HEIC)' }, { status: 400 })
    }
    if (fil.size > MAKS_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 15 MB)' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const id = nyId()
    const ext = filendelse(fil.type)
    const sti = `rapport/${rapportId}/${id}.${ext}`
    const buffer = Buffer.from(await fil.arrayBuffer())

    const { error: uErr } = await admin.storage.from(BUCKET).upload(sti, buffer, {
      contentType: fil.type,
      upsert: false,
    })
    if (uErr) return NextResponse.json({ feil: 'Opplasting feilet: ' + uErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, sti })
  } catch (e) {
    console.error('Inspeksjon rapport last-opp feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Opplasting feilet' }, { status: 500 })
  }
}
