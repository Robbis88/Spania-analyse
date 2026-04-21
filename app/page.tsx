'use client'
import Image from 'next/image'
import { useState } from 'react'
import { Innlogging } from './components/Innlogging'
import { Oppgaver } from './components/Oppgaver'
import { AgentChat } from './components/AgentChat'
import { Boliganalyse } from './components/Boliganalyse'
import { BoligerSeksjon } from './components/BoligerSeksjon'
import { Selge } from './components/Selge'
import { Regnskap } from './components/Regnskap'

type Seksjon = 'analyse' | 'flipp' | 'utleie' | 'selge' | 'regnskap' | null

const MØRK = '#1a2a3e'
const CREAM = '#f8f5ee'
const CREAM_LYS = '#faf7f0'
const GULL = '#c9a876'

const SEKSJONER = [
  { id: 'flipp' as const, emoji: '🔨', tittel: 'Boligflipp', beskrivelse: 'Dine flipp-prosjekter' },
  { id: 'utleie' as const, emoji: '🏖️', tittel: 'Boligutleie', beskrivelse: 'Dine utleieboliger' },
  { id: 'selge' as const, emoji: '💰', tittel: 'Selge bolig', beskrivelse: 'Verktøy for salg av eiendom' },
  { id: 'regnskap' as const, emoji: '📊', tittel: 'Regnskap', beskrivelse: 'Oversikt over inntekter og kostnader' },
]

const NAV_LINKS: { id: Seksjon; lbl: string }[] = [
  { id: 'analyse', lbl: 'Boliganalyse' },
  { id: 'flipp', lbl: 'Flipp' },
  { id: 'utleie', lbl: 'Utleie' },
  { id: 'selge', lbl: 'Selge' },
  { id: 'regnskap', lbl: 'Regnskap' },
]

export default function Home() {
  const [loggetInn, setLoggetInn] = useState(false)
  const [aktivSeksjon, setAktivSeksjon] = useState<Seksjon>(null)
  const [visProsjekt, setVisProsjekt] = useState<string | null>(null)

  if (!loggetInn) return <Innlogging onLoggetInn={() => setLoggetInn(true)} />

  function åpneProsjekt(id: string) {
    setAktivSeksjon('regnskap')
    setVisProsjekt(id)
  }

  function hjem() {
    setAktivSeksjon(null)
    setVisProsjekt(null)
  }

  function gåTil(s: Seksjon) {
    setAktivSeksjon(s)
    setVisProsjekt(null)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', background: CREAM, minHeight: '100vh' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: CREAM_LYS,
        borderBottom: `1px solid ${GULL}44`,
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <button onClick={hjem} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/logo.png" alt="Leganger & Osvaag Eiendom" width={48} height={48} style={{ objectFit: 'contain' }} priority />
          <span style={{ fontSize: 14, fontWeight: 700, color: MØRK, letterSpacing: '0.08em' }}>LEGANGER &amp; OSVAAG</span>
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 22, flexWrap: 'wrap' }}>
          {NAV_LINKS.map(l => {
            const aktiv = aktivSeksjon === l.id
            return (
              <button key={l.id} onClick={() => gåTil(l.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: aktiv ? 700 : 500,
                  color: aktiv ? MØRK : '#555',
                  padding: '6px 2px',
                  borderBottom: aktiv ? `2px solid ${GULL}` : '2px solid transparent',
                }}>{l.lbl}</button>
            )
          })}
        </div>
        <button onClick={() => { setLoggetInn(false); hjem() }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}>Logg ut</button>
      </nav>

      {!aktivSeksjon && (
        <>
          <section style={{ background: `linear-gradient(135deg, ${CREAM} 0%, ${CREAM_LYS} 100%)`, borderBottom: `1px solid ${GULL}22` }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 28px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 48, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: GULL, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>INVESTERER I HUS I SPANIA</div>
                <h1 style={{ fontSize: 42, lineHeight: 1.15, fontWeight: 700, color: MØRK, margin: 0, marginBottom: 16 }}>
                  Din partner for eiendoms&shy;investering i Spania
                </h1>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: '#555', margin: 0, marginBottom: 28, maxWidth: 520 }}>
                  Analyser eiendommer, følg opp prosjekter og få AI-drevne salgs- og utleieestimater — alt på ett sted.
                </p>
                <button onClick={() => gåTil('analyse')} style={{ background: MØRK, color: 'white', border: 'none', borderRadius: 10, padding: '16px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em' }}>
                  🔍  Analyser ny bolig  →
                </button>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Image src="/logo.png" alt="Leganger & Osvaag Eiendom" width={340} height={340} style={{ objectFit: 'contain', maxWidth: '100%', height: 'auto' }} priority />
              </div>
            </div>
          </section>

          <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 28px 16px' }}>
            <div style={{ fontSize: 12, color: GULL, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 14 }}>SNARVEIER</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 40 }}>
              {SEKSJONER.map(boks => (
                <div
                  key={boks.id}
                  onClick={() => gåTil(boks.id)}
                  style={{ background: 'white', border: `1px solid ${GULL}33`, borderRadius: 12, padding: 22, cursor: 'pointer', textAlign: 'center', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: 34, marginBottom: 8 }}>{boks.emoji}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: MØRK, marginBottom: 4 }}>{boks.tittel}</div>
                  <div style={{ fontSize: 12, color: '#777', lineHeight: 1.4 }}>{boks.beskrivelse}</div>
                </div>
              ))}
            </div>

            <Oppgaver />
          </section>
        </>
      )}

      {aktivSeksjon && (
        <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 28px', paddingBottom: 100 }}>
          {aktivSeksjon === 'analyse' && <Boliganalyse onTilbake={hjem} />}
          {aktivSeksjon === 'flipp' && <BoligerSeksjon kategori="flipp" onTilbake={hjem} onÅpneProsjekt={åpneProsjekt} />}
          {aktivSeksjon === 'utleie' && <BoligerSeksjon kategori="utleie" onTilbake={hjem} onÅpneProsjekt={åpneProsjekt} />}
          {aktivSeksjon === 'selge' && <Selge onTilbake={hjem} />}
          {aktivSeksjon === 'regnskap' && (
            <Regnskap
              onTilbake={hjem}
              visProsjektId={visProsjekt}
              onSettVisProsjekt={setVisProsjekt}
            />
          )}
        </main>
      )}

      <AgentChat />
    </div>
  )
}
