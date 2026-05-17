'use client'
import Image from 'next/image'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

function LaastInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTil = params.get('redirect') || '/'
  const [passord, setPassord] = useState('')
  const [sender, setSender] = useState(false)
  const [feil, setFeil] = useState('')

  async function send() {
    if (!passord || sender) return
    setSender(true); setFeil('')
    try {
      const res = await fetch('/api/portal-tilgang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passord }),
      })
      const data = await res.json()
      if (data.suksess) {
        router.push(redirectTil)
        router.refresh()
      } else {
        setFeil(data.feil || 'Feil passord')
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Noe gikk galt')
    }
    setSender(false)
  }

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
      <header style={{ padding: '18px 28px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${FARGER.kantUltralys}`, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/logo.png" alt="Leganger & Osvaag" width={40} height={40} style={{ objectFit: 'contain' }} priority />
          <span style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork, letterSpacing: '0.18em' }}>LEGANGER &amp; OSVAAG</span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14 }}>PRIVAT VISNING</div>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 300, color: FARGER.mork, margin: '0 0 14px', letterSpacing: '-0.025em' }}>
              Sidene er under utvikling
            </h1>
            <p style={{ fontSize: 15, color: FARGER.tekstMid, margin: 0, lineHeight: 1.6, fontWeight: 300 }}>
              Skriv inn tilgangskoden for å fortsette.
            </p>
          </div>

          <div className="anim-fade-up" style={{
            background: FARGER.hvit,
            border: `1px solid ${FARGER.kantUltralys}`,
            padding: 36,
            borderRadius: RADIUS.xl,
            boxShadow: SHADOW.md,
            animationDelay: '80ms',
          }}>
            <label style={lblStil}>Tilgangskode</label>
            <input
              type="password"
              value={passord}
              onChange={e => setPassord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="••••••••"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14,
                borderRadius: RADIUS.md,
                border: feil ? `1.5px solid ${FARGER.feil}` : `1px solid ${FARGER.kant}`,
                background: FARGER.hvit, boxSizing: 'border-box',
                marginBottom: 6,
                transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                outline: 'none',
              }}
            />
            {feil && <div style={{ color: FARGER.feil, fontSize: 12, marginBottom: 14 }}>{feil}</div>}
            <button onClick={send} disabled={sender || !passord} className="knapp-hover-loft"
              style={{
                width: '100%', marginTop: 12,
                background: sender || !passord ? FARGER.tekstLys : FARGER.mork,
                color: FARGER.creamLys,
                border: 'none', padding: 14,
                fontSize: 13, fontWeight: 600,
                letterSpacing: '-0.005em',
                cursor: sender || !passord ? 'not-allowed' : 'pointer',
                borderRadius: RADIUS.pill,
                boxShadow: sender || !passord ? 'none' : SHADOW.sm,
                transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}, background ${MOTION.rask}`,
              }}>
              {sender ? 'Sjekker…' : 'Få tilgang'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <a href="/admin" className="nav-lenke" style={{ fontSize: 12, color: FARGER.tekstMid, textDecoration: 'none', letterSpacing: '-0.005em', fontWeight: 500 }}>
              Admin-innlogging →
            </a>
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

export default function LaastSide() {
  return (
    <Suspense fallback={null}>
      <LaastInner />
    </Suspense>
  )
}
