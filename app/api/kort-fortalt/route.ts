import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../lib/requireAuth'

export const maxDuration = 60

const klient = new Anthropic()
const MODELL = 'claude-sonnet-4-6'

const SYSTEM = `Du skriver en kort "Kort fortalt"-oppsummering for en dashboardside i et eiendomsselskaps styringsverktøy.

Regler:
- 2-4 setninger. Struktur: status → hva går bra → hva må følges → anbefalt neste handling.
- Bruk KUN tallene som er gitt. Ikke gjett.
- ALDRI falske sikkerhetsprosenter. Konkret, norsk, rolig-profesjonell tone.`

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { kontekst, tittel } = await req.json()
    if (typeof kontekst !== 'string' || !kontekst.trim()) {
      return NextResponse.json({ feil: 'kontekst mangler' }, { status: 400 })
    }
    const svar = await klient.messages.create({
      model: MODELL, max_tokens: 400, temperature: 0.3, system: SYSTEM,
      messages: [{ role: 'user', content: `Skriv "Kort fortalt" for ${tittel || 'denne siden'}:\n\n${kontekst}` }],
    })
    const tekst = svar.content.filter(b => b.type === 'text').map(b => (b.type === 'text' ? b.text : '')).join('\n').trim()
    if (!tekst) return NextResponse.json({ feil: 'AI ga tomt svar' }, { status: 502 })
    return NextResponse.json({ tekst })
  } catch (e) {
    console.error('Kort-fortalt feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke lage oppsummering' }, { status: 500 })
  }
}
