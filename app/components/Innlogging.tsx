'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

export function Innlogging({ onLoggetInn }: { onLoggetInn: (bruker: string) => void }) {
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
      if (data.ok && data.bruker) onLoggetInn(data.bruker)
      else setFeil(true)
    } catch {
      setFeil(true)
    }
    setSjekker(false)
  }

  const inputKant = (harFeil: boolean) =>
    harFeil ? `1.5px solid ${FARGER.feil}` : `1px solid ${FARGER.kant}`

  return (
    <main style={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${FARGER.creamLys} 0%, ${FARGER.cream} 100%)`,
      color: FARGER.tekstMork,
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: '-20%', right: '-15%',
        width: '50%', height: '100%',
        background: `radial-gradient(circle, ${FARGER.gull}15 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <header style={{
        padding: '18px 28px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${FARGER.kantUltralys}`,
        position: 'relative', zIndex: 1,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Leganger & Osvaag" width={40} height={40} style={{ objectFit: 'contain' }} priority />
          <span style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork, letterSpacing: '0.18em' }}>LEGANGER &amp; OSVAAG</span>
        </Link>
        <Link href="/" className="nav-lenke" style={{ fontSize: 12, color: FARGER.tekstMid, textDecoration: 'none', letterSpacing: '-0.005em', fontWeight: 500 }}>
          ← Til portalen
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14 }}>ADMIN</div>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 300, color: FARGER.mork, margin: 0, letterSpacing: '-0.025em' }}>
              Logg inn
            </h1>
          </div>

          <div className="anim-fade-up" style={{
            background: FARGER.hvit,
            border: `1px solid ${FARGER.kantUltralys}`,
            padding: 36,
            borderRadius: RADIUS.xl,
            boxShadow: SHADOW.md,
            animationDelay: '80ms',
          }}>
            <div style={{ marginBottom: 18 }}>
              <label style={lblStil}>Brukernavn</label>
              <input
                type="text"
                value={brukernavnInput}
                onChange={e => setBrukernavnInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loggInn()}
                placeholder="Brukernavn"
                autoComplete="username"
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 14,
                  borderRadius: RADIUS.md,
                  border: inputKant(feil),
                  background: FARGER.hvit, boxSizing: 'border-box',
                  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={lblStil}>Passord</label>
              <input
                type="password"
                value={passordInput}
                onChange={e => setPassordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loggInn()}
                placeholder="Passord"
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '12px 14px', fontSize: 14,
                  borderRadius: RADIUS.md,
                  border: inputKant(feil),
                  background: FARGER.hvit, boxSizing: 'border-box',
                  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                  outline: 'none',
                }}
              />
              {feil && <div style={{ color: FARGER.feil, fontSize: 12, marginTop: 8 }}>Feil brukernavn eller passord. Prøv igjen.</div>}
            </div>
            <button onClick={loggInn} disabled={sjekker} className="knapp-hover-loft" style={{
              width: '100%',
              background: sjekker ? FARGER.tekstLys : FARGER.mork,
              color: FARGER.creamLys,
              border: 'none', padding: 14,
              fontSize: 13, fontWeight: 600,
              letterSpacing: '-0.005em',
              cursor: sjekker ? 'not-allowed' : 'pointer',
              borderRadius: RADIUS.pill,
              boxShadow: sjekker ? 'none' : SHADOW.sm,
              transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}, background ${MOTION.rask}`,
            }}>
              {sjekker ? 'Sjekker…' : 'Logg inn'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

const lblStil: React.CSSProperties = {
  fontSize: 11, color: FARGER.tekstMid, marginBottom: 8, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}
