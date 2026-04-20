'use client'
import { useState } from 'react'

export function Innlogging({ onLoggetInn }: { onLoggetInn: () => void }) {
  const [passordInput, setPassordInput] = useState('')
  const [passordFeil, setPassordFeil] = useState(false)
  const [sjekker, setSjekker] = useState(false)

  async function loggInn() {
    if (!passordInput || sjekker) return
    setSjekker(true); setPassordFeil(false)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passord: passordInput }),
      })
      const data = await res.json()
      if (data.ok) onLoggetInn()
      else setPassordFeil(true)
    } catch {
      setPassordFeil(true)
    }
    setSjekker(false)
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f8', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏡</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Leganger Eiendom</h1>
          <p style={{ color: '#666', marginTop: 8, fontSize: 14 }}>Din partner for eiendomsinvestering i Spania</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#666', marginBottom: 6, display: 'block' }}>Passord</label>
          <input
            type="password"
            value={passordInput}
            onChange={e => setPassordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loggInn()}
            placeholder="Skriv inn passord"
            style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 8, border: passordFeil ? '2px solid #C8102E' : '1.5px solid #ddd', fontFamily: 'sans-serif' }}
          />
          {passordFeil && <div style={{ color: '#C8102E', fontSize: 13, marginTop: 6 }}>Feil passord, prøv igjen.</div>}
        </div>
        <button onClick={loggInn} disabled={sjekker} style={{ width: '100%', background: sjekker ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: sjekker ? 'not-allowed' : 'pointer' }}>
          {sjekker ? '⏳ Sjekker...' : 'Logg inn'}
        </button>
      </div>
    </main>
  )
}
