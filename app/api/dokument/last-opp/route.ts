import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import {
  BUCKET_DOKUMENTER, DOKUMENT_MAKS_STORRELSE_BYTES, DOKUMENT_TILLATTE_MIME, DOKUMENT_TYPER,
  dokumentFilendelse, dokumentStorageSti,
} from '../../../lib/dokument'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const form = await req.formData()
    const prosjekt_id = form.get('prosjekt_id')
    const tittel = form.get('tittel')
    const type = form.get('type')
    const utstedt_dato = form.get('utstedt_dato')
    const gyldig_til = form.get('gyldig_til')
    const notat = form.get('notat')
    const fil = form.get('fil')

    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }
    if (typeof tittel !== 'string' || !tittel.trim()) {
      return NextResponse.json({ feil: 'tittel mangler' }, { status: 400 })
    }
    if (typeof type !== 'string' || !(DOKUMENT_TYPER as readonly string[]).includes(type)) {
      return NextResponse.json({ feil: 'Ugyldig dokument-type' }, { status: 400 })
    }
    if (!(fil instanceof File)) {
      return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    }
    if (!(DOKUMENT_TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (PDF, JPG, PNG, WebP, DOC eller DOCX)' }, { status: 400 })
    }
    if (fil.size > DOKUMENT_MAKS_STORRELSE_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 25 MB)' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: p } = await admin.from('prosjekter').select('id').eq('id', prosjekt_id).maybeSingle()
    if (!p) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

    const id = nyId()
    const ext = dokumentFilendelse(fil.type)
    const sti = dokumentStorageSti(prosjekt_id, id, ext)
    const buffer = Buffer.from(await fil.arrayBuffer())

    const { error: uErr } = await admin.storage.from(BUCKET_DOKUMENTER).upload(sti, buffer, {
      contentType: fil.type,
      upsert: false,
    })
    if (uErr) return NextResponse.json({ feil: 'Opplasting feilet: ' + uErr.message }, { status: 500 })

    const rad = {
      id,
      prosjekt_id,
      bruker: auth.bruker,
      tittel: tittel.trim(),
      type,
      storage_sti: sti,
      filnavn: fil.name,
      mime_type: fil.type,
      utstedt_dato: typeof utstedt_dato === 'string' && utstedt_dato ? utstedt_dato : null,
      gyldig_til: typeof gyldig_til === 'string' && gyldig_til ? gyldig_til : null,
      notat: typeof notat === 'string' && notat.trim() ? notat.trim() : null,
    }
    const { error: iErr } = await admin.from('dokumenter').insert([rad])
    if (iErr) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([sti])
      return NextResponse.json({ feil: 'DB-insert feilet: ' + iErr.message }, { status: 500 })
    }

    // Auto-oppdater matchende sjekkpunkt til "ok" hvis det finnes (med mindre
    // brukeren har markert det som "ikke_relevant").
    await admin.from('dokument_sjekkpunkter')
      .update({ status: 'ok', oppdatert: new Date().toISOString() })
      .eq('prosjekt_id', prosjekt_id)
      .eq('dokument_type', type)
      .neq('status', 'ikke_relevant')

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: auth.bruker,
      handling: 'lastet opp dokument',
      tabell: 'dokumenter',
      rad_id: id,
      detaljer: { prosjekt_id, type, tittel: rad.tittel, filnavn: fil.name },
    }])

    return NextResponse.json({ suksess: true, dokument_id: id })
  } catch (e) {
    console.error('Dokument opplasting feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Opplasting feilet' }, { status: 500 })
  }
}
