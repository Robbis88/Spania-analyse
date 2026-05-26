// Off-market vurdering — auto-innhenting av offentlige eiendomsdata for norske adresser.
//
// Datakilder (alle gratis, ingen API-nøkkel):
//   - Geonorge Adresser-API → koordinater + matrikkelnummer + kommune
//   - SeEiendom (Kartverket) → dyplenke for manuell matrikkel-detalj
//   - NVE temakart → dyplenke til faresoner (skred, flom, kvikkleire)
//   - Enova energimerking → søkelenke
//   - Kommunal planinnsyn → dyplenke til reguleringssak
//
// API-er som krever betaling/auth (Eiendomsverdi, Grunnboken, Matrikkel-API)
// holdes utenfor — vi viser i stedet en lenke brukeren kan klikke selv.

const GEONORGE_SOK = 'https://ws.geonorge.no/adresser/v1/sok'

export type GeonorgeAdresse = {
  adressetekst: string
  postnummer: string | null
  poststed: string | null
  kommunenavn: string | null
  kommunenummer: string | null
  gardsnummer: number | null
  bruksnummer: number | null
  festenummer: number | null
  seksjonsnummer: number | null
  bruksenhetsnummer: string[] | null
  lat: number | null
  lon: number | null
  representasjonspunkt_kilde: 'offisiell' | null
}

export type OffmarketInnhenting = {
  treff: GeonorgeAdresse[]   // alle Geonorge-treff (kan være flere ved tvetydig søk)
  valgt: GeonorgeAdresse | null  // beste treff (første) — UI lar bruker bytte
  lenker: OffmarketLenker
  hentet: string  // ISO-timestamp
}

export type OffmarketLenker = {
  seeiendom: string | null      // matrikkelportal — krever gnr/bnr
  nve_faresoner: string | null  // krever lat/lon
  enova_sok: string | null      // adresse-søk
  bergen_planinnsyn: string | null  // krever lat/lon hvis Bergen
  bergen_byggesak: string | null
  finn_sold_sok: string | null  // sannsynlige Finn-treff i området
}

// Bygg en søkelenke for sannsynlige treff i Finn.no sin sold-historikk.
// Vi kan ikke linke direkte til et område-filter (Finn krever interne IDer),
// men søk på "<gate> solgt" lander brukeren riktig sted som regel.
function finnSoldSok(adresse: string, poststed: string | null): string {
  const q = poststed ? `${adresse} ${poststed}` : adresse
  return `https://www.finn.no/realestate/homes/search.html?q=${encodeURIComponent(q + ' solgt')}`
}

function lenkerFor(a: GeonorgeAdresse | null): OffmarketLenker {
  if (!a) return {
    seeiendom: null, nve_faresoner: null, enova_sok: null,
    bergen_planinnsyn: null, bergen_byggesak: null, finn_sold_sok: null,
  }
  const erBergen = (a.kommunenavn || '').toLowerCase() === 'bergen'
  const seeiendom = a.kommunenummer && a.gardsnummer != null && a.bruksnummer != null
    ? `https://seeiendom.kartverket.no/eiendom/${a.kommunenummer}/${a.gardsnummer}/${a.bruksnummer}/${a.festenummer ?? 0}/${a.seksjonsnummer ?? 0}`
    : null
  const nve = a.lat != null && a.lon != null
    ? `https://temakart.nve.no/tema/faresoner?lat=${a.lat}&lon=${a.lon}&zoom=15`
    : null
  const enova = `https://attest.energimerking.no/?adresse=${encodeURIComponent(a.adressetekst)}`
  const bergenPlan = erBergen && a.lat != null && a.lon != null
    ? `https://kart.bergen.kommune.no/?easting=${a.lon}&northing=${a.lat}&zoom=17&layers=planinnsyn`
    : null
  const bergenBygg = erBergen
    ? `https://www.bergen.kommune.no/innsynpb/sak/list?searchText=${encodeURIComponent(a.adressetekst)}`
    : null
  return {
    seeiendom,
    nve_faresoner: nve,
    enova_sok: enova,
    bergen_planinnsyn: bergenPlan,
    bergen_byggesak: bergenBygg,
    finn_sold_sok: finnSoldSok(a.adressetekst, a.poststed),
  }
}

// Geonorge returnerer en flat liste av treff under .adresser[]. Vi mapper
// til vårt eget format og dropper felter vi ikke bruker.
type GeonorgeRespons = {
  adresser?: Array<{
    adressetekst?: string
    postnummer?: string
    poststed?: string
    kommunenavn?: string
    kommunenummer?: string
    gardsnummer?: number
    bruksnummer?: number
    festenummer?: number
    seksjonsnummer?: number
    bruksenhetsnummer?: string[]
    representasjonspunkt?: { lat?: number; lon?: number; epsg?: string }
    objtype?: string
  }>
}

function mapTreff(r: NonNullable<GeonorgeRespons['adresser']>[number]): GeonorgeAdresse {
  return {
    adressetekst: r.adressetekst || '',
    postnummer: r.postnummer || null,
    poststed: r.poststed || null,
    kommunenavn: r.kommunenavn || null,
    kommunenummer: r.kommunenummer || null,
    gardsnummer: typeof r.gardsnummer === 'number' ? r.gardsnummer : null,
    bruksnummer: typeof r.bruksnummer === 'number' ? r.bruksnummer : null,
    festenummer: typeof r.festenummer === 'number' ? r.festenummer : null,
    seksjonsnummer: typeof r.seksjonsnummer === 'number' ? r.seksjonsnummer : null,
    bruksenhetsnummer: Array.isArray(r.bruksenhetsnummer) ? r.bruksenhetsnummer : null,
    lat: r.representasjonspunkt?.lat ?? null,
    lon: r.representasjonspunkt?.lon ?? null,
    representasjonspunkt_kilde: r.representasjonspunkt ? 'offisiell' : null,
  }
}

export async function sokAdresse(query: string): Promise<OffmarketInnhenting | { feil: string }> {
  const q = query.trim()
  if (!q) return { feil: 'Tom adresse' }
  const url = `${GEONORGE_SOK}?sok=${encodeURIComponent(q)}&treffPerSide=5&utkoordsys=4326`
  let json: GeonorgeRespons
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { feil: `Geonorge svarte ${res.status}` }
    json = await res.json() as GeonorgeRespons
  } catch (e) {
    return { feil: 'Kunne ikke nå Geonorge: ' + (e instanceof Error ? e.message : String(e)) }
  }
  const treff = (json.adresser || []).map(mapTreff)
  const valgt = treff[0] || null
  return {
    treff,
    valgt,
    lenker: lenkerFor(valgt),
    hentet: new Date().toISOString(),
  }
}

// Eksportert for når UI lar brukeren velge et annet treff fra listen.
export function regenererLenker(a: GeonorgeAdresse | null): OffmarketLenker {
  return lenkerFor(a)
}

// === Budkalkyle / lønnsomhet ===
// Flippe-case for off-market: bud, forventet salgspris (megler), oppussing,
// salgskostnader (meglerhonorar + styling) og lånekostnad → netto fortjeneste
// og avkastning på egenkapital. Delt mellom UI (live-visning) og bank-PDF så
// tallene alltid stemmer overens. Alle beløp i NOK.
export type Budkalkyle = {
  bud_nok?: number                  // planlagt bud / kjøpesum
  bud_lav_nok?: number              // valgfritt budintervall (lav)
  bud_hoy_nok?: number              // valgfritt budintervall (høy)
  forventet_salgspris_nok?: number  // meglerens forventede salgspris etter oppussing
  kjopskostnader_nok?: number       // dok.avgift, tinglysing osv.
  oppussing_nok?: number            // hentes fra oppussingsbudsjettet, overstyrbar
  meglerhonorar_pst?: number        // % av salgssum
  meglerhonorar_fast_nok?: number   // faste tillegg (markedspakke, oppgjør, foto)
  styling_nok?: number              // styling/møblering for visning
  lan_nok?: number                  // lånebeløp
  rente_pst?: number                // årlig nominell rente %
  periode_mnd?: number              // eierperiode i måneder (rentekostnad-grunnlag)
  notat?: string
}

export type BudkalkyleResultat = {
  salgspris: number
  bud: number
  kjopskostnader: number
  oppussing: number
  meglerhonorar: number
  styling: number
  lanekostnad: number
  totalKostnad: number            // sum av alle kostnader (eks. salgspris)
  nettoFortjeneste: number
  egenkapital: number             // kapital du selv legger inn
  avkastningEkPst: number | null  // null hvis egenkapital ≤ 0
  margiPst: number | null         // netto fortjeneste / salgspris
}

export function beregnBudkalkyle(k: Budkalkyle): BudkalkyleResultat {
  const salgspris = k.forventet_salgspris_nok || 0
  const bud = k.bud_nok || 0
  const kjopskostnader = k.kjopskostnader_nok || 0
  const oppussing = k.oppussing_nok || 0
  const styling = k.styling_nok || 0
  const meglerhonorar = Math.round(salgspris * ((k.meglerhonorar_pst || 0) / 100)) + (k.meglerhonorar_fast_nok || 0)
  // Enkel renteberegning: lån × årsrente × andel av året eiet.
  const lanekostnad = Math.round((k.lan_nok || 0) * ((k.rente_pst || 0) / 100) * ((k.periode_mnd || 0) / 12))
  const totalKostnad = bud + kjopskostnader + oppussing + styling + meglerhonorar + lanekostnad
  const nettoFortjeneste = salgspris - totalKostnad
  // Egenkapital = det du selv finansierer av kapitalbehovet (kjøp + oppussing + styling) minus lån.
  const egenkapital = (bud + kjopskostnader + oppussing + styling) - (k.lan_nok || 0)
  return {
    salgspris, bud, kjopskostnader, oppussing, meglerhonorar, styling, lanekostnad,
    totalKostnad, nettoFortjeneste, egenkapital,
    avkastningEkPst: egenkapital > 0 ? (nettoFortjeneste / egenkapital) * 100 : null,
    margiPst: salgspris > 0 ? (nettoFortjeneste / salgspris) * 100 : null,
  }
}
