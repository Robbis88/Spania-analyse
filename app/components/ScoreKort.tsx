'use client'

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
  const lysBorder = s.lys === '🟢' ? '#2D7D46' : s.lys === '🟡' ? '#B05E0A' : '#C8102E'
  const lysText = s.lys === '🟢' ? '#1a4d2b' : s.lys === '🟡' ? '#6b3a0a' : '#7a0c1e'

  return (
    <div style={{ background: lysBg, border: `2px solid ${lysBorder}`, borderRadius: 8, padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 56 }}>{s.lys}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: lysText }}>{s.lysTekst}</div>
          <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{s.lysInfo}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: lysText }}>{s.total}</div>
          <div style={{ fontSize: 12, color: '#888' }}>/ 10</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { lbl: '📍 Lokasjon', val: s.lokasjon }, { lbl: '🏠 Eiendom', val: s.eiendom },
          { lbl: '💰 Pris vs marked', val: s.pris_vs_marked }, { lbl: '📈 Airbnb', val: s.airbnb_potensial },
          { lbl: '💸 Cashflow', val: s.cashflow }, { lbl: '🔨 Oppussing', val: s.oppussing_potensial },
          { lbl: '⚠️ Risiko', val: s.risiko },
        ].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#B05E0A' : '#C8102E' }}>{item.val}</div>
            <div style={{ background: '#e0e0e0', borderRadius: 3, height: 4, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ width: `${item.val * 10}%`, height: 4, background: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#EF9F27' : '#C8102E', borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[{ lbl: 'Brutto år 1', val: fmt(s.brutto_ar1) }, { lbl: 'Brutto etablert', val: fmt(s.brutto_etablert) }, { lbl: 'Netto estimat', val: fmt(s.netto_estimat) }].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2D7D46' }}>{item.val}</div>
          </div>
        ))}
      </div>
      {(s.maks_oppussing_5pst > 0 || s.maks_oppussing_6pst > 0 || s.maks_oppussing_7pst > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 6, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🔨 Maks oppussingsbudsjett</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[{ lbl: 'Ved 5% yield', val: s.maks_oppussing_5pst }, { lbl: 'Ved 6% yield', val: s.maks_oppussing_6pst }, { lbl: 'Ved 7% yield', val: s.maks_oppussing_7pst }].map((item, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.val > 0 ? '#2D7D46' : '#C8102E' }}>{fmt(item.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.tips && s.tips.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 6, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💡 Hva må til for grønn?</div>
          {s.tips.map((t, i) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>→ {t}</div>
          ))}
        </div>
      )}
    </div>
  )
}
