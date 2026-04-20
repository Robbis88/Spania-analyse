import type { CSSProperties } from 'react'

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
