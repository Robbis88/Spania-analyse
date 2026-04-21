import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const bolig = body.bolig || body

    const boligInfo = `
- Type: ${bolig.type || 'ukjent'}
- By og område: ${bolig.beliggenhet || 'ukjent'}
- Soverom: ${bolig.soverom || 'ukjent'}
- Bad: ${bolig.bad || 'ukjent'}
- Areal: ${bolig.areal || 'ukjent'} m²
- Avstand strand: ${bolig.avstand_strand || 'ukjent'} meter
- Basseng: ${bolig.basseng || 'ukjent'}
- Parkering: ${bolig.parkering || 'ukjent'}
- Havutsikt: ${bolig.havutsikt || 'nei'}
- Standard: ${bolig.standard || 'ukjent'}
- Kjøpspris: €${bolig.pris || 'ukjent'}
- Markedspris per m² (bra standard): €${bolig.markedspris_bra_m2 || 'ukjent'}
- Oppussingsbudsjett: €${bolig.oppbudsjett || 'ikke oppgitt'}
- Ekstra info: ${bolig.ekstra || 'ingen'}`

    // API-kall 1: Analysetekst
    const analyseRes = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Du er en senior analytiker innen korttidsutleie og Airbnb-optimalisering på Costa del Sol i Spania.

VIKTIG: Vær analytisk, kommersiell og ærlig. Ikke pynt på caset. Tallfest alt konkret.

Analyser Airbnb-potensialet for denne boligen:
${boligInfo}

Lag analysen på norsk med disse seksjonene:

## 1. Kort konklusjon
- Sterk / middels / svak utleiecase?
- De 3 viktigste positive driverne
- De 3 største risikoene
- Hvilken type gjester passer boligen best for?

## 2. Hva styrer prisen for denne boligen
Konkret vurdering av de viktigste faktorene.

## 3. Sesonganalyse – måned for måned
| Måned | Nattpris år 1 | Nattpris 4.9 | Belegg år 1 | Belegg 4.9 | Brutto inntekt |

## 4. Første år vs etablert drift
| | År 1 | Etablert 4.9 |
| Snitt nattpris | | |
| Belegg | | |
| Brutto per år | | |
| Netto etter kostnader | | |

## 5. Tre scenarier
| | Konservativt | Realistisk | Sterkt |
| Brutto år 1 | | | |
| Brutto etablert | | | |
| Netto etter kostnader | | | |

## 6. Kostnader
Liste med estimerte beløp.

## 7. Maks oppussingsbudsjett
Beregn for 5%, 6% og 7% yield.

## 8. Risikofaktorer

## 9. Investorvurdering og prisstrategi`
      }]
    })

    const analyseTekst = analyseRes.content[0].type === 'text' ? analyseRes.content[0].text : ''

    // API-kall 2: Score separat
    const scoreRes = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Du er ekspert på eiendomsinvestering i Spania. Gi en investorscore for denne boligen.

${boligInfo}

Returner KUN gyldig JSON uten markdown eller forklaring:
{
  "lokasjon": 7,
  "eiendom": 6,
  "pris_vs_marked": 5,
  "airbnb_potensial": 7,
  "cashflow": 4,
  "oppussing_potensial": 6,
  "risiko": 7,
  "total": 6.0,
  "lys": "🟡",
  "lysTekst": "Gul – midt på treet",
  "lysInfo": "kort begrunnelse på norsk",
  "brutto_ar1": 45000,
  "brutto_etablert": 65000,
  "netto_estimat": 25000,
  "maks_oppussing_5pst": 80000,
  "maks_oppussing_6pst": 60000,
  "maks_oppussing_7pst": 40000,
  "tips": ["konkret tips 1", "konkret tips 2", "konkret tips 3"]
}

Scoring-regler:
- lokasjon: strand, turistområde, by (10=Marbella beachfront, 1=ingen turister)
- eiendom: størrelse, soverom, basseng, parkering, standard
- pris_vs_marked: 10=20%+ under marked, 1=20%+ over marked
- airbnb_potensial: nattpris og belegg mulig
- cashflow: netto etter lån og drift (10=sterkt positiv, 1=sterkt negativ)
- oppussing_potensial: gevinst ved oppussing
- risiko: omvendt (10=lav risiko, 1=høy risiko)
- total: vektet snitt av alle kategorier
- lys: 🟢 hvis total >= 7, 🟡 hvis >= 5, 🔴 hvis under 5
- maks_oppussing_5pst/6pst/7pst: maks euro på oppussing og fortsatt nå den yielden`
      }]
    })

    const scoreTekst = scoreRes.content[0].type === 'text' ? scoreRes.content[0].text : ''
    console.log('Score tekst:', scoreTekst.slice(0, 200))

    let scoreData = null
    try {
      const clean = scoreTekst.replace(/```json|```/g, '').trim()
      scoreData = JSON.parse(clean)
      console.log('Score OK:', scoreData.total)
    } catch (e) {
      console.error('Parse feil:', e)
    }

    // API-kall 3: Strukturert data via Anthropic tool use
    const scenarioProps = {
      type: 'object' as const,
      required: ['brutto_ar1', 'brutto_etablert', 'netto_etablert', 'yield_pct', 'belegg_etablert'],
      properties: {
        brutto_ar1: { type: 'number' as const },
        brutto_etablert: { type: 'number' as const },
        netto_etablert: { type: 'number' as const },
        yield_pct: { type: 'number' as const, description: 'Årlig netto / kjøpspris × 100' },
        belegg_etablert: { type: 'number' as const, minimum: 0, maximum: 1 },
      },
    }

    const dataRes = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 3000,
      tools: [{
        name: 'lagre_analyse',
        description: 'Lagrer strukturert analyse av boligen som utleieobjekt. Alle tall skal være realistiske og tallfestede. Belegg oppgis som desimal (f.eks. 0.50 for 50%).',
        input_schema: {
          type: 'object',
          required: ['konklusjon', 'maaneder', 'scenarier', 'kostnader_arlig'],
          properties: {
            konklusjon: {
              type: 'object',
              required: ['vurdering', 'egnethet_score', 'anbefalt_leietype'],
              properties: {
                vurdering: { type: 'string', enum: ['sterk', 'middels', 'middels_svak', 'svak'] },
                egnethet_score: { type: 'number', minimum: 0, maximum: 10 },
                anbefalt_leietype: { type: 'string', enum: ['korttid', 'langtid', 'begge'] },
              },
            },
            maaneder: {
              type: 'array',
              minItems: 12,
              maxItems: 12,
              description: '12 måneder i rekkefølge, januar til desember',
              items: {
                type: 'object',
                required: ['maaned', 'nattpris_ar1', 'nattpris_etablert', 'belegg_ar1', 'belegg_etablert', 'brutto_ar1'],
                properties: {
                  maaned: { type: 'integer', minimum: 1, maximum: 12 },
                  nattpris_ar1: { type: 'number', minimum: 0 },
                  nattpris_etablert: { type: 'number', minimum: 0 },
                  belegg_ar1: { type: 'number', minimum: 0, maximum: 1, description: 'Desimal 0-1, f.eks. 0.50' },
                  belegg_etablert: { type: 'number', minimum: 0, maximum: 1 },
                  brutto_ar1: { type: 'number', minimum: 0, description: 'nattpris_ar1 × belegg_ar1 × dager i måneden' },
                },
              },
            },
            scenarier: {
              type: 'object',
              required: ['konservativt', 'realistisk', 'sterkt'],
              properties: {
                konservativt: scenarioProps,
                realistisk: scenarioProps,
                sterkt: scenarioProps,
              },
            },
            kostnader_arlig: {
              type: 'object',
              description: 'Årlige driftskostnader i EUR. Utelat felter som ikke er relevante.',
              properties: {
                airbnb_kommisjon: { type: 'number' },
                renhold: { type: 'number' },
                strom_vann: { type: 'number' },
                internett: { type: 'number' },
                comunidad: { type: 'number' },
                forsikring: { type: 'number' },
                ibi: { type: 'number' },
                basura: { type: 'number' },
                vedlikehold: { type: 'number' },
                management: { type: 'number' },
                leietakerregistrering: { type: 'number' },
              },
            },
            langtidsleie: {
              type: 'object',
              description: 'Estimat for langtidsleie. Utelat om ikke relevant.',
              properties: {
                maaned_lav: { type: 'number' },
                maaned_hoy: { type: 'number' },
                arlig_brutto_lav: { type: 'number' },
                arlig_brutto_hoy: { type: 'number' },
              },
            },
            maks_oppussing: {
              type: 'object',
              description: 'Maks oppussing i EUR og fortsatt nå gitt yield.',
              properties: {
                yield_5_pct: { type: 'number' },
                yield_6_pct: { type: 'number' },
                yield_7_pct: { type: 'number' },
              },
            },
          },
        },
      }],
      tool_choice: { type: 'tool', name: 'lagre_analyse' },
      messages: [{
        role: 'user',
        content: `Du er ekspert på korttidsutleie på Costa del Sol og spansk eiendomsmarked. Produser strukturert analyse for denne boligen via verktøyet lagre_analyse.

${boligInfo}

Retningslinjer:
- "år 1" = nystartet utleie, lav synlighet, få anmeldelser
- "etablert 4.9★" = etablert drift med gode anmeldelser
- konservativt/realistisk/sterkt = tre scenarier for 12-måneders utfall
- Sesongvariasjon skal reflektere Costa del Sol (sommer høyt, desember/januar typisk bunn)
- Tall skal være realistiske og tallfestet, ikke runde gjetninger
- brutto_ar1 per måned = nattpris_ar1 × belegg_ar1 × dager i måneden (Jan=31, Feb=28, Mar=31, Apr=30, Mai=31, Jun=30, Jul=31, Aug=31, Sep=30, Okt=31, Nov=30, Des=31)
- Utelat langtidsleie hvis ikke relevant for området/boligen`,
      }],
    })

    const toolBlock = dataRes.content.find(b => b.type === 'tool_use')
    let airbnbData: Record<string, unknown> | null = null
    if (toolBlock && toolBlock.type === 'tool_use') {
      airbnbData = {
        ...(toolBlock.input as Record<string, unknown>),
        versjon: 1,
        generert: new Date().toISOString(),
      }
    } else {
      console.error('Fikk ikke tool_use-blokk fra agent')
    }

    return NextResponse.json({ analyse: analyseTekst, score: scoreData, data: airbnbData })

  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error)
    console.error('Airbnb feil:', melding)
    return NextResponse.json({ error: melding }, { status: 500 })
  }
}