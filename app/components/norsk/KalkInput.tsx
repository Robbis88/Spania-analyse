'use client'
import { FARGER, RADIUS } from '../../lib/styles'

// Felles tall-input for kalkulator-felter. Brukes både i Kalkulator-,
// SalgEgenBolig- og Finansiering-komponentene.
export function KalkInput({ lbl, val, onChange, step = 1000 }: { lbl: string; val: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>{lbl}</label>
      <input type="number" min={0} step={step} value={val || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white', boxSizing: 'border-box' }} />
    </div>
  )
}
