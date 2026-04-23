import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import type { BoligData, Prosjekt } from '../../../types'

const client = new Anthropic()

const MODELL = 'claude-sonnet-4-5'

const salgsanalyseTool = {
  name: 'generer_salgsanalyse',
  description: 'Komplett salgsanalyse for en eiendom i Spania: annonse, bildeplan, dokumenter, prisstrategi, investeringsanalyse, forbedringsforslag og målgruppe.',
  input_schema: {
    type: 'object' as const,
    required: ['salgsannonse', 'bildeplan', 'dokumentcheck', 'prisstrategi', 'investeringsanalyse', 'forbedringsforslag', 'malgruppe'],
    properties: {
      salgsannonse: {
        type: 'object',
        required: ['intro', 'bullets', 'beskrivelse', 'omraade', 'cta'],
        properties: {
          intro: { type: 'string', description: 'Selgende intro, maks 3 linjer — vekke interesse umiddelbart' },
          bullets: { type: 'array', items: { type: 'string' }, description: '5–8 nøkkelpunkter med relevante detaljer og fasiliteter' },
          beskrivelse: { type: 'string', description: 'Detaljert boligbeskrivelse, 4–6 avsnitt, varm tone' },
          omraade: { type: 'string', description: 'Livsstil, fasiliteter i området, avstander til strand/sentrum/flyplass' },
          cta: { type: 'string', description: 'Call-to-action, f.eks. "Ta kontakt for visning — begrenset tilgjengelig"' },
        },
      },
      bildeplan: {
        type: 'object',
        required: ['interior', 'eksterior', 'fasiliteter', 'naeromraade', 'tips'],
        properties: {
          interior: { type: 'array', items: { type: 'string' }, description: 'Konkrete interiør-bilder: "Stue fra inngang mot vindu — morgenlys", "Kjøkken diagonal med matsal i bakgrunn"' },
          eksterior: { type: 'array', items: { type: 'string' } },
          fasiliteter: { type: 'array', items: { type: 'string' }, description: 'Basseng, parkering, fellesarealer' },
          naeromraade: { type: 'array', items: { type: 'string' }, description: 'Strand, sentrum, landemerker' },
          tips: { type: 'array', items: { type: 'string' }, description: 'Drone, video, 3D-visning, gyldne time osv.' },
        },
      },
      dokumentcheck: {
        type: 'array',
        description: 'Sjekkliste over spanske salgsdokumenter',
        items: {
          type: 'object',
          required: ['navn', 'status', 'kommentar'],
          properties: {
            navn: { type: 'string', description: 'F.eks. "Escritura (skjøte)", "Nota Simple", "IBI-kvitteringer"' },
            status: { type: 'string', enum: ['ok', 'mangler', 'maa_sjekkes'] },
            kommentar: { type: 'string', description: 'Hvorfor, hvor fås dette fra, hvor lang tid tar det' },
          },
        },
      },
      prisstrategi: {
        type: 'object',
        required: ['estimert_markedspris_eur', 'estimert_markedspris_begrunnelse', 'strategi_rask', 'strategi_maks', 'anbefalte_tiltak'],
        properties: {
          estimert_markedspris_eur: { type: 'number' },
          estimert_markedspris_begrunnelse: { type: 'string' },
          strategi_rask: {
            type: 'object',
            required: ['pris_eur', 'begrunnelse'],
            properties: {
              pris_eur: { type: 'number' },
              begrunnelse: { type: 'string', description: 'Hvorfor denne prisen gir raskt salg' },
            },
          },
          strategi_maks: {
            type: 'object',
            required: ['pris_eur', 'begrunnelse'],
            properties: {
              pris_eur: { type: 'number' },
              begrunnelse: { type: 'string', description: 'Hvorfor dette er realistisk makspris med riktige tiltak' },
            },
          },
          anbefalte_tiltak: { type: 'array', items: { type: 'string' }, description: 'Hva som bør gjøres før salg for å nå maks-strategien' },
        },
      },
      investeringsanalyse: {
        type: 'object',
        required: ['korttid_arlig_inntekt_eur', 'korttid_begrunnelse', 'langtid_arlig_inntekt_eur', 'langtid_begrunnelse', 'yield_pst', 'roi_kommentar', 'sesong_varierer', 'vurdering'],
        properties: {
          korttid_arlig_inntekt_eur: { type: 'number', description: 'Airbnb/Vrbo typisk årlig netto inntekt etter plattform-avgift og rengjøring' },
          korttid_begrunnelse: { type: 'string' },
          langtid_arlig_inntekt_eur: { type: 'number', description: 'Typisk 12 mnd × månedsleie for området og boligen' },
          langtid_begrunnelse: { type: 'string' },
          yield_pst: { type: 'number', description: 'Brutto yield = beste-case årlig inntekt / estimert kjøpspris × 100' },
          roi_kommentar: { type: 'string' },
          sesong_varierer: { type: 'string', description: 'Hvordan belegget fordeler seg per sesong' },
          vurdering: { type: 'string', enum: ['sterk', 'middels', 'svak'], description: 'Helhetsvurdering som trafikklys' },
        },
      },
      forbedringsforslag: {
        type: 'array',
        description: 'Konkrete oppgraderinger før salg — lav kost / høy verdi prioriteres først',
        items: {
          type: 'object',
          required: ['tiltak', 'kostnad_estimat_eur', 'verdi_potensial_eur', 'prioritet'],
          properties: {
            tiltak: { type: 'string' },
            kostnad_estimat_eur: { type: 'number' },
            verdi_potensial_eur: { type: 'number', description: 'Anslått økning i salgspris' },
            prioritet: { type: 'string', enum: ['hoy', 'middels', 'lav'] },
          },
        },
      },
      malgruppe: {
        type: 'object',
        required: ['primaer', 'sekundaer', 'begrunnelse'],
        properties: {
          primaer: { type: 'string', enum: ['investor', 'feriebolig', 'fastboende', 'utleie'] },
          sekundaer: { type: 'string', enum: ['investor', 'feriebolig', 'fastboende', 'utleie', 'ingen'] },
          begrunnelse: { type: 'string', description: 'Hvorfor nettopp disse — hva ved boligen og området som trekker dem' },
        },
      },
    },
  },
}

const SYSTEM = `Du er en toppkvalifisert spansk eiendomsmegler OG eiendomsinvestor med 15+ års erfaring fra Costa del Sol, Costa Blanca, Mallorca og Ibiza.

Du lager en komplett salgsanalyse ved hjelp av verktøyet generer_salgsanalyse.

RETNINGSLINJER:
- Alle priser i EUR. Kostnadsestimater basert på typiske spanske håndverker/dekorator-priser.
- Vær konkret og handlingsrettet — ikke vage formuleringer som "kan vurderes".
- Tenk alltid: "Hvordan selger jeg denne raskere og dyrere?"
- Optimiser for høyest mulig avkastning for selger.
- Bruk konkrete områdenavn og fasiliteter fra boligdata-konteksten. Ikke gjett om ting du ikke vet — si heller at ting må bekreftes.
- All tekst på norsk (annonsen på norsk og tenk gjerne at den senere kan oversettes til spansk).

REGULERINGS-KUNNSKAP:
- Alicante-by har VFT-moratorium til jan 2027. Marbella har ikke. Mallorca/Ibiza svært strengt. Disse påvirker korttidsleie-inntekt.
- Energisertifikat kreves for salg. Nota Simple fra Registro de la Propiedad.
- IBI-kvitteringer (siste 4 år), plusvalía-beregning, sameiedokumenter (Certificado de deuda).

PRISSTRATEGI:
- strategi_rask: 3–8% under markedet for salg innen 2–3 måneder
- strategi_maks: markedet + oppgraderinger. Realistisk, ikke fantasi.

INVESTERINGSANALYSE:
- Korttidsleie: estimer beleggsprosent per sesong for området. Plattformavgift ~15%, rengjøring 20–30 €/natt.
- Langtidsleie: typisk månedsleie for boligtypen i området × 11-12 (ta hensyn til tomgang).
- Yield = årlig netto inntekt / kjøpspris × 100.
- Vurdering: sterk (yield > 6% + godt område), middels (4–6%), svak (<4% eller problematisk område).`

function byggBoligKontekst(p: Prosjekt): string {
  const bd = (p.bolig_data || {}) as BoligData
  const linjer: string[] = [
    `Bolig: ${p.navn}`,
    `Kjøpesum (det selger ga): €${p.kjøpesum || '?'}`,
    `Oppussingskostnad: €${p.oppussing_faktisk || 0}`,
    `Møblering: €${p.møblering || 0}`,
    `Forventet salgsverdi (brukerens antagelse): €${p.forventet_salgsverdi || '?'}`,
  ]
  if (bd.type) linjer.push(`Type: ${bd.type}`)
  if (bd.beliggenhet) linjer.push(`Beliggenhet: ${bd.beliggenhet}`)
  if (bd.areal) linjer.push(`Areal: ${bd.areal} m²`)
  if (bd.soverom != null) linjer.push(`Soverom: ${bd.soverom}`)
  if (bd.bad != null) linjer.push(`Bad: ${bd.bad}`)
  if (bd.avstand_strand) linjer.push(`Avstand til strand: ${bd.avstand_strand} m`)
  if (bd.basseng) linjer.push(`Basseng: ${bd.basseng}`)
  if (bd.parkering) linjer.push(`Parkering: ${bd.parkering}`)
  if (bd.havutsikt) linjer.push(`Havutsikt: ${bd.havutsikt}`)
  if (bd.standard) linjer.push(`Standard: ${bd.standard}`)
  if (bd.ekstra) linjer.push(`Ekstra: ${bd.ekstra}`)
  if (p.ai_vurdering) linjer.push(`\nTidligere AI-vurdering:\n${p.ai_vurdering}`)
  if (p.notater) linjer.push(`\nNotater fra bruker:\n${p.notater}`)
  return 'PROSJEKTDATA:\n' + linjer.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { prosjekt_id } = await req.json()
    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { data: pRad } = await admin.from('prosjekter').select('*').eq('id', prosjekt_id).single()
    if (!pRad) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })
    const p = pRad as Prosjekt

    const kontekst = byggBoligKontekst(p)

    const response = await client.messages.create({
      model: MODELL,
      max_tokens: 6000,
      system: SYSTEM,
      tools: [salgsanalyseTool],
      tool_choice: { type: 'tool', name: 'generer_salgsanalyse' },
      messages: [{
        role: 'user',
        content: `Lag en komplett salgsanalyse for denne boligen.\n\n${kontekst}\n\nMål: selge raskt OG til god pris. Gi praktiske konkrete tiltak, ikke generelle råd.`,
      }],
    })

    const toolBlokk = response.content.find(b => b.type === 'tool_use')
    if (!toolBlokk || toolBlokk.type !== 'tool_use') {
      return NextResponse.json({ feil: 'Ingen tool_use i AI-respons' }, { status: 500 })
    }

    const data = toolBlokk.input
    const naa = new Date().toISOString()

    await admin.from('prosjekter').update({
      salgsanalyse_data: data,
      salgsanalyse_generert: naa,
      salgsanalyse_modell_versjon: MODELL,
    }).eq('id', prosjekt_id)

    await admin.from('aktivitetslogg').insert([{
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      bruker: p.bruker || 'ukjent',
      handling: 'genererte salgsanalyse',
      tabell: 'prosjekter',
      rad_id: prosjekt_id,
      detaljer: { navn: p.navn, modell: MODELL },
    }])

    return NextResponse.json({ data, generert: naa })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Salgsanalyse feil:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
