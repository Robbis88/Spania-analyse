'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
      .select('*')
      .order('tidspunkt', { ascending: false })
      .limit(200)
    if (data) setRader(data as LoggRad[])
    setLaster(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  const brukere = Array.from(new Set(rader.map(r => r.bruker))).sort()
  const synlige = filterBruker === 'alle' ? rader : rader.filter(r => r.bruker === filterBruker)

  return (
    <div>
      <button onClick={onTilbake} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 36 }}>📜</div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Aktivitetslogg</h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Hvem har gjort hva, og når</p>
        </div>
        <select value={filterBruker} onChange={e => setFilterBruker(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 }}>
          <option value="alle">Alle brukere</option>
          {brukere.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
        </select>
      </div>

      {laster && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div>}

      {!laster && synlige.length === 0 && (
        <div style={{ background: '#f8f8f8', border: '2px dashed #ddd', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ingen aktivitet registrert</div>
        </div>
      )}

      {synlige.map(r => {
        const bf = brukerFarge(r.bruker)
        return (
          <div key={r.id} style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 10, padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ background: bf.bg, color: bf.tekst, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
              {r.bruker.charAt(0).toUpperCase() + r.bruker.slice(1)}
            </span>
            <div style={{ flex: 1, fontSize: 14, color: '#1a1a2e' }}>
              <strong>{r.handling}</strong>
              {' '}<span style={{ color: '#666' }}>{detaljTekst(r.detaljer)}</span>
            </div>
            <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{formaterTid(r.tidspunkt)}</span>
          </div>
        )
      })}
    </div>
  )
}
