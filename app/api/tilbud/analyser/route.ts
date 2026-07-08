import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { BUCKET_DOKUMENTER, TILBUD_OCR_MODELL } from '../../../lib/tilbud'

export const maxDuration = 60

const klient = new Anthropic()

const ocrTool = {
  name: 'les_tilbud',
  description: 'Strukturert lesing av et pristilbud fra en håndverker/entreprenør. La usikre felt være null.',
  input_schema: {
    type: 'object' as const,
    properties: {
      aktor: { type: 'string', description: 'Navn på firma/håndverker som gir tilbudet' },
      totalsum: { type: 'number', description: 'Total tilbudssum (inkl. mva hvis oppgitt)' },
      valuta: { type: 'string', enum: ['NOK', 'EUR'] },
      poster: {
        type: 'array', description: 'Delposter i tilbudet',
        items: { type: 'object', properties: { navn: { type: 'string' }, sum: { type: 'number' } }, required: ['navn'] },
      },
      inkluderer: { type: 'string', description: 'Kort: hva inngår i prisen (materialer, arbeid, mva osv.)' },
      ekskluderer: { type: 'string', description: 'Kort: hva som IKKE inngår / tillegg' },
      gyldig_til: { type: 'string', description: 'Gyldighetsdato YYYY-MM-DD hvis oppgitt' },
    },
    required: [],
  },
}

const SYSTEM = `Du er en presis leser av norske og spanske byggetilbud/pristilbud. Trekk ut aktør, totalsum, delposter, hva som inngår/ikke inngår og gyldighetsdato via verktøyet.
Regler: tall med punktum som desimaltegn, datoer ISO (YYYY-MM-DD), IVA=mva på spanske tilbud. Sett felt til null hvis usikker — aldri gjett.`

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { tilbud_id } = await req.json()
    if (typeof tilbud_id !== 'string' || !tilbud_id) {
      return NextResponse.json({ feil: 'tilbud_id mangler' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('tilbud').select('id, storage_sti, mime_type').eq('id', tilbud_id).maybeSingle()
    if (!rad || !rad.storage_sti) return NextResponse.json({ feil: 'Tilbud ikke funnet' }, { status: 404 })

    const { data: blob } = await admin.storage.from(BUCKET_DOKUMENTER).download(rad.storage_sti)
    if (!blob) {
      await admin.from('tilbud').update({ ocr_status: 'feilet', ocr_kjort: new Date().toISOString(), ocr_feilmelding: 'Fil mangler i Storage' }).eq('id', tilbud_id)
      return NextResponse.json({ feil: 'Fil mangler i Storage' }, { status: 500 })
    }
    const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
    const erPdf = rad.mime_type === 'application/pdf'

    const innhold = erPdf
      ? [
          { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
          { type: 'text' as const, text: 'Les dette tilbudet og fyll ut strukturen via verktøyet.' },
        ]
      : [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: (rad.mime_type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg', data: base64 } },
          { type: 'text' as const, text: 'Les dette tilbudet og fyll ut strukturen via verktøyet.' },
        ]

    let svar
    try {
      svar = await klient.messages.create({
        model: TILBUD_OCR_MODELL, max_tokens: 1500, temperature: 0,
        system: SYSTEM, tools: [ocrTool], tool_choice: { type: 'tool', name: 'les_tilbud' },
        messages: [{ role: 'user', content: innhold }],
      })
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      await admin.from('tilbud').update({ ocr_status: 'feilet', ocr_kjort: new Date().toISOString(), ocr_feilmelding: m }).eq('id', tilbud_id)
      return NextResponse.json({ feil: 'OCR feilet' }, { status: 502 })
    }

    const tool = svar.content.find(b => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') {
      await admin.from('tilbud').update({ ocr_status: 'feilet', ocr_kjort: new Date().toISOString(), ocr_feilmelding: 'Modellen returnerte ikke tool_use' }).eq('id', tilbud_id)
      return NextResponse.json({ feil: 'Tom OCR-respons' }, { status: 502 })
    }
    const inn = tool.input as Record<string, unknown>
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null
    const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null
    const poster = Array.isArray(inn.poster)
      ? (inn.poster as Array<Record<string, unknown>>).map(p => ({ navn: String(p.navn || ''), sum: num(p.sum) || 0 })).filter(p => p.navn)
      : []

    const oppdatering = {
      ocr_status: 'analysert' as const,
      ocr_kjort: new Date().toISOString(),
      ocr_radata: inn, ocr_feilmelding: null,
      aktor: str(inn.aktor), totalsum: num(inn.totalsum),
      valuta: (inn.valuta === 'NOK' || inn.valuta === 'EUR') ? inn.valuta : null,
      poster, inkluderer: str(inn.inkluderer), ekskluderer: str(inn.ekskluderer),
      gyldig_til: str(inn.gyldig_til),
    }
    const { error } = await admin.from('tilbud').update(oppdatering).eq('id', tilbud_id)
    if (error) return NextResponse.json({ feil: 'Lagring av OCR-resultat feilet' }, { status: 500 })
    return NextResponse.json({ suksess: true, ...oppdatering })
  } catch (e) {
    console.error('Tilbud analyse feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'OCR feilet' }, { status: 500 })
  }
}
