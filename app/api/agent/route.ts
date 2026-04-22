import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../lib/supabase'
import type { BoligData, OppussingBudsjett, OppussingPost, Prosjekt, Utleieanalyse } from '../../types'

const client = new Anthropic()

const BASE_SYSTEM = `Du er en ekspert AI-assistent for Leganger & Osvaag Eiendom – spesialisert på eiendomsinvestering i Spania.

Du hjelper med:

JURIDISK OG SKATT:
- VFT-turistlisens regler per region (Andalucia, Valencia, Mallorca, Ibiza etc)
- Kjøpsprosessen i Spania: NIE-nummer, notarius, tinglysning, skatt
- Kjøpskostnader: IVA (10% nybygg), ITP (7-10% brukt), notarius, stempel
- Plusvalía-skatt ved salg, IBI (eiendomsskatt), formuesskatt
- Skatt på leieinntekter for nordmenn bosatt i Norge (24% kildeskatt)
- Selskapsstruktur: Norsk AS vs Spansk SL vs privat kjøp

AIRBNB OG KORTTIDSUTLEIE:
- Prissetting og sesongstrategi per område
- Plattformer, forvaltning, property management
- Hvordan bygge 4.9-score raskt, beleggsprosenter og yield

INVESTERING OG FINANSIERING:
- Yield-beregninger, banklån i Spania for utlendinger (typisk 60-70% LTV)
- Egenkapitalkrav, kjøpskostnader, cashflow, verdistigning

OMRÅDE-KUNNSKAP:
- Costa del Sol: Marbella, Estepona, Fuengirola, Benalmádena, Nerja
- Costa Blanca: Alicante, Torrevieja, Altea (obs moratorium)
- Mallorca og Ibiza
- VFT-moratorium: Alicante by t.o.m. jan 2027, enkelte kommuner
- Marbella har ikke moratorium – god for turistutleie

Svar alltid på norsk. Vær konkret og gi praktiske råd. Hvis du ikke vet noe sikkert, si det ærlig. Hold svarene korte – bruk punktlister når det passer.`

const EMAIL_SYSTEM = `
NÅR BRUKEREN BER OM HJELP MED E-POST:
- Bruk verktøyet foreslaa_epost for å lage utkast. Brukeren godkjenner og kan redigere før sending.
- VIKTIG: Kall foreslaa_epost MAKS ÉN GANG per respons. Hvis brukeren ber om å sende til flere mottakere, lag utkastet til den FØRSTE mottakeren nå — etter brukerens godkjenning kan du lage den neste i påfølgende respons.
- Default språk: spansk ("es") for spanske mottakere, norsk ("no") for norske. Engelsk ("en") kun hvis etterspurt.
- Formell og profesjonell tone for banker/meglere. På spansk: "Estimados señores", "Atentamente". På norsk: "Hei," / "Med vennlig hilsen".
- ALDRI inkluder signatur manuelt i innhold-feltet. Appen legger til signatur automatisk.
- Hvis prosjekt-kontekst er oppgitt: bruk konkrete detaljer (adresse, pris, m², rom) fra boligdata i e-posten.
- Ikke still unødvendige oppklaringsspørsmål. Har du nok info, kall foreslaa_epost direkte.

OM PDF-VEDLEGG (vedlegg_pdf: true):
- DU KAN vedlegge en komplett prosjektanalyse-PDF (boligdata, økonomi, oppussingsbudsjett, ROI, AI-vurdering, før/etter-bilder) til e-posten ved å sette vedlegg_pdf: true i foreslaa_epost-kallet. Krever at relatert_prosjekt_id er satt.
- Når brukeren sier ting som "lag pdf for X-prosjektet og send til Y", "send analyse til Z", "send rapporten til mottaker", eller "send den samme til en annen mottaker" — TOLK det som: kall foreslaa_epost med vedlegg_pdf: true OG relatert_prosjekt_id satt. PDF-en bygges og festes automatisk av appen.
- ALDRI svar at "jeg kan ikke lage PDF" — du kan, via vedlegg_pdf-flagget. Hvis prosjekt-konteksten er satt og brukeren ber om analyse/rapport: bare lag e-postutkastet med vedlegg_pdf: true.
- Default vedlegg_pdf: true for: bank_finansieringssamtale, og når brukeren eksplisitt nevner PDF/analyse/rapport. Ellers default false.

FORMÅL bank_finansieringssamtale:
- Mål: få møte eller samtale. Ikke be om finansiering via e-post.
- Struktur: kort presentasjon → konkret prosjekt (type, område, prisantydning, omtrentlig EK) → tydelig forespørsel om møte → 2-3 konkrete tidsvinduer neste uke.
- Sett vedlegg_pdf: true som default – nevn i innhold at detaljert analyse er vedlagt.
- Bruk onsket_mote-feltet hvis brukeren sa hvordan de vil møtes.

FORMÅL megler_boligsporsmal:
- Mål: få info som mangler i annonsen før befaring/bud.
- Struktur: referanse til boligen (adresse eller annonse-URL) → kort interesse → nummererte spørsmål (bruk sporsmal-arrayen) → "vurderer befaring når disse er avklart".
- Velg 5-8 mest relevante spørsmål basert på prosjektkonteksten:
  - Fersk IBI-utskrift?
  - Comunidad-kostnader per måned?
  - Boligens alder og renoveringshistorikk?
  - Certificado energético tilgjengelig?
  - Ubetalte fellesutgifter eller heftelser?
  - Lovlig turistlisens (kun hvis korttid er aktuelt for området/boligen)?
  - Alle arealer lovlig registrert (ingen sorte byggearbeider)?
  - Tak/VVS/el-anlegg – status?
  - Basseng: alder og siste renovering? (kun hvis bolig har basseng)
  - Nota Simple (grunnboksutskrift) tilgjengelig?
- Prioriter spørsmål der info mangler i boligdata.

FORMÅL megler_befaring:
- Kort og direkte: bekreft interesse, be om befaringstidspunkt, oppgi egen tilgjengelighet.

FORMÅL megler_bud:
- Formell: budbeløp, betingelser, svarfrist, evt. finansieringsforbehold.
- Dette er ET UTKAST – brukeren må lese nøye og redigere før sending.

FORMÅL selger_kontakt:
- Følg megler_boligsporsmal-malen. Færre spørsmål (3-5), litt varmere tone (for privatsalg uten megler).

FORMÅL haandverker_tilbud:
- Kort: beskriv arbeid som skal gjøres, bolig-adresse, be om befaring og pristilbud.

Hvis brukeren bare prater generelt eller stiller spørsmål, svar som vanlig uten å kalle verktøyet.`

const foreslaaEpostTool = {
  name: 'foreslaa_epost',
  description: 'Foreslår en e-post brukeren må godkjenne i chatten før sending. Brukes ved henvendelser til banker, meglere, selgere, håndverkere. Formålet styrer strukturen.',
  input_schema: {
    type: 'object' as const,
    required: ['til', 'emne', 'innhold', 'sprak', 'formaal'],
    properties: {
      til: { type: 'string', description: 'E-postadresse til mottaker' },
      mottaker_navn: { type: 'string', description: 'Fullt navn eller firmanavn' },
      mottaker_type: { type: 'string', enum: ['bank', 'selger', 'megler', 'haandverker', 'annet'] },
      sprak: { type: 'string', enum: ['no', 'es', 'en'] },
      emne: { type: 'string' },
      innhold: { type: 'string', description: 'Ferdig e-posttekst UTEN signatur (appen legger til signatur)' },
      formaal: {
        type: 'string',
        enum: ['bank_finansieringssamtale', 'megler_boligsporsmal', 'megler_befaring', 'megler_bud', 'selger_kontakt', 'haandverker_tilbud', 'annet'],
      },
      relatert_prosjekt_id: { type: 'string' },
      sporsmal: {
        type: 'array',
        items: { type: 'string' },
        description: 'Nummererte spørsmål til megler – brukes for megler_boligsporsmal og selger_kontakt',
      },
      onsket_mote: {
        type: 'string',
        enum: ['telefon', 'video', 'fysisk_mote', 'fleksibelt'],
        description: 'Kun for bank_finansieringssamtale',
      },
      vedlegg_pdf: {
        type: 'boolean',
        description: 'Om prosjektanalysen skal vedlegges som PDF. True som default for bank_finansieringssamtale.',
      },
    },
  },
}

async function hentProsjektKontekst(id: string): Promise<string> {
  const { data: pRad } = await supabase.from('prosjekter').select('*').eq('id', id).single()
  if (!pRad) return ''
  const p = pRad as Prosjekt
  const bd = (p.bolig_data || {}) as BoligData
  const linjer: string[] = [
    `Prosjekt: ${p.navn} (id: ${p.id})`,
    `Kategori: ${p.kategori === 'flipp' ? 'Boligflipp' : 'Boligutleie'}`,
    `Status: ${p.status}`,
    `Kjøpesum: €${p.kjøpesum || '?'}`,
  ]
  if (bd.type) linjer.push(`Boligtype: ${bd.type}`)
  if (bd.beliggenhet) linjer.push(`Beliggenhet: ${bd.beliggenhet}`)
  if (bd.areal) linjer.push(`Areal: ${bd.areal} m²`)
  if (bd.soverom) linjer.push(`Soverom: ${bd.soverom}`)
  if (bd.bad) linjer.push(`Bad: ${bd.bad}`)
  if (bd.basseng) linjer.push(`Basseng: ${bd.basseng}`)
  if (bd.avstand_strand) linjer.push(`Avstand strand: ${bd.avstand_strand} m`)
  if (bd.standard) linjer.push(`Standard: ${bd.standard}`)
  if (bd.ekstra) linjer.push(`Ekstra: ${bd.ekstra}`)
  if (p.ai_vurdering) linjer.push(`AI-vurdering: ${p.ai_vurdering}`)

  if (p.airbnb_data && typeof p.airbnb_data === 'object') {
    const ad = p.airbnb_data as { konklusjon?: { vurdering?: string; anbefalt_leietype?: string; egnethet_score?: number } }
    if (ad.konklusjon) {
      linjer.push(`Utleie-konklusjon: ${ad.konklusjon.vurdering || '?'}, egnethet ${ad.konklusjon.egnethet_score ?? '?'}/10, anbefalt ${ad.konklusjon.anbefalt_leietype || '?'}`)
    }
  }

  if (p.kategori === 'flipp') {
    const { data: b } = await supabase.from('oppussing_budsjett').select('*').eq('bolig_id', p.id).maybeSingle()
    if (b) {
      const budsjett = b as OppussingBudsjett
      const { data: poster } = await supabase.from('oppussing_poster').select('*').eq('budsjett_id', budsjett.id)
      const sumPoster = (poster as OppussingPost[] | null || []).reduce((s, pp) => s + (pp.kostnad || 0), 0)
      linjer.push(`Oppussingsbudsjett: standard ${budsjett.standard}, varighet ${budsjett.antall_maneder} mnd, sum poster €${sumPoster}`)
      if (budsjett.estimert_salgspris) linjer.push(`Estimert salgspris (AI): €${budsjett.estimert_salgspris}`)
    }
  }

  if (p.kategori === 'utleie') {
    const { data: u } = await supabase.from('utleieanalyse').select('*').eq('bolig_id', p.id).maybeSingle()
    if (u) {
      const ua = u as Utleieanalyse
      linjer.push(`Utleieanalyse: ${ua.leietype === 'korttid' ? 'korttid' : 'langtid'}, scenario ${ua.scenario}, kjøpspris €${ua.total_kjopspris || '?'}`)
    }
  }

  return 'AKTIV PROSJEKT-KONTEKST:\n' + linjer.join('\n')
}

type Melding = { role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }

// Sikrer at hver assistant.tool_use har en matchende user.tool_result i NESTE melding.
// Hvis ikke: injiserer auto-avbrutt tool_result. Forhindrer 400-feilen om orphan tool_use.
function fiksToolUseKjede(input: Melding[]): Melding[] {
  const m = input.map(x => ({
    role: x.role,
    content: typeof x.content === 'string' ? x.content : [...x.content],
  }))
  for (let i = 0; i < m.length; i++) {
    const cur = m[i]
    if (cur.role !== 'assistant' || typeof cur.content === 'string') continue
    const toolUses = cur.content.filter(b => b.type === 'tool_use') as Array<{ type: 'tool_use'; id: string }>
    if (toolUses.length === 0) continue

    const next = m[i + 1]
    const eksisterendeIds = new Set<string>()
    if (next && next.role === 'user' && Array.isArray(next.content)) {
      for (const b of next.content) {
        if (b.type === 'tool_result') eksisterendeIds.add(b.tool_use_id as string)
      }
    }
    const mangler = toolUses.filter(tu => !eksisterendeIds.has(tu.id))
    if (mangler.length === 0) continue

    const autoResultater = mangler.map(tu => ({
      type: 'tool_result',
      tool_use_id: tu.id,
      content: 'Brukeren handlet ikke på dette utkastet. Behandle som avbrutt.',
    }))

    if (next && next.role === 'user') {
      const eksisterende = typeof next.content === 'string'
        ? [{ type: 'text', text: next.content }]
        : next.content
      next.content = [...autoResultater, ...eksisterende]
    } else {
      m.splice(i + 1, 0, { role: 'user', content: autoResultater })
    }
  }
  return m
}

export async function POST(req: NextRequest) {
  try {
    const { meldinger, relatert_prosjekt_id } = await req.json()

    let prosjektKontekst = ''
    if (typeof relatert_prosjekt_id === 'string' && relatert_prosjekt_id.length > 0) {
      try { prosjektKontekst = await hentProsjektKontekst(relatert_prosjekt_id) } catch (e) {
        console.error('Prosjekt-kontekst feilet:', e)
      }
    }

    const system = [BASE_SYSTEM, EMAIL_SYSTEM, prosjektKontekst].filter(Boolean).join('\n\n')

    const fiksedeMeldinger = fiksToolUseKjede(meldinger as Melding[])

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      system,
      tools: [foreslaaEpostTool],
      messages: fiksedeMeldinger as Parameters<typeof client.messages.create>[0]['messages'],
    })

    return NextResponse.json({ content: response.content, stop_reason: response.stop_reason })
  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error)
    console.error('Agent feil:', melding)
    return NextResponse.json({ error: melding }, { status: 500 })
  }
}
