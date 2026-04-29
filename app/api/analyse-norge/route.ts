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
      .slice(0, 12000)
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const { propertyText } = await req.json()

    let analyse = propertyText
    if (typeof propertyText === 'string' && propertyText.trim().startsWith('http')) {
      const innhold = await hentNettside(propertyText)
      if (innhold.length > 100) analyse = innhold
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Du er ekspert på norsk eiendomsmarked med dyp kunnskap om priser per kvadratmeter, områder og bydeler i alle norske byer.

Analyser denne norske Finn-annonsen og returner KUN gyldig JSON uten markdown.

Annonse:
${analyse}

Vurder markedspris per m² for området basert på:
- Konkret bydel og adresse (f.eks. Bergenhus vs Fyllingsdalen i Bergen er svært forskjellig)
- Type bolig (leilighet, enebolig, rekkehus, tomannsbolig)
- Byggeår og standard
- Energimerke
- Beliggenhet (sentrum, sjø, kollektivdekning)
- Aktuelle markedstrender 2025-2026

Estimer realistiske markedspriser for tre standard-nivåer:
- Som er nå: aktuell stand
- Bra: moderne kjøkken og bad, god kvalitet materialer
- Toppstand: ny renovert, premium materialer

Returner dette (norsk språk i tekst-feltene, alle beløp i NOK):
{
  "tittel": "eksakt tittel fra annonsen",
  "pris_antydning_nok": 0,
  "type": "Leilighet / Enebolig / Tomannsbolig / Rekkehus / Hytte",
  "eierform": "Selveier / Andel / Aksje / Obligasjon",
  "by": "Bergen",
  "bydel": "f.eks. Bergenhus, Sandviken, Fyllingsdalen",
  "adresse": "gateadresse hvis oppgitt, ellers tom streng",
  "areal_bra": 0,
  "areal_p_rom": 0,
  "soverom": 0,
  "bad": 0,
  "byggear": 0,
  "energimerke": "A/B/C/D/E/F/G eller tom streng",
  "fellesgjeld_nok": 0,
  "fellesutgifter_mnd_nok": 0,
  "kommunale_avg_aar_nok": 0,
  "tomt_m2": 0,
  "tomt_type": "Eier / Festet / tom streng",
  "markedspris_nasitt_m2_nok": 0,
  "markedspris_bra_m2_nok": 0,
  "markedspris_topp_m2_nok": 0,
  "markedspris_begrunnelse": "2-3 setninger om hvorfor du estimerer disse prisene basert på konkret bydel og standard",
  "oppussing_vurdering": "2-3 setninger om oppussingspotensial — hva som faktisk gir verdiøkning her",
  "ai_vurdering": "4-5 setninger på norsk om denne boligen som flippe-prosjekt — er den under marked? hvilken oppussing løfter mest?",
  "anbefalt_strategi": "raskt-flipp / standard-flipp / luksus-flipp / la den ligge",
  "annonse_beskrivelse": "selve teksten fra annonsen (renset for navigasjon)",
  "kort_oppsummering": "1 setning på norsk som beskriver boligen",
  "neste_steg": ["steg 1", "steg 2", "steg 3"],
  "score": {
    "lokasjon": 0,
    "lokasjon_begrunnelse": "kort begrunnelse",
    "eiendomsstand": 0,
    "eiendomsstand_begrunnelse": "kort begrunnelse",
    "pris_vs_marked": 0,
    "pris_vs_marked_begrunnelse": "kort begrunnelse",
    "oppussingspotensial": 0,
    "oppussingspotensial_begrunnelse": "kort begrunnelse",
    "risiko": 0,
    "risiko_begrunnelse": "kort begrunnelse",
    "total": 0,
    "lys": "🟢 / 🟡 / 🔴",
    "lys_tekst": "Sterkt flippe-prosjekt / Greit men ikke åpenbart / Frarådes",
    "tips": ["3 konkrete tips om hva som må til for å gjøre dette til et bedre flippe-prosjekt"]
  },
  "bud_strategi": {
    "anbefalt_startbud_nok": 0,
    "startbud_pst_under_prisantydning": 0,
    "anbefalt_maks_bud_nok": 0,
    "maks_bud_pst_av_prisantydning": 0,
    "begrunnelse": "2-3 setninger om budstrategi: hvor mye spillerom finnes mellom markedspris og prisantydning, hvor sterk konkurranse forventes (likviditet i området), og hvor det er verdt å gå over"
  },
  "foreslatte_oppussingsposter": [
    {"navn": "Bad", "kostnad_nok": 0, "begrunnelse": "kort"},
    {"navn": "Kjøkken", "kostnad_nok": 0, "begrunnelse": "kort"},
    {"navn": "Maling og overflater", "kostnad_nok": 0, "begrunnelse": "kort"},
    {"navn": "Gulv", "kostnad_nok": 0, "begrunnelse": "kort"}
  ],
  "arlig_prisvekst_pst": 0,
  "prisvekst_begrunnelse": "1-2 setninger om realistisk årlig prisvekst i denne bydelen basert på siste 5-10 år, kommunale planer, befolkningsvekst og generell etterspørsel. Eksempler: Bergen sentrum/Bergenhus 4-6 %, Sandviken 3-5 %, perifere bydeler 2-4 %, fallende områder 0-2 %"
}

Score-veiledning (1-10 skala der 10 = perfekt for flipp):
- lokasjon: er bydelen ettertraktet? høy etterspørsel? rask omsetning?
- eiendomsstand: er det reelt oppside her, eller er den allerede pen? lavt = mye å gjøre = mer oppside
- pris_vs_marked: er prisantydningen lav i forhold til markedet? høy score = under-priset
- oppussingspotensial: gir oppussing reell verdiøkning her, eller når man taket?
- risiko: skjulte feil-risiko, regulering, salgbarhet, markedsrisiko (10 = lav risiko, 1 = høy risiko)

Lys-regler:
- 🟢 hvis total >= 7 — sterkt flippe-prosjekt
- 🟡 hvis total 5-6.9 — greit men risikabelt
- 🔴 hvis total < 5 — frarådes

For oppussingsposter: foreslå 4-7 typiske poster basert på byggeår, standard og hva annonsen sier. Realistiske norske 2025-26-priser. Sett kostnad_nok til 0 hvis du ikke vet.

Sett tall til 0 og strenger til "" hvis ikke oppgitt. Hvis prisantydning ikke står, sett 0.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    let clean = text.replace(/```json|```/g, '').trim()
    const forste = clean.indexOf('{')
    const siste = clean.lastIndexOf('}')
    if (forste >= 0 && siste > forste) clean = clean.slice(forste, siste + 1)

    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error)
    console.error('Norsk analyse-feil:', melding)
    return NextResponse.json({ error: melding }, { status: 500 })
  }
}
