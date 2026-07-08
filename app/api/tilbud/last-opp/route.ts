import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import {
  BUCKET_DOKUMENTER, TILBUD_MAKS_STORRELSE_BYTES, TILBUD_TILLATTE_MIME,
  tilbudFilendelse, tilbudStorageSti,
} from '../../../lib/tilbud'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Multipart-opplasting av et tilbud (PDF/bilde). OCR kjøres etterpå via /analyser.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const form = await req.formData()
    const prosjekt_id = form.get('prosjekt_id')
    const fil = form.get('fil')
    const arbeidstype = form.get('arbeidstype')

    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }
    if (!(fil instanceof File)) return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    if (!(TILBUD_TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (JPEG, PNG, WebP eller PDF)' }, { status: 400 })
    }
    if (fil.size > TILBUD_MAKS_STORRELSE_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 15 MB)' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: p } = await admin.from('prosjekter').select('id').eq('id', prosjekt_id).maybeSingle()
    if (!p) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

    const id = nyId()
    const ext = tilbudFilendelse(fil.type)
    const sti = tilbudStorageSti(prosjekt_id, id, ext)
    const buffer = Buffer.from(await fil.arrayBuffer())

    const { error: uErr } = await admin.storage.from(BUCKET_DOKUMENTER).upload(sti, buffer, { contentType: fil.type, upsert: false })
    if (uErr) return NextResponse.json({ feil: 'Opplasting feilet: ' + uErr.message }, { status: 500 })

    const rad = {
      id, prosjekt_id, bruker: auth.bruker,
      storage_sti: sti, filnavn: fil.name, mime_type: fil.type,
      ocr_status: 'venter' as const,
      arbeidstype: typeof arbeidstype === 'string' && arbeidstype ? arbeidstype : null,
      akseptert: false, er_internt: false,
    }
    const { error: iErr } = await admin.from('tilbud').insert([rad])
    if (iErr) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([sti])
      return NextResponse.json({ feil: 'DB-insert feilet: ' + iErr.message }, { status: 500 })
    }

    return NextResponse.json({ suksess: true, tilbud_id: id })
  } catch (e) {
    console.error('Tilbud opplasting feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Opplasting feilet' }, { status: 500 })
  }
}
