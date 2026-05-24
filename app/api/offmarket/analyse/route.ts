import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/requireAuth'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { BUCKET_BILDER } from '../../../lib/bilder'

const MODELL = 'claude-sonnet-4-6'
const MAKS_BILDER = 8  // begrens hva som sendes til vision for å holde response-tid nede

export const maxDuration = 300

const offmarketTool = {
  name: 'vurder_offmarket',
  description: 'Strukturert kjøper-vurdering av et off-market boligtilbud i Norge. Sammenstiller offentlige data, bilder, og sammenlignbare salg til en handlingsplan.',
  input_schema: {
    type: 'object' as const,
    required: ['ai_oppsummering', 'kjop_anbefaling'],
    properties: {
      verdivurdering: {
        type: 'object',
        description: 'Verdiestimat-bånd basert på sammenlignbare salg, område, bilde-tilstand og byggeår.',
        properties: {
          lav_nok: { type: 'number', description: 'Konservativt estimat — det du burde få den for med solid forhandling.' },
          sannsynlig_nok: { type: 'number', description: 'Mest sannsynlig markedsverdi i dagens stand.' },
          hoy_nok: { type: 'number', description: 'Optimistisk estimat hvis konkurranse.' },
          begrunnelse: { type: 'string', description: '2-4 setninger om hvordan estimatet er bygd opp.' },
        },
      },
      bilde_vurdering: {
        type: 'object',
        description: 'Hva bildene viser om tilstand. Hopp over hvis ingen bilder.',
        properties: {
          tilstand_samlet: { type: 'string', enum: ['svært_dårlig', 'dårlig', 'normal', 'god', 'topp'] },
          byggear_estimat: { type: 'string', description: 'Anslå byggeår eller siste totalrenovering fra bilde-stil.' },
          kommentar: { type: 'string', description: '2-4 setninger om hva bildene avslører — kjøkken/bad-alder, materialer, vedlikehold.' },
          observerte_risikoer: {
            type: 'array',
            items: { type: 'string' },
            description: 'Konkrete ting fra bildene: råteflekker, fuktskjolder, gamle vinduer, slitt fasade, etc.',
          },
        },
      },
      rode_flagg: {
        type: 'array',
        description: '0-8 viktige forhold kjøper må være oppmerksom på. Tenk kritisk — off-market betyr ofte mindre transparens enn vanlige annonser.',
        items: {
          type: 'object',
          required: ['alvorlighet', 'tittel', 'beskrivelse'],
          properties: {
            alvorlighet: { type: 'string', enum: ['kritisk', 'advarsel', 'info'] },
            tittel: { type: 'string' },
            beskrivelse: { type: 'string' },
          },
        },
      },
      sporsmal_til_selger: {
        type: 'array',
        description: '6-15 konkrete spørsmål kjøper må stille selger — basert PÅ DET VI IKKE VET. Sjekk grunnlaget under "KJENTE FAKTA" — ikke spør om noe som står der. Hvis BRA, byggeår, type, eierform, fellesgjeld osv. er oppgitt, hopp over slike spørsmål helt. Fokuser i stedet på: tilstand, oppussinger utført, mangler/skader, dokumentasjon (FDV, takstrapporter, energiattest), heftelser, naboforhold, planer i nabolaget, hvorfor de selger nå, hva de forventer i pris og hvorfor.',
        items: { type: 'string' },
      },
      sporsmal_til_megler_eller_kommune: {
        type: 'array',
        description: 'Spørsmål til 3-parter: kommune (regulering, byggesaker), eventuelt megler hvis involvert.',
        items: { type: 'string' },
      },
      aldersrelaterte_risikoer: {
        type: 'array',
        description: 'Basert på antatt byggeår — typiske svake punkter. <1999 = el uten jordfeil, 1960-80 = asbest/PCB, 1970-90 = kobberrør fluss, <1960 = råte-risiko.',
        items: {
          type: 'object',
          required: ['risiko', 'hvordan_sjekke'],
          properties: {
            risiko: { type: 'string' },
            hvordan_sjekke: { type: 'string' },
            estimat_om_funnet_nok: { type: 'number' },
          },
        },
      },
      mangler_i_grunnlag: {
        type: 'array',
        description: 'Hva vi ikke har info om — der kjøper må kreve dokumentasjon før budgivning.',
        items: { type: 'string' },
      },
      sammenlignbare_vurdering: {
        type: 'object',
        description: 'Vurdering av sammenlignbare salg brukeren har limt inn. Hopp over hvis ingen lenker er gitt.',
        properties: {
          antall: { type: 'number' },
          gjennomsnitt_m2_pris_nok: { type: 'number' },
          kommentar: { type: 'string', description: 'Hvordan tilbudet ligger an mot disse salgene.' },
        },
      },
      forhandlingsposisjon: {
        type: 'object',
        description: 'Hvor kjøper står — off-market gir ofte sterkere posisjon (ingen budkrig).',
        properties: {
          anbefalt_maksbud_nok: { type: 'number' },
          anbefalt_startbud_nok: { type: 'number' },
          begrunnelse: { type: 'string' },
          spaker: { type: 'array', items: { type: 'string' }, description: 'Konkrete argumenter å bruke i forhandling.' },
        },
      },
      neste_steg: {
        type: 'array',
        description: '4-7 konkrete handlinger kjøper bør gjøre i prioritert rekkefølge før budgivning.',
        items: { type: 'string' },
      },
      kjop_anbefaling: {
        type: 'string',
        enum: ['avstå', 'forhandle_hardt', 'ja_med_forbehold', 'klart_ja'],
        description: 'Sluttvurdering basert på all info.',
      },
      ai_oppsummering: {
        type: 'string',
        description: '5-7 setninger fra et kjøperperspektiv: hva er denne boligen, hvilke risikoer dominerer i fravær av takstrapport, og hva er konklusjonen — bør kjøper gå videre, og i så fall med hvilken posisjon?',
      },
    },
  },
}

const SYSTEM = `Du er en kritisk boligkjøper-rådgiver med spesialitet på off-market transaksjoner i Norge.

KONTEKST: Off-market betyr at boligen ikke er annonsert. Det finnes typisk:
- Ingen salgsoppgave
- Ingen takstrapport
- Ingen tilstandsrapport
- Ingen annonse-bilder utenom det selger sender
- Liten informasjon om eierhistorikk og oppussinger

Dette gir kjøper noen fordeler (ingen budkrig, kan gå rolig til verks) og mange ulemper (mye mer due diligence på egen hånd, lett å bli lurt).

Din jobb: gjøre kjøperen i stand til å ta en informert beslutning til tross for mangelfullt grunnlag. Hovedoutputten er en god spørsmålsliste til selger — det er DEN som kompenserer for manglende takstrapport.

VIKTIG OM SPØRSMÅL TIL SELGER:
Du får en seksjon "KJENTE FAKTA" i grunnlaget. Disse skal IKKE spørres om — kjøper har allerede fått dem. Hvis du ser at BRA, byggeår, type, eierform, fellesgjeld, energimerke osv. er oppgitt der, ikke spør "hva er arealet" eller "når er den bygget" — det er sløsing av kjøpers troverdighet hos selger. Bruk i stedet de kjente fakta som inngang til DYPERE spørsmål: hvis byggeår er 1975, spør om kobberrørene er byttet, ikke om byggeår. Hvis BRA er 110m² men oppussingsgrad er "Original", spør om hva som er kostnaden de har estimert for oppgradering.

Aldersregler (bruk når byggeår er kjent eller estimerbar fra bildene):
- <1999: el-anlegg uten jordfeilbryter (30-80k utbedring)
- 1960-80: asbest/PCB-risiko (sanering 100-300k)
- 1970-90: kobberrør fluss-fasen (rør-bytte 150-400k)
- <1960: råte-risiko bærekonstruksjon

Realistiske priser (NOK 2025):
- Bad: 250-450k · Kjøkken: 150-350k · Drenering: 80-300k
- Vinduer 10-15 stk: 150-300k · El-anlegg: 50-150k · Tak: 200-500k

Skriv på norsk. Vær direkte og konkret. Ikke pynt på risikoer.`

type SammenlignbarData = { url: string; tekst: string }

type Bilde = { id: string; storage_sti: string; kategori?: string | null; notat?: string | null }

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ feil: 'ANTHROPIC_API_KEY mangler' }, { status: 500 })
  }
  const klient = new Anthropic()
  try {
    const { prosjektId } = await req.json()
    if (typeof prosjektId !== 'string') {
      return NextResponse.json({ feil: 'prosjektId mangler' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()

    const { data: prosjekt, error: pErr } = await admin
      .from('prosjekter').select('*').eq('id', prosjektId).maybeSingle()
    if (pErr || !prosjekt) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })
    if (!prosjekt.off_market) return NextResponse.json({ feil: 'Ikke et off-market prosjekt' }, { status: 400 })

    const omd = (prosjekt.off_market_data || {}) as Record<string, unknown>
    const selger = (omd.selger || {}) as Record<string, unknown>
    const fakta = (omd.kjente_fakta || {}) as Record<string, unknown>
    const innhenting = (omd.innhenting || {}) as Record<string, unknown>
    const valgtIdx = typeof omd.valgt_treff_idx === 'number' ? omd.valgt_treff_idx : 0
    const treff = Array.isArray(innhenting.treff) ? innhenting.treff[valgtIdx] : null
    const sammenlignbare = Array.isArray(omd.sammenlignbare_data)
      ? (omd.sammenlignbare_data as SammenlignbarData[])
      : []

    // Hent bilder for vision
    const { data: bilderRader } = await admin
      .from('prosjekt_bilder')
      .select('id, storage_sti, kategori, notat')
      .eq('prosjekt_id', prosjektId)
      .eq('type', 'original')
      .order('opprettet', { ascending: false })
      .limit(MAKS_BILDER)
    const bilder = (bilderRader || []) as Bilde[]

    const bildeUrler: Array<{ url: string; kategori: string; notat: string }> = []
    for (const b of bilder) {
      const { data: signert } = await admin.storage.from(BUCKET_BILDER).createSignedUrl(b.storage_sti, 60 * 60)
      if (signert?.signedUrl) bildeUrler.push({ url: signert.signedUrl, kategori: b.kategori || 'ukjent', notat: b.notat || '' })
    }

    // Bygg liste over kjente fakta — kun ikke-tomme verdier, så Claude vet hva som er bekreftet
    const faktaLinjer: string[] = []
    const visFakta = (lbl: string, v: unknown, suffiks = '') => {
      if (v === undefined || v === null || v === '' || v === 0) return
      faktaLinjer.push(`- ${lbl}: ${v}${suffiks}`)
    }
    visFakta('Boligtype', fakta.boligtype)
    visFakta('Eierform', fakta.eierform)
    visFakta('BRA', fakta.bra_m2, ' m²')
    visFakta('P-rom', fakta.p_rom_m2, ' m²')
    visFakta('Byggeår', fakta.byggear)
    visFakta('Soverom', fakta.soverom)
    visFakta('Bad', fakta.bad)
    visFakta('Etasje', fakta.etasje)
    visFakta('Energimerke', fakta.energimerke)
    visFakta('Fellesgjeld', typeof fakta.fellesgjeld_nok === 'number' ? Number(fakta.fellesgjeld_nok).toLocaleString('nb-NO') + ' NOK' : null)
    visFakta('Fellesutgifter/mnd', typeof fakta.fellesutg_mnd_nok === 'number' ? Number(fakta.fellesutg_mnd_nok).toLocaleString('nb-NO') + ' NOK' : null)
    visFakta('Kommunale avgifter/år', typeof fakta.kommunale_avg_aar_nok === 'number' ? Number(fakta.kommunale_avg_aar_nok).toLocaleString('nb-NO') + ' NOK' : null)
    visFakta('Tomt', fakta.tomt_m2, ' m²')
    visFakta('Tomt-type', fakta.tomt_type)
    visFakta('Oppussingsgrad', fakta.oppussingsgrad)
    if (fakta.notater) faktaLinjer.push(`- Andre opplysninger fra selger: ${fakta.notater}`)

    // Bygg tekst-grunnlag
    const grunnlag = [
      `=== OFF-MARKET TILBUD ===`,
      `Adresse (input): ${omd.adresse_input || '(ikke oppgitt)'}`,
      treff ? `Adresse (Geonorge): ${(treff as Record<string, unknown>).adressetekst || ''}` : '',
      treff ? `Postnummer/sted: ${(treff as Record<string, unknown>).postnummer || ''} ${(treff as Record<string, unknown>).poststed || ''}` : '',
      treff ? `Kommune: ${(treff as Record<string, unknown>).kommunenavn || ''}` : '',
      treff ? `Matrikkel: gnr ${(treff as Record<string, unknown>).gardsnummer ?? '-'}/bnr ${(treff as Record<string, unknown>).bruksnummer ?? '-'}` : '',
      ``,
      `=== SELGER / TILBUD ===`,
      `Navn: ${selger.navn || '(ukjent)'}`,
      `Telefon: ${selger.telefon || '(ukjent)'}`,
      `E-post: ${selger.epost || '(ukjent)'}`,
      `Prisindikasjon: ${selger.prisindikasjon_nok ? Number(selger.prisindikasjon_nok).toLocaleString('nb-NO') + ' NOK' : '(ikke oppgitt)'}`,
      `Bakgrunn: ${selger.bakgrunn || '(ingen)'}`,
      ``,
      faktaLinjer.length > 0
        ? `=== KJENTE FAKTA (oppgitt av selger — IKKE spør om disse på nytt) ===\n${faktaLinjer.join('\n')}`
        : `=== INGEN KJENTE FAKTA OPPGITT ===\nKjøper har ikke fått grunnleggende informasjon. Inkluder dette i spørsmålslisten.`,
      ``,
      sammenlignbare.length > 0 ? `=== SAMMENLIGNBARE SALG (${sammenlignbare.length}) ===` : `=== INGEN SAMMENLIGNBARE LIMT INN ===`,
      ...sammenlignbare.map((s, i) => `\n--- Sammenligning ${i + 1}: ${s.url} ---\n${s.tekst.slice(0, 3000)}`),
      ``,
      bilder.length > 0 ? `=== BILDER ===\n${bilder.length} bilder vedlagt for vision-analyse. Kategorier: ${bilder.map(b => b.kategori || '?').join(', ')}` : `=== INGEN BILDER ===`,
    ].filter(Boolean).join('\n')

    type ImgContent = { type: 'image'; source: { type: 'url'; url: string } }
    type TxtContent = { type: 'text'; text: string }
    const innhold: Array<ImgContent | TxtContent> = [
      { type: 'text', text: grunnlag },
      ...bildeUrler.map(b => ({
        type: 'image' as const,
        source: { type: 'url' as const, url: b.url },
      })),
      { type: 'text', text: 'Fyll inn vurder_offmarket-verktøyet. Vær spesielt grundig på spørsmålsliste til selger — det er hovedverdien her.' },
    ]

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let pingInterval: ReturnType<typeof setInterval> | null = null
        const send = (obj: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')) }
          catch { /* lukket */ }
        }
        try {
          pingInterval = setInterval(() => send({ ping: 1 }), 3000)
          const stream = klient.messages.stream({
            model: MODELL,
            max_tokens: 4500,
            temperature: 0.2,
            system: SYSTEM,
            tools: [offmarketTool],
            tool_choice: { type: 'tool', name: 'vurder_offmarket' },
            messages: [{ role: 'user', content: innhold }],
          })
          const svar = await stream.finalMessage()
          clearInterval(pingInterval); pingInterval = null

          const tool = svar.content.find(b => b.type === 'tool_use')
          if (!tool || tool.type !== 'tool_use') {
            send({ feil: 'AI ga ikke strukturert svar (stop_reason: ' + svar.stop_reason + ')' })
            return
          }
          const ai_analyse = tool.input as Record<string, unknown>
          const generert = new Date().toISOString()

          // Lagre resultatet på prosjektet — slik at vi slipper å kjøre Claude på nytt ved hver visning
          const oppdatert = { ...omd, ai_analyse, ai_generert: generert, ai_modell: MODELL, ai_bilde_antall: bilder.length }
          await admin.from('prosjekter').update({ off_market_data: oppdatert }).eq('id', prosjektId)
          send({ data: ai_analyse, generert, modell: MODELL })
        } catch (e) {
          if (pingInterval) clearInterval(pingInterval)
          const m = e instanceof Error ? e.message : String(e)
          console.error('Offmarket-analyse feilet:', m)
          const klientMelding = m.includes('overloaded') ? 'AI-tjenesten er overbelastet — prøv igjen om noen sekunder'
            : m.includes('rate_limit') ? 'For mange forespørsler — vent et minutt og prøv igjen'
            : 'AI-tjenesten feilet: ' + m.slice(0, 200)
          send({ feil: klientMelding })
        } finally {
          try { controller.close() } catch { /* allerede lukket */ }
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Offmarket-analyse pre-stream feil:', m)
    return NextResponse.json({ feil: 'Uventet feil: ' + m.slice(0, 200) }, { status: 500 })
  }
}
