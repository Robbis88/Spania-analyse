'use client'
import { useEffect, useState } from 'react'
import { useSprak } from '../../lib/i18n'

const MØRK = '#0e1726'
const CREAM_LYS = '#fafaf6'
const GULL = '#b89a6f'

export function InteresseModal({ apen, onLukk, prosjektId, prosjektNavn }: {
  apen: boolean
  onLukk: () => void
  prosjektId?: string
  prosjektNavn?: string
}) {
  const { sprak, t } = useSprak()
  const [navn, setNavn] = useState('')
  const [epost, setEpost] = useState('')
  const [telefon, setTelefon] = useState('')
  const [interesse, setInteresse] = useState<'kjop' | 'leie' | 'begge' | ''>('')
  const [region, setRegion] = useState('')
  const [budsjett, setBudsjett] = useState('')
  const [melding, setMelding] = useState('')
  const [sender, setSender] = useState(false)
  const [resultat, setResultat] = useState<'ok' | 'feil' | null>(null)
  const [feilTekst, setFeilTekst] = useState('')

  useEffect(() => {
    if (apen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultat(null); setFeilTekst('')
    }
  }, [apen])

  if (!apen) return null

  async function send() {
    if (!navn || !epost) return
    setSender(true); setResultat(null); setFeilTekst('')
    try {
      const res = await fetch('/api/utleie-portal/interesse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          navn, epost, telefon: telefon || null,
          interesse: interesse || null,
          region: region || null,
          budsjett_eur: budsjett ? Number(budsjett) : null,
          melding: melding || null,
          prosjekt_id: prosjektId || null,
          sprak,
        }),
      })
      const data = await res.json()
      if (data.suksess) {
        setResultat('ok')
        setNavn(''); setEpost(''); setTelefon(''); setInteresse('')
        setRegion(''); setBudsjett(''); setMelding('')
      } else {
        setResultat('feil'); setFeilTekst(data.feil || t.feil_oppstod)
      }
    } catch (e) {
      setResultat('feil'); setFeilTekst(e instanceof Error ? e.message : t.feil_oppstod)
    }
    setSender(false)
  }

  return (
    <div onClick={onLukk}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(14, 23, 38, 0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.2s',
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: CREAM_LYS, maxWidth: 520, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          padding: 'clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)', borderRadius: 0,
          boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.16em', fontWeight: 700, marginBottom: 6 }}>{t.registrer_interesse_tittel.toUpperCase()}</div>
            <h2 style={{ fontSize: 26, fontWeight: 400, color: MØRK, margin: 0, lineHeight: 1.2 }}>
              {prosjektNavn || t.registrer_interesse_tittel}
            </h2>
          </div>
          <button onClick={onLukk}
            style={{ background: 'none', border: 'none', fontSize: 24, color: '#888', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, margin: '0 0 24px' }}>{t.registrer_interesse_intro}</p>

        {resultat === 'ok' && (
          <div style={{ background: '#e8f5ed', border: `1px solid #2D7D46`, padding: 14, fontSize: 13, color: '#1a4d2b', marginBottom: 16 }}>
            ✓ {t.takk_interesse}
          </div>
        )}
        {resultat === 'feil' && (
          <div style={{ background: '#fde8ec', border: `1px solid #C8102E`, padding: 14, fontSize: 13, color: '#7a0c1e', marginBottom: 16 }}>
            ✕ {feilTekst}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!prosjektId && (
            <div style={{ display: 'flex', gap: 8 }}>
              {(['kjop', 'leie', 'begge'] as const).map(v => (
                <button key={v} onClick={() => setInteresse(v)}
                  style={{
                    flex: 1, padding: '10px 8px', fontSize: 12,
                    background: interesse === v ? MØRK : 'transparent',
                    color: interesse === v ? CREAM_LYS : MØRK,
                    border: `1px solid ${interesse === v ? MØRK : GULL + '55'}`,
                    cursor: 'pointer', letterSpacing: '0.06em',
                  }}>
                  {v === 'kjop' ? t.jeg_vil_kjope : v === 'leie' ? t.jeg_vil_leie : t.jeg_vil_begge}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Felt label={t.navn + ' *'} val={navn} onChange={setNavn} />
            <Felt label={t.epost + ' *'} type="email" val={epost} onChange={setEpost} />
          </div>
          <Felt label={t.telefon} type="tel" val={telefon} onChange={setTelefon} />
          {!prosjektId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Felt label={t.region_onsket} val={region} onChange={setRegion} placeholder="Marbella, Costa del Sol..." />
              <Felt label={t.budsjett_eur} type="number" val={budsjett} onChange={setBudsjett} />
            </div>
          )}
          <div>
            <label style={lblStil}>{t.melding}</label>
            <textarea value={melding} onChange={e => setMelding(e.target.value)}
              style={{ ...inputStil, minHeight: 90, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={onLukk}
              style={{ flex: 1, background: 'transparent', color: MØRK, border: `1px solid ${GULL}55`, padding: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t.avbryt}
            </button>
            <button onClick={send} disabled={sender || !navn || !epost}
              style={{ flex: 2, background: sender || !navn || !epost ? '#888' : MØRK, color: CREAM_LYS, border: 'none', padding: 14, fontSize: 12, fontWeight: 600, cursor: sender || !navn || !epost ? 'not-allowed' : 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {sender ? t.sender : t.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1px solid #d4d0c4', background: 'white',
  fontFamily: 'sans-serif', boxSizing: 'border-box',
}
const lblStil: React.CSSProperties = {
  display: 'block', fontSize: 10, color: '#777',
  marginBottom: 6, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
}

function Felt({ label, val, onChange, type = 'text', placeholder }: { label: string; val: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={lblStil}>{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} style={inputStil} placeholder={placeholder} />
    </div>
  )
}
