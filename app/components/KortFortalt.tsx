'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FARGER, RADIUS } from '../lib/styles'

/**
 * "Kort fortalt" (C0) — 2-4 setningers oppsummering som Claude genererer fra
 * sidens EGNE tall. Leser ingen ny datakilde: forelderen bygger `kontekst` fra
 * tallene den allerede har hentet, og sender dem hit. Auto-genereres én gang når
 * kontekst er klar; kan oppdateres manuelt.
 *
 * Varianter:
 *  - lys (default): cream-boks med gull-kant, for seksjonssider.
 *  - mørk (`mork`): tekst rett på mørk hero — brukes som «Dagens brief».
 */
export function KortFortalt({ tittel, kontekst, mork = false, overskrift = 'Kort fortalt' }: {
  tittel: string; kontekst: string; mork?: boolean; overskrift?: string
}) {
  const [tekst, setTekst] = useState<string | null>(null)
  const [laster, setLaster] = useState(false)
  const [feil, setFeil] = useState(false)
  const hentetFor = useRef<string>('')

  const hent = useCallback(async () => {
    const k = kontekst.trim()
    if (!k) return
    setLaster(true); setFeil(false)
    hentetFor.current = kontekst
    try {
      const r = await fetch('/api/kort-fortalt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tittel, kontekst }),
      })
      const d = await r.json()
      if (!r.ok || !d.tekst) { setFeil(true); return }
      setTekst(d.tekst)
    } catch { setFeil(true) } finally { setLaster(false) }
  }, [tittel, kontekst])

  useEffect(() => {
    if (kontekst.trim() && hentetFor.current !== kontekst) void hent()
  }, [kontekst, hent])

  if (!kontekst.trim()) return null

  // ── Mørk hero-variant ──────────────────────────────────────────────────────
  if (mork) {
    const dempet = 'rgba(253,252,247,0.62)'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 17 }}>🤖</span>
          <span style={{ fontSize: 10.5, color: FARGER.gull, letterSpacing: '0.22em', fontWeight: 700, textTransform: 'uppercase' }}>{overskrift}</span>
          {tekst && !laster && (
            <button onClick={() => void hent()} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: dempet, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>↻</button>
          )}
        </div>
        {tekst ? (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: 'rgba(253,252,247,0.94)', whiteSpace: 'pre-wrap' }}>{tekst}</p>
        ) : laster ? (
          <p style={{ margin: 0, fontSize: 13.5, color: dempet, fontStyle: 'italic' }}>Skriver dagens brief…</p>
        ) : feil ? (
          <p style={{ margin: 0, fontSize: 13.5, color: dempet }}>
            Kunne ikke lage brief nå. <button onClick={() => void hent()} style={{ background: 'none', border: 'none', color: FARGER.gull, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, padding: 0 }}>Prøv igjen</button>
          </p>
        ) : null}
      </div>
    )
  }

  // ── Lys standardvariant ────────────────────────────────────────────────────
  return (
    <div style={{
      background: FARGER.creamLys,
      border: `1px solid ${FARGER.kantLys}`,
      borderLeft: `3px solid ${FARGER.gull}`,
      borderRadius: RADIUS.md,
      padding: '14px 18px',
      marginBottom: 22,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: tekst || laster ? 8 : 0 }}>
        <span style={{ fontSize: 10, color: FARGER.gull, letterSpacing: '0.22em', fontWeight: 700, textTransform: 'uppercase' }}>
          {overskrift}
        </span>
        <button onClick={() => void hent()} disabled={laster}
          style={{ background: 'none', border: 'none', color: FARGER.tekstLys, fontSize: 11, fontWeight: 600, cursor: laster ? 'default' : 'pointer', padding: 0 }}>
          {laster ? 'Skriver…' : tekst ? '↻ Oppdater' : ''}
        </button>
      </div>
      {tekst && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: FARGER.mork, whiteSpace: 'pre-wrap' }}>{tekst}</p>
      )}
      {!tekst && laster && (
        <p style={{ margin: 0, fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic' }}>Oppsummerer sidens tall…</p>
      )}
      {feil && !laster && (
        <p style={{ margin: 0, fontSize: 13, color: FARGER.tekstLys }}>
          Kunne ikke lage oppsummering nå. <button onClick={() => void hent()} style={{ background: 'none', border: 'none', color: FARGER.gull, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>Prøv igjen</button>
        </p>
      )}
    </div>
  )
}
