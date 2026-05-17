'use client'
import { useProsjekter } from '../lib/useProsjekter'
import { BoligListe } from './BoligListe'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

export function BoligerSeksjon({
  kategori, onTilbake, onÅpneProsjekt,
}: {
  kategori: 'flipp' | 'utleie'
  onTilbake: () => void
  onÅpneProsjekt: (id: string) => void
}) {
  // Filtrerer kategori server-side så vi ikke laster ned alle Spania-prosjekter for så å kaste halvparten
  const { prosjekter: liste, laster, slett } = useProsjekter(kategori)

  const meta = kategori === 'flipp'
    ? { emoji: '🔨', tittel: 'Boligflipp', farge: FARGER.mork, tomTekst: 'Ingen flipp-prosjekter ennå', suffix: 'prosjekt' }
    : { emoji: '🏖️', tittel: 'Boligutleie', farge: '#2D7D46', tomTekst: 'Ingen utleieboliger ennå', suffix: 'utleiebolig' }

  async function slettMedBekreftelse(id: string) {
    if (!confirm('Er du sikker?')) return
    await slett(id)
  }

  return (
    <div>
      <button onClick={onTilbake} className="nav-lenke" style={{
        background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
        borderRadius: RADIUS.pill, padding: '8px 16px 8px 12px',
        fontSize: 13, cursor: 'pointer', marginBottom: 22,
        color: FARGER.tekstMid, fontWeight: 500,
        boxShadow: SHADOW.xs,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        letterSpacing: '-0.005em',
        transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
      }}>
        <span aria-hidden>←</span> Tilbake
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ fontSize: 40 }}>{meta.emoji}</div>
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>{meta.tittel}</h2>
          <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14 }}>{liste.length} {meta.suffix}{liste.length !== 1 ? 'er' : ''}</p>
        </div>
      </div>
      {laster ? (
        <div>
          {[0, 1].map(i => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 14, boxShadow: SHADOW.sm }}>
              <div className="skimmer" style={{ height: 20, width: '40%', marginBottom: 14, borderRadius: 4 }} />
              <div className="skimmer" style={{ height: 60, borderRadius: RADIUS.md }} />
            </div>
          ))}
        </div>
      ) : (
        <BoligListe
          liste={liste}
          tomTekst={meta.tomTekst}
          farge={meta.farge}
          onÅpne={onÅpneProsjekt}
          onSlett={slettMedBekreftelse}
        />
      )}
    </div>
  )
}
