'use client'
import type { Prosjekt } from '../types'
import { fmt, statusFarge, FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
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
      <div style={{
        background: FARGER.hvit,
        border: `1px dashed ${FARGER.gull}55`,
        borderRadius: RADIUS.lg,
        padding: 48, textAlign: 'center', color: FARGER.tekstMid,
      }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: FARGER.mork, letterSpacing: '-0.005em' }}>{tomTekst}</div>
        <div style={{ fontSize: 13 }}>Gå til Boliganalyse for å legge til en bolig</div>
      </div>
    )
  }
  return (
    <div>
      {liste.map((p, i) => {
        const sf = statusFarge(p.status)
        return (
          <div key={p.id}
            className="kort-loft anim-fade-up"
            style={{
              background: FARGER.hvit,
              border: `1px solid ${FARGER.kantUltralys}`,
              borderRadius: RADIUS.lg,
              padding: 22, marginBottom: 14,
              boxShadow: SHADOW.sm,
              animationDelay: `${Math.min(i, 8) * 40}ms`,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: FARGER.mork, letterSpacing: '-0.015em' }}>{p.navn}</div>
                <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: RADIUS.pill, letterSpacing: '-0.005em' }}>{p.status}</span>
                {p.dato_kjopt && <span style={{ fontSize: 12, color: FARGER.tekstLys, marginLeft: 10 }}>Kjøpt: {p.dato_kjopt}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onÅpne(p.id)} className="knapp-hover-loft" style={{
                  background: farge, color: FARGER.creamLys, border: 'none',
                  borderRadius: RADIUS.pill, padding: '8px 18px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '-0.005em',
                  boxShadow: SHADOW.sm,
                  transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                }}>Åpne</button>
                <button onClick={() => onSlett(p.id)} style={{
                  background: FARGER.feilBg, color: FARGER.feil,
                  border: 'none', borderRadius: RADIUS.pill,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '-0.005em',
                  transition: `background ${MOTION.rask}`,
                }}>Slett</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 12 }}>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Kjøpesum</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.01em' }}>{fmt(p.kjøpesum)}</div>
              </div>
              <div style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 12 }}>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Total investert</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.01em' }}>{fmt(totalInvestering(p))}</div>
              </div>
              <div style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 12 }}>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Kategori</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.01em' }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
