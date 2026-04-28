import type { CSSProperties } from 'react'

// Design-tokens — luksus-minimalistisk palett som samsvarer med utleie-portalen.
// Bruk disse når du skriver nye stiler så får appen en konsistent identitet.
export const FARGER = {
  // Brand
  mork: '#0e1726',         // dyp navy — primærfarge
  cream: '#fafaf6',        // mykt off-white — bakgrunn
  creamLys: '#fdfcf7',     // enda lysere — kort/paneler
  gull: '#b89a6f',         // varm gull — aksent
  gullSvak: 'rgba(184, 154, 111, 0.22)',
  // Handlingsfarger
  primar: '#0e1726',
  sekundar: '#5a6171',
  suksess: '#2D7D46',
  advarsel: '#B05E0A',
  feil: '#C8102E',
  lilla: '#6a4c93',
  // Tekst
  tekstMork: '#0e1726',
  tekstMid: '#5a6171',
  tekstLys: '#888',
  tekstSvak: '#aaa',
  // Bakgrunner
  hvit: '#fff',
  flateLys: '#faf7ee',
  flateMid: '#f0ede5',
  kantLys: '#e8e4d8',
  kant: '#d4d0c4',
  // Tilbakemeldingsbokser
  suksessBg: '#e8f5ed',
  advarselBg: '#fff8e1',
  feilBg: '#fde8ec',
  infoBg: '#faf7ee',
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

// Mer minimalistisk stil — mindre rounding for ro
export const RADIUS = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
} as const

export const SHADOW = {
  liten: '0 2px 8px rgba(0,0,0,0.04)',
  mid: '0 4px 14px rgba(0,0,0,0.06)',
  stor: '0 16px 48px rgba(0,0,0,0.12)',
} as const

export const BREAKPOINT = {
  mobil: 640,
  tablet: 900,
} as const

export const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: RADIUS.sm,
  border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: FARGER.hvit,
}

export const selectStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: RADIUS.sm,
  border: `1px solid ${FARGER.kant}`, background: FARGER.hvit,
}

export const labelStyle: CSSProperties = {
  fontSize: 11, color: FARGER.tekstMid, marginBottom: 5, display: 'block',
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
}

export const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column' }

export const prioritetFarge = (ep: string, status: string) => {
  if (status === 'ferdig') return { bg: '#e8f5ed', border: '#2D7D46', color: '#2D7D46' }
  if (ep === 'hast') return { bg: '#fde8ec', border: '#C8102E', color: '#C8102E' }
  if (ep === 'normal') return { bg: '#fff8e1', border: '#B05E0A', color: '#B05E0A' }
  return { bg: FARGER.flateLys, border: FARGER.kantLys, color: FARGER.tekstMid }
}

export const prioritetLabel = (ep: string) =>
  ep === 'hast' ? '🔴 Hast' : ep === 'normal' ? '🟡 Normal' : '⚪ Lav'

export const statusFarge = (s: string) => {
  if (s === 'Utleie') return { bg: '#e8f5ed', color: '#2D7D46' }
  if (s === 'Kjøpt') return { bg: FARGER.flateLys, color: FARGER.gull }
  if (s === 'Under oppussing') return { bg: '#fff8e1', color: '#B05E0A' }
  if (s === 'Solgt') return { bg: FARGER.flateMid, color: FARGER.tekstMid }
  return { bg: '#fde8ec', color: '#C8102E' }
}

export const fmt = (n: number) =>
  n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'

export const fmtPct = (n: number) =>
  n ? n.toFixed(1) + '%' : '–'

// Felles knapp-stiler — bruk disse i stedet for å hardkode farger.
export const knappPrimar: CSSProperties = {
  background: FARGER.mork, color: FARGER.creamLys, border: 'none',
  padding: '12px 22px', fontSize: 12, fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  cursor: 'pointer', borderRadius: RADIUS.sm,
}

export const knappSekundar: CSSProperties = {
  background: 'transparent', color: FARGER.mork,
  border: `1px solid ${FARGER.gull}55`,
  padding: '11px 22px', fontSize: 12, fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  cursor: 'pointer', borderRadius: RADIUS.sm,
}

export const knappFare: CSSProperties = {
  background: FARGER.feilBg, color: FARGER.feil,
  border: 'none', padding: '8px 14px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', borderRadius: RADIUS.sm,
}

export const seksjonsTittel: CSSProperties = {
  fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em',
  fontWeight: 700, marginBottom: 12, textTransform: 'uppercase',
}

export const headlineStor: CSSProperties = {
  fontSize: 32, fontWeight: 300, color: FARGER.mork,
  margin: 0, letterSpacing: '-0.01em', lineHeight: 1.15,
}

export const kortFlate: CSSProperties = {
  background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`,
  borderRadius: RADIUS.sm, padding: SPACING.xl,
}
