import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { BILAG_BUCKET } from '../../../lib/bilag'
import { KOSTNAD_KATEGORIER } from '../../../lib/portefolje'
import type { Bilag, BilagAiForslag, Prosjekt, Selskap } from '../../../types'

export const maxDuration = 60

const klient = new Anthropic()
const MODELL = 'claude-sonnet-4-5'

// Foreslår hvilken eiendom + kategori et bilag hører til, og trekker ut
// fakturafelt fra vedlagt dokument. Skriver KUN forslag (ai_forslag) — bruker
// bekrefter i innboksen. Overskriver aldri et godkjent/låst bilag.
const forslagTool = {
  name: 'foreslaa_bilag',
  description: 'Foreslå eiendom og kostnadskategori for et bilag, og trekk ut fakturafelt hvis dokument er vedlagt. La usikre felt være null.',
  input_schema: {
    type: 'object' as const,
    properties: {
      prosjekt_id: { type: 'string', description: 'ID-en til eiendommen bilaget hører til (fra listen). Null hvis uklart.' },
      kategori: { type: 'string', enum: [...KOSTNAD_KATEGORIER], description: 'Kostnadskategori' },
      underkategori: { type: 'string', description: 'Kort fritekst-underkategori (f.eks. «rørlegger», «strøm Q2»)' },
      begrunnelse: { type: 'string', description: 'Kort hvorfor denne eiendommen/kategorien' },
      leverandor: { type: 'string' },
      faktura_dato: { type: 'string', description: 'YYYY-MM-DD' },
      forfall_dato: { type: 'string', description: 'YYYY-MM-DD' },
      belop: { type: 'number', description: 'Totalbeløp inkl. mva' },
      mva: { type: 'number', description: 'MVA-beløp' },
      valuta: { type: 'string', enum: ['NOK', 'EUR'] },
      fakturanummer: { type: 'string' },
    },
    required: [],
  },
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { bilag_id } = await req.json()
    if (typeof bilag_id !== 'string' || !bilag_id) return NextResponse.json({ feil: 'bilag_id mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()

    const [{ data: bilagRad }, { data: pData }, { data: sData }] = await Promise.all([
      admin.from('bilag').select('*').eq('id', bilag_id).maybeSingle(),
      admin.from('prosjekter').select('id, navn, marked, selskap_id').eq('er_portefolje', true),
      admin.from('selskaper').select('id, navn, land'),
    ])
    const bilag = bilagRad as Bilag | null
    if (!bilag) return NextResponse.json({ feil: 'Bilag ikke funnet' }, { status: 404 })
    if (bilag.status === 'laast') return NextResponse.json({ feil: 'Bilaget er låst' }, { status: 409 })

    const prosjekter = (pData || []) as Array<Pick<Prosjekt, 'id' | 'navn' | 'marked' | 'selskap_id'>>
    const selskaper = (sData || []) as Array<Pick<Selskap, 'id' | 'navn' | 'land'>>

    const prosjektListe = prosjekter.length
      ? prosjekter.map(p => `- ${p.id}: ${p.navn} (${p.marked || 'spania'})`).join('\n')
      : '(ingen eiendommer registrert)'
    const kjent = [
      bilag.leverandor && `Leverandør: ${bilag.leverandor}`,
      bilag.belop != null && `Beløp: ${bilag.belop} ${bilag.valuta}`,
      bilag.fakturanummer && `Fakturanr: ${bilag.fakturanummer}`,
      bilag.notat && `Notat: ${bilag.notat}`,
    ].filter(Boolean).join('. ')

    const innhold: Anthropic.Messages.ContentBlockParam[] = []
    if (bilag.storage_sti) {
      const { data: blob } = await admin.storage.from(BILAG_BUCKET).download(bilag.storage_sti)
      if (blob) {
        const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
        if (bilag.mime_type === 'application/pdf') {
          innhold.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
        } else {
          innhold.push({ type: 'image', source: { type: 'base64', media_type: (bilag.mime_type as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg', data: base64 } })
        }
      }
    }
    innhold.push({
      type: 'text',
      text: `Eiendommer å velge mellom (bruk prosjekt_id):\n${prosjektListe}\n\nKjent om bilaget: ${kjent || 'ingenting ennå'}.\n\nForeslå eiendom + kategori, og trekk ut fakturafelt hvis dokument er vedlagt.`,
    })

    let svar
    try {
      svar = await klient.messages.create({
        model: MODELL, max_tokens: 1200, temperature: 0,
        system: 'Du klassifiserer innkommende bilag/fakturaer i et eiendomsstyringssystem. Foreslå riktig eiendom (prosjekt_id fra listen) og kostnadskategori, og trekk ut fakturafelt fra vedlagt dokument. Sett felt til null hvis usikker — aldri gjett på eiendom.',
        tools: [forslagTool], tool_choice: { type: 'tool', name: 'foreslaa_bilag' },
        messages: [{ role: 'user', content: innhold }],
      })
    } catch (e) {
      console.error('Bilag-forslag feilet:', e instanceof Error ? e.message : String(e))
      return NextResponse.json({ feil: 'Kunne ikke lage forslag' }, { status: 502 })
    }

    const tool = svar.content.find(b => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') return NextResponse.json({ feil: 'Tomt forslag' }, { status: 502 })
    const inn = tool.input as Record<string, unknown>
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null
    const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null

    // Valider prosjekt_id mot faktiske eiendommer; utled selskap fra valgt eiendom.
    const valgtProsjekt = prosjekter.find(p => p.id === inn.prosjekt_id) || null
    const kategori = typeof inn.kategori === 'string' && (KOSTNAD_KATEGORIER as readonly string[]).includes(inn.kategori) ? inn.kategori : null

    const forslag: BilagAiForslag = {
      prosjekt_id: valgtProsjekt?.id ?? null,
      selskap_id: valgtProsjekt?.selskap_id ?? null,
      kategori,
      underkategori: str(inn.underkategori),
      begrunnelse: str(inn.begrunnelse),
      felt: {
        leverandor: str(inn.leverandor) ?? undefined,
        faktura_dato: str(inn.faktura_dato) ?? undefined,
        forfall_dato: str(inn.forfall_dato) ?? undefined,
        belop: num(inn.belop) ?? undefined,
        mva: num(inn.mva) ?? undefined,
        valuta: (inn.valuta === 'NOK' || inn.valuta === 'EUR') ? inn.valuta : undefined,
        fakturanummer: str(inn.fakturanummer) ?? undefined,
      },
    }

    // Skriv forslag; løft status til 'foreslatt' kun hvis den fortsatt er 'ny'.
    const nyStatus = bilag.status === 'ny' ? 'foreslatt' : bilag.status
    const { error } = await admin.from('bilag').update({ ai_forslag: forslag, status: nyStatus }).eq('id', bilag_id)
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ suksess: true, ai_forslag: forslag, selskaper })
  } catch (e) {
    console.error('Bilag-forslag feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Forslag feilet' }, { status: 500 })
  }
}
