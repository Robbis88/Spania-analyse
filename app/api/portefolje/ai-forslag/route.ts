import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import type {
  Prosjekt, EiendomLaan, EiendomInntekt, EiendomKostnad, EiendomVerdivurdering,
} from '../../../types'
import {
  KOSTNAD_ETIKETT, LAANETYPE_ETIKETT, VURDERING_KILDE_ETIKETT,
  belaningsgrad, bruttoYield, cashflowMnd, gjeldendeLeieMnd, sisteVerdi,
  sumKostnaderPerMnd, totalLaanKostnadMnd, totalRestgjeld,
} from '../../../lib/portefolje'

const klient = new Anthropic()

const MODELL = 'claude-sonnet-4-6'

const aiTool = {
  name: 'gi_portefolje_anbefaling',
  description: 'Strukturert AI-anbefaling for én eid eiendom. Vurderer leie, rente, refinansiering, oppussing og overordnet strategi.',
  input_schema: {
    type: 'object' as const,
    required: ['oppsummering', 'leie_vurdering', 'rente_vurdering', 'refinansiering', 'strategi', 'cashflow_diagnose', 'oppgraderinger'],
    properties: {
      oppsummering: { type: 'string', description: '2-3 setninger som oppsummerer eiendommens posisjon i dag.' },
      leie_vurdering: {
        type: 'object',
        required: ['kan_okes', 'estimat_okning_kr', 'begrunnelse'],
        properties: {
          kan_okes: { type: 'boolean', description: 'Er det realistisk å øke leien?' },
          estimat_okning_kr: { type: 'number', description: 'Estimert månedlig økning i NOK (0 hvis ikke aktuelt).' },
          begrunnelse: { type: 'string', description: 'Kort hvorfor — markedstrend, kontraktstype, oppgraderinger osv.' },
        },
      },
      rente_vurdering: {
        type: 'object',
        required: ['er_hoy', 'kommentar'],
        properties: {
          er_hoy: { type: 'boolean', description: 'Er rente over markedssnitt for samme type lån?' },
          kommentar: { type: 'string', description: 'Vurdering av rentenivå sammenlignet med Norges Banks styringsrente og typisk margin.' },
        },
      },
      refinansiering: {
        type: 'object',
        required: ['anbefal', 'potensial_per_mnd', 'kommentar'],
        properties: {
          anbefal: { type: 'boolean', description: 'Bør lånet refinansieres?' },
          potensial_per_mnd: { type: 'number', description: 'Estimert månedlig besparelse i NOK (0 hvis ikke aktuelt).' },
          kommentar: { type: 'string' },
        },
      },
      strategi: {
        type: 'object',
        required: ['anbefaling', 'begrunnelse'],
        properties: {
          anbefaling: { type: 'string', enum: ['behold', 'puss_opp', 'selg', 'refinansier', 'oke_leie'], description: 'Overordnet anbefaling.' },
          begrunnelse: { type: 'string', description: '3-5 setninger som forklarer anbefalingen.' },
        },
      },
      cashflow_diagnose: {
        type: 'object',
        required: ['status', 'hovedaarsak', 'tiltak'],
        properties: {
          status: { type: 'string', enum: ['sterk', 'akseptabel', 'svak', 'kritisk'] },
          hovedaarsak: { type: 'string', description: 'Hvorfor cashflow er som den er — leienivå, høy rente, drift, etc.' },
          tiltak: { type: 'array', items: { type: 'string' }, description: '2-4 konkrete tiltak.' },
        },
      },
      oppgraderinger: {
        type: 'array',
        description: '2-4 oppgraderinger sortert etter beste ROI. Kan være tom.',
        items: {
          type: 'object',
          required: ['navn', 'estimat_kostnad', 'forventet_verdiokning', 'begrunnelse'],
          properties: {
            navn: { type: 'string' },
            estimat_kostnad: { type: 'number', description: 'NOK' },
            forventet_verdiokning: { type: 'number', description: 'NOK — markedsverdiøkning ved salg' },
            begrunnelse: { type: 'string' },
          },
        },
      },
    },
  },
}

const SYSTEM = `Du er en erfaren norsk eiendomsrådgiver som vurderer eide utleieboliger og flippeprosjekter. Du gir konkrete, datadrevne anbefalinger basert på den faktiske dataen som sendes inn.

Regler:
- Bruk dataen som er gitt — ikke gjett tall som ikke er der
- Sammenlign rente mot dagens nivå (referer til Norges Banks styringsrente og typisk bankmargin på 1.5-2.5pp)
- Vær realistisk om leieøkninger (markedssjekk + leietakerlovens bestemmelser om årlig regulering iht. KPI)
- Anbefalinger skal være handlingsrettede
- Skriv på norsk, profesjonell men ikke stiv tone`

function byggKontekst(opt: {
  p: Prosjekt; laan: EiendomLaan[]; inntekter: EiendomInntekt[];
  kostnader: EiendomKostnad[]; vurderinger: EiendomVerdivurdering[];
}): string {
  const { p, laan, inntekter, kostnader, vurderinger } = opt
  const verdi = sisteVerdi(vurderinger) || (typeof p.forventet_salgsverdi === 'number' ? p.forventet_salgsverdi : 0)
  const restgjeld = totalRestgjeld(laan)
  const ek = verdi - restgjeld
  const ltv = belaningsgrad(restgjeld, verdi)
  const leieMnd = gjeldendeLeieMnd(inntekter)
  const driftMnd = sumKostnaderPerMnd(kostnader)
  const laanMnd = totalLaanKostnadMnd(laan)
  const cf = cashflowMnd({ leieMnd, kostnaderMnd: driftMnd, laanMnd })
  const yieldB = bruttoYield(leieMnd, verdi)

  const linjer: string[] = []
  linjer.push(`EIENDOM: ${p.navn}`)
  if (p.bolig_data && typeof p.bolig_data === 'object' && 'beliggenhet' in p.bolig_data) {
    linjer.push(`Beliggenhet: ${(p.bolig_data as { beliggenhet?: string }).beliggenhet || 'ukjent'}`)
  }
  linjer.push(`Marked: ${p.marked === 'norge' ? 'Norge (NOK)' : 'Spania (EUR)'}`)
  linjer.push(`Kjøpspris (inkl. omkostninger): ${(p.kjøpesum || 0) + (p.kjøpskostnader || 0)}`)
  linjer.push(``)
  linjer.push(`NØKKELTALL`)
  linjer.push(`Estimert verdi i dag: ${verdi}`)
  linjer.push(`Restgjeld: ${restgjeld}`)
  linjer.push(`Egenkapital: ${ek}`)
  linjer.push(`Belåningsgrad (LTV): ${ltv.toFixed(1)}%`)
  linjer.push(`Brutto yield: ${yieldB.toFixed(2)}%`)
  linjer.push(`Cashflow per måned: ${cf} (leie ${leieMnd} - drift ${driftMnd} - lån ${laanMnd})`)
  linjer.push(``)

  if (vurderinger.length > 0) {
    linjer.push(`VERDIVURDERINGER (${vurderinger.length})`)
    const sortert = [...vurderinger].sort((a, b) => (a.dato || '').localeCompare(b.dato || ''))
    for (const v of sortert) {
      const kilde = v.kilde ? VURDERING_KILDE_ETIKETT[v.kilde] || v.kilde : 'ukjent kilde'
      linjer.push(`- ${v.dato}: ${v.verdi} (${kilde}${v.utstedt_av ? ' — ' + v.utstedt_av : ''})`)
    }
    linjer.push(``)
  }

  if (laan.length > 0) {
    linjer.push(`LÅN`)
    for (const l of laan) {
      linjer.push(`- ${l.bank || 'ukjent bank'}: ${LAANETYPE_ETIKETT[l.laanetype || 'annet']}, restgjeld ${l.restgjeld}, ${l.rente_pst}% ${l.rentetype}, ${l.nedbetalingstid_aar} år, termin ${l.termin_belop}/${l.termin_frekvens}`)
    }
    linjer.push(``)
  }

  if (inntekter.length > 0) {
    linjer.push(`LEIE / INNTEKTER`)
    for (const i of inntekter) {
      const periode = `${i.startdato || '?'} → ${i.sluttdato || 'løpende'}`
      linjer.push(`- ${i.type}: ${i.belop_mnd}/mnd (${periode})${i.depositum ? ', depositum ' + i.depositum : ''}`)
    }
    linjer.push(``)
  }

  if (kostnader.length > 0) {
    linjer.push(`DRIFTSKOSTNADER`)
    for (const k of kostnader) {
      const kat = k.kategori ? KOSTNAD_ETIKETT[k.kategori] || k.kategori : 'ukategorisert'
      linjer.push(`- ${kat}: ${k.belop} ${k.frekvens}${k.beskrivelse ? ' (' + k.beskrivelse + ')' : ''}`)
    }
    linjer.push(``)
  }

  return linjer.join('\n')
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { prosjekt_id, tving_ny } = await req.json()
    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: pRad } = await admin.from('prosjekter').select('*').eq('id', prosjekt_id).maybeSingle()
    if (!pRad) return NextResponse.json({ feil: 'Eiendom ikke funnet' }, { status: 404 })
    const p = pRad as Prosjekt

    // Returner cachet svar hvis det finnes og brukeren ikke tvinger ny analyse
    if (!tving_ny && p.portefolje_ai_data) {
      return NextResponse.json({
        cachet: true,
        generert: p.portefolje_ai_generert,
        modell: p.portefolje_ai_modell_versjon,
        data: p.portefolje_ai_data,
      })
    }

    // Hent støttetabeller
    const [laanRes, inntekterRes, kostnaderRes, vurderingerRes] = await Promise.all([
      admin.from('eiendom_laan').select('*').eq('prosjekt_id', prosjekt_id),
      admin.from('eiendom_inntekter').select('*').eq('prosjekt_id', prosjekt_id),
      admin.from('eiendom_kostnader').select('*').eq('prosjekt_id', prosjekt_id),
      admin.from('eiendom_verdivurderinger').select('*').eq('prosjekt_id', prosjekt_id),
    ])

    const kontekst = byggKontekst({
      p,
      laan: (laanRes.data || []) as EiendomLaan[],
      inntekter: (inntekterRes.data || []) as EiendomInntekt[],
      kostnader: (kostnaderRes.data || []) as EiendomKostnad[],
      vurderinger: (vurderingerRes.data || []) as EiendomVerdivurdering[],
    })

    const svar = await klient.messages.create({
      model: MODELL,
      max_tokens: 2500,
      temperature: 0,
      system: SYSTEM,
      tools: [aiTool],
      tool_choice: { type: 'tool', name: 'gi_portefolje_anbefaling' },
      messages: [{ role: 'user', content: 'Vurder denne eiendommen og fyll inn strukturen via verktøyet:\n\n' + kontekst }],
    })

    const tool = svar.content.find(b => b.type === 'tool_use')
    if (!tool || tool.type !== 'tool_use') {
      return NextResponse.json({ feil: 'AI ga ikke strukturert svar' }, { status: 502 })
    }
    const aiData = tool.input as Record<string, unknown>
    const naa = new Date().toISOString()

    await admin.from('prosjekter').update({
      portefolje_ai_data: aiData,
      portefolje_ai_generert: naa,
      portefolje_ai_modell_versjon: MODELL,
    }).eq('id', prosjekt_id)

    await admin.from('aktivitetslogg').insert([{
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      bruker: auth.bruker,
      handling: 'genererte AI-portefølje-rapport',
      tabell: 'prosjekter',
      rad_id: prosjekt_id,
      detaljer: { navn: p.navn, modell: MODELL },
    }])

    return NextResponse.json({ cachet: false, generert: naa, modell: MODELL, data: aiData })
  } catch (e) {
    console.error('Portefølje AI feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'AI-analyse feilet' }, { status: 500 })
  }
}
