import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { BUCKET_BILDER, lagStorageSti } from '../../../../lib/bilder'

const replicate = new Replicate()

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

function finnOutputUrl(output: unknown): string | null {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') return output[0]
  if (output && typeof output === 'object' && 'url' in output && typeof (output as { url: unknown }).url === 'string') {
    return (output as { url: string }).url
  }
  return null
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const url = new URL(req.url)
    const original_bilde_id = url.searchParams.get('original_bilde_id') || ''
    const visualisering_type = url.searchParams.get('visualisering_type') || ''
    const generert_av = url.searchParams.get('generert_av') || ''
    const forslag_navn = url.searchParams.get('forslag_navn') || ''

    if (!id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })

    const prediction = await replicate.predictions.get(id)

    if (prediction.status === 'starting' || prediction.status === 'processing') {
      return NextResponse.json({ status: prediction.status })
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return NextResponse.json({
        status: prediction.status,
        feil: prediction.error ? String(prediction.error) : 'Generering feilet',
      })
    }

    // succeeded
    const outputUrl = finnOutputUrl(prediction.output)
    if (!outputUrl) {
      return NextResponse.json({ status: 'feilet', feil: 'Ingen output-URL fra modellen' })
    }

    const gyldigeTyper = ['oppussing', 'tillegg', 'kombinert']
    if (!original_bilde_id || !gyldigeTyper.includes(visualisering_type) || !generert_av) {
      return NextResponse.json({
        status: 'succeeded',
        output_url: outputUrl,
        advarsel: 'Kontekst manglet — kan ikke lagre. Send original_bilde_id, visualisering_type og generert_av som query-params.',
      })
    }

    const admin = hentSupabaseAdmin()
    const { data: original } = await admin.from('prosjekt_bilder')
      .select('prosjekt_id, kategori')
      .eq('id', original_bilde_id)
      .single()
    if (!original) return NextResponse.json({ feil: 'Originalbilde ikke funnet' }, { status: 404 })

    const hent = await fetch(outputUrl)
    if (!hent.ok) return NextResponse.json({ feil: 'Kunne ikke laste ned generert bilde' }, { status: 500 })
    const buffer = Buffer.from(await hent.arrayBuffer())

    const bildeId = nyId()
    const sti = lagStorageSti(original.prosjekt_id, bildeId, 'jpg')
    const { error: uErr } = await admin.storage.from(BUCKET_BILDER).upload(sti, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (uErr) return NextResponse.json({ feil: 'Opplasting til storage feilet: ' + uErr.message }, { status: 500 })

    const rad = {
      id: bildeId,
      prosjekt_id: original.prosjekt_id,
      type: 'generert' as const,
      visualisering_type,
      kategori: original.kategori,
      storage_sti: sti,
      filnavn: null,
      tilleggsnotat: forslag_navn || null,
      original_bilde_id,
      replicate_id: prediction.id,
      generert_av,
      er_valgt_for_pdf: false,
      opprettet_av: generert_av,
    }
    const { error: iErr } = await admin.from('prosjekt_bilder').insert([rad])
    if (iErr) {
      await admin.storage.from(BUCKET_BILDER).remove([sti])
      return NextResponse.json({ feil: 'DB-insert feilet: ' + iErr.message }, { status: 500 })
    }

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: generert_av,
      handling: 'genererte visualisering',
      tabell: 'prosjekt_bilder',
      rad_id: bildeId,
      detaljer: { original_bilde_id, visualisering_type, forslag: forslag_navn, replicate_id: prediction.id },
    }])

    return NextResponse.json({ status: 'ferdig', bilde_id: bildeId })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Polling feilet:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
