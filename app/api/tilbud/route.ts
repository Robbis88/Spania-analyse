import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import { BUCKET_DOKUMENTER } from '../../lib/tilbud'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Liste over tilbud for ett prosjekt, med signerte fil-URL-er.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { searchParams } = new URL(req.url)
    const prosjekt_id = searchParams.get('prosjekt_id')
    if (!prosjekt_id) return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()
    const { data, error } = await admin.from('tilbud').select('*').eq('prosjekt_id', prosjekt_id).order('opprettet', { ascending: false })
    if (error) return NextResponse.json({ feil: 'Kunne ikke hente tilbud: ' + error.message }, { status: 500 })
    const rader = data || []
    const medUrl = await Promise.all(rader.map(async (t) => {
      let url: string | null = null
      if (t.storage_sti) {
        const { data: s } = await admin.storage.from(BUCKET_DOKUMENTER).createSignedUrl(t.storage_sti, 3600)
        url = s?.signedUrl || null
      }
      return { ...t, fil_url: url }
    }))
    return NextResponse.json({ tilbud: medUrl })
  } catch (e) {
    console.error('Tilbud GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente tilbud' }, { status: 500 })
  }
}

// Opprett manuelt/internt tilbud, oppdater felt, eller marker som akseptert.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const b = await req.json()
    const admin = hentSupabaseAdmin()

    // Marker som akseptert (kun ett per prosjekt)
    if (b.id && b.akseptert === true) {
      const { data: rad } = await admin.from('tilbud').select('prosjekt_id, aktor, totalsum').eq('id', b.id).maybeSingle()
      if (!rad) return NextResponse.json({ feil: 'Tilbud ikke funnet' }, { status: 404 })
      await admin.from('tilbud').update({ akseptert: false }).eq('prosjekt_id', rad.prosjekt_id)
      await admin.from('tilbud').update({ akseptert: true }).eq('id', b.id)
      await admin.from('aktivitetslogg').insert([{
        id: nyId(), bruker: auth.bruker, handling: 'aksepterte tilbud',
        tabell: 'tilbud', rad_id: b.id, prosjekt_id: rad.prosjekt_id, hendelsestype: 'tilbud_akseptert',
        detaljer: { aktor: rad.aktor, totalsum: rad.totalsum },
      }])
      return NextResponse.json({ suksess: true })
    }

    // Fjern aksept
    if (b.id && b.akseptert === false) {
      await admin.from('tilbud').update({ akseptert: false }).eq('id', b.id)
      return NextResponse.json({ suksess: true })
    }

    const felt: Record<string, unknown> = {}
    for (const k of ['aktor', 'valuta', 'arbeidstype', 'notat', 'inkluderer', 'ekskluderer', 'gyldig_til']) {
      if (typeof b[k] === 'string') felt[k] = b[k] || null
    }
    if (typeof b.totalsum === 'number') felt.totalsum = b.totalsum
    if (Array.isArray(b.poster)) felt.poster = b.poster

    // Oppdater eksisterende
    if (b.id) {
      if (Object.keys(felt).length === 0) return NextResponse.json({ feil: 'ingen endringer' }, { status: 400 })
      const { error } = await admin.from('tilbud').update(felt).eq('id', b.id)
      if (error) return NextResponse.json({ feil: 'Lagring feilet: ' + error.message }, { status: 500 })
      return NextResponse.json({ suksess: true, id: b.id })
    }

    // Opprett nytt (typisk internt tilbud uten fil)
    if (!b.prosjekt_id) return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    const id = nyId()
    const rad = {
      id, prosjekt_id: b.prosjekt_id, bruker: auth.bruker,
      ocr_status: 'manuelt' as const, er_internt: b.er_internt === true,
      akseptert: false, ...felt,
    }
    const { error } = await admin.from('tilbud').insert([rad])
    if (error) return NextResponse.json({ feil: 'Opprettelse feilet: ' + error.message }, { status: 500 })
    return NextResponse.json({ suksess: true, id })
  } catch (e) {
    console.error('Tilbud POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('tilbud').select('storage_sti').eq('id', id).maybeSingle()
    if (rad?.storage_sti) await admin.storage.from(BUCKET_DOKUMENTER).remove([rad.storage_sti])
    const { error } = await admin.from('tilbud').delete().eq('id', id)
    if (error) return NextResponse.json({ feil: 'Sletting feilet: ' + error.message }, { status: 500 })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Tilbud DELETE feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Sletting feilet' }, { status: 500 })
  }
}
