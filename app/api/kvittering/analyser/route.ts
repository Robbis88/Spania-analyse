import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import {
  BUCKET_DOKUMENTER, KVITTERING_KATEGORIER, KVITTERING_ROM, OCR_MODELL,
} from '../../../lib/kvittering'

const klient = new Anthropic()

const ocrTool = {
  name: 'les_kvittering',
  description: 'Strukturert OCR av en kvittering eller faktura. Returner felt der du er rimelig sikker; la usikre felt være null.',
  input_schema: {
    type: 'object' as const,
    properties: {
      dato: { type: 'string', description: 'YYYY-MM-DD format. Bruk fakturadato eller transaksjonsdato.' },
      belop_inkl_mva: { type: 'number', description: 'Total betalt inkl. mva' },
      belop_eks_mva: { type: 'number' },
      mva: { type: 'number', description: 'Mva-beløp i kroner/euro' },
      valuta: { type: 'string', enum: ['NOK', 'EUR'] },
      leverandor: { type: 'string', description: 'Navn på utsteder/firma' },
      leverandor_orgnr: { type: 'string', description: 'Organisasjonsnummer (NO) eller CIF/NIF (ES)' },
      dokument_nr: { type: 'string', description: 'Faktura- eller kvitteringsnummer' },
      kategori: { type: 'string', enum: KVITTERING_KATEGORIER as unknown as string[], description: 'Beste matchende kategori basert på linjer/leverandør. Bruk "div" hvis usikker.' },
      rom: { type: 'string', enum: KVITTERING_ROM as unknown as string[], description: 'Hvilket rom dette gjelder hvis det fremgår; ellers null' },
      tagger: { type: 'array', items: { type: 'string' }, description: '0-5 stikkord som beskriver innholdet (f.eks. "lampe", "fliser", "spikkerpistol"). Korte ord, små bokstaver.' },
      sammendrag: { type: 'string', description: 'Én setning på norsk som forklarer hva dette er.' },
    },
    required: [],
  },
}

const SYSTEM = `Du er en presis OCR-motor for byggekvitteringer og fakturaer fra Norge og Spania. Les nøye fra bildet/PDF-en og fyll inn strukturerte felt via les_kvittering-verktøyet.

Regler:
- Tall: bruk punktum som desimaltegn ("1234.50"), ikke tusenskille.
- Datoer: ISO-format YYYY-MM-DD.
- Spanske fakturaer: IVA = mva. CIF/NIF som leverandor_orgnr.
- Norske: MVA. Org.nr som leverandor_orgnr.
- Hvis flere linjer: kategori velges basert på dominerende vare/tjeneste.
- Sett feltet til null/utelat hvis du ikke er rimelig sikker. Aldri gjett.
- Tagger: korte stikkord, ikke fulle setninger.`

async function lastNedFil(admin: ReturnType<typeof hentSupabaseAdmin>, sti: string): Promise<{ buffer: Buffer; ok: boolean }> {
  const { data: blob } = await admin.storage.from(BUCKET_DOKUMENTER).download(sti)
  if (!blob) return { buffer: Buffer.alloc(0), ok: false }
  return { buffer: Buffer.from(await blob.arrayBuffer()), ok: true }
}

// Re-kjør OCR for én kvittering. Klienten kaller denne rett etter opplasting,
// og kan kalle den igjen hvis bruker ber om "prøv igjen".
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { kvittering_id } = await req.json()
    if (typeof kvittering_id !== 'string' || !kvittering_id) {
      return NextResponse.json({ feil: 'kvittering_id mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('kvitteringer')
      .select('id, prosjekt_id, storage_sti, mime_type')
      .eq('id', kvittering_id)
      .maybeSingle()
    if (!rad) return NextResponse.json({ feil: 'Kvittering ikke funnet' }, { status: 404 })

    const { buffer, ok } = await lastNedFil(admin, rad.storage_sti)
    if (!ok) {
      await admin.from('kvitteringer').update({
        ocr_status: 'feilet', ocr_kjort: new Date().toISOString(),
        ocr_feilmelding: 'Kunne ikke laste fil fra Storage',
      }).eq('id', kvittering_id)
      return NextResponse.json({ feil: 'Fil mangler i Storage' }, { status: 500 })
    }

    const base64 = buffer.toString('base64')
    const erPdf = rad.mime_type === 'application/pdf'

    type ImgKilde = { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string }
    type DokKilde = { type: 'base64'; media_type: 'application/pdf'; data: string }
    const innhold = erPdf
      ? [
          { type: 'document' as const, source: { type: 'base64', media_type: 'application/pdf', data: base64 } satisfies DokKilde },
          { type: 'text' as const, text: 'Les denne kvitteringen/fakturaen og fyll ut strukturen via verktøyet.' },
        ]
      : [
          { type: 'image' as const, source: { type: 'base64', media_type: (rad.mime_type as ImgKilde['media_type']) || 'image/jpeg', data: base64 } satisfies ImgKilde },
          { type: 'text' as const, text: 'Les denne kvitteringen/fakturaen og fyll ut strukturen via verktøyet.' },
        ]

    let svar
    try {
      svar = await klient.messages.create({
        model: OCR_MODELL,
        max_tokens: 1500,
        temperature: 0,
        system: SYSTEM,
        tools: [ocrTool],
        tool_choice: { type: 'tool', name: 'les_kvittering' },
        messages: [{ role: 'user', content: innhold }],
      })
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      await admin.from('kvitteringer').update({
        ocr_status: 'feilet', ocr_kjort: new Date().toISOString(), ocr_feilmelding: m,
      }).eq('id', kvittering_id)
      return NextResponse.json({ feil: 'OCR feilet' }, { status: 502 })
    }

    const tool = svar.content.find(b => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') {
      await admin.from('kvitteringer').update({
        ocr_status: 'feilet', ocr_kjort: new Date().toISOString(),
        ocr_feilmelding: 'Modellen returnerte ikke tool_use',
      }).eq('id', kvittering_id)
      return NextResponse.json({ feil: 'Tom OCR-respons' }, { status: 502 })
    }

    const inn = tool.input as Record<string, unknown>
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null
    const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null

    const oppdatering = {
      ocr_status: 'analysert' as const,
      ocr_kjort: new Date().toISOString(),
      ocr_radata: inn,
      ocr_feilmelding: null,
      dato: str(inn.dato),
      belop_eks_mva: num(inn.belop_eks_mva),
      mva: num(inn.mva),
      belop_inkl_mva: num(inn.belop_inkl_mva),
      valuta: (inn.valuta === 'NOK' || inn.valuta === 'EUR') ? inn.valuta : null,
      leverandor: str(inn.leverandor),
      leverandor_orgnr: str(inn.leverandor_orgnr),
      dokument_nr: str(inn.dokument_nr),
      kategori: (KVITTERING_KATEGORIER as readonly string[]).includes(String(inn.kategori)) ? String(inn.kategori) : null,
      rom: (KVITTERING_ROM as readonly string[]).includes(String(inn.rom)) ? String(inn.rom) : null,
      tagger: Array.isArray(inn.tagger) ? (inn.tagger as unknown[]).filter(t => typeof t === 'string').slice(0, 8) : [],
    }

    const { error } = await admin.from('kvitteringer').update(oppdatering).eq('id', kvittering_id)
    if (error) return NextResponse.json({ feil: 'Lagring av OCR-resultat feilet' }, { status: 500 })

    return NextResponse.json({ suksess: true, ...oppdatering })
  } catch (e) {
    console.error('Kvittering analyse feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'OCR feilet' }, { status: 500 })
  }
}
