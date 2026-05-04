import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import {
  BUCKET_DOKUMENTER, KVITTERING_MAKS_STORRELSE_BYTES, KVITTERING_TILLATTE_MIME,
  kvitteringFilendelse, kvitteringStorageSti,
} from '../../../lib/kvittering'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Multipart-opplasting av kvittering eller faktura. Lagrer fil i privat
// dokumenter-bucket og lager DB-rad med ocr_status='venter'. OCR kjøres
// separat (klient kaller /api/kvittering/analyser etterpå).
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const form = await req.formData()
    const prosjekt_id = form.get('prosjekt_id')
    const fil = form.get('fil')
    const notat = form.get('notat')

    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }
    if (!(fil instanceof File)) {
      return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    }
    if (!(KVITTERING_TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (JPEG, PNG, WebP eller PDF)' }, { status: 400 })
    }
    if (fil.size > KVITTERING_MAKS_STORRELSE_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 15 MB)' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: p } = await admin.from('prosjekter').select('id').eq('id', prosjekt_id).maybeSingle()
    if (!p) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

    const id = nyId()
    const ext = kvitteringFilendelse(fil.type)
    const sti = kvitteringStorageSti(prosjekt_id, id, ext)
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
      storage_sti: sti,
      filnavn: fil.name,
      mime_type: fil.type,
      ocr_status: 'venter' as const,
      notat: typeof notat === 'string' && notat.trim() ? notat.trim() : null,
    }
    const { error: iErr } = await admin.from('kvitteringer').insert([rad])
    if (iErr) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([sti])
      return NextResponse.json({ feil: 'DB-insert feilet: ' + iErr.message }, { status: 500 })
    }

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: auth.bruker,
      handling: 'lastet opp kvittering',
      tabell: 'kvitteringer',
      rad_id: id,
      detaljer: { prosjekt_id, filnavn: fil.name, storrelse: fil.size },
    }])

    return NextResponse.json({ suksess: true, kvittering_id: id })
  } catch (e) {
    console.error('Kvittering opplasting feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Opplasting feilet' }, { status: 500 })
  }
}
