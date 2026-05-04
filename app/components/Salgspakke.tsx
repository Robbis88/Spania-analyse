'use client'
import { useState } from 'react'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS } from '../lib/styles'

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
    <div onClick={onLukk}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(14, 23, 38, 0.55)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: RADIUS.lg, maxWidth: 520, width: '100%',
          padding: 28, maxHeight: '90vh', overflowY: 'auto',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 6 }}>
              SALGSPAKKE
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: FARGER.mork }}>
              {prosjektNavn}
            </h2>
            <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '6px 0 0' }}>
              Investor- og kjøper-rettet PDF som samler oppgraderinger, kostnader, bilder og dokumenter.
            </p>
          </div>
          <button onClick={onLukk} disabled={bygger}
            style={{ background: 'none', border: 'none', fontSize: 22, color: FARGER.tekstLys, cursor: bygger ? 'not-allowed' : 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ background: FARGER.creamLys, borderRadius: RADIUS.md, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Hva skal inkluderes?
          </div>
          {[
            { id: 'inkluderBilder' as const, lbl: 'Bilder før/etter', beskr: 'AI-genererte etter-visualiseringer + originaler' },
            { id: 'inkluderKvitteringer' as const, lbl: 'Kostnadsoversikt', beskr: 'Sum av kvitteringer per kategori' },
            { id: 'inkluderDokumenter' as const, lbl: 'Vedlagte dokumenter', beskr: 'Liste over alle opplastede dokumenter' },
            { id: 'inkluderSjekkliste' as const, lbl: 'Dokumentsjekkliste', beskr: 'Status på escritura, IBI, VFT osv.' },
          ].map(felt => (
            <label key={felt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={valg[felt.id]} onChange={() => toggle(felt.id)}
                disabled={bygger}
                style={{ marginTop: 2, accentColor: FARGER.gull }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>{felt.lbl}</div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys }}>{felt.beskr}</div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 14, lineHeight: 1.5 }}>
          Sammendrag (kjøp, investering, ROI) og oppgraderinger med budsjett vs faktisk er alltid med.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={bygg} disabled={bygger}
            style={{
              flex: 1, background: bygger ? FARGER.tekstLys : FARGER.mork, color: '#fff',
              border: 'none', padding: 14, borderRadius: RADIUS.md,
              fontSize: 14, fontWeight: 600, cursor: bygger ? 'wait' : 'pointer',
              letterSpacing: '0.04em',
            }}>
            {bygger ? '⏳ Bygger PDF…' : '📥 Bygg og last ned'}
          </button>
          <button onClick={onLukk} disabled={bygger}
            style={{
              background: FARGER.flateMid, color: FARGER.tekstMid,
              border: 'none', padding: '14px 20px', borderRadius: RADIUS.md,
              fontSize: 14, fontWeight: 600, cursor: bygger ? 'not-allowed' : 'pointer',
            }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}
