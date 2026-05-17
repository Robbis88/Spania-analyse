import type { CSSProperties } from 'react'

// Design-tokens — luksus-minimalistisk palett som samsvarer med utleie-portalen.
// Bruk disse når du skriver nye stiler så får appen en konsistent identitet.
// Stilen er inspirert av Apple/Airbnb: myk rounding, lagvise skygger og generøs luft.
export const FARGER = {
  // Brand
  mork: '#0e1726',         // dyp navy — primærfarge
  morkSvak: '#1a2638',     // litt lysere navy — hover/aktiv
  cream: '#fafaf6',        // mykt off-white — bakgrunn
  creamLys: '#fdfcf7',     // enda lysere — kort/paneler
  gull: '#b89a6f',         // varm gull — aksent
  gullSvak: 'rgba(184, 154, 111, 0.18)',
  gullVarm: '#cdb087',     // lysere gull — hover
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
  kantLys: '#ece8dc',
  kant: '#d4d0c4',
  kantUltralys: 'rgba(14, 23, 38, 0.06)',
  // Tilbakemeldingsbokser
  suksessBg: '#e8f5ed',
  advarselBg: '#fff8e1',
  feilBg: '#fde8ec',
  infoBg: '#faf7ee',
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
  xxxl: 64,
} as const

// Apple/Airbnb-inspirert: store, myke radier på kort og knapper.
export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  pill: 999,
} as const

// Lagvise, myke skygger — kombinerer to lag for å gi dybde uten støy.
export const SHADOW = {
  ingen: 'none',
  xs: '0 1px 2px rgba(14, 23, 38, 0.04)',
  sm: '0 1px 2px rgba(14, 23, 38, 0.04), 0 2px 6px rgba(14, 23, 38, 0.04)',
  md: '0 2px 4px rgba(14, 23, 38, 0.04), 0 8px 24px rgba(14, 23, 38, 0.06)',
  lg: '0 4px 8px rgba(14, 23, 38, 0.04), 0 16px 40px rgba(14, 23, 38, 0.08)',
  xl: '0 8px 16px rgba(14, 23, 38, 0.06), 0 24px 60px rgba(14, 23, 38, 0.12)',
  // Bakoverkompatibilitet
  liten: '0 1px 2px rgba(14, 23, 38, 0.04), 0 2px 6px rgba(14, 23, 38, 0.04)',
  mid: '0 2px 4px rgba(14, 23, 38, 0.04), 0 8px 24px rgba(14, 23, 38, 0.06)',
  stor: '0 8px 16px rgba(14, 23, 38, 0.06), 0 24px 60px rgba(14, 23, 38, 0.12)',
  // Hover-skygge for kort som løftes
  hover: '0 8px 20px rgba(14, 23, 38, 0.08), 0 24px 64px rgba(14, 23, 38, 0.12)',
  // Fokus-ring (subtil indre + ytre)
  fokus: '0 0 0 3px rgba(184, 154, 111, 0.25)',
} as const

// Easing-kurver og varigheter — Apple-aktig "smooth-out".
export const MOTION = {
  rask: '160ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '240ms cubic-bezier(0.4, 0, 0.2, 1)',
  treg: '380ms cubic-bezier(0.4, 0, 0.2, 1)',
  fjær: '420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
  fjærEase: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

export const BREAKPOINT = {
  mobil: 640,
  tablet: 900,
} as const

export const inputStyle: CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: RADIUS.md,
  border: `1px solid ${FARGER.kant}`, fontFamily: 'inherit', background: FARGER.hvit,
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
  outline: 'none',
}

export const selectStyle: CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: RADIUS.md,
  border: `1px solid ${FARGER.kant}`, background: FARGER.hvit,
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
  outline: 'none',
}

export const labelStyle: CSSProperties = {
  fontSize: 11, color: FARGER.tekstMid, marginBottom: 6, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
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
  padding: '13px 24px', fontSize: 13, fontWeight: 600,
  letterSpacing: '0.04em',
  cursor: 'pointer', borderRadius: RADIUS.pill,
  transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}, background ${MOTION.rask}`,
  boxShadow: SHADOW.sm,
}

export const knappSekundar: CSSProperties = {
  background: FARGER.hvit, color: FARGER.mork,
  border: `1px solid ${FARGER.kant}`,
  padding: '12px 22px', fontSize: 13, fontWeight: 600,
  letterSpacing: '0.04em',
  cursor: 'pointer', borderRadius: RADIUS.pill,
  transition: `border-color ${MOTION.rask}, background ${MOTION.rask}, box-shadow ${MOTION.rask}`,
}

export const knappFare: CSSProperties = {
  background: FARGER.feilBg, color: FARGER.feil,
  border: 'none', padding: '10px 16px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', borderRadius: RADIUS.pill,
  transition: `background ${MOTION.rask}`,
}

export const seksjonsTittel: CSSProperties = {
  fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em',
  fontWeight: 700, marginBottom: 14, textTransform: 'uppercase',
}

export const headlineStor: CSSProperties = {
  fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 300, color: FARGER.mork,
  margin: 0, letterSpacing: '-0.02em', lineHeight: 1.12,
}

export const kortFlate: CSSProperties = {
  background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
  borderRadius: RADIUS.lg, padding: SPACING.xl,
  boxShadow: SHADOW.sm,
}

// Konvensjon for stort kort med soft-shadow og generøs padding.
export const kortStort: CSSProperties = {
  background: FARGER.hvit,
  borderRadius: RADIUS.xl,
  padding: SPACING.xxl,
  boxShadow: SHADOW.md,
  border: `1px solid ${FARGER.kantUltralys}`,
}
