import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import type { BoligData, OppussingBudsjett, OppussingPost, Prosjekt, AirbnbScore } from '../../../types'

const client = new Anthropic()

const STANDARD_TEKST: Record<string, string> = {
  standard: 'Standard – enkel oppgradering, ok kvalitet',
  bra: 'Bra – moderne kjøkken og bad, god kvalitet materialer',
  luksus: 'Luksus – toppkvalitet, premium materialer',
}

export async function POST(req: NextRequest) {
  try {
    const { boligId } = await req.json()
    if (!boligId) {
      return NextResponse.json({ error: 'boligId mangler' }, { status: 400 })
    }

    const { data: prosjekt, error: pErr } = await supabase
      .from('prosjekter').select('*').eq('id', boligId).single()
    if (pErr || !prosjekt) {
      return NextResponse.json({ error: 'Fant ikke prosjekt' }, { status: 404 })
    }
    const p = prosjekt as Prosjekt

    const { data: budsjettRad } = await supabase
      .from('oppussing_budsjett').select('*').eq('bolig_id', boligId).single()
    if (!budsjettRad) {
      return NextResponse.json({ error: 'Oppussingsbudsjett ikke opprettet' }, { status: 404 })
    }
    const b = budsjettRad as OppussingBudsjett

    const { data: posterRader } = await supabase
      .from('oppussing_poster').select('*').eq('budsjett_id', b.id).order('rekkefolge')
    const poster = (posterRader || []) as OppussingPost[]

    const bolig = (p.bolig_data || {}) as BoligData
    const score = (p.airbnb_score || null) as AirbnbScore | null
    const sumPoster = poster.reduce((s, pp) => s + (Number(pp.kostnad) || 0), 0)

    const boligKontekst = `
Bolig (${p.navn}):
- Type: ${bolig.type || 'ukjent'}
- Beliggenhet: ${bolig.beliggenhet || 'ukjent'}
- Areal: ${bolig.areal || '?'} m²
- Soverom: ${bolig.soverom || '?'}, Bad: ${bolig.bad || '?'}
- Avstand strand: ${bolig.avstand_strand || '?'} m
- Basseng: ${bolig.basseng || '?'} · Parkering: ${bolig.parkering || '?'} · Havutsikt: ${bolig.havutsikt || 'nei'}
- Standard i dag: ${bolig.standard || 'ukjent'}
- Kjøpspris: €${p.kjøpesum || bolig.pris || '?'}
- Markedspris/m² (standard / bra / luksus): €${bolig.markedspris_standard_m2 || '?'} / €${bolig.markedspris_bra_m2 || '?'} / €${bolig.markedspris_luksus_m2 || '?'}
- VFT-score: ${bolig.vft_score ?? '?'}/100
- Ekstra: ${bolig.ekstra || 'ingen'}`

    const analyseKontekst = [
      bolig.markedspris_begrunnelse && `Markedspris-begrunnelse: ${bolig.markedspris_begrunnelse}`,
      bolig.oppussing_vurdering && `Oppussingspotensial: ${bolig.oppussing_vurdering}`,
      p.ai_vurdering && `Tidligere AI-vurdering: ${p.ai_vurdering}`,
      score?.lysInfo && `Score-info: ${score.lysInfo} (total ${score.total}/10)`,
    ].filter(Boolean).join('\n')

    const posterListe = poster.length
      ? poster.map(pp => `  - ${pp.navn}: €${pp.kostnad}${pp.notat ? ' (' + pp.notat + ')' : ''}`).join('\n')
      : '  (ingen poster lagt inn)'

    const brukermelding = `Du skal estimere salgspris etter oppussing for en eiendom i Spania. Bruk kunnskap om området, sammenlignbare salg og sunn eiendomsfornuft.

${boligKontekst}

${analyseKontekst ? 'Tidligere analyse:\n' + analyseKontekst + '\n' : ''}
Planlagt oppussing:
${posterListe}
Sum oppussingsposter: €${sumPoster}
Standard på oppussingen: ${STANDARD_TEKST[b.standard] || b.standard}
Prosjektvarighet: ${b.antall_maneder} måneder

Returner KUN gyldig JSON uten markdown:
{
  "estimert_salgspris": 0,
  "begrunnelse": "2-4 setninger på norsk om hvorfor denne prisen – bruk område, sammenlignbare, oppussingsnivå og markedspris per m²",
  "usikkerhet": "lav" | "middels" | "høy"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      temperature: 0,
      system: `Du er ekspert på eiendomsinvestering og salg i Spania, spesielt Costa del Sol, Costa Blanca, Mallorca og Ibiza.

Når du estimerer salgspris etter oppussing:
- Ta utgangspunkt i markedspris per m² for valgt standard i det spesifikke nabolaget
- Juster for størrelse, soverom, bad, basseng, parkering, havutsikt, avstand strand
- Vær nøktern – ikke pynt på tallene. Bedre å undervurdere litt enn å overselge
- Sett usikkerhet høyere hvis området er volatilt, tallgrunnlaget er tynt, eller oppussingsbudsjett virker lavt for valgt standard
- Svar alltid på norsk.`,
      messages: [{ role: 'user', content: brukermelding }],
    })

    const tekst = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = tekst.replace(/```json|```/g, '').trim()

    let estimat: { estimert_salgspris: number; begrunnelse: string; usikkerhet: string }
    try {
      estimat = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Kunne ikke tolke agentens svar', rå: tekst }, { status: 502 })
    }

    const { error: oppErr } = await supabase
      .from('oppussing_budsjett')
      .update({
        estimert_salgspris: estimat.estimert_salgspris,
        estimat_begrunnelse: estimat.begrunnelse,
        estimat_usikkerhet: estimat.usikkerhet,
        estimat_oppdatert: new Date().toISOString(),
        estimat_poster_sum: sumPoster,
      })
      .eq('id', b.id)
    if (oppErr) {
      return NextResponse.json({ error: 'Lagring feilet: ' + oppErr.message }, { status: 500 })
    }

    return NextResponse.json(estimat)

  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error)
    console.error('Salgsestimat feil:', melding)
    return NextResponse.json({ error: melding }, { status: 500 })
  }
}
