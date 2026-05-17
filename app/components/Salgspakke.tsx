'use client'
import { useState } from 'react'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

type Props = {
  prosjektId: string
  prosjektNavn: string
  apen: boolean
  onLukk: () => void
}

type Valg = {
  inkluderBilder: boolean
  inkluderKvitteringer: boolean
  inkluderDokumenter: boolean
  inkluderSjekkliste: boolean
}

const STD_VALG: Valg = {
  inkluderBilder: true,
  inkluderKvitteringer: true,
  inkluderDokumenter: true,
  inkluderSjekkliste: true,
}

export function Salgspakke({ prosjektId, prosjektNavn, apen, onLukk }: Props) {
  const [valg, setValg] = useState<Valg>(STD_VALG)
  const [bygger, setBygger] = useState(false)

  if (!apen) return null

  async function bygg() {
    setBygger(true)
    try {
      const res = await fetch('/api/salgspakke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prosjekt_id: prosjektId, opt: valg }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.base64) {
        visToast(data?.feil || 'Salgspakke feilet', 'feil', 4000)
        return
      }
      // Last ned
      const bin = atob(data.base64)
      const u8 = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      const blob = new Blob([u8], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filnavn || 'salgspakke.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      visToast('Salgspakke lastet ned: ' + data.filnavn, 'suksess', 4000)
      onLukk()
    } catch (e) {
      visToast('Feil: ' + (e instanceof Error ? e.message : String(e)), 'feil', 4000)
    } finally {
      setBygger(false)
    }
  }

  function toggle(felt: keyof Valg) {
    setValg(v => ({ ...v, [felt]: !v[felt] }))
  }

  return (
    <div onClick={onLukk} className="anim-fade-in"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14, 23, 38, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in"
        style={{
          background: FARGER.creamLys,
          borderRadius: RADIUS.xl, maxWidth: 540, width: '100%',
          padding: 'clamp(24px, 4vw, 36px)', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: SHADOW.xl,
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
              Salgspakke
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 26px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {prosjektNavn}
            </h2>
            <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '8px 0 0', lineHeight: 1.55 }}>
              Investor- og kjøper-rettet PDF som samler oppgraderinger, kostnader, bilder og dokumenter.
            </p>
          </div>
          <button onClick={onLukk} disabled={bygger}
            aria-label="Lukk"
            style={{
              background: FARGER.flateLys, border: 'none',
              width: 36, height: 36, fontSize: 18, color: FARGER.tekstMid,
              cursor: bygger ? 'not-allowed' : 'pointer',
              lineHeight: 1, padding: 0,
              borderRadius: RADIUS.pill,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>×</button>
        </div>

        <div style={{
          background: FARGER.hvit,
          border: `1px solid ${FARGER.kantUltralys}`,
          borderRadius: RADIUS.lg,
          padding: 18, marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
            Hva skal inkluderes?
          </div>
          {[
            { id: 'inkluderBilder' as const, lbl: 'Bilder før/etter', beskr: 'AI-genererte etter-visualiseringer + originaler' },
            { id: 'inkluderKvitteringer' as const, lbl: 'Kostnadsoversikt', beskr: 'Sum av kvitteringer per kategori' },
            { id: 'inkluderDokumenter' as const, lbl: 'Vedlagte dokumenter', beskr: 'Liste over alle opplastede dokumenter' },
            { id: 'inkluderSjekkliste' as const, lbl: 'Dokumentsjekkliste', beskr: 'Status på escritura, IBI, VFT osv.' },
          ].map(felt => (
            <label key={felt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={valg[felt.id]} onChange={() => toggle(felt.id)}
                disabled={bygger}
                style={{ marginTop: 3, accentColor: FARGER.gull, width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>{felt.lbl}</div>
                <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 2 }}>{felt.beskr}</div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ fontSize: 12, color: FARGER.tekstLys, marginBottom: 16, lineHeight: 1.55 }}>
          Sammendrag (kjøp, investering, ROI) og oppgraderinger med budsjett vs faktisk er alltid med.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={bygg} disabled={bygger} className="knapp-hover-loft"
            style={{
              flex: 1, background: bygger ? FARGER.tekstLys : FARGER.mork, color: FARGER.creamLys,
              border: 'none', padding: 14, borderRadius: RADIUS.pill,
              fontSize: 14, fontWeight: 600, cursor: bygger ? 'wait' : 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: bygger ? 'none' : SHADOW.sm,
              transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
            }}>
            {bygger ? '⏳ Bygger PDF…' : '📥 Bygg og last ned'}
          </button>
          <button onClick={onLukk} disabled={bygger}
            style={{
              background: FARGER.hvit, color: FARGER.tekstMid,
              border: `1px solid ${FARGER.kantUltralys}`,
              padding: '14px 20px', borderRadius: RADIUS.pill,
              fontSize: 14, fontWeight: 600,
              cursor: bygger ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.005em',
            }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}
