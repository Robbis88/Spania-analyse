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

    // API-kall 3: Strukturert data for utleieanalysen
    const dataRes = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      messages: [{
        role: 'user',
        content: `Du er ekspert på korttidsutleie på Costa del Sol og spansk eiendomsmarked. Produser strukturert data for denne boligen som skal brukes i utleieanalyse.

${boligInfo}

Vurder realistiske nattpriser og belegg per måned for TO nivåer:
- "år 1" = nystartet utleie, lav synlighet, få anmeldelser
- "etablert 4.9★" = etablert drift med gode anmeldelser og høyere synlighet

Estimer tre scenarier for årlige inntekter:
- konservativt = lavere nattpris/belegg, realistisk hvis det går seigt
- realistisk = forventet utfall
- sterkt = best-case med gode anmeldelser raskt

Estimer spesifikke årlige driftskostnader for denne eiendommen i dette området.

Returner KUN gyldig JSON uten markdown eller forklaring:
{
  "maneder": [
    { "nr": 1, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 31 },
    { "nr": 2, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 28 },
    { "nr": 3, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 31 },
    { "nr": 4, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 30 },
    { "nr": 5, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 31 },
    { "nr": 6, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 30 },
    { "nr": 7, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 31 },
    { "nr": 8, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 31 },
    { "nr": 9, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 30 },
    { "nr": 10, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 31 },
    { "nr": 11, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 30 },
    { "nr": 12, "nattpris_ar1": 0, "nattpris_etablert": 0, "belegg_ar1_pst": 0, "belegg_etablert_pst": 0, "dager": 31 }
  ],
  "scenarioer": {
    "konservativt": { "brutto_ar1": 0, "brutto_etablert": 0, "netto_etablert": 0 },
    "realistisk":   { "brutto_ar1": 0, "brutto_etablert": 0, "netto_etablert": 0 },
    "sterkt":       { "brutto_ar1": 0, "brutto_etablert": 0, "netto_etablert": 0 }
  },
  "kostnader_ar": {
    "airbnb_kommisjon": 0,
    "renhold": 0,
    "strom_vann": 0,
    "internett": 0,
    "comunidad": 0,
    "forsikring": 0,
    "ibi": 0,
    "soppel": 0,
    "vedlikehold": 0,
    "management": 0,
    "leietakerregistrering": 0
  },
  "langtidsleie_maned_lav": 0,
  "langtidsleie_maned_hoy": 0
}

Regler:
- Belegg er prosent (0-100), ikke desimal
- Sesongvariasjon skal reflektere Costa del Sol / Spania typisk (sommer høyt, vinter lavt; desember/januar typisk bunn)
- Tall skal være realistiske, ikke runde estimater som avslører gjetning
- Hvis du ikke har grunnlag for langtidsleie, sett begge lav/hoy til 0`
      }]
    })

    const dataTekst = dataRes.content[0].type === 'text' ? dataRes.content[0].text : ''
    let airbnbData = null
    try {
      const cleanData = dataTekst.replace(/```json|```/g, '').trim()
      airbnbData = JSON.parse(cleanData)
    } catch (e) {
      console.error('Data parse feil:', e)
    }

    return NextResponse.json({ analyse: analyseTekst, score: scoreData, data: airbnbData })

  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error)
    console.error('Airbnb feil:', melding)
    return NextResponse.json({ error: melding }, { status: 500 })
  }
}