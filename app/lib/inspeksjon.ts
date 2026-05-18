// Konstanter og typer for boliginspeksjons-tjenesten.
// Holdes adskilt fra portal-typene siden dette er en separat tjeneste.

export const STORRELSE = ['1-rom', '2-rom', '3-rom', '4-rom', 'villa'] as const
export type Storrelse = typeof STORRELSE[number]

export const STORRELSE_ETIKETT: Record<Storrelse, string> = {
  '1-rom': '1-roms leilighet',
  '2-rom': '2-roms leilighet',
  '3-rom': '3-roms leilighet',
  '4-rom': '4-roms leilighet / penthouse',
  'villa': 'Villa / rekkehus',
}

export const TJENESTE_TYPE = ['engangs', 'manedlig_visuell', 'kvartalsvis_grundig'] as const
export type TjenesteType = typeof TJENESTE_TYPE[number]

export const TJENESTE_ETIKETT: Record<TjenesteType, string> = {
  engangs: 'Engangs grundig inspeksjon',
  manedlig_visuell: 'Månedlig visuell sjekk (abonnement)',
  kvartalsvis_grundig: 'Kvartalsvis grundig (abonnement)',
}

export const TJENESTE_BESKRIVELSE: Record<TjenesteType, string> = {
  engangs: 'Full grundig sjekk av bad, kjøkken, terrasse, varmt-/kaldtvann, elektrisk, ventilasjon og generell tilstand. Skriftlig rapport med foto og prioriterte anbefalinger.',
  manedlig_visuell: 'Kort visuell sjekk hver måned (~20 min) — lekkasje-tegn, fukt, vinduer, dører, balkong. Rapport med foto. Bra for trygghet ved langtidsleie eller når du ikke bor i leiligheten selv.',
  kvartalsvis_grundig: 'Grundig sjekk hvert kvartal med fukt-måling og kontroll av kritiske punkter. Skriftlig rapport. Sparer deg fra dyre overraskelser.',
}

// Basispris per størrelse — engangs-pris i €.
// Modell 1 fra anbefalingen: lav inspeksjons-pris, høyere margin på utbedringer.
export const BASIS_PRIS_EUR: Record<Storrelse, number> = {
  '1-rom': 60,
  '2-rom': 80,
  '3-rom': 110,
  '4-rom': 140,
  'villa': 220,
}

// Multiplikator for tjeneste-type. Månedlig er rabattert per gang siden
// volumet kompenserer; kvartalsvis er litt under engangs siden gjentakelsen
// gjør jobben mer effektiv (kjenner leiligheten).
export const TJENESTE_FAKTOR: Record<TjenesteType, number> = {
  engangs: 1.0,
  manedlig_visuell: 0.40,        // ~20 min visuell — billig per gang
  kvartalsvis_grundig: 0.85,      // grundig hver 3. måned
}

export function beregnPris(storrelse: Storrelse, tjeneste: TjenesteType): number {
  return Math.round(BASIS_PRIS_EUR[storrelse] * TJENESTE_FAKTOR[tjeneste])
}

// Status-flyt for bestillinger
export const BESTILLING_STATUS = ['ny', 'planlagt', 'utfort', 'tilbud_sendt', 'avsluttet', 'avlyst'] as const
export type BestillingStatus = typeof BESTILLING_STATUS[number]

export const BESTILLING_STATUS_ETIKETT: Record<BestillingStatus, { lbl: string; bg: string; tekst: string }> = {
  ny:           { lbl: 'Ny', bg: '#fff8e1', tekst: '#7a4a08' },
  planlagt:     { lbl: 'Planlagt', bg: '#e8f0fe', tekst: '#1a3a6e' },
  utfort:       { lbl: 'Utført', bg: '#e8f5ed', tekst: '#1a4d2b' },
  tilbud_sendt: { lbl: 'Tilbud sendt', bg: '#faf7ee', tekst: '#7a4a08' },
  avsluttet:    { lbl: 'Avsluttet', bg: '#f0ede5', tekst: '#5a6171' },
  avlyst:       { lbl: 'Avlyst', bg: '#fde8ec', tekst: '#7a0c1e' },
}

// Sjekkliste-kategorier som inspektøren krysser av per besøk.
export const SJEKK_KATEGORIER = [
  { id: 'bad',        lbl: '🛁 Bad', felter: ['Fugemasse', 'Avløp', 'Vannkraner', 'Toalett', 'Lekkasje under vask', 'Fuktskader på vegger/tak'] },
  { id: 'kjokken',    lbl: '🍳 Kjøkken', felter: ['Avløp', 'Vannkraner', 'Oppvaskmaskin', 'Komfyr/ovn', 'Ventilator', 'Lekkasje under benk'] },
  { id: 'terrasse',   lbl: '🌅 Terrasse / balkong', felter: ['Fliser', 'Avrenning/sluk', 'Rekkverk', 'Vann-tetning vegger', 'Møbler/marker'] },
  { id: 'vinduer',    lbl: '🪟 Vinduer og dører', felter: ['Tetninger', 'Hengsler', 'Lås', 'Glass (sprekker?)'] },
  { id: 'elektrisk',  lbl: '⚡ Elektrisk', felter: ['Stikkontakter', 'Lyspunkter', 'Sikringsskap', 'Jordfeilbryter'] },
  { id: 'ventilasjon',lbl: '🌬️ Ventilasjon', felter: ['Avtrekk bad', 'Avtrekk kjøkken', 'Friskluftventiler', 'Fuktdamp/kondens'] },
  { id: 'felles',     lbl: '🏢 Fellesarealer (utenfor leil.)', felter: ['Inngangsparti', 'Heis', 'Tilstand bygningsmasse'] },
] as const

export type SjekkpunktStatus = 'ok' | 'merknad' | 'kritisk' | 'ikke_aktuelt'

export type SjekkpunktVerdi = {
  status: SjekkpunktStatus
  notat?: string
}

export type Sjekkliste = Record<string, SjekkpunktVerdi>

export const STATUS_FARGE: Record<SjekkpunktStatus, { bg: string; tekst: string; ikon: string }> = {
  ok:           { bg: '#e8f5ed', tekst: '#1a4d2b', ikon: '✓' },
  merknad:      { bg: '#fff8e1', tekst: '#7a4a08', ikon: '⚠️' },
  kritisk:      { bg: '#fde8ec', tekst: '#7a0c1e', ikon: '⛔' },
  ikke_aktuelt: { bg: '#f0ede5', tekst: '#5a6171', ikon: '—' },
}
