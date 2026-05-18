// Oversettelser for /inspeksjon — kun for kunde-flatene (landing + min side).
// Admin er ren norsk. Bruker en flat key-struktur for å unngå dyp objekt-traversering.

export type InspSprak = 'no' | 'en' | 'es'

export const INSP_SPRAK_NAVN: Record<InspSprak, string> = {
  no: 'Norsk',
  en: 'English',
  es: 'Español',
}

export const INSP_SPRAK_FLAGG: Record<InspSprak, string> = {
  no: '🇳🇴',
  en: '🇬🇧',
  es: '🇪🇸',
}

type Ord = Record<InspSprak, string>

const TEKSTER = {
  // Header
  tilbake_portal: { no: '← Til portalen', en: '← Back to portal', es: '← Volver al portal' },

  // Hero
  hero_eyebrow: { no: 'BOLIGINSPEKSJON', en: 'HOME INSPECTION', es: 'INSPECCIÓN DE VIVIENDA' },
  hero_tittel: {
    no: 'Sov trygt — vi sjekker leiligheten for deg',
    en: 'Sleep easy — we inspect your apartment for you',
    es: 'Duerme tranquilo — inspeccionamos tu apartamento por ti',
  },
  hero_undertittel: {
    no: 'Lokal håndverker med 30+ års erfaring tar full sjekk av leiligheten din langs Costa del Sol — lekkasjer, fukt, slitasje. Du får skriftlig rapport med foto, og tilbud på utbedring hvis noe er funnet.',
    en: 'A local craftsman with 30+ years of experience does a full inspection of your apartment along Costa del Sol — leaks, moisture, wear and tear. You receive a written report with photos, and a quote for repairs if anything is found.',
    es: 'Un artesano local con más de 30 años de experiencia realiza una inspección completa de tu apartamento en la Costa del Sol — fugas, humedad, desgaste. Recibes un informe escrito con fotos y un presupuesto para reparaciones si se encuentra algo.',
  },
  hero_cta: { no: 'Bestill inspeksjon', en: 'Book inspection', es: 'Reservar inspección' },

  // Tjenester
  tjeneste_eyebrow: { no: 'VELG TJENESTE', en: 'CHOOSE SERVICE', es: 'ELIGE SERVICIO' },
  tjeneste_tittel: {
    no: 'Tre måter å holde leiligheten trygg',
    en: 'Three ways to keep your apartment safe',
    es: 'Tres formas de mantener tu apartamento seguro',
  },
  type_engangs: { no: 'Engang', en: 'One-time', es: 'Una vez' },
  type_manedlig: { no: 'Månedlig', en: 'Monthly', es: 'Mensual' },
  type_kvartalsvis: { no: 'Kvartalsvis', en: 'Quarterly', es: 'Trimestral' },

  engangs_lbl: {
    no: 'Engangs grundig inspeksjon',
    en: 'One-time thorough inspection',
    es: 'Inspección minuciosa única',
  },
  engangs_desc: {
    no: 'Full grundig sjekk av bad, kjøkken, terrasse, varmt-/kaldtvann, elektrisk, ventilasjon og generell tilstand. Skriftlig rapport med foto og prioriterte anbefalinger.',
    en: 'Full thorough inspection of bathroom, kitchen, terrace, plumbing, electrical, ventilation and general condition. Written report with photos and prioritized recommendations.',
    es: 'Inspección minuciosa de baño, cocina, terraza, fontanería, electricidad, ventilación y condición general. Informe escrito con fotos y recomendaciones priorizadas.',
  },
  manedlig_lbl: {
    no: 'Månedlig visuell sjekk (abonnement)',
    en: 'Monthly visual check (subscription)',
    es: 'Comprobación visual mensual (suscripción)',
  },
  manedlig_desc: {
    no: 'Kort visuell sjekk hver måned (~20 min) — lekkasje-tegn, fukt, vinduer, dører, balkong. Rapport med foto. Bra for trygghet ved langtidsleie eller når du ikke bor i leiligheten selv.',
    en: 'Short visual check each month (~20 min) — signs of leaks, moisture, windows, doors, balcony. Report with photos. Great for peace of mind during long-term rentals or when you don\'t live in the apartment yourself.',
    es: 'Comprobación visual breve cada mes (~20 min) — signos de fugas, humedad, ventanas, puertas, balcón. Informe con fotos. Ideal para tranquilidad durante alquileres a largo plazo o cuando no vives en el apartamento.',
  },
  kvartalsvis_lbl: {
    no: 'Kvartalsvis grundig (abonnement)',
    en: 'Quarterly thorough (subscription)',
    es: 'Trimestral minuciosa (suscripción)',
  },
  kvartalsvis_desc: {
    no: 'Grundig sjekk hvert kvartal med fukt-måling og kontroll av kritiske punkter. Skriftlig rapport. Sparer deg fra dyre overraskelser.',
    en: 'Thorough check every quarter with moisture measurement and review of critical points. Written report. Saves you from expensive surprises.',
    es: 'Comprobación minuciosa cada trimestre con medición de humedad y revisión de puntos críticos. Informe escrito. Te ahorra costosas sorpresas.',
  },

  storrelse_1: { no: '1-roms leilighet', en: '1-bedroom apartment', es: 'Apartamento de 1 dormitorio' },
  storrelse_2: { no: '2-roms leilighet', en: '2-bedroom apartment', es: 'Apartamento de 2 dormitorios' },
  storrelse_3: { no: '3-roms leilighet', en: '3-bedroom apartment', es: 'Apartamento de 3 dormitorios' },
  storrelse_4: { no: '4-roms leilighet / penthouse', en: '4-bedroom apartment / penthouse', es: 'Apartamento de 4 dormitorios / ático' },
  storrelse_villa: { no: 'Villa / rekkehus', en: 'Villa / townhouse', es: 'Villa / casa adosada' },

  // Bestilling
  bestill_eyebrow: { no: 'BESTILL', en: 'BOOK', es: 'RESERVAR' },
  bestill_tittel: { no: 'Klar på 60 sekunder', en: 'Ready in 60 seconds', es: 'Listo en 60 segundos' },
  valgt: { no: 'Valgt', en: 'Selected', es: 'Seleccionado' },
  per_besok: { no: 'per besøk', en: 'per visit', es: 'por visita' },
  engang: { no: 'engang', en: 'one-time', es: 'una vez' },

  felt_storrelse: { no: 'Størrelse', en: 'Size', es: 'Tamaño' },
  felt_tjeneste: { no: 'Tjeneste', en: 'Service', es: 'Servicio' },
  felt_navn: { no: 'Ditt navn *', en: 'Your name *', es: 'Tu nombre *' },
  felt_epost: { no: 'E-post *', en: 'Email *', es: 'Correo electrónico *' },
  felt_telefon: { no: 'Telefon', en: 'Phone', es: 'Teléfono' },
  felt_adresse: { no: 'Adresse *', en: 'Address *', es: 'Dirección *' },
  felt_kompleks: { no: 'Kompleks / urbanización', en: 'Complex / urbanización', es: 'Complejo / urbanización' },
  felt_leilighet_nr: { no: 'Leilighet nr.', en: 'Apartment no.', es: 'Apto. nº' },
  felt_bra: { no: 'BRA (m²)', en: 'Area (m²)', es: 'Superficie (m²)' },
  felt_onsket_dato: { no: 'Ønsket dato', en: 'Preferred date', es: 'Fecha deseada' },
  felt_fleksibel: { no: 'Jeg er fleksibel — finn et tidspunkt som passer', en: 'I\'m flexible — find a time that works', es: 'Soy flexible — encuentra un horario que funcione' },
  felt_fleksibel_lbl: { no: 'Fleksibel?', en: 'Flexible?', es: '¿Flexible?' },
  felt_melding: { no: 'Melding (valgfri)', en: 'Message (optional)', es: 'Mensaje (opcional)' },
  felt_melding_placeholder: {
    no: 'Spesielle bekymringer? Tidligere lekkasjer? Adgang til leiligheten (nøkkel hos megler)?',
    en: 'Special concerns? Previous leaks? Access to the apartment (key with agent)?',
    es: '¿Preocupaciones especiales? ¿Fugas anteriores? ¿Acceso al apartamento (llave con agente)?',
  },

  feil_fyll_inn: { no: 'Fyll inn navn, e-post og adresse', en: 'Please fill in name, email and address', es: 'Por favor, completa nombre, correo y dirección' },
  feil_generell: { no: 'Noe gikk galt. Prøv igjen.', en: 'Something went wrong. Try again.', es: 'Algo salió mal. Inténtalo de nuevo.' },
  sender: { no: '⏳ Sender bestilling…', en: '⏳ Sending booking…', es: '⏳ Enviando reserva…' },
  send_bestilling: { no: 'Send bestilling', en: 'Send booking', es: 'Enviar reserva' },
  uforpliktende: {
    no: 'Bestillingen er uforpliktende — vi bekrefter pris og tidspunkt på e-post før vi kommer.',
    en: 'The booking is non-binding — we confirm price and time by email before we come.',
    es: 'La reserva no es vinculante — confirmamos precio y horario por correo antes de venir.',
  },

  // Bekreftelse
  takk: { no: 'Takk — bestillingen er mottatt', en: 'Thank you — booking received', es: 'Gracias — reserva recibida' },
  bekreftet_msg: {
    no: 'Vi tar kontakt på {epost} innen 24 timer for å avtale tidspunkt. Pris bekreftet: €{pris}.',
    en: 'We\'ll contact you at {epost} within 24 hours to schedule. Price confirmed: €{pris}.',
    es: 'Nos pondremos en contacto contigo en {epost} dentro de 24 horas para programar. Precio confirmado: €{pris}.',
  },
  lagre_lenken: { no: '🔖 Lagre denne lenken', en: '🔖 Save this link', es: '🔖 Guarda este enlace' },
  lenken_beskrivelse: {
    no: 'Du finner alltid status, rapporter og tilbud på din egen oversiktsside:',
    en: 'You can always find status, reports and offers on your own overview page:',
    es: 'Siempre puedes encontrar estado, informes y ofertas en tu propia página:',
  },
  kopier_lenke: { no: '📋 Kopier lenken', en: '📋 Copy link', es: '📋 Copiar enlace' },
  referanse: { no: 'Referanse', en: 'Reference', es: 'Referencia' },
  aapne_min_side: { no: 'Åpne min side →', en: 'Open my page →', es: 'Abrir mi página →' },

  // Steg
  slik_eyebrow: { no: 'SLIK FUNGERER DET', en: 'HOW IT WORKS', es: 'CÓMO FUNCIONA' },
  slik_tittel: { no: 'Fire enkle steg', en: 'Four simple steps', es: 'Cuatro pasos sencillos' },
  steg1_t: { no: 'Du bestiller', en: 'You book', es: 'Tú reservas' },
  steg1_b: {
    no: 'Velg tjeneste og leilighetsstørrelse — du får pris med en gang. Vi bekrefter tidspunkt på e-post.',
    en: 'Choose service and apartment size — you get a price immediately. We confirm the time by email.',
    es: 'Elige servicio y tamaño del apartamento — obtienes precio al instante. Confirmamos el horario por correo.',
  },
  steg2_t: { no: 'Vi sjekker', en: 'We inspect', es: 'Inspeccionamos' },
  steg2_b: {
    no: 'Lokal håndverker går grundig gjennom leiligheten. Sjekker bad, kjøkken, terrasse, ventilasjon, elektrisk, vinduer.',
    en: 'A local craftsman thoroughly inspects the apartment. Checks bathroom, kitchen, terrace, ventilation, electrical, windows.',
    es: 'Un artesano local inspecciona minuciosamente el apartamento. Comprueba baño, cocina, terraza, ventilación, electricidad, ventanas.',
  },
  steg3_t: { no: 'Du får rapport', en: 'You receive a report', es: 'Recibes un informe' },
  steg3_b: {
    no: 'Skriftlig rapport med bilder og prioriterte funn — det er trygt, det er en merknad, eller det haster.',
    en: 'Written report with photos and prioritized findings — it\'s safe, it\'s a note, or it\'s urgent.',
    es: 'Informe escrito con fotos y hallazgos priorizados — es seguro, es una observación, o es urgente.',
  },
  steg4_t: { no: 'Vi utbedrer', en: 'We repair', es: 'Reparamos' },
  steg4_b: {
    no: 'Hvis noe trenger oppmerksomhet, får du tilbud på utbedring direkte. Du velger om vi gjør jobben eller ikke.',
    en: 'If something needs attention, you get a repair quote directly. You choose whether we do the work or not.',
    es: 'Si algo necesita atención, recibes un presupuesto de reparación directamente. Tú eliges si hacemos el trabajo o no.',
  },

  footer_tagline: { no: 'BOLIGINSPEKSJON · LEGANGER & OSVAAG EIENDOM', en: 'HOME INSPECTION · LEGANGER & OSVAAG EIENDOM', es: 'INSPECCIÓN DE VIVIENDA · LEGANGER & OSVAAG EIENDOM' },
} satisfies Record<string, Ord>

export type InspNokkel = keyof typeof TEKSTER

export function tInsp(sprak: InspSprak, nokkel: InspNokkel, vars?: Record<string, string | number>): string {
  let s = TEKSTER[nokkel][sprak] || TEKSTER[nokkel].no
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}

const STORAGE_NOKKEL = 'insp-sprak'

export function lestInspSprak(): InspSprak {
  if (typeof window === 'undefined') return 'no'
  const lagret = window.localStorage.getItem(STORAGE_NOKKEL)
  if (lagret === 'no' || lagret === 'en' || lagret === 'es') return lagret
  const nettleser = navigator.language?.slice(0, 2).toLowerCase()
  if (nettleser === 'en') return 'en'
  if (nettleser === 'es') return 'es'
  return 'no'
}

export function lagreInspSprak(s: InspSprak): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_NOKKEL, s)
}
