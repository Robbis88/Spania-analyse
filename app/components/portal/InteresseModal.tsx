'use client'
import { useEffect, useState } from 'react'
import { useSprak } from '../../lib/i18n'
import { FARGER, RADIUS, SHADOW, MOTION } from '../../lib/styles'

const MØRK = FARGER.mork
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

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
    <div onClick={onLukk} className="anim-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(14, 23, 38, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in"
        style={{
          background: CREAM_LYS, maxWidth: 540, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          padding: 'clamp(28px, 5vw, 44px) clamp(22px, 5vw, 40px)',
          borderRadius: RADIUS.xl,
          boxShadow: SHADOW.xl,
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>{t.registrer_interesse_tittel}</div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 400, color: MØRK, margin: 0, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {prosjektNavn || t.registrer_interesse_tittel}
            </h2>
          </div>
          <button onClick={onLukk}
            aria-label="Lukk"
            style={{
              background: FARGER.flateLys, border: 'none',
              width: 36, height: 36, fontSize: 18, color: FARGER.tekstMid,
              cursor: 'pointer', lineHeight: 1, padding: 0,
              borderRadius: RADIUS.pill,
              transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
            ×
          </button>
        </div>

        <p style={{ fontSize: 14, color: FARGER.tekstMid, lineHeight: 1.6, margin: '0 0 26px' }}>{t.registrer_interesse_intro}</p>

        {resultat === 'ok' && (
          <div className="anim-fade-up" style={{ background: FARGER.suksessBg, border: `1px solid ${FARGER.suksess}33`, padding: 16, fontSize: 14, color: '#1a4d2b', marginBottom: 18, borderRadius: RADIUS.md }}>
            ✓ {t.takk_interesse}
          </div>
        )}
        {resultat === 'feil' && (
          <div className="anim-fade-up" style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, padding: 16, fontSize: 14, color: '#7a0c1e', marginBottom: 18, borderRadius: RADIUS.md }}>
            ✕ {feilTekst}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!prosjektId && (
            <div style={{ display: 'flex', gap: 8 }}>
              {(['kjop', 'leie', 'begge'] as const).map(v => (
                <button key={v} onClick={() => setInteresse(v)}
                  style={{
                    flex: 1, padding: '12px 10px', fontSize: 13,
                    background: interesse === v ? MØRK : FARGER.hvit,
                    color: interesse === v ? CREAM_LYS : MØRK,
                    border: `1px solid ${interesse === v ? MØRK : FARGER.kantUltralys}`,
                    cursor: 'pointer', letterSpacing: '-0.005em', fontWeight: 500,
                    borderRadius: RADIUS.pill,
                    boxShadow: interesse === v ? SHADOW.sm : 'none',
                    transition: `background ${MOTION.rask}, color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                  }}>
                  {v === 'kjop' ? t.jeg_vil_kjope : v === 'leie' ? t.jeg_vil_leie : t.jeg_vil_begge}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Felt label={t.navn + ' *'} val={navn} onChange={setNavn} />
            <Felt label={t.epost + ' *'} type="email" val={epost} onChange={setEpost} />
          </div>
          <Felt label={t.telefon} type="tel" val={telefon} onChange={setTelefon} />
          {!prosjektId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Felt label={t.region_onsket} val={region} onChange={setRegion} placeholder="Marbella, Costa del Sol..." />
              <Felt label={t.budsjett_eur} type="number" val={budsjett} onChange={setBudsjett} />
            </div>
          )}
          <div>
            <label style={lblStil}>{t.melding}</label>
            <textarea value={melding} onChange={e => setMelding(e.target.value)}
              style={{ ...inputStil, minHeight: 100, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button onClick={onLukk}
              style={{
                flex: 1, background: FARGER.hvit, color: MØRK,
                border: `1px solid ${FARGER.kantUltralys}`,
                padding: 14, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', letterSpacing: '-0.005em',
                borderRadius: RADIUS.pill,
                transition: `background ${MOTION.rask}`,
              }}>
              {t.avbryt}
            </button>
            <button onClick={send} disabled={sender || !navn || !epost}
              className={sender || !navn || !epost ? '' : 'knapp-hover-loft'}
              style={{
                flex: 2,
                background: sender || !navn || !epost ? FARGER.tekstLys : MØRK,
                color: CREAM_LYS, border: 'none',
                padding: 14, fontSize: 13, fontWeight: 600,
                cursor: sender || !navn || !epost ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.005em',
                borderRadius: RADIUS.pill,
                boxShadow: sender || !navn || !epost ? 'none' : SHADOW.sm,
              }}>
              {sender ? t.sender : t.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 14,
  border: `1px solid ${FARGER.kantUltralys}`, background: FARGER.hvit,
  fontFamily: 'inherit', boxSizing: 'border-box',
  borderRadius: RADIUS.md,
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
  outline: 'none',
}
const lblStil: React.CSSProperties = {
  display: 'block', fontSize: 11, color: FARGER.tekstMid,
  marginBottom: 8, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
}

function Felt({ label, val, onChange, type = 'text', placeholder }: { label: string; val: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={lblStil}>{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} style={inputStil} placeholder={placeholder} />
    </div>
  )
}
