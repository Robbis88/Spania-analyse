'use client'
import { useEffect, useState } from 'react'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle } from '../lib/styles'
import { medDefaults } from '../lib/skatteprofil'
import type { Selskap } from '../types'

type FeltType = 'pst' | 'mnd' | 'bool'
type FeltDef = { key: string; lbl: string; type: FeltType }

const FELT_NORGE: FeltDef[] = [
  { key: 'gevinstskatt_pst', lbl: 'Gevinstskatt ved salg', type: 'pst' },
  { key: 'dokumentavgift_pst', lbl: 'Dokumentavgift', type: 'pst' },
  { key: 'botid_fritak_mnd', lbl: 'Botid for skattefritak', type: 'mnd' },
  { key: 'utleie_skatt_pst', lbl: 'Skatt på utleie', type: 'pst' },
]
const FELT_SPANIA: FeltDef[] = [
  { key: 'gevinst_eu_pst', lbl: 'Gevinstskatt (EU-residens)', type: 'pst' },
  { key: 'gevinst_ikke_eu_pst', lbl: 'Gevinstskatt (ikke-EU)', type: 'pst' },
  { key: 'retention_pst', lbl: 'Kildeskatt (retention)', type: 'pst' },
  { key: 'vft_krav', lbl: 'VFT-lisens kreves', type: 'bool' },
]

type Rad = Omit<Selskap, 'skatteprofil'> & { skatteprofil: Record<string, number | boolean> }

export function Selskaper() {
  const [list, setList] = useState<Rad[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState<string | null>(null)
  const [lagret, setLagret] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/selskaper')
      .then(r => r.json())
      .then((d: { selskaper?: Selskap[]; feil?: string }) => {
        if (d.feil) { setFeil(d.feil); return }
        const rader = (d.selskaper || []).map(s => ({
          ...s,
          skatteprofil: medDefaults(s.land, s.skatteprofil) as Record<string, number | boolean>,
        }))
        setList(rader)
      })
      .catch(() => setFeil('Kunne ikke hente selskaper'))
      .finally(() => setLaster(false))
  }, [])

  function settFelt(id: string, key: string, verdi: number | boolean) {
    setList(prev => prev.map(s => s.id === id ? { ...s, skatteprofil: { ...s.skatteprofil, [key]: verdi } } : s))
  }
  function settNavn(id: string, navn: string) {
    setList(prev => prev.map(s => s.id === id ? { ...s, navn } : s))
  }

  async function lagre(rad: Rad) {
    setLagrer(rad.id)
    setLagret(null)
    try {
      const r = await fetch('/api/selskaper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rad.id, navn: rad.navn, skatteprofil: rad.skatteprofil }),
      })
      const d = await r.json()
      if (!r.ok || d.feil) { setFeil(d.feil || 'Lagring feilet'); return }
      setLagret(rad.id)
      setTimeout(() => setLagret(null), 2500)
    } catch {
      setFeil('Lagring feilet')
    } finally {
      setLagrer(null)
    }
  }

  if (laster) return <div style={{ padding: 40, color: FARGER.tekstLys }}>Laster selskaper…</div>

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 300, color: FARGER.mork, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Selskaper</h1>
      <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '0 0 28px', maxWidth: 620, lineHeight: 1.6 }}>
        Hvert prosjekt hører til et selskap. Skattesatsene under styrer beregningene for prosjektene i selskapet — endre her når regler eller satser endres.
      </p>

      {feil && (
        <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}`, padding: 14, color: '#7a0c1e', borderRadius: RADIUS.md, marginBottom: 20 }}>{feil}</div>
      )}

      <div style={{ display: 'grid', gap: 20 }}>
        {list.map(rad => {
          const felt = rad.land === 'norge' ? FELT_NORGE : FELT_SPANIA
          return (
            <div key={rad.id} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.sm, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>{rad.land === 'norge' ? '🇳🇴' : '🇪🇸'}</span>
                <span style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, color: FARGER.gull, textTransform: 'uppercase' }}>
                  {rad.land === 'norge' ? 'Norge · NOK' : 'Spania · EUR'}
                </span>
              </div>

              <div style={{ marginBottom: 20, maxWidth: 340 }}>
                <label style={labelStyle}>Selskapsnavn</label>
                <input value={rad.navn} onChange={e => settNavn(rad.id, e.target.value)} style={{ ...inputStyle, fontSize: 16, fontWeight: 500 }} />
              </div>

              <div style={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: FARGER.tekstLys, textTransform: 'uppercase', marginBottom: 12 }}>Skatteprofil</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {felt.map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={labelStyle}>{f.lbl}</label>
                    {f.type === 'bool' ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: FARGER.mork, cursor: 'pointer', padding: '8px 0' }}>
                        <input type="checkbox" checked={Boolean(rad.skatteprofil[f.key])} onChange={e => settFelt(rad.id, f.key, e.target.checked)} />
                        {rad.skatteprofil[f.key] ? 'Ja' : 'Nei'}
                      </label>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          step={f.type === 'mnd' ? 1 : 0.1}
                          value={Number(rad.skatteprofil[f.key] ?? 0)}
                          onChange={e => settFelt(rad.id, f.key, e.target.value === '' ? 0 : Number(e.target.value))}
                          style={{ ...inputStyle, maxWidth: 120 }}
                        />
                        <span style={{ fontSize: 13, color: FARGER.tekstLys }}>{f.type === 'pst' ? '%' : 'mnd'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
                <button
                  onClick={() => lagre(rad)}
                  disabled={lagrer === rad.id}
                  style={{
                    background: FARGER.mork, color: FARGER.creamLys, border: 'none',
                    padding: '11px 22px', fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em',
                    borderRadius: RADIUS.pill, cursor: lagrer === rad.id ? 'default' : 'pointer', opacity: lagrer === rad.id ? 0.6 : 1,
                  }}>
                  {lagrer === rad.id ? 'Lagrer…' : 'Lagre'}
                </button>
                {lagret === rad.id && <span style={{ fontSize: 13, color: FARGER.suksess }}>✓ Lagret</span>}
              </div>
            </div>
          )
        })}
        {list.length === 0 && !feil && (
          <div style={{ padding: 40, textAlign: 'center', color: FARGER.tekstLys, fontStyle: 'italic' }}>
            Ingen selskaper ennå. Kjør migrasjonen <code>migrasjoner/B1_selskaper.sql</code> i Supabase.
          </div>
        )}
      </div>
    </div>
  )
}
