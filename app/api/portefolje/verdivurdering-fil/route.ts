import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { BUCKET_DOKUMENTER } from '../../../lib/kvittering'

const TILLATTE_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
const MAKS_BYTES = 25 * 1024 * 1024  // 25 MB — takstrapporter med bilder kan være store
const SIGNERT_TTL = 60 * 60

function ext(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

function sti(prosjektId: string, vurderingId: string, e: string): string {
  return `verdivurderinger/${prosjektId}/${vurderingId}.${e}`
}

// Multipart-opplasting: { vurdering_id, fil }. Erstatter eksisterende fil
// hvis det allerede er en. Returnerer signert URL for visning.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const form = await req.formData()
    const vurdering_id = form.get('vurdering_id')
    const fil = form.get('fil')

    if (typeof vurdering_id !== 'string' || !vurdering_id) {
      return NextResponse.json({ feil: 'vurdering_id mangler' }, { status: 400 })
    }
    if (!(fil instanceof File)) {
      return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    }
    if (!(TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (PDF, JPEG, PNG, WebP)' }, { status: 400 })
    }
    if (fil.size > MAKS_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 25 MB)' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('eiendom_verdivurderinger')
      .select('id, prosjekt_id, storage_sti').eq('id', vurdering_id).maybeSingle()
    if (!rad) return NextResponse.json({ feil: 'Verdivurdering ikke funnet' }, { status: 404 })

    // Fjern gammel fil hvis den finnes (annen ext er mulig)
    if (rad.storage_sti) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([rad.storage_sti])
    }

    const nySti = sti(rad.prosjekt_id, vurdering_id, ext(fil.type))
    const buffer = Buffer.from(await fil.arrayBuffer())
    const { error: uErr } = await admin.storage.from(BUCKET_DOKUMENTER).upload(nySti, buffer, {
      contentType: fil.type,
      upsert: true,
    })
    if (uErr) return NextResponse.json({ feil: 'Opplasting feilet: ' + uErr.message }, { status: 500 })

    const { error: oErr } = await admin.from('eiendom_verdivurderinger').update({
      storage_sti: nySti,
      filnavn: fil.name,
      mime_type: fil.type,
    }).eq('id', vurdering_id)
    if (oErr) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([nySti])
      return NextResponse.json({ feil: 'DB-oppdatering feilet: ' + oErr.message }, { status: 500 })
    }

    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Verdivurdering opplasting feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Opplasting feilet' }, { status: 500 })
  }
}

// Fjerner kun filen — beholder DB-raden
export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { vurdering_id } = await req.json()
    if (typeof vurdering_id !== 'string' || !vurdering_id) {
      return NextResponse.json({ feil: 'vurdering_id mangler' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('eiendom_verdivurderinger')
      .select('storage_sti').eq('id', vurdering_id).maybeSingle()
    if (!rad) return NextResponse.json({ feil: 'Verdivurdering ikke funnet' }, { status: 404 })
    if (rad.storage_sti) {
      await admin.storage.from(BUCKET_DOKUMENTER).remove([rad.storage_sti])
    }
    await admin.from('eiendom_verdivurderinger').update({
      storage_sti: null, filnavn: null, mime_type: null,
    }).eq('id', vurdering_id)
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Verdivurdering fjern fil-feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Sletting feilet' }, { status: 500 })
  }
}

// Henter signert URL for visning av filen
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('vurdering_id')
    if (!id) return NextResponse.json({ feil: 'vurdering_id mangler' }, { status: 400 })

    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('eiendom_verdivurderinger')
      .select('storage_sti').eq('id', id).maybeSingle()
    if (!rad?.storage_sti) return NextResponse.json({ feil: 'Ingen fil' }, { status: 404 })

    const { data: signert } = await admin.storage.from(BUCKET_DOKUMENTER)
      .createSignedUrl(rad.storage_sti, SIGNERT_TTL)
    if (!signert?.signedUrl) return NextResponse.json({ feil: 'Kunne ikke lage signert URL' }, { status: 500 })
    return NextResponse.json({ url: signert.signedUrl })
  } catch (e) {
    console.error('Verdivurdering signert-url feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Signert URL feilet' }, { status: 500 })
  }
}
