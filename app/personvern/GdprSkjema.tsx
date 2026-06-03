'use client'
import { useState } from 'react'
import { FARGER, RADIUS, MOTION } from '../lib/styles'

type Status = 'idle' | 'sender' | 'sendt' | 'feil'

const TYPER: Array<{ id: string; lbl: string; beskrivelse: string }> = [
  { id: 'innsyn',       lbl: 'Be om innsyn',          beskrivelse: 'Få en kopi av alle personopplysninger vi har om deg.' },
  { id: 'sletting',     lbl: 'Be om sletting',        beskrivelse: 'Få slettet personopplysninger (med unntak av lovpålagt oppbevaring).' },
  { id: 'retting',      lbl: 'Be om retting',         beskrivelse: 'Få korrigert uriktige eller utdaterte opplysninger.' },
  { id: 'portabilitet', lbl: 'Be om dataportabilitet', beskrivelse: 'Få utlevert dine data i et maskinlesbart format.' },
  { id: 'annet',        lbl: 'Annet',                 beskrivelse: 'Bruk meldingsfeltet for å spesifisere.' },
]

export function GdprSkjema() {
  const [apen, setApen] = useState(false)
  const [type, setType] = useState('innsyn')
  const [epost, setEpost] = useState('')
  const [navn, setNavn] = useState('')
  const [melding, setMelding] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [feilmelding, setFeilmelding] = useState('')

  async function send() {
    if (!epost.trim()) { setFeilmelding('E-post må fylles ut'); return }
    setStatus('sender'); setFeilmelding('')
    try {
      const res = await fetch('/api/gdpr/forespoersel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epost, navn: navn || null, type, melding: melding || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setFeilmelding(data.feil || 'Sending feilet — prøv på nytt eller send e-post til post@loeiendom.com')
        setStatus('feil')
        return
      }
      setStatus('sendt')
    } catch (e) {
      setFeilmelding(e instanceof Error ? e.message : 'Uventet feil')
      setStatus('feil')
    }
  }

  if (!apen) {
    return (
      <button onClick={() => setApen(true)}
        style={{
          marginTop: 16,
          background: FARGER.mork, color: '#fff', border: 'none',
          borderRadius: RADIUS.sm, padding: '12px 22px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          transition: `background ${MOTION.rask}`,
        }}>
        📩 Send GDPR-forespørsel
      </button>
    )
  }

  if (status === 'sendt') {
    return (
      <div style={{ marginTop: 16, background: '#e8f5ed', border: '1px solid #2D7D4644', borderRadius: RADIUS.md, padding: 20, color: '#1a4d2b' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>✅ Forespørselen er registrert</div>
        <p style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.6 }}>
          Vi har sendt en bekreftelse til {epost}. Du får svar innen 30 dager.
          Hvis du ikke ser bekreftelsen i innboksen, sjekk søppelpost-mappen.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16, background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, letterSpacing: '-0.005em' }}>
          📩 GDPR-forespørsel
        </div>
        <button onClick={() => { setApen(false); setStatus('idle') }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: FARGER.tekstLys, fontSize: 14 }}>
          ✕
        </button>
      </div>

      <label style={lblStil}>Type forespørsel</label>
      <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStil, fontFamily: 'inherit', marginBottom: 4 }}>
        {TYPER.map(t => <option key={t.id} value={t.id}>{t.lbl}</option>)}
      </select>
      <p style={{ fontSize: 11, color: FARGER.tekstMid, margin: '0 0 14px', fontStyle: 'italic' }}>
        {TYPER.find(t => t.id === type)?.beskrivelse}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={lblStil}>E-post (påkrevd)</label>
          <input type="email" value={epost} onChange={e => setEpost(e.target.value)}
            placeholder="din@epost.no" autoFocus
            style={inputStil} />
        </div>
        <div>
          <label style={lblStil}>Navn (valgfri)</label>
          <input value={navn} onChange={e => setNavn(e.target.value)}
            placeholder="Fornavn Etternavn"
            style={inputStil} />
        </div>
      </div>

      <label style={lblStil}>Melding (valgfri)</label>
      <textarea value={melding} onChange={e => setMelding(e.target.value)} rows={4}
        placeholder="Spesifiser detaljer hvis relevant — f.eks. hvilke data du vil ha innsyn i, eller hvilken kontekst dataene ble samlet inn under."
        style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />

      {feilmelding && (
        <div style={{ background: FARGER.feilBg, padding: 10, borderRadius: RADIUS.sm, color: '#7a0c1e', fontSize: 12, marginTop: 12 }}>
          {feilmelding}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={send} disabled={status === 'sender'}
          style={{
            flex: 1, background: status === 'sender' ? FARGER.tekstLys : FARGER.mork,
            color: '#fff', border: 'none', borderRadius: RADIUS.sm,
            padding: 12, fontSize: 13, fontWeight: 600,
            cursor: status === 'sender' ? 'not-allowed' : 'pointer',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
          {status === 'sender' ? '⏳ Sender…' : 'Send forespørsel'}
        </button>
        <button onClick={() => { setApen(false); setStatus('idle') }} disabled={status === 'sender'}
          style={{
            background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none',
            borderRadius: RADIUS.sm, padding: '12px 18px', fontSize: 13, fontWeight: 600,
            cursor: status === 'sender' ? 'not-allowed' : 'pointer',
          }}>
          Avbryt
        </button>
      </div>
      <p style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 10, fontStyle: 'italic' }}>
        Vi bekrefter mottak på e-post umiddelbart og svarer på selve forespørselen innen 30 dager.
      </p>
    </div>
  )
}

const lblStil: React.CSSProperties = {
  fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box',
}
