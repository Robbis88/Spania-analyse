import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { BUCKET_BILDER, MAKS_BREDDE_PIKSLER, MAKS_STORRELSE_BYTES, TILLATTE_MIME, lagStorageSti } from '../../../lib/bilder'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const prosjekt_id = form.get('prosjekt_id')
    const kategori = form.get('kategori')
    const notat = form.get('notat')
    const opplastet_av = form.get('opplastet_av')
    const fil = form.get('fil')

    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }
    if (typeof opplastet_av !== 'string' || !opplastet_av) {
      return NextResponse.json({ feil: 'opplastet_av mangler' }, { status: 400 })
    }
    if (!(fil instanceof File)) {
      return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    }
    if (!(TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet. JPEG, PNG eller WebP.' }, { status: 400 })
    }
    if (fil.size > MAKS_STORRELSE_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 10 MB)' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()

    // Bekreft at prosjektet finnes
    const { data: p } = await admin.from('prosjekter').select('id').eq('id', prosjekt_id).single()
    if (!p) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

    const raw = Buffer.from(await fil.arrayBuffer())
    const resized = await sharp(raw)
      .rotate() // auto-orienter
      .resize({ width: MAKS_BREDDE_PIKSLER, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const meta = await sharp(resized).metadata()

    const bildeId = nyId()
    const sti = lagStorageSti(prosjekt_id, bildeId, 'jpg')

    const { error: uErr } = await admin.storage.from(BUCKET_BILDER).upload(sti, resized, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (uErr) {
      return NextResponse.json({ feil: 'Opplasting feilet: ' + uErr.message }, { status: 500 })
    }

    const rad = {
      id: bildeId,
      prosjekt_id,
      type: 'original',
      kategori: typeof kategori === 'string' ? kategori : null,
      storage_sti: sti,
      filnavn: fil.name,
      bredde: meta.width || null,
      hoyde: meta.height || null,
      tilleggsnotat: typeof notat === 'string' && notat.trim() ? notat.trim() : null,
      er_valgt_for_pdf: false,
      opprettet_av: opplastet_av,
    }
    const { error: iErr } = await admin.from('prosjekt_bilder').insert([rad])
    if (iErr) {
      await admin.storage.from(BUCKET_BILDER).remove([sti])
      return NextResponse.json({ feil: 'DB-insert feilet: ' + iErr.message }, { status: 500 })
    }

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: opplastet_av,
      handling: 'lastet opp bilde',
      tabell: 'prosjekt_bilder',
      rad_id: bildeId,
      detaljer: { prosjekt_id, kategori: typeof kategori === 'string' ? kategori : null, filnavn: fil.name },
    }])

    return NextResponse.json({ suksess: true, bilde_id: bildeId })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Opplasting feil:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
