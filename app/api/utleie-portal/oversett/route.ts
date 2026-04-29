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

const sprakliste = SPRAK.map(s => `${s} (${SPRAK_NAVN[s]})`).join(', ')

// Oversetter én tekst til alle 8 språk. Hvert kall er kort så vi treffer
// aldri max_tokens-grensen. Returnerer { no, en, es, ... }
async function oversettTekst(tekst: string, etikett: string): Promise<Record<string, string>> {
  if (!tekst || !tekst.trim()) return {}
  const prompt = `Translate this Spanish luxury real-estate ${etikett} into all 8 languages: ${sprakliste}.

Rules:
- Keep tone warm, professional, evocative
- Preserve specific facts (rooms, areas, distances, dates)
- Don't translate place names (Marbella, Costa del Sol etc.)
- For Norwegian (no), keep original if input is already Norwegian, else translate

Source:
${tekst}

Return ONLY JSON in this exact shape (no markdown):
{ "no": "...", "en": "...", "es": "...", "fr": "...", "de": "...", "nl": "...", "da": "...", "sv": "..." }`

  const respons = await klient.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })
  const tekstSvar = respons.content[0]?.type === 'text' ? respons.content[0].text : ''
  const ren = robustParseJson(tekstSvar)
  if (!ren || typeof ren !== 'object') throw new Error(`Klarte ikke parse svar for ${etikett}`)
  return ren as Record<string, string>
}

// Oversetter en liste til alle 8 språk. Returnerer { no: [...], en: [...], ... }
async function oversettListe(liste: string[], etikett: string): Promise<Record<string, string[]>> {
  if (!liste || liste.length === 0) return {}
  const prompt = `Translate these Spanish luxury real-estate ${etikett} into all 8 languages: ${sprakliste}.

Rules:
- Use natural local equivalents (e.g. "Klimaanlegg" → "Air conditioning" / "Aire acondicionado")
- Keep array order identical to source
- Same number of items in every language

Source (JSON array):
${JSON.stringify(liste)}

Return ONLY JSON in this exact shape (no markdown):
{ "no": [...], "en": [...], "es": [...], "fr": [...], "de": [...], "nl": [...], "da": [...], "sv": [...] }`

  const respons = await klient.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })
  const tekstSvar = respons.content[0]?.type === 'text' ? respons.content[0].text : ''
  const ren = robustParseJson(tekstSvar)
  if (!ren || typeof ren !== 'object') throw new Error(`Klarte ikke parse svar for ${etikett}`)
  return ren as Record<string, string[]>
}

function robustParseJson(raw: string): unknown {
  let ren = raw.replace(/```json|```/g, '').trim()
  const forste = ren.indexOf('{')
  const siste = ren.lastIndexOf('}')
  if (forste >= 0 && siste > forste) ren = ren.slice(forste, siste + 1)
  try { return JSON.parse(ren) } catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const { prosjekt_id } = await req.json()
    if (!prosjekt_id) return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ feil: 'ANTHROPIC_API_KEY mangler' }, { status: 500 })
    }

    const admin = hentSupabaseAdmin()
    const { data: p, error } = await admin
      .from('prosjekter')
      .select('id, navn, utleie_kort_beskrivelse, utleie_beskrivelse, salg_kort_beskrivelse, salg_beskrivelse, utleie_fasiliteter')
      .eq('id', prosjekt_id)
      .maybeSingle()
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    if (!p) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

    const fas = Array.isArray(p.utleie_fasiliteter) ? p.utleie_fasiliteter : []

    // Kjør alle oversettelsene parallelt — hver er liten nok til å fullføre
    const [navn, utleieKort, utleieFull, salgKort, salgFull, fasiliteter] = await Promise.all([
      oversettTekst(p.navn || '', 'property title'),
      oversettTekst(p.utleie_kort_beskrivelse || '', 'short rental description'),
      oversettTekst(p.utleie_beskrivelse || '', 'full rental description'),
      oversettTekst(p.salg_kort_beskrivelse || '', 'short sales description'),
      oversettTekst(p.salg_beskrivelse || '', 'full sales description'),
      oversettListe(fas, 'amenities list'),
    ])

    const oppdatering = {
      navn_oversettelser: Object.keys(navn).length > 0 ? navn : null,
      utleie_kort_oversettelser: Object.keys(utleieKort).length > 0 ? utleieKort : null,
      utleie_beskrivelse_oversettelser: Object.keys(utleieFull).length > 0 ? utleieFull : null,
      salg_kort_oversettelser: Object.keys(salgKort).length > 0 ? salgKort : null,
      salg_beskrivelse_oversettelser: Object.keys(salgFull).length > 0 ? salgFull : null,
      utleie_fasiliteter_oversettelser: Object.keys(fasiliteter).length > 0 ? fasiliteter : null,
      oversettelser_oppdatert: new Date().toISOString(),
    }

    const { error: oppErr } = await admin.from('prosjekter').update(oppdatering).eq('id', prosjekt_id)
    if (oppErr) {
      const trolig = oppErr.message.toLowerCase().includes('column') || oppErr.message.toLowerCase().includes('does not exist')
        ? ' — tips: kjør 20260428c_oversettelser.sql i Supabase'
        : ''
      return NextResponse.json({ feil: 'Lagring feilet: ' + oppErr.message + trolig }, { status: 500 })
    }

    return NextResponse.json({ suksess: true, oversettelser_oppdatert: oppdatering.oversettelser_oppdatert })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Oversett-feil:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
