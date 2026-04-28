'use client'
import { useEffect, useState } from 'react'

export const SPRAK = ['no', 'en', 'es', 'fr', 'de', 'nl', 'da', 'sv'] as const
export type Sprak = typeof SPRAK[number]

export const SPRAK_NAVN: Record<Sprak, string> = {
  no: 'Norsk',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  nl: 'Nederlands',
  da: 'Dansk',
  sv: 'Svenska',
}

const NOEKKEL = 'lo-portal-sprak'

type Strenger = {
  // Header / nav
  bolig_til_leie: string
  bolig_til_salgs: string
  kontakt: string
  logg_inn: string
  registrer_interesse: string

  // Forside hero
  hero_eyebrow: string
  hero_tittel: string
  hero_undertittel: string
  hero_cta_se_boliger: string

  // Listing
  vare_boliger: string
  tilgjengelige_naa: string
  ingen_boliger: string
  henter: string
  per_natt: string
  per_uke: string
  pris_paa_foresporsel: string
  gjester: string
  soverom: string
  bad: string
  kort_sov: string

  // Detaljside
  tilbake_til_boliger: string
  om_boligen: string
  fasiliteter: string
  beliggenhet: string
  spesifikasjoner: string
  type_bolig: string
  areal: string
  byggear: string
  tomt: string
  basseng: string
  parkering: string
  havutsikt: string
  avstand_strand: string
  min_opphold: string
  natter: string
  maks_gjester: string

  // Skjema
  send_foresporsel: string
  navn: string
  epost: string
  telefon: string
  fra_dato: string
  til_dato: string
  antall_gjester: string
  melding: string
  send: string
  sender: string
  takk_kontakter_deg: string
  feil_oppstod: string
  paakrevd: string

  // Interesse-modal
  registrer_interesse_tittel: string
  registrer_interesse_intro: string
  jeg_vil_kjope: string
  jeg_vil_leie: string
  jeg_vil_begge: string
  region_onsket: string
  budsjett_eur: string
  takk_interesse: string
  avbryt: string

  // Footer
  kontakt_oss: string
  copyright: string
  privacy_link: string

  // Tabs
  alle: string
  til_leie: string
  til_salgs: string
}

const NO: Strenger = {
  bolig_til_leie: 'Til leie', bolig_til_salgs: 'Til salgs', kontakt: 'Kontakt',
  logg_inn: 'Logg inn', registrer_interesse: 'Registrer interesse',
  hero_eyebrow: 'EIENDOM I SPANIA', hero_tittel: 'Solfylte hjem ved Middelhavet',
  hero_undertittel: 'Eksklusive boliger til leie og salg i Spanias mest ettertraktede områder.',
  hero_cta_se_boliger: 'Se boliger',
  vare_boliger: 'VÅRE BOLIGER', tilgjengelige_naa: 'Tilgjengelig nå',
  ingen_boliger: 'Ingen boliger publisert ennå.', henter: 'Henter...',
  per_natt: '/natt', per_uke: '/uke', pris_paa_foresporsel: 'Pris på forespørsel',
  gjester: 'gjester', soverom: 'soverom', bad: 'bad', kort_sov: 'sov',
  tilbake_til_boliger: '← Tilbake til boliger',
  om_boligen: 'Om boligen', fasiliteter: 'Fasiliteter', beliggenhet: 'Beliggenhet',
  spesifikasjoner: 'Spesifikasjoner', type_bolig: 'Type', areal: 'Areal',
  byggear: 'Byggeår', tomt: 'Tomt', basseng: 'Basseng', parkering: 'Parkering',
  havutsikt: 'Havutsikt', avstand_strand: 'Til strand',
  min_opphold: 'Min. opphold', natter: 'netter', maks_gjester: 'Maks gjester',
  send_foresporsel: 'Send forespørsel', navn: 'Navn', epost: 'E-post',
  telefon: 'Telefon', fra_dato: 'Fra', til_dato: 'Til',
  antall_gjester: 'Antall gjester', melding: 'Melding',
  send: 'Send', sender: 'Sender...',
  takk_kontakter_deg: 'Takk! Vi tar kontakt så snart vi kan.',
  feil_oppstod: 'Noe gikk galt', paakrevd: 'påkrevd',
  registrer_interesse_tittel: 'Registrer interesse',
  registrer_interesse_intro: 'Fortell oss hva du leter etter, så tar vi kontakt med passende boliger.',
  jeg_vil_kjope: 'Jeg vil kjøpe', jeg_vil_leie: 'Jeg vil leie', jeg_vil_begge: 'Begge',
  region_onsket: 'Ønsket område', budsjett_eur: 'Budsjett (€)',
  takk_interesse: 'Takk! Vi kontakter deg snart.', avbryt: 'Avbryt',
  kontakt_oss: 'KONTAKT', copyright: '© Leganger & Osvaag Eiendom',
  privacy_link: 'Personvern',
  alle: 'Alle', til_leie: 'Til leie', til_salgs: 'Til salgs',
}

const EN: Strenger = {
  bolig_til_leie: 'For rent', bolig_til_salgs: 'For sale', kontakt: 'Contact',
  logg_inn: 'Sign in', registrer_interesse: 'Register interest',
  hero_eyebrow: 'PROPERTY IN SPAIN', hero_tittel: 'Sunlit homes by the Mediterranean',
  hero_undertittel: 'Exclusive properties for rent and sale in Spain’s most desirable locations.',
  hero_cta_se_boliger: 'View properties',
  vare_boliger: 'OUR PROPERTIES', tilgjengelige_naa: 'Available now',
  ingen_boliger: 'No properties published yet.', henter: 'Loading...',
  per_natt: '/night', per_uke: '/week', pris_paa_foresporsel: 'Price on request',
  gjester: 'guests', soverom: 'bedrooms', bad: 'baths', kort_sov: 'bd',
  tilbake_til_boliger: '← Back to properties',
  om_boligen: 'About this property', fasiliteter: 'Amenities', beliggenhet: 'Location',
  spesifikasjoner: 'Specifications', type_bolig: 'Type', areal: 'Living area',
  byggear: 'Year built', tomt: 'Plot', basseng: 'Pool', parkering: 'Parking',
  havutsikt: 'Sea view', avstand_strand: 'To beach',
  min_opphold: 'Min. stay', natter: 'nights', maks_gjester: 'Max guests',
  send_foresporsel: 'Send enquiry', navn: 'Name', epost: 'Email',
  telefon: 'Phone', fra_dato: 'From', til_dato: 'To',
  antall_gjester: 'Number of guests', melding: 'Message',
  send: 'Send', sender: 'Sending...',
  takk_kontakter_deg: 'Thank you. We’ll be in touch shortly.',
  feil_oppstod: 'Something went wrong', paakrevd: 'required',
  registrer_interesse_tittel: 'Register interest',
  registrer_interesse_intro: 'Tell us what you’re looking for and we’ll get back with matching properties.',
  jeg_vil_kjope: 'I want to buy', jeg_vil_leie: 'I want to rent', jeg_vil_begge: 'Both',
  region_onsket: 'Preferred area', budsjett_eur: 'Budget (€)',
  takk_interesse: 'Thank you. We’ll be in touch soon.', avbryt: 'Cancel',
  kontakt_oss: 'CONTACT', copyright: '© Leganger & Osvaag Eiendom',
  privacy_link: 'Privacy',
  alle: 'All', til_leie: 'For rent', til_salgs: 'For sale',
}

const ES: Strenger = {
  bolig_til_leie: 'En alquiler', bolig_til_salgs: 'En venta', kontakt: 'Contacto',
  logg_inn: 'Iniciar sesión', registrer_interesse: 'Registrar interés',
  hero_eyebrow: 'PROPIEDAD EN ESPAÑA', hero_tittel: 'Hogares soleados junto al Mediterráneo',
  hero_undertittel: 'Propiedades exclusivas en alquiler y venta en las zonas más codiciadas de España.',
  hero_cta_se_boliger: 'Ver propiedades',
  vare_boliger: 'NUESTRAS PROPIEDADES', tilgjengelige_naa: 'Disponibles ahora',
  ingen_boliger: 'Aún no hay propiedades publicadas.', henter: 'Cargando...',
  per_natt: '/noche', per_uke: '/semana', pris_paa_foresporsel: 'Precio a consultar',
  gjester: 'huéspedes', soverom: 'habitaciones', bad: 'baños', kort_sov: 'hab',
  tilbake_til_boliger: '← Volver a propiedades',
  om_boligen: 'Sobre la propiedad', fasiliteter: 'Servicios', beliggenhet: 'Ubicación',
  spesifikasjoner: 'Especificaciones', type_bolig: 'Tipo', areal: 'Superficie',
  byggear: 'Año de construcción', tomt: 'Parcela', basseng: 'Piscina',
  parkering: 'Aparcamiento', havutsikt: 'Vistas al mar', avstand_strand: 'A la playa',
  min_opphold: 'Estancia mínima', natter: 'noches', maks_gjester: 'Máx. huéspedes',
  send_foresporsel: 'Enviar consulta', navn: 'Nombre', epost: 'Correo',
  telefon: 'Teléfono', fra_dato: 'Desde', til_dato: 'Hasta',
  antall_gjester: 'Número de huéspedes', melding: 'Mensaje',
  send: 'Enviar', sender: 'Enviando...',
  takk_kontakter_deg: 'Gracias. Le contactaremos pronto.',
  feil_oppstod: 'Algo salió mal', paakrevd: 'obligatorio',
  registrer_interesse_tittel: 'Registrar interés',
  registrer_interesse_intro: 'Cuéntenos qué busca y le responderemos con propiedades adecuadas.',
  jeg_vil_kjope: 'Quiero comprar', jeg_vil_leie: 'Quiero alquilar', jeg_vil_begge: 'Ambos',
  region_onsket: 'Área preferida', budsjett_eur: 'Presupuesto (€)',
  takk_interesse: 'Gracias. Le contactaremos pronto.', avbryt: 'Cancelar',
  kontakt_oss: 'CONTACTO', copyright: '© Leganger & Osvaag Eiendom',
  privacy_link: 'Privacidad',
  alle: 'Todos', til_leie: 'En alquiler', til_salgs: 'En venta',
}

// For å holde filen håndterbar lar vi FR/DE/NL/DA/SV falle tilbake til EN
// inntil de oversettes. Strukturen er klar — bare bytt ut.
const FR: Strenger = { ...EN, logg_inn: 'Connexion', registrer_interesse: 'Manifester intérêt',
  hero_tittel: 'Maisons ensoleillées sur la Méditerranée',
  hero_cta_se_boliger: 'Voir les biens', tilgjengelige_naa: 'Disponibles maintenant',
  bolig_til_leie: 'À louer', bolig_til_salgs: 'À vendre',
  per_natt: '/nuit', per_uke: '/semaine', send_foresporsel: 'Envoyer une demande',
  navn: 'Nom', epost: 'E-mail', telefon: 'Téléphone', send: 'Envoyer', avbryt: 'Annuler' }

const DE: Strenger = { ...EN, logg_inn: 'Anmelden', registrer_interesse: 'Interesse bekunden',
  hero_tittel: 'Sonnige Häuser am Mittelmeer',
  hero_cta_se_boliger: 'Immobilien ansehen', tilgjengelige_naa: 'Jetzt verfügbar',
  bolig_til_leie: 'Zu mieten', bolig_til_salgs: 'Zu verkaufen',
  per_natt: '/Nacht', per_uke: '/Woche', send_foresporsel: 'Anfrage senden',
  navn: 'Name', epost: 'E-Mail', telefon: 'Telefon', send: 'Senden', avbryt: 'Abbrechen' }

const NL: Strenger = { ...EN, logg_inn: 'Inloggen', registrer_interesse: 'Interesse registreren',
  hero_tittel: 'Zonnige huizen aan de Middellandse Zee',
  hero_cta_se_boliger: 'Bekijk woningen', tilgjengelige_naa: 'Nu beschikbaar',
  bolig_til_leie: 'Te huur', bolig_til_salgs: 'Te koop',
  per_natt: '/nacht', per_uke: '/week', send_foresporsel: 'Aanvraag versturen',
  navn: 'Naam', epost: 'E-mail', telefon: 'Telefoon', send: 'Verstuur', avbryt: 'Annuleren' }

const DA: Strenger = { ...EN, logg_inn: 'Log ind', registrer_interesse: 'Registrér interesse',
  hero_tittel: 'Solfyldte hjem ved Middelhavet',
  hero_cta_se_boliger: 'Se boliger', tilgjengelige_naa: 'Tilgængelig nu',
  bolig_til_leie: 'Til leje', bolig_til_salgs: 'Til salg',
  per_natt: '/nat', per_uke: '/uge', send_foresporsel: 'Send forespørgsel',
  navn: 'Navn', epost: 'E-mail', telefon: 'Telefon', send: 'Send', avbryt: 'Annullér' }

const SV: Strenger = { ...EN, logg_inn: 'Logga in', registrer_interesse: 'Anmäl intresse',
  hero_tittel: 'Soliga hem vid Medelhavet',
  hero_cta_se_boliger: 'Se bostäder', tilgjengelige_naa: 'Tillgängliga nu',
  bolig_til_leie: 'Till uthyrning', bolig_til_salgs: 'Till salu',
  per_natt: '/natt', per_uke: '/vecka', send_foresporsel: 'Skicka förfrågan',
  navn: 'Namn', epost: 'E-post', telefon: 'Telefon', send: 'Skicka', avbryt: 'Avbryt' }

const ALLE: Record<Sprak, Strenger> = { no: NO, en: EN, es: ES, fr: FR, de: DE, nl: NL, da: DA, sv: SV }

// Velger oversatt versjon hvis tilgjengelig, ellers original.
// Brukes på portal-tekster lagret som { no: "...", en: "..." }-objekter.
export function plukkOversettelse(
  oversettelser: Record<string, string> | null | undefined,
  sprak: Sprak,
  fallback: string | null | undefined,
): string {
  if (oversettelser && oversettelser[sprak] && oversettelser[sprak].trim()) {
    return oversettelser[sprak]
  }
  return fallback || ''
}

export function plukkOversettelseListe(
  oversettelser: Record<string, string[]> | null | undefined,
  sprak: Sprak,
  fallback: string[] | null | undefined,
): string[] {
  if (oversettelser && Array.isArray(oversettelser[sprak]) && oversettelser[sprak].length > 0) {
    return oversettelser[sprak]
  }
  return fallback || []
}

export function hentStrenger(sprak: Sprak): Strenger {
  return ALLE[sprak] || NO
}

function lesLagretSprak(): Sprak {
  if (typeof window === 'undefined') return 'no'
  const lagret = window.localStorage.getItem(NOEKKEL)
  if (lagret && (SPRAK as readonly string[]).includes(lagret)) return lagret as Sprak
  // Default basert på nettleser-språk
  const browser = window.navigator.language?.slice(0, 2).toLowerCase()
  if (browser && (SPRAK as readonly string[]).includes(browser)) return browser as Sprak
  return 'no'
}

export function useSprak(): { sprak: Sprak; settSprak: (s: Sprak) => void; t: Strenger } {
  const [sprak, settInternal] = useState<Sprak>('no')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    settInternal(lesLagretSprak())
    function onChange(e: Event) {
      const detail = (e as CustomEvent<{ sprak: Sprak }>).detail
      if (detail?.sprak) settInternal(detail.sprak)
    }
    window.addEventListener('app-sprak-endret', onChange as EventListener)
    return () => window.removeEventListener('app-sprak-endret', onChange as EventListener)
  }, [])

  function settSprak(s: Sprak) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(NOEKKEL, s)
    window.dispatchEvent(new CustomEvent('app-sprak-endret', { detail: { sprak: s } }))
    settInternal(s)
  }

  return { sprak, settSprak, t: hentStrenger(sprak) }
}

// === VALUTA ===
// Følger språkvalget. Priser er lagret i EUR i databasen — vi konverterer
// til visningsvaluta og formaterer etter locale.

export type Valuta = 'EUR' | 'NOK' | 'DKK' | 'SEK'

export const VALUTA_PER_SPRAK: Record<Sprak, Valuta> = {
  no: 'NOK', en: 'EUR', es: 'EUR', fr: 'EUR', de: 'EUR', nl: 'EUR', da: 'DKK', sv: 'SEK',
}

const VALUTA_LOCALE: Record<Valuta, string> = {
  EUR: 'de-DE', NOK: 'nb-NO', DKK: 'da-DK', SEK: 'sv-SE',
}

const VALUTA_SYMBOL: Record<Valuta, string> = {
  EUR: '€', NOK: 'kr', DKK: 'kr', SEK: 'kr',
}

const KURS_NOEKKEL = 'lo-portal-kurser'
const KURS_TTL_MS = 1000 * 60 * 60 * 24 // 24 timer

type KursData = { hentet: number; rates: Record<string, number> }

async function hentKurser(): Promise<Record<string, number>> {
  if (typeof window === 'undefined') return { EUR: 1, NOK: 11.8, DKK: 7.46, SEK: 11.3 }

  // Sjekk localStorage
  try {
    const lagret = window.localStorage.getItem(KURS_NOEKKEL)
    if (lagret) {
      const data: KursData = JSON.parse(lagret)
      if (Date.now() - data.hentet < KURS_TTL_MS) return data.rates
    }
  } catch { /* ignore */ }

  // Hent fra ECB via frankfurter.app (gratis, ingen nøkkel)
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=NOK,DKK,SEK')
    const data = await res.json()
    const rates = { EUR: 1, ...(data.rates || {}) }
    window.localStorage.setItem(KURS_NOEKKEL, JSON.stringify({ hentet: Date.now(), rates }))
    return rates
  } catch {
    // Fallback til omtrentlige kurser hvis API-et er nede
    return { EUR: 1, NOK: 11.8, DKK: 7.46, SEK: 11.3 }
  }
}

export function useValuta(): {
  valuta: Valuta
  formater: (eurBeloep: number | null | undefined) => string
  symbol: string
} {
  const { sprak } = useSprak()
  const valuta = VALUTA_PER_SPRAK[sprak] || 'EUR'
  const [kurser, setKurser] = useState<Record<string, number>>({ EUR: 1, NOK: 11.8, DKK: 7.46, SEK: 11.3 })

  useEffect(() => {
    let aktiv = true
    void hentKurser().then(r => { if (aktiv) setKurser(r) })
    return () => { aktiv = false }
  }, [])

  function formater(eurBeloep: number | null | undefined): string {
    if (!eurBeloep || !Number.isFinite(eurBeloep)) return '–'
    const kurs = kurser[valuta] || 1
    const omregnet = eurBeloep * kurs
    // Avrund: små tall presist, store tall til nærmeste 100/1000
    let avrundet = omregnet
    if (omregnet > 100000) avrundet = Math.round(omregnet / 1000) * 1000
    else if (omregnet > 1000) avrundet = Math.round(omregnet / 10) * 10
    else avrundet = Math.round(omregnet)
    try {
      return new Intl.NumberFormat(VALUTA_LOCALE[valuta], {
        style: 'currency', currency: valuta, maximumFractionDigits: 0,
      }).format(avrundet)
    } catch {
      return `${VALUTA_SYMBOL[valuta]} ${avrundet.toLocaleString()}`
    }
  }

  return { valuta, formater, symbol: VALUTA_SYMBOL[valuta] }
}
