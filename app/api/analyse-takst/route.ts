import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../lib/requireAuth'

const klient = new Anthropic()

const TILLATTE_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
const MAKS_BYTES = 25 * 1024 * 1024
const MODELL = 'claude-sonnet-4-5'

const takstTool = {
  name: 'les_takstrapport',
  description: 'Strukturert utdrag av en norsk takstrapport / e-takst / boligsalgsrapport. Returnerer markedsverdi, tilstandsgrader, røde flagg og anbefalte oppussingsposter.',
  input_schema: {
    type: 'object' as const,
    required: ['ai_oppsummering'],
    properties: {
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
        description: 'Bygningsdeler med tilstandsgrad TG0/TG1/TG2/TG3. Kun ta med deler som faktisk er vurdert.',
        items: {
          type: 'object',
          required: ['del', 'tg'],
          properties: {
            del: { type: 'string', description: 'F.eks. "Tak", "Drenering", "Bad", "Vinduer", "Røropplegg", "Elektrisk anlegg".' },
            tg: { type: 'number', enum: [0, 1, 2, 3], description: '0 = ingen anmerkning, 1 = mindre tiltak, 2 = vesentlig tiltak, 3 = stort tiltak / kritisk.' },
            kommentar: { type: 'string', description: 'Kort sitat eller oppsummering av takstmannens kommentar.' },
            estimat_nok: { type: 'number', description: 'Anslått utbedrings-kostnad i NOK hvis takstmannen har angitt det.' },
          },
        },
      },

      rode_flagg: {
        type: 'array',
        description: '0-6 viktige forhold kjøper bør være oppmerksom på. Sortér etter alvorlighet.',
        items: {
          type: 'object',
          required: ['alvorlighet', 'tittel', 'beskrivelse'],
          properties: {
            alvorlighet: { type: 'string', enum: ['kritisk', 'advarsel', 'info'] },
            tittel: { type: 'string', description: '3-6 ord.' },
            beskrivelse: { type: 'string', description: '1-2 setninger som forklarer hva og hvorfor det er viktig.' },
          },
        },
      },

      anbefalte_oppussingsposter: {
        type: 'array',
        description: 'Konkrete oppussingsposter basert på TG2/TG3 og takstmannens anbefalinger. 0-10 poster.',
        items: {
          type: 'object',
          required: ['navn', 'kostnad_estimat_nok', 'begrunnelse'],
          properties: {
            navn: { type: 'string', description: 'F.eks. "Nytt bad", "Skifte vinduer", "Drenering rundt sokkel".' },
            kostnad_estimat_nok: { type: 'number', description: 'Realistisk håndverkerpris i NOK 2025-nivå.' },
            begrunnelse: { type: 'string', description: 'Kort hvorfor — refer til TG eller takstmannens funn.' },
            prioritet: { type: 'string', enum: ['hast', 'normal', 'lav'] },
          },
        },
      },

      ai_oppsummering: { type: 'string', description: '3-5 setninger som oppsummerer hovedinntrykket — verditakst, største risikoer, største mulighetene.' },
    },
  },
}

const SYSTEM = `Du er en erfaren norsk takstvurderer som leser tilstandsrapporter, e-takster og boligsalgsrapporter. Du gir kjøpere en strukturert oversikt over hva som er viktig.

Regler:
- Skriv på norsk
- Bruk faktiske tall fra rapporten — ikke gjett
- Tilstandsgrader (TG): 0 = ingen anmerkning, 1 = mindre tiltak, 2 = vesentlig tiltak (utløser opplysningsplikt), 3 = stort/kritisk tiltak
- TG2 og TG3 er det viktigste — kjøper bør lese disse nøye
- Røde flagg: prioriter konkrete forhold som kan koste mye eller skape juridiske problemer (mugg, råte, drenering, ulovlige byggearbeider, asbest, radon, elektrisk anlegg fra før 1999)
- Oppussingsposter: bruk takstmannens kostnadsestimater hvis de finnes, ellers realistiske håndverkerpriser i NOK 2025
- Hvis et felt ikke fremgår tydelig av rapporten, utelat det heller enn å gjette`

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
