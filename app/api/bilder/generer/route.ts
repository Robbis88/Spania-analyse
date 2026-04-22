import Replicate from 'replicate'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { BUCKET_BILDER, STILER, TILLEGG_ETIKETT } from '../../../lib/bilder'
import type { TilleggType } from '../../../lib/bilder'

const replicate = new Replicate()

const MODELL = 'black-forest-labs/flux-kontext-max'
const SIGNERT_URL_TTL = 60 * 60

type PostRad = { navn: string; notat: string | null }
type TilleggRad = { navn: string; tillegg_type: string | null; notat: string | null }

function byggPrompt(poster: PostRad[], tillegg: TilleggRad[], kategori: string | null, stilPrompt: string): string {
  const erInterior = kategori ? !['Uteplass/terrasse', 'Basseng', 'Hage', 'Fasade utvendig', 'Tak'].includes(kategori) : false
  const romNavn = erInterior ? (kategori?.toLowerCase() || 'room') : 'outdoor area'

  const oppussingsLinjer = poster.map((p, i) => {
    const beskr = p.notat ? ` (${p.notat})` : ''
    return `${i + 1}. ${p.navn}${beskr}`
  })
  const tilleggsLinjer = tillegg.map((t, i) => {
    const navn = t.tillegg_type ? (TILLEGG_ETIKETT[t.tillegg_type as TilleggType] || t.tillegg_type) : t.navn
    const beskr = t.notat ? ` (${t.notat})` : ''
    return `${i + 1 + oppussingsLinjer.length}. Add ${navn}${beskr}`
  })

  const endringer = [...oppussingsLinjer, ...tilleggsLinjer].join('\n')

  // Stilen er rammeverket — plasseres ØVERST så modellen vekter den tungt.
  // Uten stil: fokus kun på endringene med minimal estetisk endring.
  const linjer: string[] = []
  if (stilPrompt) {
    linjer.push(`Completely reimagine this ${romNavn} as a brand-new design from scratch in the following style:`)
    linjer.push(stilPrompt)
    linjer.push('')
    linjer.push('Required design changes:')
    linjer.push(endringer)
    linjer.push('')
    linjer.push('You have full creative freedom to:')
    linjer.push('- Replace ALL cabinets, fixtures, countertops, appliances, flooring, lighting, furniture and décor with new ones that fit the style')
    linjer.push('- Rearrange the layout (e.g. island vs peninsula, L-shape vs U-shape, different furniture placement) — it does not need to match the original layout')
    linjer.push('- Change wall colors, tile patterns, backsplashes, materials, and surface finishes')
    linjer.push('- Modernize or completely swap appliance models, sinks, faucets, hardware')
    linjer.push('- Add or remove decorative elements (plants, art, accessories) to fit the style')
    linjer.push('')
    linjer.push('Only preserve: the camera angle and viewing direction, the room\'s overall footprint (walls and windows at roughly the same positions), and the natural light direction. Everything else can change.')
  } else {
    linjer.push(`Edit this ${romNavn} to show these renovations applied:`)
    linjer.push(endringer)
    linjer.push('')
    linjer.push('Keep the same camera angle, composition, and existing elements that are not being changed.')
  }
  linjer.push('Photorealistic, magazine-quality architectural photography, high detail.')
  return linjer.join('\n')
}

function utledVisualiseringType(antallPoster: number, antallTillegg: number): 'oppussing' | 'tillegg' | 'kombinert' {
  if (antallPoster > 0 && antallTillegg > 0) return 'kombinert'
  if (antallTillegg > 0) return 'tillegg'
  return 'oppussing'
}

export async function POST(req: NextRequest) {
  try {
    const { original_bilde_id, generert_av, stil, egen_prompt } = await req.json()

    if (typeof original_bilde_id !== 'string' || !original_bilde_id) {
      return NextResponse.json({ feil: 'original_bilde_id mangler' }, { status: 400 })
    }
    if (typeof generert_av !== 'string' || !generert_av) {
      return NextResponse.json({ feil: 'generert_av mangler' }, { status: 400 })
    }
    const stilDef = STILER.find(s => s.id === (stil || ''))
    if (!stilDef) {
      return NextResponse.json({ feil: `Ukjent stil: ${stil}` }, { status: 400 })
    }
    const egenPromptTekst = typeof egen_prompt === 'string' ? egen_prompt.trim() : ''
    if (stilDef.id === 'egen' && !egenPromptTekst) {
      return NextResponse.json({ feil: 'Skriv inn en stil-beskrivelse når du har valgt "Egen stil"' }, { status: 400 })
    }
    const effektivStilPrompt = stilDef.id === 'egen' ? egenPromptTekst : stilDef.prompt

    const admin = hentSupabaseAdmin()
    const { data: bilde } = await admin.from('prosjekt_bilder')
      .select('id, storage_sti, prosjekt_id, kategori')
      .eq('id', original_bilde_id)
      .eq('type', 'original')
      .single()
    if (!bilde) return NextResponse.json({ feil: 'Originalbilde ikke funnet' }, { status: 404 })

    const [{ data: poster }, { data: tilleggRader }] = await Promise.all([
      admin.from('oppussing_poster').select('navn, notat').eq('kilde_bilde_id', original_bilde_id),
      admin.from('oppussing_tillegg').select('navn, tillegg_type, notat').eq('kilde_bilde_id', original_bilde_id),
    ])

    const p = (poster || []) as PostRad[]
    const t = (tilleggRader || []) as TilleggRad[]

    if (p.length === 0 && t.length === 0) {
      return NextResponse.json({
        feil: 'Ingen godtatte forslag koblet til dette bildet. Godta minst ett forslag først.',
      }, { status: 400 })
    }

    const { data: signert } = await admin.storage.from(BUCKET_BILDER)
      .createSignedUrl(bilde.storage_sti, SIGNERT_URL_TTL)
    if (!signert?.signedUrl) {
      return NextResponse.json({ feil: 'Kunne ikke opprette signert URL for original' }, { status: 500 })
    }

    const prompt = byggPrompt(p, t, bilde.kategori, effektivStilPrompt)
    const visualiseringType = utledVisualiseringType(p.length, t.length)

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
      visualisering_type: visualiseringType,
      antall_endringer: p.length + t.length,
      stil: stilDef.id,
      prompt,
    })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Generering start feilet:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
