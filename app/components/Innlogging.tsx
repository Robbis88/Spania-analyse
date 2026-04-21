'use client'
import Image from 'next/image'
import { useState } from 'react'

export function Innlogging({ onLoggetInn }: { onLoggetInn: () => void }) {
  const [brukernavnInput, setBrukernavnInput] = useState('')
  const [passordInput, setPassordInput] = useState('')
  const [feil, setFeil] = useState(false)
  const [sjekker, setSjekker] = useState(false)

  async function loggInn() {
    if (!brukernavnInput || !passordInput || sjekker) return
    setSjekker(true); setFeil(false)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brukernavn: brukernavnInput, passord: passordInput }),
      })
      const data = await res.json()
      if (data.ok) onLoggetInn()
      else setFeil(true)
    } catch {
      setFeil(true)
    }
    setSjekker(false)
  }

  const inputKant = (harFeil: boolean) => harFeil ? '2px solid #C8102E' : '1.5px solid #ddd'

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f8', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Image src="/logo.png" alt="Leganger & Osvaag Eiendom" width={160} height={160} style={{ objectFit: 'contain', marginBottom: 8 }} priority />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#666', marginBottom: 6, display: 'block' }}>Brukernavn</label>
          <input
            type="text"
            value={brukernavnInput}
            onChange={e => setBrukernavnInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loggInn()}
            placeholder="Skriv inn brukernavn"
            autoComplete="username"
            style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 8, border: inputKant(feil), fontFamily: 'sans-serif' }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#666', marginBottom: 6, display: 'block' }}>Passord</label>
          <input
            type="password"
            value={passordInput}
            onChange={e => setPassordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loggInn()}
            placeholder="Skriv inn passord"
            autoComplete="current-password"
            style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 8, border: inputKant(feil), fontFamily: 'sans-serif' }}
          />
          {feil && <div style={{ color: '#C8102E', fontSize: 13, marginTop: 6 }}>Feil brukernavn eller passord, prøv igjen.</div>}
        </div>
        <button onClick={loggInn} disabled={sjekker} style={{ width: '100%', background: sjekker ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: sjekker ? 'not-allowed' : 'pointer' }}>
          {sjekker ? '⏳ Sjekker...' : 'Logg inn'}
        </button>
      </div>
    </main>
  )
}
