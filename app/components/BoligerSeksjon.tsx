'use client'
import { useProsjekter } from '../lib/useProsjekter'
import { BoligListe } from './BoligListe'

export function BoligerSeksjon({
  kategori, onTilbake, onÅpneProsjekt,
}: {
  kategori: 'flipp' | 'utleie'
  onTilbake: () => void
  onÅpneProsjekt: (id: string) => void
}) {
  const { prosjekter, laster, slett } = useProsjekter()
  const liste = prosjekter.filter(p => p.kategori === kategori)

  const meta = kategori === 'flipp'
    ? { emoji: '🔨', tittel: 'Boligflipp', farge: '#185FA5', tomTekst: 'Ingen flipp-prosjekter ennå', suffix: 'prosjekt' }
    : { emoji: '🏖️', tittel: 'Boligutleie', farge: '#2D7D46', tomTekst: 'Ingen utleieboliger ennå', suffix: 'utleiebolig' }

  async function slettMedBekreftelse(id: string) {
    if (!confirm('Er du sikker?')) return
    await slett(id)
  }

  return (
    <div>
      <button onClick={onTilbake} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 36 }}>{meta.emoji}</div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{meta.tittel}</h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>{liste.length} {meta.suffix}{liste.length !== 1 ? 'er' : ''}</p>
        </div>
      </div>
      {laster ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div>
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
