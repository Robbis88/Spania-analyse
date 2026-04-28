'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SPRAK, SPRAK_NAVN, useSprak, type Sprak } from '../../lib/i18n'

const MØRK = '#0e1726'
const CREAM_LYS = '#fafaf6'
const GULL = '#b89a6f'

const MOBIL_BREDDE = 760

export function PortalHeader({ onRegistrerInteresse }: { onRegistrerInteresse: () => void }) {
  const { sprak, settSprak, t } = useSprak()
  const [erMobil, setErMobil] = useState(false)
  const [menyApen, setMenyApen] = useState(false)

  useEffect(() => {
    function sjekk() { setErMobil(window.innerWidth < MOBIL_BREDDE) }
    sjekk()
    window.addEventListener('resize', sjekk)
    return () => window.removeEventListener('resize', sjekk)
  }, [])

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(250, 250, 246, 0.92)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(184, 154, 111, 0.18)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: erMobil ? '12px 18px' : '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: erMobil ? 8 : 12, textDecoration: 'none', minWidth: 0 }}>
          <Image src="/logo.png" alt="Leganger & Osvaag" width={erMobil ? 34 : 40} height={erMobil ? 34 : 40} style={{ objectFit: 'contain', flexShrink: 0 }} priority />
          <span style={{ fontSize: erMobil ? 11 : 13, fontWeight: 600, color: MØRK, letterSpacing: erMobil ? '0.12em' : '0.18em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {erMobil ? 'L & O' : 'LEGANGER & OSVAAG'}
          </span>
        </Link>

        {!erMobil && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <Link href="/?type=leie" style={navLenkeStil}>{t.bolig_til_leie}</Link>
            <Link href="/?type=salgs" style={navLenkeStil}>{t.bolig_til_salgs}</Link>
            <a href="#kontakt" style={navLenkeStil}>{t.kontakt}</a>
            <SprakDropdown sprak={sprak} onVelg={settSprak} />
            <button onClick={onRegistrerInteresse}
              style={{
                background: MØRK, color: CREAM_LYS, border: 'none',
                padding: '10px 20px', fontSize: 12, fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer', borderRadius: 0,
              }}>
              {t.registrer_interesse}
            </button>
            <Link href="/admin" style={{ fontSize: 11, color: '#888', textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
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
                background: 'none', border: `1px solid ${GULL}55`,
                width: 36, height: 36, fontSize: 18, color: MØRK,
                cursor: 'pointer', padding: 0,
              }}>
              {menyApen ? '✕' : '☰'}
            </button>
          </div>
        )}
      </div>

      {erMobil && menyApen && (
        <div style={{
          background: CREAM_LYS, borderTop: `1px solid ${GULL}33`,
          padding: '14px 18px 18px',
        }}>
          <Link href="/?type=leie" onClick={() => setMenyApen(false)} style={mobilLenkeStil}>{t.bolig_til_leie}</Link>
          <Link href="/?type=salgs" onClick={() => setMenyApen(false)} style={mobilLenkeStil}>{t.bolig_til_salgs}</Link>
          <a href="#kontakt" onClick={() => setMenyApen(false)} style={mobilLenkeStil}>{t.kontakt}</a>
          <button onClick={() => { setMenyApen(false); onRegistrerInteresse() }}
            style={{
              width: '100%', marginTop: 10,
              background: MØRK, color: CREAM_LYS, border: 'none',
              padding: 13, fontSize: 12, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}>
            {t.registrer_interesse}
          </button>
          <Link href="/admin" onClick={() => setMenyApen(false)}
            style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: 12, fontSize: 11, color: '#888', textDecoration: 'none', letterSpacing: '0.12em', textTransform: 'uppercase', border: `1px solid ${GULL}33` }}>
            {t.logg_inn}
          </Link>
        </div>
      )}
    </header>
  )
}

const navLenkeStil: React.CSSProperties = {
  fontSize: 12, color: MØRK, textDecoration: 'none',
  fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase',
}

const mobilLenkeStil: React.CSSProperties = {
  display: 'block', padding: '12px 4px',
  fontSize: 13, color: MØRK, textDecoration: 'none',
  fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
  borderBottom: `1px solid ${GULL}22`,
}

function SprakDropdown({ sprak, onVelg }: { sprak: Sprak; onVelg: (s: Sprak) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ background: 'none', border: `1px solid ${GULL}55`, padding: '6px 10px', fontSize: 11, color: MØRK, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}>
        {sprak.toUpperCase()} ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          background: 'white', border: `1px solid ${GULL}55`,
          minWidth: 140, padding: 4, zIndex: 40,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}>
          {SPRAK.map(s => (
            <button key={s} onMouseDown={() => { onVelg(s); setOpen(false) }}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 12px',
                background: s === sprak ? '#faf7ee' : 'none',
                border: 'none', fontSize: 12, cursor: 'pointer',
                color: MØRK, display: 'flex', justifyContent: 'space-between',
              }}>
              <span>{SPRAK_NAVN[s]}</span>
              <span style={{ color: '#999', fontSize: 11 }}>{s.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
