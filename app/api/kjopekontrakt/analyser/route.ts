import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/requireAuth'
import { TILBUD_MAKS_STORRELSE_BYTES, TILBUD_TILLATTE_MIME } from '../../../lib/tilbud'

export const maxDuration = 60

const klient = new Anthropic()
const MODELL = 'claude-sonnet-4-5'

// Trekker grunndata ut av en kjøpekontrakt / salgsoppgave / kjøpsbekreftelse.
// Fyller IKKE inn i databasen — returnerer feltene så veiviseren kan forhåndsutfylle
// og brukeren bekrefte (dine tall vinner). Ingen lagring her.
const kontraktTool = {
  name: 'les_kjopekontrakt',
  description: 'Strukturert lesing av en kjøpekontrakt/salgsoppgave for en bolig. La usikre felt være null — aldri gjett.',
  input_schema: {
    type: 'object' as const,
    properties: {
      adresse: { type: 'string', description: 'Eiendommens adresse' },
      kjopesum: { type: 'number', description: 'Kjøpesum / kjøpspris (ikke prisantydning hvis endelig pris finnes)' },
      omkostninger: { type: 'number', description: 'Totale omkostninger ved kjøp hvis oppgitt (dokumentavgift + tinglysing + gebyrer)' },
      dokumentavgift: { type: 'number', description: 'Dokumentavgift hvis oppgitt separat' },
      fellesgjeld: { type: 'number', description: 'Andel fellesgjeld (borettslag/andel) hvis oppgitt' },
      eierform: { type: 'string', enum: ['selveier', 'andel', 'aksje', 'annet'], description: 'Eierform' },
      kjopsdato: { type: 'string', description: 'Kjøps-/overtakelsesdato ISO (YYYY-MM-DD)' },
      selger: { type: 'string', description: 'Selgers navn hvis oppgitt' },
      byggear: { type: 'number', description: 'Byggeår hvis oppgitt' },
    },
    required: [],
  },
}

const SYSTEM = `Du er en presis leser av norske og spanske kjøpekontrakter, salgsoppgaver og kjøpsbekreftelser for bolig. Trekk ut grunndata via verktøyet.
Regler: tall med punktum som desimaltegn (ikke tusenskille), datoer ISO (YYYY-MM-DD). Skill endelig kjøpesum fra prisantydning (bruk kjøpesum hvis den finnes). Sett felt til null hvis usikker — aldri gjett.`

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const form = await req.formData()
    const fil = form.get('fil')
    if (!(fil instanceof File)) return NextResponse.json({ feil: 'fil mangler' }, { status: 400 })
    if (!(TILBUD_TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return NextResponse.json({ feil: 'Filtype ikke støttet (JPEG, PNG, WebP eller PDF)' }, { status: 400 })
    }
    if (fil.size > TILBUD_MAKS_STORRELSE_BYTES) {
      return NextResponse.json({ feil: 'Filen er for stor (maks 15 MB)' }, { status: 400 })
    }

    const base64 = Buffer.from(await fil.arrayBuffer()).toString('base64')
    const erPdf = fil.type === 'application/pdf'
    const oppgave = 'Les denne kjøpekontrakten/salgsoppgaven og fyll ut strukturen via verktøyet.'
    const innhold = erPdf
      ? [
          { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
          { type: 'text' as const, text: oppgave },
        ]
      : [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: (fil.type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg', data: base64 } },
          { type: 'text' as const, text: oppgave },
        ]

    let svar
    try {
      svar = await klient.messages.create({
        model: MODELL, max_tokens: 1000, temperature: 0,
        system: SYSTEM, tools: [kontraktTool], tool_choice: { type: 'tool', name: 'les_kjopekontrakt' },
        messages: [{ role: 'user', content: innhold }],
      })
    } catch (e) {
      console.error('Kjøpekontrakt-OCR feilet:', e instanceof Error ? e.message : String(e))
      return NextResponse.json({ feil: 'Kunne ikke lese dokumentet' }, { status: 502 })
    }

    const tool = svar.content.find(b => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') return NextResponse.json({ feil: 'Fant ingen kontraktdata i dokumentet' }, { status: 502 })
    const inn = tool.input as Record<string, unknown>
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null
    const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null
    const enumEl = (v: unknown, gyldige: string[]) => typeof v === 'string' && gyldige.includes(v) ? v : null

    const felt = {
      adresse: str(inn.adresse),
      kjopesum: num(inn.kjopesum),
      omkostninger: num(inn.omkostninger),
      dokumentavgift: num(inn.dokumentavgift),
      fellesgjeld: num(inn.fellesgjeld),
      eierform: enumEl(inn.eierform, ['selveier', 'andel', 'aksje', 'annet']),
      kjopsdato: str(inn.kjopsdato),
      selger: str(inn.selger),
      byggear: num(inn.byggear),
    }
    return NextResponse.json({ suksess: true, felt })
  } catch (e) {
    console.error('Kjøpekontrakt-analyse feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Analyse feilet' }, { status: 500 })
  }
}
