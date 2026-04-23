import type { CSSProperties } from 'react'

// Design-tokens. Bruk disse når du skriver nye stiler så får appen en konsistent palett.
export const FARGER = {
  // Brand
  mork: '#1a2a3e',
  cream: '#f8f5ee',
  creamLys: '#faf7f0',
  gull: '#c9a876',
  // Handlingsfarger
  primar: '#1a2a3e',
  sekundar: '#185FA5',
  suksess: '#2D7D46',
  advarsel: '#B05E0A',
  feil: '#C8102E',
  lilla: '#6a4c93',
  // Tekst
  tekstMork: '#1a2a3e',
  tekstMid: '#555',
  tekstLys: '#888',
  tekstSvak: '#aaa',
  // Bakgrunner
  hvit: '#fff',
  flateLys: '#f8f8f8',
  flateMid: '#f0f0f0',
  kantLys: '#eee',
  kant: '#ddd',
  // Farge-varianter for suksess/feil/info-bokser
  suksessBg: '#e8f5ed',
  advarselBg: '#fff8e1',
  feilBg: '#fde8ec',
  infoBg: '#f0f7ff',
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
} as const

export const SHADOW = {
  liten: '0 2px 8px rgba(0,0,0,0.04)',
  mid: '0 4px 14px rgba(0,0,0,0.06)',
  stor: '0 8px 40px rgba(0,0,0,0.15)',
} as const

export const BREAKPOINT = {
  mobil: 640,
  tablet: 900,
} as const

export const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8,
  border: '1.5px solid #ddd', fontFamily: 'sans-serif',
}

export const selectStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8,
  border: '1.5px solid #ddd',
}

export const labelStyle: CSSProperties = {
  fontSize: 12, color: '#666', marginBottom: 5, display: 'block',
}

export const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column' }

export const prioritetFarge = (ep: string, status: string) => {
  if (status === 'ferdig') return { bg: '#e8f5ed', border: '#2D7D46', color: '#2D7D46' }
  if (ep === 'hast') return { bg: '#fde8ec', border: '#C8102E', color: '#C8102E' }
  if (ep === 'normal') return { bg: '#fff8e1', border: '#B05E0A', color: '#B05E0A' }
  return { bg: '#f8f8f8', border: '#ddd', color: '#666' }
}

export const prioritetLabel = (ep: string) =>
  ep === 'hast' ? '🔴 Hast' : ep === 'normal' ? '🟡 Normal' : '⚪ Lav'

export const statusFarge = (s: string) => {
  if (s === 'Utleie') return { bg: '#e8f5ed', color: '#2D7D46' }
  if (s === 'Kjøpt') return { bg: '#f0f7ff', color: '#185FA5' }
  if (s === 'Under oppussing') return { bg: '#fff8e1', color: '#B05E0A' }
  if (s === 'Solgt') return { bg: '#f0f0f0', color: '#666' }
  return { bg: '#fde8ec', color: '#C8102E' }
}

export const fmt = (n: number) =>
  n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'

export const fmtPct = (n: number) =>
  n ? n.toFixed(1) + '%' : '–'
