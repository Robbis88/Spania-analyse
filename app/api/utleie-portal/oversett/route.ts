import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'

const klient = new Anthropic()

const SPRAK = ['no', 'en', 'es', 'fr', 'de', 'nl', 'da', 'sv'] as const
const SPRAK_NAVN: Record<string, string> = {
  no: 'Norwegian (Bokmål)',
  en: 'English',
  es: 'Spanish (Castellano)',
  fr: 'French',
  de: 'German',
  nl: 'Dutch',
  da: 'Danish',
  sv: 'Swedish',
}

// Tar prosjekt_id, leser tekstfelter, kaller Claude én gang for alle språk,
// lagrer JSONB-oversettelser tilbake. Idempotent — kan kjøres flere ganger.
export async function POST(req: NextRequest) {
  try {
    const { prosjekt_id } = await req.json()
    if (!prosjekt_id) return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })

    const admin = hentSupabaseAdmin()
    const { data: p, error } = await admin
      .from('prosjekter')
      .select('id, navn, utleie_kort_beskrivelse, utleie_beskrivelse, salg_kort_beskrivelse, salg_beskrivelse, utleie_fasiliteter')
      .eq('id', prosjekt_id)
      .maybeSingle()
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    if (!p) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

    const kilder = {
      navn: p.navn || '',
      utleie_kort: p.utleie_kort_beskrivelse || '',
      utleie_full: p.utleie_beskrivelse || '',
      salg_kort: p.salg_kort_beskrivelse || '',
      salg_full: p.salg_beskrivelse || '',
      fasiliteter: Array.isArray(p.utleie_fasiliteter) ? p.utleie_fasiliteter : [],
    }

    const harTekst = kilder.navn || kilder.utleie_kort || kilder.utleie_full
      || kilder.salg_kort || kilder.salg_full || kilder.fasiliteter.length > 0
    if (!harTekst) return NextResponse.json({ feil: 'Ingen tekst å oversette' }, { status: 400 })

    const sprakliste = SPRAK.map(s => `${s} (${SPRAK_NAVN[s]})`).join(', ')

    const prompt = `You are a professional translator for a Spanish luxury real-estate portal.

Translate the following property listing into all 8 languages: ${sprakliste}.

Rules:
- Keep tone warm, professional, evocative — like a high-end estate agent
- Preserve specific facts (room counts, areas, distances, year built)
- Don't translate place names (Marbella, Costa del Sol, etc.) — keep them as-is
- For amenities, use natural local equivalents (e.g. "Air conditioning" / "Aire acondicionado")
- For Norwegian (no), keep the original if input is already Norwegian, otherwise translate

Source content (any field may be empty — return empty strings for those):
\`\`\`json
${JSON.stringify(kilder, null, 2)}
\`\`\`

Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "navn": { "no": "...", "en": "...", "es": "...", "fr": "...", "de": "...", "nl": "...", "da": "...", "sv": "..." },
  "utleie_kort": { "no": "...", "en": "...", "es": "...", "fr": "...", "de": "...", "nl": "...", "da": "...", "sv": "..." },
  "utleie_full": { "no": "...", "en": "...", "es": "...", "fr": "...", "de": "...", "nl": "...", "da": "...", "sv": "..." },
  "salg_kort": { "no": "...", "en": "...", "es": "...", "fr": "...", "de": "...", "nl": "...", "da": "...", "sv": "..." },
  "salg_full": { "no": "...", "en": "...", "es": "...", "fr": "...", "de": "...", "nl": "...", "da": "...", "sv": "..." },
  "fasiliteter": { "no": [], "en": [], "es": [], "fr": [], "de": [], "nl": [], "da": [], "sv": [] }
}`

    const respons = await klient.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    const tekst = respons.content[0].type === 'text' ? respons.content[0].text : ''
    const ren = tekst.replace(/```json|```/g, '').trim()

    let oversatt: {
      navn: Record<string, string>
      utleie_kort: Record<string, string>
      utleie_full: Record<string, string>
      salg_kort: Record<string, string>
      salg_full: Record<string, string>
      fasiliteter: Record<string, string[]>
    }
    try {
      oversatt = JSON.parse(ren)
    } catch {
      return NextResponse.json({ feil: 'Klarte ikke å parse oversettelses-JSON' }, { status: 502 })
    }

    const oppdatering = {
      navn_oversettelser: oversatt.navn || null,
      utleie_kort_oversettelser: oversatt.utleie_kort || null,
      utleie_beskrivelse_oversettelser: oversatt.utleie_full || null,
      salg_kort_oversettelser: oversatt.salg_kort || null,
      salg_beskrivelse_oversettelser: oversatt.salg_full || null,
      utleie_fasiliteter_oversettelser: oversatt.fasiliteter || null,
      oversettelser_oppdatert: new Date().toISOString(),
    }

    const { error: oppErr } = await admin.from('prosjekter').update(oppdatering).eq('id', prosjekt_id)
    if (oppErr) return NextResponse.json({ feil: oppErr.message }, { status: 500 })

    return NextResponse.json({ suksess: true, oversettelser_oppdatert: oppdatering.oversettelser_oppdatert })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Oversett-feil:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
