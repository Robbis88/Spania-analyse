import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../lib/requireAuth'

const TILLATTE_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
const MAKS_BYTES = 25 * 1024 * 1024
const MODELL = 'claude-sonnet-4-5'

const takstTool = {
  name: 'les_takstrapport',
  description: 'Kjøper-rettet analyse av en norsk takstrapport / e-takst / tilstandsrapport. Henter ut fakta og gir kritisk vurdering av risiko, forhandlingsposisjon, mangler i rapporten og spørsmål kjøper bør stille før budgivning.',
  input_schema: {
    type: 'object' as const,
    required: ['ai_oppsummering'],
    properties: {
      // === FAKTA FRA RAPPORTEN ===
      vurdert_markedsverdi_nok: { type: 'number', description: 'Takstmannens vurderte markedsverdi i NOK. Hvis flere verdier er nevnt (f.eks. teknisk verdi vs markedsverdi), bruk markedsverdi.' },
      laneverdi_nok: { type: 'number', description: 'Låneverdi / lånetakst i NOK hvis spesifisert (typisk lavere enn markedsverdi).' },
      adresse: { type: 'string' },
      byggear: { type: 'number' },
      areal_bra_m2: { type: 'number', description: 'Bruksareal (BRA) i m².' },
      areal_p_rom_m2: { type: 'number', description: 'P-rom areal i m² hvis oppgitt.' },
      energimerke: { type: 'string', description: 'F.eks. "C orange", "B grønn", "G rød".' },
      eierform: { type: 'string', description: 'F.eks. "Selveier", "Andel", "Aksje".' },

      tilstandsgrader: {
        type: 'array',
        description: 'Bygningsdeler med tilstandsgrad TG0/TG1/TG2/TG3. Kun ta med deler som faktisk er vurdert i rapporten.',
        items: {
          type: 'object',
          required: ['del', 'tg'],
          properties: {
            del: { type: 'string' },
            tg: { type: 'number', enum: [0, 1, 2, 3] },
            kommentar: { type: 'string', description: 'Kort sitat eller oppsummering av takstmannens kommentar.' },
            estimat_nok: { type: 'number', description: 'Anslått utbedrings-kostnad i NOK hvis takstmannen har angitt det.' },
          },
        },
      },

      // === KJØPER-VURDERING (det rapporten IKKE eksplisitt sier) ===

      rode_flagg: {
        type: 'array',
        description: '0-8 viktige forhold kjøper bør være oppmerksom på. Tenk som en kritisk kjøper, ikke bare gjenta TG-funn — flagg også motsetninger mellom takst og normal forventning, ulovligheter, vannskade-historikk, mugg/fukt, og ting som typisk skjules.',
        items: {
          type: 'object',
          required: ['alvorlighet', 'tittel', 'beskrivelse'],
          properties: {
            alvorlighet: { type: 'string', enum: ['kritisk', 'advarsel', 'info'] },
            tittel: { type: 'string' },
            beskrivelse: { type: 'string', description: '1-2 setninger om hva og hvorfor det er viktig for kjøper.' },
          },
        },
      },

      anbefalte_oppussingsposter: {
        type: 'array',
        description: 'Konkrete oppussingsposter basert på TG2/TG3 + nødvendige tiltak for å nå normalt tilstandsnivå. Inkluder 20% buffer for ukjente forhold som typisk dukker opp.',
        items: {
          type: 'object',
          required: ['navn', 'kostnad_estimat_nok', 'begrunnelse'],
          properties: {
            navn: { type: 'string' },
            kostnad_estimat_nok: { type: 'number', description: 'Realistisk håndverkerpris i NOK 2025-nivå.' },
            begrunnelse: { type: 'string', description: 'Refer til TG eller takstmannens funn.' },
            prioritet: { type: 'string', enum: ['hast', 'normal', 'lav'] },
          },
        },
      },

      forhandlingsvurdering: {
        type: 'object',
        description: 'Kjøperens forhandlingsposisjon basert på funnene.',
        properties: {
          anbefalt_avvik_pst: { type: 'number', description: 'Hvor mange prosent UNDER prisantydning bør kjøper gå inn med? Negativt tall = under (typisk), 0 = på antydning, positivt = over.' },
          anbefalt_avvik_kr: { type: 'number', description: 'Samme i kroner — basert på markedsverdi.' },
          begrunnelse: { type: 'string', description: 'Kort hvorfor — hvilke funn gir forhandlingsspak.' },
          forhandlingsspaker: { type: 'array', items: { type: 'string' }, description: 'Konkrete punkter å bruke i forhandling, f.eks. "TG3 på drenering — krever utbedring 200k", "bad fra 1985 må totalrenoveres".' },
        },
      },

      mangler_i_rapporten: {
        type: 'array',
        description: 'Bygningsdeler eller forhold som typisk vurderes, men IKKE er nevnt eller bare overfladisk omtalt i denne rapporten. Eksempler: "Loft er ikke undersøkt", "Kryperom kun visuelt vurdert", "Røropplegget kun delvis sjekket", "Ingen radonmåling".',
        items: {
          type: 'object',
          required: ['punkt', 'hvorfor_viktig'],
          properties: {
            punkt: { type: 'string' },
            hvorfor_viktig: { type: 'string', description: 'Hva risikoen er, og hva det kan koste å avdekke senere.' },
          },
        },
      },

      aldersrelaterte_risikoer: {
        type: 'array',
        description: 'Basert på byggeår — typiske svake punkter som bør sjekkes konkret. Eksempler: bygg fra 60-70 = asbest/PCB, før 1999 = el-anlegg uten jordfeilbryter, 1970-1990 = kobberrør i fluss-fasen, før 1960 = mulig råte i bærekonstruksjon.',
        items: {
          type: 'object',
          required: ['risiko', 'hvordan_sjekke'],
          properties: {
            risiko: { type: 'string' },
            hvordan_sjekke: { type: 'string', description: 'Konkret hva kjøper kan be om eller undersøke.' },
            estimat_om_funnet_nok: { type: 'number', description: 'Hva det typisk koster å utbedre om problemet finnes.' },
          },
        },
      },

      sporsmal_til_megler: {
        type: 'array',
        description: '5-8 konkrete spørsmål kjøper bør stille megler eller selger før budgivning, basert på rapportens funn og det som ikke står der.',
        items: { type: 'string' },
      },

      takst_kvalitet: {
        type: 'object',
        description: 'Vurdering av selve takstrapporten — er den grundig nok?',
        properties: {
          grundighet: { type: 'string', enum: ['overfladisk', 'normal', 'grundig'] },
          kommentar: { type: 'string', description: 'Hvor mange bygningsdeler er sjekket, hvilke ble hoppet over, om kommentarene er konkrete eller generiske.' },
        },
      },

      samlet_oppussingsbehov: {
        type: 'object',
        description: 'Total realistisk kostnad for å bringe boligen til normaltilstand.',
        properties: {
          minimum_nok: { type: 'number', description: 'Sum av kun TG3 + kritisk-flaggede tiltak.' },
          realistisk_nok: { type: 'number', description: 'Sum av alle anbefalte poster + 20% buffer for skjulte forhold.' },
          maksimum_nok: { type: 'number', description: 'Hvis aldersrelaterte risikoer dukker opp i tillegg.' },
        },
      },

      ai_oppsummering: { type: 'string', description: '4-6 setninger fra et kjøperperspektiv: er denne boligen verd å by på, hvilke risikoer dominerer, og hva er sluttvurderingen — kjøp / kjøp m/forhandling / unngå?' },
    },
  },
}

const SYSTEM = `Du er en kritisk boligkjøper-rådgiver. Les takstrapporten og vurder hva den betyr for kjøperen — inkludert det den IKKE sier.

Aldersregler (bruk når byggeår er kjent):
- <1999: el-anlegg uten jordfeilbryter (30-80k utbedring)
- 1960-80: asbest/PCB-risiko (sanering 100-300k)
- 1970-90: kobberrør fluss-fasen (rør-bytte 150-400k)
- <1960: råte-risiko bærekonstruksjon

Forhandlingsregler:
- TG3 = 100% av estimat som spak
- TG2 vesentlige = 50-80% spak
- Manglende dokumentasjon = 200-500k usikkerhet

Realistiske priser (NOK 2025):
- Bad: 250-450k · Kjøkken: 150-350k · Drenering: 80-300k
- Vinduer 10-15 stk: 150-300k · El-anlegg: 50-150k · Tak: 200-500k

Skriv på norsk. Vær direkte og konkret. Bruk takstmannens estimater når de finnes.`

// Krever Vercel Pro for å ha effekt over 60s. På Hobby capped på 10s.
// Localhost dev-server respekterer dette ikke. For å unngå timeout-problemer
// holder vi prompt og max_tokens lav nok til å fullføres innenfor 50-60s.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Takst-analyse: ANTHROPIC_API_KEY mangler i miljøet')
    return NextResponse.json({ feil: 'AI-tjenesten er ikke konfigurert (ANTHROPIC_API_KEY mangler)' }, { status: 500 })
  }
  const klient = new Anthropic()
  try {
    const form = await req.formData()
    const fil = form.get('fil')
    if (!(fil instanceof File)) return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    if (!(TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (PDF, JPEG, PNG, WebP)' }, { status: 400 })
    }
    if (fil.size > MAKS_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 25 MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await fil.arrayBuffer())
    const base64 = buffer.toString('base64')
    const erPdf = fil.type === 'application/pdf'

    type ImgKilde = { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
    type DokKilde = { type: 'base64'; media_type: 'application/pdf'; data: string }
    const innhold = erPdf
      ? [
          { type: 'document' as const, source: { type: 'base64', media_type: 'application/pdf', data: base64 } satisfies DokKilde },
          { type: 'text' as const, text: 'Les denne takstrapporten / tilstandsrapporten og fyll inn strukturen via verktøyet.' },
        ]
      : [
          { type: 'image' as const, source: { type: 'base64', media_type: fil.type as ImgKilde['media_type'], data: base64 } satisfies ImgKilde },
          { type: 'text' as const, text: 'Les denne takstrapporten / tilstandsrapporten og fyll inn strukturen via verktøyet.' },
        ]

    // NDJSON-streaming: vi sender en ping ({}) hver 3. sek mens Claude jobber,
    // og legger på sluttsvaret som siste linje. Det holder proxy-er fra å gi opp
    // (de ser data flyte) selv om generering tar 60+ sekunder.
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let pingInterval: ReturnType<typeof setInterval> | null = null
        const send = (obj: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')) }
          catch { /* ignorer hvis stream er lukket */ }
        }
        try {
          pingInterval = setInterval(() => send({ ping: 1 }), 3000)
          const stream = klient.messages.stream({
            model: MODELL,
            // Holdes lavt nok til å fullføre under 60s for typisk 30-siders rapport
            max_tokens: 4000,
            temperature: 0,
            system: SYSTEM,
            tools: [takstTool],
            tool_choice: { type: 'tool', name: 'les_takstrapport' },
            messages: [{ role: 'user', content: innhold }],
          })
          const svar = await stream.finalMessage()
          clearInterval(pingInterval); pingInterval = null

          const tool = svar.content.find(b => b.type === 'tool_use')
          if (!tool || tool.type !== 'tool_use') {
            const stop = svar.stop_reason
            console.error('Takst: ingen tool_use. stop_reason:', stop)
            const melding = stop === 'max_tokens'
              ? 'AI-svaret ble kuttet (for stor rapport). Prøv en mindre PDF.'
              : stop === 'refusal'
              ? 'AI-en avviste å analysere innholdet'
              : 'AI ga ikke strukturert svar (stop_reason: ' + stop + ')'
            send({ feil: melding })
          } else {
            send({ data: tool.input, modell: MODELL, generert: new Date().toISOString() })
          }
        } catch (e) {
          if (pingInterval) clearInterval(pingInterval)
          const m = e instanceof Error ? e.message : String(e)
          console.error('Takst-analyse feilet:', m)
          const klientMelding = m.includes('overloaded') ? 'AI-tjenesten er overbelastet — prøv igjen om noen sekunder'
            : m.includes('rate_limit') ? 'For mange forespørsler — vent et minutt og prøv igjen'
            : m.includes('too large') || m.includes('too long') ? 'PDF-en er for stor eller har for mange sider for AI-en'
            : m.includes('cannot read') || m.includes('decode') ? 'Kunne ikke lese PDF — er den skannet uten tekst?'
            : 'AI-tjenesten feilet: ' + m.slice(0, 150)
          send({ feil: klientMelding })
        } finally {
          try { controller.close() } catch { /* allerede lukket */ }
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',  // hindre buffering hos reverse-proxy
      },
    })
  } catch (e) {
    console.error('Takst-analyse pre-stream feil:', e instanceof Error ? e.message : String(e))
    const m = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: 'Uventet feil: ' + m.slice(0, 150) }, { status: 500 })
  }
}
