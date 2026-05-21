'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SPRAK, SPRAK_NAVN, useSprak, type Sprak } from '../../lib/i18n'
import { FARGER, RADIUS, SHADOW, MOTION } from '../../lib/styles'

const MØRK = FARGER.mork
const CREAM_LYS = FARGER.cream
const GULL = FARGER.gull

const MOBIL_BREDDE = 760

export function PortalHeader({ onRegistrerInteresse }: { onRegistrerInteresse: () => void }) {
  const { sprak, settSprak, t } = useSprak()
  const [erMobil, setErMobil] = useState(false)
  const [menyApen, setMenyApen] = useState(false)
  const [scrollet, setScrollet] = useState(false)

  useEffect(() => {
    function sjekk() { setErMobil(window.innerWidth < MOBIL_BREDDE) }
    sjekk()
    window.addEventListener('resize', sjekk)
    return () => window.removeEventListener('resize', sjekk)
  }, [])

  useEffect(() => {
    function sjekkScroll() { setScrollet(window.scrollY > 8) }
    sjekkScroll()
    window.addEventListener('scroll', sjekkScroll, { passive: true })
    return () => window.removeEventListener('scroll', sjekkScroll)
  }, [])

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: scrollet ? 'rgba(250, 250, 246, 0.85)' : 'rgba(250, 250, 246, 0.6)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: scrollet ? `1px solid ${FARGER.kantUltralys}` : '1px solid transparent',
      boxShadow: scrollet ? SHADOW.xs : 'none',
      transition: `background ${MOTION.normal}, border-color ${MOTION.normal}, box-shadow ${MOTION.normal}`,
    }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: erMobil ? '12px 18px' : '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: erMobil ? 8 : 12, textDecoration: 'none', minWidth: 0 }}>
          <Image src="/logo.png" alt="Leganger & Osvaag" width={erMobil ? 34 : 40} height={erMobil ? 34 : 40} style={{ objectFit: 'contain', flexShrink: 0 }} priority />
          <span style={{ fontSize: erMobil ? 11 : 13, fontWeight: 600, color: MØRK, letterSpacing: erMobil ? '0.12em' : '0.18em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {erMobil ? 'L & O' : 'LEGANGER & OSVAAG'}
          </span>
        </Link>

        {!erMobil && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link href="/?type=leie" style={navLenkeStil} className="nav-lenke">{t.bolig_til_leie}</Link>
            <Link href="/?type=salgs" style={navLenkeStil} className="nav-lenke">{t.bolig_til_salgs}</Link>
            <Link href="/inspeksjon" style={navLenkeStil} className="nav-lenke">{t.boliginspeksjon}</Link>
            <a href="#kontakt" style={navLenkeStil} className="nav-lenke">{t.kontakt}</a>
            <div style={{ width: 1, height: 20, background: FARGER.kantUltralys, margin: '0 12px' }} />
            <SprakDropdown sprak={sprak} onVelg={settSprak} />
            <button onClick={onRegistrerInteresse} className="knapp-hover-loft"
              style={{
                background: MØRK, color: CREAM_LYS, border: 'none',
                padding: '11px 22px', fontSize: 13, fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: 'pointer', borderRadius: RADIUS.pill,
                marginLeft: 8,
                boxShadow: SHADOW.sm,
              }}>
              {t.registrer_interesse}
            </button>
            <Link href="/admin" style={{ fontSize: 12, color: FARGER.tekstLys, textDecoration: 'none', letterSpacing: '0.04em', marginLeft: 16, fontWeight: 500 }}>
              {t.logg_inn}
            </Link>
          </nav>
        )}

        {erMobil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SprakDropdown sprak={sprak} onVelg={settSprak} />
            <button onClick={() => setMenyApen(o => !o)}
              aria-label="Meny"
              style={{
                background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
                width: 40, height: 40, fontSize: 17, color: MØRK,
                cursor: 'pointer', padding: 0,
                borderRadius: RADIUS.pill,
                boxShadow: SHADOW.xs,
                transition: `transform ${MOTION.rask}`,
              }}>
              {menyApen ? '✕' : '☰'}
            </button>
          </div>
        )}
      </div>

      {erMobil && menyApen && (
        <div className="anim-fade-down" style={{
          background: FARGER.creamLys, borderTop: `1px solid ${FARGER.kantUltralys}`,
          padding: '18px 18px 22px',
          boxShadow: SHADOW.md,
        }}>
          <Link href="/?type=leie" onClick={() => setMenyApen(false)} style={mobilLenkeStil}>{t.bolig_til_leie}</Link>
          <Link href="/?type=salgs" onClick={() => setMenyApen(false)} style={mobilLenkeStil}>{t.bolig_til_salgs}</Link>
          <Link href="/inspeksjon" onClick={() => setMenyApen(false)} style={mobilLenkeStil}>{t.boliginspeksjon}</Link>
          <a href="#kontakt" onClick={() => setMenyApen(false)} style={mobilLenkeStil}>{t.kontakt}</a>
          <button onClick={() => { setMenyApen(false); onRegistrerInteresse() }}
            style={{
              width: '100%', marginTop: 14,
              background: MØRK, color: CREAM_LYS, border: 'none',
              padding: 14, fontSize: 13, fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              borderRadius: RADIUS.pill,
              boxShadow: SHADOW.sm,
            }}>
            {t.registrer_interesse}
          </button>
          <Link href="/admin" onClick={() => setMenyApen(false)}
            style={{
              display: 'block', textAlign: 'center', marginTop: 10, padding: 13, fontSize: 12,
              color: FARGER.tekstMid, textDecoration: 'none', letterSpacing: '0.04em',
              border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.pill,
              background: FARGER.hvit,
            }}>
            {t.logg_inn}
          </Link>
        </div>
      )}
    </header>
  )
}

const navLenkeStil: React.CSSProperties = {
  fontSize: 13, color: MØRK, textDecoration: 'none',
  fontWeight: 500, letterSpacing: '0.01em',
}

const mobilLenkeStil: React.CSSProperties = {
  display: 'block', padding: '14px 4px',
  fontSize: 15, color: MØRK, textDecoration: 'none',
  fontWeight: 500, letterSpacing: '-0.005em',
  borderBottom: `1px solid ${FARGER.kantUltralys}`,
}

function SprakDropdown({ sprak, onVelg }: { sprak: Sprak; onVelg: (s: Sprak) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
          padding: '7px 14px', fontSize: 12, color: MØRK,
          letterSpacing: '0.04em', cursor: 'pointer',
          borderRadius: RADIUS.pill, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          transition: `background ${MOTION.rask}, box-shadow ${MOTION.rask}`,
          boxShadow: SHADOW.xs,
        }}>
        <span>{sprak.toUpperCase()}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div className="anim-scale-in" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
          minWidth: 160, padding: 6, zIndex: 40,
          boxShadow: SHADOW.lg,
          borderRadius: RADIUS.md,
          transformOrigin: 'top right',
        }}>
          {SPRAK.map(s => (
            <button key={s} onMouseDown={() => { onVelg(s); setOpen(false) }}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                background: s === sprak ? FARGER.flateLys : 'none',
                border: 'none', fontSize: 13, cursor: 'pointer',
                color: MØRK, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderRadius: RADIUS.sm,
                transition: `background ${MOTION.rask}`,
              }}>
              <span style={{ fontWeight: s === sprak ? 600 : 400 }}>{SPRAK_NAVN[s]}</span>
              <span style={{ color: FARGER.tekstLys, fontSize: 11, letterSpacing: '0.04em' }}>{s.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
