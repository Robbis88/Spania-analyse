import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/requireAuth'

const MODELL = 'claude-sonnet-4-5'

const SPRAK_NAVN: Record<string, string> = {
  no: 'Norwegian (Bokmål)',
  en: 'English',
  es: 'Spanish (Castellano, Spain)',
}

// Oversetter brukerens norske tekst til håndverkerens språk.
// Bruker en kort, profesjonell tone — egnet for håndverkertilbud-forespørsel.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ feil: 'AI-tjenesten er ikke konfigurert' }, { status: 500 })
  }
  try {
    const { tekst, tittel, sprak } = await req.json()
    if (typeof tekst !== 'string' || !tekst.trim()) {
      return NextResponse.json({ feil: 'tekst mangler' }, { status: 400 })
    }
    const malSprak = (sprak === 'no' || sprak === 'en' || sprak === 'es') ? sprak : 'es'
    // Hvis ingen oversetting trengs (norsk → norsk), returner som er
    if (malSprak === 'no') {
      return NextResponse.json({
        tittel_oversatt: typeof tittel === 'string' ? tittel : '',
        tekst_oversatt: tekst,
      })
    }

    const klient = new Anthropic()
    const prompt = `Translate this tilbudsforesporsel (request for quote) from Norwegian to ${SPRAK_NAVN[malSprak]}.

Rules:
- Professional and concise — this goes to a tradesman / handyman
- Keep technical terms (bad/baño/bathroom, kjøkken/cocina/kitchen, etc.) accurate
- Use measurements as-is (m², m, kr/EUR)
- Don't add greetings, sign-off or other content — just translate what's there
- Return ONLY the translated text, no explanation

${tittel ? `Title (also translate, on its own first line):\n${tittel}\n\n---\n\n` : ''}Text:
${tekst}`

    const svar = await klient.messages.create({
      model: MODELL,
      max_tokens: 1500,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })
    const utdata = svar.content[0]?.type === 'text' ? svar.content[0].text.trim() : ''
    if (!utdata) return NextResponse.json({ feil: 'Oversettelse feilet' }, { status: 502 })

    // Hvis tittel ble bedt om: første linje er tittel, resten er tekst
    if (typeof tittel === 'string' && tittel.trim()) {
      const splitt = utdata.split(/\n---\n|\n\n---\n\n/, 2)
      if (splitt.length === 2) {
        return NextResponse.json({ tittel_oversatt: splitt[0].trim(), tekst_oversatt: splitt[1].trim() })
      }
      // fallback — første linje er tittel
      const linjer = utdata.split('\n')
      return NextResponse.json({ tittel_oversatt: linjer[0].trim(), tekst_oversatt: linjer.slice(1).join('\n').trim() })
    }
    return NextResponse.json({ tittel_oversatt: '', tekst_oversatt: utdata })
  } catch (e) {
    console.error('Håndverker oversett-feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Oversettelse feilet' }, { status: 500 })
  }
}
