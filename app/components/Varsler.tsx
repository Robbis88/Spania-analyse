'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW } from '../lib/styles'

type RangRad = { id: string; navn: string; marked: string; flagg: Array<{ farge: 'rod' | 'gul'; tekst: string }> }
type Varsel = { prosjektId: string; navn: string; marked: string; farge: 'rod' | 'gul'; tekst: string }

export function Varsler({ onÅpne }: { onÅpne?: (id: string) => void }) {
  const [rang, setRang] = useState<RangRad[]>([])
  const [laster, setLaster] = useState(true)
  const [filter, setFilter] = useState<'alle' | 'rod' | 'gul'>('alle')

  useEffect(() => {
    fetch('/api/portefolje-rangering').then(r => r.json())
      .then(d => setRang(d.rader || []))
      .catch(() => {})
      .finally(() => setLaster(false))
  }, [])

  const varsler = useMemo<Varsel[]>(() => {
    const ut: Varsel[] = []
    for (const r of rang) for (const f of r.flagg) ut.push({ prosjektId: r.id, navn: r.navn, marked: r.marked, farge: f.farge, tekst: f.tekst })
    // Røde først
    return ut.sort((a, b) => (a.farge === b.farge ? 0 : a.farge === 'rod' ? -1 : 1))
  }, [rang])

  const vist = varsler.filter(v => filter === 'alle' || v.farge === filter)
  const antRod = varsler.filter(v => v.farge === 'rod').length
  const antGul = varsler.filter(v => v.farge === 'gul').length

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 300, color: FARGER.mork, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Varsler</h1>
      <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '0 0 20px' }}>
        {antRod} røde · {antGul} gule flagg. Beregnes fra porteføljen ved lesing — ingen bakgrunnsjobber.
      </p>

      <div style={{ display: 'inline-flex', gap: 4, background: FARGER.hvit, padding: 4, borderRadius: RADIUS.pill, border: `1px solid ${FARGER.kantLys}`, marginBottom: 20 }}>
        {(['alle', 'rod', 'gul'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? FARGER.mork : 'transparent', color: filter === f ? FARGER.creamLys : FARGER.tekstMid, border: 'none', borderRadius: RADIUS.pill, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'alle' ? 'Alle' : f === 'rod' ? 'Røde' : 'Gule'}
          </button>
        ))}
      </div>

      {laster ? (
        <div style={{ padding: 30, color: FARGER.tekstLys }}>Laster varsler…</div>
      ) : vist.length === 0 ? (
        <div style={{ background: FARGER.suksessBg, border: `1px solid ${FARGER.suksess}44`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: '#1a4d2b', fontSize: 14 }}>
          ✓ Ingen {filter === 'alle' ? '' : filter === 'rod' ? 'røde ' : 'gule '}flagg. Alt ser bra ut.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {vist.map((v, i) => (
            <button key={i} onClick={() => onÅpne?.(v.prosjektId)}
              style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderLeft: `4px solid ${v.farge === 'rod' ? FARGER.feil : FARGER.advarsel}`, borderRadius: RADIUS.md, padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, boxShadow: SHADOW.xs }}>
              <span style={{ fontSize: 16 }}>{v.farge === 'rod' ? '🔴' : '🟡'}</span>
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>{v.navn}</span>
                <span style={{ fontSize: 13, color: FARGER.tekstMid, display: 'block' }}>{v.tekst}</span>
              </span>
              <span style={{ fontSize: 11, color: FARGER.tekstLys }}>{v.marked === 'norge' ? '🇳🇴' : '🇪🇸'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
