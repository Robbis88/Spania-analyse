'use client'
import type { Prosjekt } from '../types'
import { fmt, statusFarge } from '../lib/styles'
import { totalInvestering } from '../lib/beregninger'

export function BoligListe({
  liste, tomTekst, farge, onÅpne, onSlett,
}: {
  liste: Prosjekt[]
  tomTekst: string
  farge: string
  onÅpne: (id: string) => void
  onSlett: (id: string) => void
}) {
  if (liste.length === 0) {
    return (
      <div style={{ background: '#f8f8f8', border: '2px dashed #ddd', borderRadius: 6, padding: 40, textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{tomTekst}</div>
        <div style={{ fontSize: 13 }}>Gå til Boliganalyse for å legge til en bolig</div>
      </div>
    )
  }
  return (
    <div>
      {liste.map(p => {
        const sf = statusFarge(p.status)
        return (
          <div key={p.id} style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{p.navn}</div>
                <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                {p.dato_kjopt && <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>Kjøpt: {p.dato_kjopt}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onÅpne(p.id)} style={{ background: farge, color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Åpne</button>
                <button onClick={() => onSlett(p.id)} style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Slett</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Kjøpesum</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(p.kjøpesum)}</div>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Total investert</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(totalInvestering(p))}</div>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Kategori</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
