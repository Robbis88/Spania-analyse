import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../lib/requireAuth'

const klient = new Anthropic()

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

const SYSTEM = `Du er en kritisk og erfaren boligkjøper-rådgiver med dyp teknisk forståelse av norske boliger. Du leser takstrapporter ikke for å gjenta dem, men for å vurdere hva de betyr for kjøperen — inkludert det de IKKE sier.

Tenk som en kjøper som har hatt vondt for mye en gang før: Ikke stol blindt på takstmann. Vær spesifikt skeptisk til:
- Generiske kommentarer ("god stand for alderen") som ikke er underbygget
- Manglende undersøkelse av loft, kryperom, røropplegg, elektrisk anlegg
- Sprik mellom annonse og takst
- TG1 som egentlig burde vært TG2 (takstmann er ofte konservative for å beskytte selger)

Aldersrelaterte risikoer du ALLTID skal sjekke når byggeår er kjent:
- Bygg < 1999: el-anlegg uten jordfeilbryter, gammelt sikringsskap (utbedring 30-80k)
- Bygg 1960-1980: asbest i tak/vegger/rør-isolasjon, PCB i vinduer (sanering kan koste 100-300k)
- Bygg 1970-1990: kobberrør i fluss-fasen — pinhole-lekkasjer (totalt rør-bytte 150-400k)
- Bygg < 1960: råte i bærekonstruksjon, manglende fundament-isolasjon
- Alle bygg: radon (måling 1k, utbedring 30-100k)

Forhandlingsvurdering — typiske grunnregler:
- TG3-funn = 100% av estimert utbedring som forhandlingsspak
- TG2 vesentlige funn = 50-80% som spak
- Mange små TG2 sammen = totalvurdering kan trekke 5-10% av prisantydning
- Manglende dokumentasjon (omsøkt rom, ferdigattest) = 200-500k usikkerhet

Bruk takstmannens estimater når de finnes. Når de mangler, bruk realistiske håndverkerpriser i NOK 2025:
- Bad-renovering komplett: 250-450k
- Kjøkken-renovering: 150-350k
- Drenering: 80-300k avhengig av sokkel
- Vinduer (10-15 stk): 150-300k
- El-anlegg-oppgradering: 50-150k
- Tak-skifte: 200-500k

Skriv på norsk. Vær direkte og konkret — ikke vag. Hvis rapporten er overfladisk, si det.`

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
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

    const svar = await klient.messages.create({
      model: MODELL,
      max_tokens: 3000,
      temperature: 0,
      system: SYSTEM,
      tools: [takstTool],
      tool_choice: { type: 'tool', name: 'les_takstrapport' },
      messages: [{ role: 'user', content: innhold }],
    })

    const tool = svar.content.find(b => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') {
      return NextResponse.json({ feil: 'AI ga ikke strukturert svar' }, { status: 502 })
    }

    return NextResponse.json({ data: tool.input, modell: MODELL, generert: new Date().toISOString() })
  } catch (e) {
    console.error('Takst-analyse feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Takst-analyse feilet' }, { status: 500 })
  }
}
