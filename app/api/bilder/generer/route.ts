import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { BUCKET_BILDER } from '../../../lib/bilder'

const replicate = new Replicate()

const MODELL = 'black-forest-labs/flux-kontext-pro'
const SIGNERT_URL_TTL = 60 * 60 // 1 time — Replicate må rekke å laste ned

type ForslagOppussing = { navn: string; begrunnelse?: string }
type ForslagTillegg = { tillegg: string; beskrivelse?: string }

function byggPrompt(
  visualiseringsType: 'oppussing' | 'tillegg',
  forslag: ForslagOppussing | ForslagTillegg,
  kategori: string | null,
): string {
  if (visualiseringsType === 'oppussing') {
    const f = forslag as ForslagOppussing
    const rom = kategori?.toLowerCase() || 'room'
    return `Renovate this ${rom}: ${f.navn}. ${f.begrunnelse || ''} Keep the same camera angle, composition, and structural layout. Photorealistic interior photography, high detail.`.trim()
  }
  const f = forslag as ForslagTillegg
  const tilleggNavn = (f.tillegg || 'addition').replace(/_/g, ' ')
  return `Add a ${tilleggNavn} to this outdoor scene. ${f.beskrivelse || ''} Keep existing buildings, terrain, vegetation, and camera angle. Photorealistic architectural photography.`.trim()
}

export async function POST(req: NextRequest) {
  try {
    const { original_bilde_id, visualisering_type, forslag, generert_av } = await req.json()

    if (typeof original_bilde_id !== 'string' || !original_bilde_id) {
      return NextResponse.json({ feil: 'original_bilde_id mangler' }, { status: 400 })
    }
    if (visualisering_type !== 'oppussing' && visualisering_type !== 'tillegg') {
      return NextResponse.json({ feil: 'visualisering_type må være "oppussing" eller "tillegg"' }, { status: 400 })
    }
    if (!forslag || typeof forslag !== 'object') {
      return NextResponse.json({ feil: 'forslag mangler' }, { status: 400 })
    }
    if (typeof generert_av !== 'string' || !generert_av) {
      return NextResponse.json({ feil: 'generert_av mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: bilde } = await admin.from('prosjekt_bilder')
      .select('id, storage_sti, prosjekt_id, kategori')
      .eq('id', original_bilde_id)
      .eq('type', 'original')
      .single()
    if (!bilde) return NextResponse.json({ feil: 'Originalbilde ikke funnet' }, { status: 404 })

    const { data: signert } = await admin.storage.from(BUCKET_BILDER)
      .createSignedUrl(bilde.storage_sti, SIGNERT_URL_TTL)
    if (!signert?.signedUrl) {
      return NextResponse.json({ feil: 'Kunne ikke opprette signert URL for original' }, { status: 500 })
    }

    const prompt = byggPrompt(visualisering_type, forslag, bilde.kategori)

    const prediction = await replicate.predictions.create({
      model: MODELL,
      input: {
        prompt,
        input_image: signert.signedUrl,
        aspect_ratio: 'match_input_image',
        output_format: 'jpg',
        safety_tolerance: 2,
      },
    })

    return NextResponse.json({
      prediction_id: prediction.id,
      status: prediction.status,
      prompt,
    })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Generering start feilet:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
