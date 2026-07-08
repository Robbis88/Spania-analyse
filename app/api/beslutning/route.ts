import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../lib/requireAuth'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import type { Beslutning, ScenarioResultat } from '../../lib/beslutning'

export const maxDuration = 60

const klient = new Anthropic()
const MODELL = 'claude-sonnet-4-6'

const SYSTEM = `Du er en erfaren eiendomsrådgiver for et lite investeringsselskap. Du får ferdig beregnede tall for fire mulige bruk av én eiendom, og skal svare på: "Hva er beste bruk av denne akkurat nå?"

Regler:
- Gi ÉN tydelig anbefaling i klartekst med kort begrunnelse og tallene bak (f.eks. "Selg: flipp gir 480' etter skatt og frigjør kapital; langtidsleie gir bare 4,2 % på bundet EK, under terskelen på 6 %").
- Bruk KUN tallene som er gitt. Ikke gjett tall som ikke finnes.
- ALDRI oppgi falske sikkerhetsprosenter ("96 % sikker"). Anbefalingen skal kunne etterprøves, ikke bare stoles på.
- Nevn viktigste forbehold (f.eks. manglende Airbnb-data, usikker verdivurdering).
- Maks 4-6 setninger. Norsk, konkret, profesjonell.`

function byggKontekst(b: Beslutning, prosjektNavn: string, marked: string): string {
  const valuta = marked === 'norge' ? 'NOK' : 'EUR'
  const l: string[] = []
  l.push(`EIENDOM: ${prosjektNavn} (${marked}, ${valuta})`)
  l.push(`Markedsverdi: ${Math.round(b.verdi)}`)
  l.push(`Restgjeld: ${Math.round(b.restgjeld)}`)
  l.push(`Bundet egenkapital: ${Math.round(b.bundet_ek)}`)
  l.push(`Terskel for svak leie: ${b.terskel_yield_pst} % yield på bundet EK`)
  l.push('')
  l.push('SCENARIER:')
  for (const s of b.scenarier) {
    l.push(scenarioLinje(s))
  }
  return l.join('\n')
}

function scenarioLinje(s: ScenarioResultat): string {
  if (!s.tilgjengelig) return `- ${s.tittel}: ikke tilgjengelig (${s.utilgjengeligGrunn})`
  const deler: string[] = []
  if (typeof s.yield_bundet_ek_pst === 'number') deler.push(`yield ${s.yield_bundet_ek_pst.toFixed(1)} %`)
  if (typeof s.cashflow_mnd === 'number') deler.push(`cashflow ${Math.round(s.cashflow_mnd)}/mnd`)
  if (typeof s.frigjort_kapital === 'number') deler.push(`frigjort kapital ${Math.round(s.frigjort_kapital)}`)
  if (typeof s.gevinst_etter_skatt === 'number') deler.push(`gevinst etter skatt ${Math.round(s.gevinst_etter_skatt)}`)
  if (typeof s.ny_ltv_pst === 'number') deler.push(`ny LTV ${s.ny_ltv_pst} %`)
  return `- ${s.tittel}: ${deler.join(', ')}`
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { beslutning, prosjektNavn, marked, prosjekt_id } = await req.json()
    if (!beslutning || !Array.isArray(beslutning.scenarier)) {
      return NextResponse.json({ feil: 'beslutning mangler' }, { status: 400 })
    }
    const kontekst = byggKontekst(beslutning as Beslutning, String(prosjektNavn || 'Eiendom'), String(marked || 'spania'))

    // B5: mat inn Roberts historiske justeringer så AI lærer hans mønster
    const admin = hentSupabaseAdmin()
    let historikk = ''
    try {
      const { data: just } = await admin.from('estimat_justeringer')
        .select('felt, ai_verdi, min_verdi, faktisk_verdi, kontekst')
        .order('tidspunkt', { ascending: false }).limit(12)
      const rel = (just || []).filter(j => !j.kontekst?.marked || j.kontekst.marked === (marked || 'spania'))
      if (rel.length > 0) {
        historikk = '\n\nHISTORIKK — Roberts tidligere justeringer (vekt disse når du vurderer om tallene virker realistiske):\n'
          + rel.map(j => `- ${j.felt}: AI/estimat ${j.ai_verdi ?? '?'}, min vurdering ${j.min_verdi ?? '?'}${j.faktisk_verdi != null ? `, faktisk ${j.faktisk_verdi}` : ''}`).join('\n')
      }
    } catch { /* historikk er valgfri */ }

    const svar = await klient.messages.create({
      model: MODELL,
      max_tokens: 600,
      temperature: 0.2,
      system: SYSTEM,
      messages: [{ role: 'user', content: 'Gi din anbefaling basert på disse tallene:\n\n' + kontekst + historikk }],
    })

    const tekst = svar.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim()

    if (!tekst) return NextResponse.json({ feil: 'AI ga tomt svar' }, { status: 502 })

    // Logg til tidslinjen (B10)
    if (typeof prosjekt_id === 'string' && prosjekt_id) {
      try {
        await admin.from('aktivitetslogg').insert([{
          id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
          bruker: auth.bruker, handling: 'AI ga beslutningsanbefaling',
          tabell: 'prosjekter', rad_id: prosjekt_id, prosjekt_id, hendelsestype: 'anbefaling_gitt',
          detaljer: { sammendrag: tekst.slice(0, 120) },
        }])
      } catch { /* logging skal ikke blokkere svaret */ }
    }

    return NextResponse.json({ anbefaling: tekst })
  } catch (e) {
    console.error('Beslutning AI feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente anbefaling' }, { status: 500 })
  }
}
