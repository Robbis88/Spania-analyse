// Catastro (spansk matrikkel) — gratis offentlig OVC-web-service.
// Henter ubeskyttede eiendomsfakta ut fra referencia catastral (refcat):
// areal, byggeår, brukstype og adresse. Ingen auth, ingen API-nøkkel.
//
// Endepunkt: OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=<refcat>
// Respons er XML — vi parser de få flate feltene vi trenger med målrettet regex
// (stabil statlig API, så ingen grunn til å dra inn en full XML-parser).

const OVC_BASE = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC'

export type CatastroEiendom = {
  refcat: string
  areal_m2: number | null       // bygd areal (sfc / stl)
  byggear: number | null        // antigüedad (ant)
  brukstype: string | null      // uso (Residencial, etc.)
  klasse: string | null         // cn (UR = urbano, RU = rústico)
  adresse: string | null        // sammensatt fra tv + nv + pnp
  etasje: string | null
  dor: string | null
  postnummer: string | null
  kommune: string | null
  provins: string | null
}

export type CatastroResultat =
  | { ok: true; eiendom: CatastroEiendom }
  | { ok: false; feil: string }

// Trekk ut innholdet i første forekomst av en tag.
function tag(xml: string, navn: string): string | null {
  const m = xml.match(new RegExp(`<${navn}>([\\s\\S]*?)</${navn}>`, 'i'))
  return m ? m[1].trim() : null
}

function tallEllerNull(s: string | null): number | null {
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Normaliser refcat: fjern mellomrom, store bokstaver. Aksepterer 14/18/20 tegn.
export function normaliserRefcat(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

export function gyldigRefcat(refcat: string): boolean {
  return /^[0-9A-Z]{14}([0-9A-Z]{4}([0-9A-Z]{2})?)?$/.test(refcat)
}

export async function hentCatastro(refcatRaw: string): Promise<CatastroResultat> {
  const refcat = normaliserRefcat(refcatRaw)
  if (!gyldigRefcat(refcat)) {
    return { ok: false, feil: 'Ugyldig referencia catastral (forventet 14, 18 eller 20 tegn)' }
  }

  const url = `${OVC_BASE}?Provincia=&Municipio=&RC=${encodeURIComponent(refcat)}`
  let xml: string
  try {
    const res = await fetch(url, { headers: { Accept: 'application/xml' } })
    xml = await res.text()
  } catch (e) {
    return { ok: false, feil: 'Kunne ikke nå Catastro: ' + (e instanceof Error ? e.message : String(e)) }
  }

  // Feil fra Catastro kommer som <err>…<des>melding</des>… eller <lerr>
  if (/<err>/i.test(xml) || /<lerr>/i.test(xml)) {
    const des = tag(xml, 'des')
    return { ok: false, feil: des || 'Catastro fant ingen eiendom med denne referansen' }
  }

  // Areal: <sfc> i debi, eller <stl> i construcciones som fallback
  const areal = tallEllerNull(tag(xml, 'sfc')) ?? tallEllerNull(tag(xml, 'stl'))

  // Adresse-deler
  const tv = tag(xml, 'tv')   // gatetype (AV, CL, PZ ...)
  const nv = tag(xml, 'nv')   // gatenavn
  const pnp = tag(xml, 'pnp') // husnummer
  const adresse = [tv, nv, pnp].filter(Boolean).join(' ') || null

  const eiendom: CatastroEiendom = {
    refcat,
    areal_m2: areal,
    byggear: tallEllerNull(tag(xml, 'ant')),
    brukstype: tag(xml, 'luso'),
    klasse: tag(xml, 'cn'),
    adresse,
    etasje: tag(xml, 'pt'),
    dor: tag(xml, 'pu'),
    postnummer: tag(xml, 'dp'),
    kommune: tag(xml, 'nm'),
    provins: tag(xml, 'np'),
  }

  // Hvis vi ikke fant noe nyttig i det hele tatt, behandle som ikke funnet
  if (!eiendom.areal_m2 && !eiendom.byggear && !eiendom.kommune) {
    return { ok: false, feil: 'Catastro returnerte ingen data for denne referansen' }
  }

  return { ok: true, eiendom }
}
