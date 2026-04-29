import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { AI_MODELL_VERSJON, BUCKET_BILDER, KATEGORIER, TILLEGG_TYPER } from '../../../lib/bilder'
import type { BoligData, Prosjekt } from '../../../types'

const client = new Anthropic()

const nyLoggId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const analyserBildeTool = {
  name: 'analyser_bilde',
  description: 'Strukturert analyse av et prosjektbilde med synlige problemer, foreslåtte oppussingsposter og potensielle tillegg.',
  input_schema: {
    type: 'object' as const,
    required: ['beskrivelse', 'foreslatt_kategori'],
    properties: {
      foreslatt_kategori: { type: 'string', enum: KATEGORIER as unknown as string[] },
      beskrivelse: { type: 'string', description: 'Kort beskrivelse av hva som er i bildet (2-3 setninger).' },
      synlige_problemer: {
        type: 'array',
        items: { type: 'string' },
        description: 'Konkrete problemer eller slitasje som er synlig. Tom hvis ingenting.',
      },
      foreslatte_oppussingsposter: {
        type: 'array',
        items: {
          type: 'object',
          required: ['navn', 'kostnad_estimat_lav', 'kostnad_estimat_hoy', 'begrunnelse'],
          properties: {
            navn: { type: 'string', description: 'F.eks. "Bad – flislegging + nytt vvs"' },
            kostnad_estimat_lav: { type: 'number', description: 'EUR, nedre del av intervall' },
            kostnad_estimat_hoy: { type: 'number', description: 'EUR, øvre del av intervall' },
            begrunnelse: { type: 'string', description: 'Kort hvorfor dette anbefales' },
          },
        },
      },
      potensielle_tillegg: {
        type: 'array',
        description: 'Bare foreslå hvis bildet tydelig viser tilgjengelig plass. Hvis ikke — tom.',
        items: {
          type: 'object',
          required: ['tillegg', 'beskrivelse', 'regulering_vurdering', 'begrunnelse'],
          properties: {
            tillegg: { type: 'string', enum: TILLEGG_TYPER as unknown as string[] },
            beskrivelse: { type: 'string' },
            kostnad_estimat_lav: { type: 'number' },
            kostnad_estimat_hoy: { type: 'number' },
            verdiokning_estimat: { type: 'string', description: 'F.eks. "€30 000–50 000 ved salg"' },
            regulering_vurdering: { type: 'string', enum: ['sannsynlig_ok', 'ma_sjekkes', 'sannsynlig_problematisk'] },
            regulering_begrunnelse: { type: 'string' },
            ma_sjekkes_videre: { type: 'array', items: { type: 'string' }, description: 'Konkrete punkter for ayuntamiento/arkitekt' },
            begrunnelse: { type: 'string' },
          },
        },
      },
      egnet_for_visualisering: { type: 'boolean', description: 'Om bildet er egnet for AI-generert "etter"-visualisering' },
      salgbarhet_score: { type: 'number', minimum: 0, maximum: 10 },
    },
  },
}

const SYSTEM = `Du er ekspert på spansk eiendomsmarked og oppussing. Du analyserer bilder av boliger og returnerer strukturert data via analyser_bilde-verktøyet.

Retningslinjer:
- Alle kostnader i EUR som intervall (lav–hoy), basert på typiske spanske håndverker-priser
- Kun konkrete synlige forhold — ikke gjetning om det du ikke ser
- Potensielle tillegg (basseng, pergola, outdoor kitchen, takterrasse osv.): kun hvis bildet tydelig viser tilgjengelig plass
- Regulering — VÆR KONSERVATIV. Ved tvil velg "ma_sjekkes":
  - Basseng: 3 m minimumsavstand til tomtegrense; kyst: Ley de Costas (100 m)
  - Takterrasser / takoppbygg: krever comunidad-godkjenning for leiligheter
  - Outdoor kitchen: VVS-tillatelse, evt. gass-godkjenning
  - Nye strukturer: ayuntamiento kan kreve licencia de obra mayor
  - Kystsone: Costas-loven strenge restriksjoner
- ma_sjekkes_videre: konkrete punkter brukeren må sjekke med ayuntamiento, arkitekt eller advokat
- salgbarhet_score 0–10 basert på helhetsinntrykk
- Alle tekster på norsk`

async function hentBilde(admin: ReturnType<typeof hentSupabaseAdmin>, sti: string): Promise<string | null> {
  const { data: blob } = await admin.storage.from(BUCKET_BILDER).download(sti)
  if (!blob) return null
  const buffer = Buffer.from(await blob.arrayBuffer())
  return buffer.toString('base64')
}

async function analyserEttBilde(
  admin: ReturnType<typeof hentSupabaseAdmin>,
  bildeRad: { id: string; storage_sti: string; kategori: string | null; tilleggsnotat: string | null; prosjekt_id: string },
  boligKontekst: string,
): Promise<{ ok: boolean; feil?: string }> {
  const base64 = await hentBilde(admin, bildeRad.storage_sti)
  if (!base64) return { ok: false, feil: 'Kunne ikke hente bilde fra Storage' }

  const kontekstLinjer = [
    boligKontekst,
    bildeRad.kategori ? `Kategori satt av bruker: ${bildeRad.kategori}` : null,
    bildeRad.tilleggsnotat ? `Bruker-notat: ${bildeRad.tilleggsnotat}` : null,
  ].filter(Boolean).join('\n')

  const response = await client.messages.create({
    model: AI_MODELL_VERSJON,
    max_tokens: 2000,
    temperature: 0,
    system: SYSTEM,
    tools: [analyserBildeTool],
    tool_choice: { type: 'tool', name: 'analyser_bilde' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: 'Analyser dette bildet av en bolig i Spania.\n\n' + kontekstLinjer },
      ],
    }],
  })

  const toolBlokk = response.content.find(b => b.type === 'tool_use')
  if (!toolBlokk || toolBlokk.type !== 'tool_use') {
    return { ok: false, feil: 'Ingen tool_use i respons' }
  }

  const input = toolBlokk.input as {
    foreslatt_kategori?: string
    beskrivelse?: string
    synlige_problemer?: string[]
    foreslatte_oppussingsposter?: unknown[]
    potensielle_tillegg?: unknown[]
    egnet_for_visualisering?: boolean
    salgbarhet_score?: number
  }

  const oppdatering = {
    kategori: bildeRad.kategori || input.foreslatt_kategori || null,
    ai_beskrivelse: input.beskrivelse || null,
    ai_synlige_problemer: input.synlige_problemer || [],
    ai_foreslatte_poster: input.foreslatte_oppussingsposter || [],
    ai_potensielle_tillegg: input.potensielle_tillegg || [],
    ai_salgbarhet_score: typeof input.salgbarhet_score === 'number' ? input.salgbarhet_score : null,
    ai_analysert: new Date().toISOString(),
    ai_modell_versjon: AI_MODELL_VERSJON,
  }
  const { error } = await admin.from('prosjekt_bilder').update(oppdatering).eq('id', bildeRad.id)
  if (error) return { ok: false, feil: 'DB-oppdatering feilet: ' + error.message }
  return { ok: true }
}

async function parallelBegrenset<T, R>(items: T[], maks: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      res[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(maks, items.length) }, () => worker()))
  return res
}

function byggBoligKontekst(p: Prosjekt | null): string {
  if (!p) return ''
  const bd = (p.bolig_data || {}) as BoligData
  const linjer = [
    `Bolig: ${p.navn}`,
    bd.type ? `Type: ${bd.type}` : null,
    bd.beliggenhet ? `Beliggenhet: ${bd.beliggenhet}` : null,
    bd.avstand_strand ? `Avstand strand: ${bd.avstand_strand} m` : null,
    bd.standard ? `Nåværende standard: ${bd.standard}` : null,
  ].filter(Boolean).join('\n')
  return linjer ? 'BOLIGKONTEKST:\n' + linjer : ''
}

export async function POST(req: NextRequest) {
  try {
    const { bilde_ids, analysert_av } = await req.json()
    if (!Array.isArray(bilde_ids) || bilde_ids.length === 0) {
      return NextResponse.json({ feil: 'bilde_ids mangler' }, { status: 400 })
    }
    if (typeof analysert_av !== 'string' || !analysert_av) {
      return NextResponse.json({ feil: 'analysert_av mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: bildeRader } = await admin.from('prosjekt_bilder')
      .select('id, storage_sti, kategori, tilleggsnotat, prosjekt_id')
      .in('id', bilde_ids)
      .eq('type', 'original')
    if (!bildeRader || bildeRader.length === 0) {
      return NextResponse.json({ feil: 'Fant ingen bilder' }, { status: 404 })
    }

    // Hent bolig-kontekst for hvert unikt prosjekt
    const prosjektIds = Array.from(new Set(bildeRader.map(b => b.prosjekt_id)))
    const { data: prosjekter } = await admin.from('prosjekter').select('*').in('id', prosjektIds)
    const prosjektMap = new Map<string, Prosjekt>()
    for (const p of (prosjekter || []) as Prosjekt[]) prosjektMap.set(p.id, p)

    const resultater = await parallelBegrenset(bildeRader, 3, async b => {
      const kontekst = byggBoligKontekst(prosjektMap.get(b.prosjekt_id) || null)
      try {
        return await analyserEttBilde(admin, b, kontekst)
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e)
        return { ok: false, feil: m }
      }
    })

    const suksess = resultater.filter(r => r.ok).length
    const feilet = resultater.length - suksess

    await admin.from('aktivitetslogg').insert([{
      id: nyLoggId(),
      bruker: analysert_av,
      handling: 'analyserte bilder',
      tabell: 'prosjekt_bilder',
      rad_id: null,
      detaljer: { antall_total: bildeRader.length, suksess, feilet, bilde_ids },
    }])

    return NextResponse.json({ suksess, feilet, detaljer: resultater })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Analyse feil:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
