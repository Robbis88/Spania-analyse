import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/requireAuth'
import { TILBUD_MAKS_STORRELSE_BYTES, TILBUD_TILLATTE_MIME } from '../../../lib/tilbud'

export const maxDuration = 60

const klient = new Anthropic()
const MODELL = 'claude-sonnet-4-5'

// Trekker lånevilkår ut av et lånedokument (lånebekreftelse, nedbetalingsplan,
// gjeldsbrev). Fyller IKKE inn — returnerer feltene så brukeren kan gjennomgå og
// lagre selv (dine tall vinner). Ingen lagring her; PDF-en arkiveres i Dokumenter.
const laanTool = {
  name: 'les_laanedokument',
  description: 'Strukturert lesing av et lånedokument fra en bank. La usikre felt være null — aldri gjett.',
  input_schema: {
    type: 'object' as const,
    properties: {
      bank: { type: 'string', description: 'Navn på banken/långiver' },
      laanetype: { type: 'string', enum: ['annuitet', 'serie', 'rammelaan', 'annet'], description: 'Annuitetslån, serielån, rammelån eller annet' },
      hovedstol: { type: 'number', description: 'Opprinnelig lånebeløp' },
      restgjeld: { type: 'number', description: 'Gjenstående gjeld / saldo hvis oppgitt' },
      rente_pst: { type: 'number', description: 'Nominell rente i prosent (f.eks. 5.45)' },
      rentetype: { type: 'string', enum: ['flytende', 'fast'], description: 'Flytende eller fast rente' },
      bindingstid_aar: { type: 'number', description: 'Rentebindingstid i år (kun ved fastrente)' },
      nedbetalingstid_aar: { type: 'number', description: 'Løpetid / nedbetalingstid i år' },
      termin_belop: { type: 'number', description: 'Totalt terminbeløp per betaling (renter + avdrag)' },
      rente_belop: { type: 'number', description: 'Rentedelen per termin hvis oppgitt separat' },
      avdrag_belop: { type: 'number', description: 'Avdragsdelen per termin hvis oppgitt separat' },
      avdragsfritt: { type: 'boolean', description: 'True hvis lånet er avdragsfritt / rent rentelån (kun renter betales)' },
      termin_frekvens: { type: 'string', enum: ['mnd', 'kvartal', 'aar'], description: 'Hvor ofte terminbeløpet betales' },
      startdato: { type: 'string', description: 'Utbetalings-/startdato ISO (YYYY-MM-DD)' },
    },
    required: [],
  },
}

const SYSTEM = `Du er en presis leser av norske og spanske lånedokumenter (lånebekreftelse, gjeldsbrev, nedbetalingsplan, kontoutskrift for lån). Trekk ut lånevilkårene via verktøyet.
Regler: tall med punktum som desimaltegn (ikke tusenskille), renter i prosent (5.45 ikke 0.0545), datoer ISO (YYYY-MM-DD). Skill hovedstol (opprinnelig) fra restgjeld (nå). Sett felt til null hvis usikker — aldri gjett.`

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
    const innhold = erPdf
      ? [
          { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
          { type: 'text' as const, text: 'Les dette lånedokumentet og fyll ut strukturen via verktøyet.' },
        ]
      : [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: (fil.type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg', data: base64 } },
          { type: 'text' as const, text: 'Les dette lånedokumentet og fyll ut strukturen via verktøyet.' },
        ]

    let svar
    try {
      svar = await klient.messages.create({
        model: MODELL, max_tokens: 1200, temperature: 0,
        system: SYSTEM, tools: [laanTool], tool_choice: { type: 'tool', name: 'les_laanedokument' },
        messages: [{ role: 'user', content: innhold }],
      })
    } catch (e) {
      console.error('Lån-OCR feilet:', e instanceof Error ? e.message : String(e))
      return NextResponse.json({ feil: 'Kunne ikke lese dokumentet' }, { status: 502 })
    }

    const tool = svar.content.find(b => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') return NextResponse.json({ feil: 'Fant ingen lånevilkår i dokumentet' }, { status: 502 })
    const inn = tool.input as Record<string, unknown>
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null
    const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null
    const enumEl = (v: unknown, gyldige: string[]) => typeof v === 'string' && gyldige.includes(v) ? v : null

    const felt = {
      bank: str(inn.bank),
      laanetype: enumEl(inn.laanetype, ['annuitet', 'serie', 'rammelaan', 'annet']),
      hovedstol: num(inn.hovedstol),
      restgjeld: num(inn.restgjeld),
      rente_pst: num(inn.rente_pst),
      rentetype: enumEl(inn.rentetype, ['flytende', 'fast']),
      bindingstid_aar: num(inn.bindingstid_aar),
      nedbetalingstid_aar: num(inn.nedbetalingstid_aar),
      termin_belop: num(inn.termin_belop),
      rente_belop: num(inn.rente_belop),
      avdrag_belop: num(inn.avdrag_belop),
      avdragsfritt: typeof inn.avdragsfritt === 'boolean' ? inn.avdragsfritt : false,
      termin_frekvens: enumEl(inn.termin_frekvens, ['mnd', 'kvartal', 'aar']),
      startdato: str(inn.startdato),
    }
    return NextResponse.json({ suksess: true, felt })
  } catch (e) {
    console.error('Lån-analyse feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Analyse feilet' }, { status: 500 })
  }
}
