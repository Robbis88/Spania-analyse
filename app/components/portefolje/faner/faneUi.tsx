'use client'
// Felles UI-byggesteiner for portefølje-fanene (skjema-felt, knapper).

import { FARGER, RADIUS } from '../../../lib/styles'

export const fmtNok = (n: number | null | undefined) =>
  (n === null || n === undefined || !Number.isFinite(n) || n === 0) ? '–' : Math.round(n).toLocaleString('nb-NO') + ' kr'

export const fmtDato = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) : '–'

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function Felt({ lbl, full, children }: { lbl: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</label>
      {children}
    </div>
  )
}

export function SumKort({ lbl, verdi, farge }: { lbl: string; verdi: string; farge?: string }) {
  return (
    <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4 }}>{lbl}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: farge || FARGER.mork }}>{verdi}</div>
    </div>
  )
}

export const inputStil: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

export const knappStilPrimaer: React.CSSProperties = {
  background: FARGER.mork, color: '#fff', border: 'none', padding: '8px 16px',
  borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}

export const knappStilSekundaer: React.CSSProperties = {
  background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none', padding: '8px 14px',
  borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 600, cursor: 'pointer',
}

export const knappStilSlett: React.CSSProperties = {
  background: FARGER.feilBg, color: FARGER.feil, border: 'none', padding: '8px 12px',
  borderRadius: RADIUS.sm, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

export const knappStilNyttElement: React.CSSProperties = {
  background: FARGER.mork, color: '#fff', border: 'none',
  padding: '10px 18px', borderRadius: RADIUS.sm,
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
  letterSpacing: '0.08em', textTransform: 'uppercase',
  marginBottom: 18,
}

export function TomTilstand({ tekst }: { tekst: string }) {
  return (
    <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys, fontSize: 13, marginBottom: 16 }}>
      {tekst}
    </div>
  )
}
