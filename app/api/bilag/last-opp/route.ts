import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { BILAG_BUCKET, BILAG_MAKS_BYTES, BILAG_TILLATTE_MIME, bilagFilendelse, bilagStorageSti } from '../../../lib/bilag'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Multipart-opplasting av et bilag (PDF/bilde) → oppretter en 'ny' rad i
// innboksen. Dette er stand-in for fremtidig regnskapsimport: samme rad-form,
// men kilde='manuell'. AI-forslag kjøres etterpå via /api/bilag/foreslaa.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const form = await req.formData()
    const fil = form.get('fil')
    if (!(fil instanceof File)) return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    if (!(BILAG_TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (JPEG, PNG, WebP eller PDF)' }, { status: 400 })
    }
    if (fil.size > BILAG_MAKS_BYTES) return NextResponse.json({ feil: 'Filen er for stor (maks 15 MB)' }, { status: 400 })

    const admin = hentSupabaseAdmin()
    const id = nyId()
    const sti = bilagStorageSti(id, bilagFilendelse(fil.type))
    const buffer = Buffer.from(await fil.arrayBuffer())
    const { error: uErr } = await admin.storage.from(BILAG_BUCKET).upload(sti, buffer, { contentType: fil.type, upsert: false })
    if (uErr) return NextResponse.json({ feil: 'Opplasting feilet: ' + uErr.message }, { status: 500 })

    const { error: iErr } = await admin.from('bilag').insert([{
      id, bruker: auth.bruker, status: 'ny', kilde: 'manuell', valuta: 'NOK',
      storage_sti: sti, filnavn: fil.name, mime_type: fil.type,
    }])
    if (iErr) {
      await admin.storage.from(BILAG_BUCKET).remove([sti])
      return NextResponse.json({ feil: 'DB-insert feilet: ' + iErr.message }, { status: 500 })
    }
    return NextResponse.json({ suksess: true, bilag_id: id })
  } catch (e) {
    console.error('Bilag opplasting feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Opplasting feilet' }, { status: 500 })
  }
}
