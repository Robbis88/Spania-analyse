import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../lib/requireAuth'

export const maxDuration = 60

const klient = new Anthropic()
const MODELL = 'claude-sonnet-4-6'

const SYSTEM = `Du er en investeringspartner som skriver en kort daglig brief til eieren av et lite eiendomsselskap. Du får ferdig beregnede tall (kjøpekraft, flaggede eiendommer, målstatus).

Regler:
- Svar på "hva bør jeg se på i dag?" — prioriter det viktigste øverst.
- Kort: 3-6 setninger, konkret, med tall.
- ALDRI falske sikkerhetsprosenter. Bruk kun tallene som er gitt.
- Norsk, direkte, vennlig-profesjonell tone. Ikke gjenta alle tall mekanisk — trekk fram det som krever handling.`

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { kjopekraft, flagg, maal_status } = await req.json()
    const l: string[] = []
    if (Array.isArray(kjopekraft) && kjopekraft.length) {
      l.push('KJØPEKRAFT: ' + kjopekraft.map((k: { valuta: string; kjopekraft: number }) => `${Math.round(k.kjopekraft)} ${k.valuta}`).join(', '))
    }
    if (Array.isArray(flagg) && flagg.length) {
      l.push('\nFLAGGEDE EIENDOMMER:')
      for (const f of flagg.slice(0, 8)) l.push(`- ${f.navn}: ${f.tekst}`)
    } else {
      l.push('\nIngen flaggede eiendommer akkurat nå.')
    }
    if (Array.isArray(maal_status) && maal_status.length) {
      l.push('\nMÅL:')
      for (const m of maal_status) l.push(`- ${m.beskrivelse}: ${m.naa} av ${m.maaltall} (${m.status})`)
    }

    const svar = await klient.messages.create({
      model: MODELL, max_tokens: 500, temperature: 0.3, system: SYSTEM,
      messages: [{ role: 'user', content: 'Skriv dagens brief basert på:\n\n' + l.join('\n') }],
    })
    const tekst = svar.content.filter(b => b.type === 'text').map(b => (b.type === 'text' ? b.text : '')).join('\n').trim()
    if (!tekst) return NextResponse.json({ feil: 'AI ga tomt svar' }, { status: 502 })
    return NextResponse.json({ brief: tekst })
  } catch (e) {
    console.error('Brief feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke lage brief' }, { status: 500 })
  }
}
