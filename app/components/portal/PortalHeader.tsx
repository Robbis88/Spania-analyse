'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { SPRAK, SPRAK_NAVN, useSprak, type Sprak } from '../../lib/i18n'

const MØRK = '#0e1726'
const CREAM_LYS = '#fafaf6'
const GULL = '#b89a6f'

export function PortalHeader({ onRegistrerInteresse }: { onRegistrerInteresse: () => void }) {
  const { sprak, settSprak, t } = useSprak()
  const [meny, setMeny] = useState(false)

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(250, 250, 246, 0.92)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(184, 154, 111, 0.18)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Leganger & Osvaag" width={40} height={40} style={{ objectFit: 'contain' }} priority />
          <span style={{ fontSize: 13, fontWeight: 600, color: MØRK, letterSpacing: '0.18em' }}>LEGANGER &amp; OSVAAG</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/?type=leie" style={navLenkeStil}>{t.bolig_til_leie}</Link>
          <Link href="/?type=salgs" style={navLenkeStil}>{t.bolig_til_salgs}</Link>
          <a href="#kontakt" style={navLenkeStil}>{t.kontakt}</a>

          <SprakDropdown sprak={sprak} onVelg={settSprak} apen={meny === ('sprak' as unknown as boolean)} setApen={(v) => setMeny(v as unknown as boolean)} />

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
      </div>
    </header>
  )
}

const navLenkeStil: React.CSSProperties = {
  fontSize: 12, color: MØRK, textDecoration: 'none',
  fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase',
}

function SprakDropdown({ sprak, onVelg }: { sprak: Sprak; onVelg: (s: Sprak) => void; apen: boolean; setApen: (v: boolean) => void }) {
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
