'use client'
import { FARGER, RADIUS, SHADOW } from '../lib/styles'

export type Score = {
  lys: '🟢' | '🟡' | '🔴'
  lysTekst: string
  lysInfo: string
  total: number
  lokasjon: number
  eiendom: number
  pris_vs_marked: number
  airbnb_potensial: number
  cashflow: number
  oppussing_potensial: number
  risiko: number
  brutto_ar1: number
  brutto_etablert: number
  netto_estimat: number
  maks_oppussing_5pst: number
  maks_oppussing_6pst: number
  maks_oppussing_7pst: number
  tips?: string[]
}

export function ScoreKort({ s }: { s: Score }) {
  const fmt = (n: number) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'
  const lysBg = s.lys === '🟢' ? '#e8f5ed' : s.lys === '🟡' ? '#fff8e1' : '#fde8ec'
  const lysBorder = s.lys === '🟢' ? '#2D7D4633' : s.lys === '🟡' ? '#B05E0A44' : '#C8102E44'
  const lysText = s.lys === '🟢' ? '#1a4d2b' : s.lys === '🟡' ? '#6b3a0a' : '#7a0c1e'

  return (
    <div className="anim-fade-up" style={{
      background: lysBg,
      border: `1px solid ${lysBorder}`,
      borderRadius: RADIUS.xl,
      padding: 28,
      marginBottom: 20,
      boxShadow: SHADOW.md,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 56 }}>{s.lys}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: lysText, letterSpacing: '-0.02em' }}>{s.lysTekst}</div>
          <div style={{ fontSize: 14, color: FARGER.tekstMid, marginTop: 6, lineHeight: 1.55 }}>{s.lysInfo}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 600, color: lysText, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.total}</div>
          <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 4 }}>/ 10</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { lbl: '📍 Lokasjon', val: s.lokasjon }, { lbl: '🏠 Eiendom', val: s.eiendom },
          { lbl: '💰 Pris vs marked', val: s.pris_vs_marked }, { lbl: '📈 Airbnb', val: s.airbnb_potensial },
          { lbl: '💸 Cashflow', val: s.cashflow }, { lbl: '🔨 Oppussing', val: s.oppussing_potensial },
          { lbl: '⚠️ Risiko', val: s.risiko },
        ].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.md, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 6, letterSpacing: '0.04em' }}>{item.lbl}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#B05E0A' : '#C8102E', letterSpacing: '-0.02em', lineHeight: 1 }}>{item.val}</div>
            <div style={{ background: 'rgba(14, 23, 38, 0.08)', borderRadius: RADIUS.pill, height: 4, marginTop: 8, overflow: 'hidden' }}>
              <div style={{ width: `${item.val * 10}%`, height: 4, background: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#EF9F27' : '#C8102E', borderRadius: RADIUS.pill, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        {[{ lbl: 'Brutto år 1', val: fmt(s.brutto_ar1) }, { lbl: 'Brutto etablert', val: fmt(s.brutto_etablert) }, { lbl: 'Netto estimat', val: fmt(s.netto_estimat) }].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.9)', borderRadius: RADIUS.md, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 6, letterSpacing: '0.04em' }}>{item.lbl}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#2D7D46', letterSpacing: '-0.015em' }}>{item.val}</div>
          </div>
        ))}
      </div>
      {(s.maks_oppussing_5pst > 0 || s.maks_oppussing_6pst > 0 || s.maks_oppussing_7pst > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: RADIUS.md, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: FARGER.mork, letterSpacing: '-0.005em' }}>🔨 Maks oppussingsbudsjett</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[{ lbl: 'Ved 5% yield', val: s.maks_oppussing_5pst }, { lbl: 'Ved 6% yield', val: s.maks_oppussing_6pst }, { lbl: 'Ved 7% yield', val: s.maks_oppussing_7pst }].map((item, i) => (
              <div key={i} style={{ background: FARGER.hvit, borderRadius: RADIUS.md, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 5 }}>{item.lbl}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: item.val > 0 ? '#2D7D46' : '#C8102E', letterSpacing: '-0.015em' }}>{fmt(item.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.tips && s.tips.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: FARGER.mork, letterSpacing: '-0.005em' }}>💡 Hva må til for grønn?</div>
          {s.tips.map((t, i) => (
            <div key={i} style={{ fontSize: 13.5, padding: '6px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', color: FARGER.tekstMid, lineHeight: 1.5 }}>→ {t}</div>
          ))}
        </div>
      )}
    </div>
  )
}
