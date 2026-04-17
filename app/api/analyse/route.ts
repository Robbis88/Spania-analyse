import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

async function hentNettside(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const html = await res.text()
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)
  } catch {
    return ''
  }
}

function beregnOkonomi(pris: number) {
  const ek_krav = Math.round(pris * 0.35 + pris * 0.13)
  const lan = pris * 0.65
  const rente = 0.03 / 12
  const mnd_betaling = Math.round(lan * rente / (1 - Math.pow(1 + rente, -240)))
  return { ek_krav, mnd_betaling }
}

function beregnAirbnb(pris: number, soverom: number, beliggenhet: string) {
  let faktor = 1
  const sted = beliggenhet.toLowerCase()
  if (sted.includes('marbella') || sted.includes('ibiza')) faktor = 1.8
  else if (sted.includes('costa del sol') || sted.includes('mallorca')) faktor = 1.5
  else if (sted.includes('alicante') || sted.includes('costa blanca')) faktor = 1.2
  else if (sted.includes('torrevieja') || sted.includes('benalmadena')) faktor = 1.1

  const grunnpris = soverom <= 1 ? 80 : soverom === 2 ? 120 : soverom === 3 ? 160 : 220
  const hoysesong_natt = Math.round(grunnpris * faktor * 1.4)
  const skulder_natt = Math.round(grunnpris * faktor)
  const lavsesong_natt = Math.round(grunnpris * faktor * 0.6)
  const hoysesong = Math.round(hoysesong_natt * 120 * 0.85)
  const skulder = Math.round(skulder_natt * 90 * 0.60)
  const lavsesong = Math.round(lavsesong_natt * 150 * 0.35)
  const brutto = hoysesong + skulder + lavsesong
  const etter_gebyr = Math.round(brutto * 0.85)
  const etter_drift = Math.round(etter_gebyr * 0.70)
  const netto_mnd = Math.round(etter_drift / 12)

  return {
    pris_natt_hoysesong: hoysesong_natt,
    pris_natt_skulder: skulder_natt,
    pris_natt_lavsesong: lavsesong_natt,
    inntekt_hoysesong: hoysesong,
    inntekt_skulder: skulder,
    inntekt_lavsesong: lavsesong,
    total_arsinntekt: brutto,
    etter_plattformgebyr: etter_gebyr,
    etter_drift: etter_drift,
    netto_per_mnd: netto_mnd
  }
}

function beregnVFT(type: string, beliggenhet: string): number {
  const t = type.toLowerCase()
  const b = beliggenhet.toLowerCase()
  if (b.includes('alicante') && !b.includes('gran alacant')) return 15
  if (b.includes('altea') || b.includes('alfaz')) return 20
  if (t.includes('villa') || t.includes('enebolig') || t.includes('chalet')) {
    if (b.includes('marbella') || b.includes('ibiza') || b.includes('mallorca')) return 92
    if (b.includes('costa del sol') || b.includes('andalucia')) return 85
    if (b.includes('costa blanca') || b.includes('valencia')) return 78
    return 75
  }
  if (t.includes('rekkehus') || t.includes('townhouse')) return 55
  if (t.includes('leilighet') || t.includes('piso')) {
    if (b.includes('marbella') || b.includes('costa del sol')) return 45
    return 35
  }
  return 50
}

export async function POST(req: NextRequest) {
  try {
    const { propertyText } = await req.json()

    let analyse = propertyText
    if (propertyText.trim().startsWith('http')) {
      const innhold = await hentNettside(propertyText)
      if (innhold.length > 100) analyse = innhold
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Du er ekspert på spansk eiendomsmarked med dyp kunnskap om priser per kvadratmeter i alle områder langs kysten.

Analyser denne eiendommen og returner KUN gyldig JSON uten markdown:

${analyse}

For markedspriser per m² - bruk din kunnskap om:
- Eksakt beliggenhet og nabolag (f.eks Golden Mile vs utkant av Marbella er svært forskjellig)
- Type bolig (villa, leilighet, rekkehus)
- Nærhet til strand, marina, sentrum
- Utsikt (hav, fjell, basseng)
- Standard på området generelt
- Aktuelle markedstrender 2024-2025 i Spania

Estimer realistiske markedspriser for tre nivåer:
- Standard: enkel oppgradering, ok standard
- Bra: moderne kjøkken og bad, god kvalitet materialer
- Luksus: toppkvalitet, premium materialer, arkitekttegnet

Returner dette:
{
  "tittel": "eksakt tittel fra annonsen",
  "pris": 0,
  "type": "Villa / Enebolig / Leilighet / Rekkehus",
  "beliggenhet": "by og nabolag i Spania",
  "soverom": 0,
  "areal": 0,
  "vft_mulig": true,
  "markedspris_standard_m2": 0,
  "markedspris_bra_m2": 0,
  "markedspris_luksus_m2": 0,
  "markedspris_begrunnelse": "2-3 setninger som forklarer hvorfor du estimerer disse prisene basert på beliggenhet, nabolag og type",
  "oppussing_vurdering": "2-3 setninger om oppussingspotensial for akkurat denne eiendommen",
  "ai_vurdering": "4-5 setninger på norsk om denne eiendommen som investering",
  "anbefalt_strategi": "turistutleie / sesongutleie / langtidsleie",
  "neste_steg": ["steg 1", "steg 2", "steg 3"]
}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    if (data.pris > 0) {
      const okonomi = beregnOkonomi(data.pris)
      data.ek_krav = okonomi.ek_krav
      data.mnd_betaling = okonomi.mnd_betaling
    }

    if (data.pris > 0 && data.soverom > 0) {
      data.airbnb = beregnAirbnb(data.pris, data.soverom, data.beliggenhet || '')
      data.yield_estimat = parseFloat(((data.airbnb.etter_drift / data.pris) * 100).toFixed(1))
    }

    data.vft_score = beregnVFT(data.type || '', data.beliggenhet || '')

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Feil:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}