'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

type LoggRad = {
  id: string
  tidspunkt: string
  bruker: string
  handling: string
  tabell: string | null
  rad_id: string | null
  detaljer: Record<string, unknown> | null
}

const brukerFarge = (b: string) => {
  const palette = [
    { bg: '#FFE8D4', tekst: '#7a3b10' },
    { bg: '#D7F0EC', tekst: '#1e5b62' },
    { bg: '#FBEFC9', tekst: '#6e4812' },
    { bg: '#EDF4E4', tekst: '#2e4a1d' },
    { bg: '#FFDDE5', tekst: '#6e1f35' },
    { bg: '#E5DDFA', tekst: '#3e2469' },
  ]
  let hash = 0
  for (let i = 0; i < b.length; i++) hash = (hash * 31 + b.charCodeAt(i)) | 0
  return palette[Math.abs(hash) % palette.length]
}

function formaterTid(iso: string) {
  const d = new Date(iso)
  const idag = new Date()
  const igår = new Date(idag)
  igår.setDate(idag.getDate() - 1)
  const klokke = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === idag.toDateString()) return `I dag ${klokke}`
  if (d.toDateString() === igår.toDateString()) return `I går ${klokke}`
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + klokke
}

function detaljTekst(detaljer: Record<string, unknown> | null): string {
  if (!detaljer) return ''
  const navn = detaljer.navn || detaljer.tittel || detaljer.bolig
  if (typeof navn === 'string') return `« ${navn} »`
  return ''
}

export function Aktivitetslogg({ onTilbake }: { onTilbake: () => void }) {
  const [rader, setRader] = useState<LoggRad[]>([])
  const [laster, setLaster] = useState(true)
  const [filterBruker, setFilterBruker] = useState<string>('alle')

  const hent = useCallback(async () => {
    setLaster(true)
    const { data } = await supabase
      .from('aktivitetslogg')
      .select('id, tidspunkt, bruker, handling, tabell, rad_id, detaljer')
      .order('tidspunkt', { ascending: false })
      .limit(200)
    if (data) setRader(data as LoggRad[])
    setLaster(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  const brukere = useMemo(() => Array.from(new Set(rader.map(r => r.bruker))).sort(), [rader])
  const synlige = useMemo(
    () => filterBruker === 'alle' ? rader : rader.filter(r => r.bruker === filterBruker),
    [rader, filterBruker],
  )

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
      }}><span aria-hidden>←</span> Tilbake</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 40 }}>📜</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>Aktivitetslogg</h2>
          <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14 }}>Hvem har gjort hva, og når</p>
        </div>
        <select value={filterBruker} onChange={e => setFilterBruker(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: RADIUS.pill,
            border: `1px solid ${FARGER.kantUltralys}`,
            background: FARGER.hvit,
            fontSize: 13, color: FARGER.mork,
            boxShadow: SHADOW.xs,
            outline: 'none',
            transition: `border-color ${MOTION.rask}`,
          }}>
          <option value="alle">Alle brukere</option>
          {brukere.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
        </select>
      </div>

      {laster && (
        <div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 8, boxShadow: SHADOW.xs }}>
              <div className="skimmer" style={{ height: 14, width: '70%', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {!laster && synlige.length === 0 && (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 48, textAlign: 'center', color: FARGER.tekstMid }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Ingen aktivitet registrert</div>
        </div>
      )}

      {synlige.map((r, i) => {
        const bf = brukerFarge(r.bruker)
        return (
          <div key={r.id} className="anim-fade-up" style={{
            background: FARGER.hvit,
            border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.md,
            padding: '14px 16px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            boxShadow: SHADOW.xs,
            animationDelay: `${Math.min(i, 12) * 30}ms`,
          }}>
            <span style={{ background: bf.bg, color: bf.tekst, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS.pill, letterSpacing: '-0.005em' }}>
              {r.bruker.charAt(0).toUpperCase() + r.bruker.slice(1)}
            </span>
            <div style={{ flex: 1, fontSize: 14, color: FARGER.mork, letterSpacing: '-0.005em' }}>
              <strong style={{ fontWeight: 600 }}>{r.handling}</strong>
              {' '}<span style={{ color: FARGER.tekstMid }}>{detaljTekst(r.detaljer)}</span>
            </div>
            <span style={{ fontSize: 12, color: FARGER.tekstLys, whiteSpace: 'nowrap' }}>{formaterTid(r.tidspunkt)}</span>
          </div>
        )
      })}
    </div>
  )
}
