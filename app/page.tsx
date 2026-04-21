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

type Snarvei = {
  id: Exclude<Seksjon, null>
  emoji: string
  tittel: string
  beskrivelse: string
  gradient: string
  ring: string
  tekst: string
}

const SEKSJONER: Snarvei[] = [
  { id: 'flipp', emoji: '🔨', tittel: 'Boligflipp', beskrivelse: 'Kjøp, puss opp, selg med fortjeneste', gradient: 'linear-gradient(135deg, #FFE8D4 0%, #F5C294 100%)', ring: '#D4814E', tekst: '#7a3b10' },
  { id: 'utleie', emoji: '🏝️', tittel: 'Boligutleie', beskrivelse: 'Dine utleieboliger i solen', gradient: 'linear-gradient(135deg, #D7F0EC 0%, #9BD7CB 100%)', ring: '#4FA3AE', tekst: '#1e5b62' },
  { id: 'selge', emoji: '💎', tittel: 'Selge bolig', beskrivelse: 'Salg, skatt og sluttkalkyle', gradient: 'linear-gradient(135deg, #FBEFC9 0%, #E8CD7B 100%)', ring: '#B08030', tekst: '#6e4812' },
  { id: 'regnskap', emoji: '📈', tittel: 'Regnskap', beskrivelse: 'Tall, oversikt og årsrapport', gradient: 'linear-gradient(135deg, #EDF4E4 0%, #C0D9A5 100%)', ring: '#6b9055', tekst: '#2e4a1d' },
]

type NavLink = { id: Seksjon | 'gjoremal'; lbl: string }
const NAV_LINKS: NavLink[] = [
  { id: 'analyse', lbl: 'Boliganalyse' },
  { id: 'flipp', lbl: 'Flipp' },
  { id: 'utleie', lbl: 'Utleie' },
  { id: 'selge', lbl: 'Selge' },
  { id: 'regnskap', lbl: 'Regnskap' },
  { id: 'gjoremal', lbl: 'Gjøremål' },
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

  function gåTilGjoremal() {
    hjem()
    setTimeout(() => {
      document.getElementById('gjoremal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
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
            const onClick = l.id === 'gjoremal' ? gåTilGjoremal : () => gåTil(l.id as Seksjon)
            return (
              <button key={l.id} onClick={onClick}
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

          <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 28px 80px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32 }}>
              <div>
                <div style={{ fontSize: 12, color: GULL, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 14 }}>SNARVEIER</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  {SEKSJONER.map(boks => (
                    <div
                      key={boks.id}
                      onClick={() => gåTil(boks.id)}
                      style={{
                        background: boks.gradient,
                        border: `1.5px solid ${boks.ring}55`,
                        borderRadius: 16,
                        padding: 24,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px) rotate(-0.5deg)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 28px ${boks.ring}44`
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0) rotate(0)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ position: 'absolute', right: -10, top: -10, fontSize: 96, opacity: 0.18, lineHeight: 1, transform: 'rotate(12deg)' }}>{boks.emoji}</div>
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>{boks.emoji}</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: boks.tekst, marginBottom: 4 }}>{boks.tittel}</div>
                        <div style={{ fontSize: 12.5, color: boks.tekst, opacity: 0.75, lineHeight: 1.4 }}>{boks.beskrivelse}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="gjoremal">
                <div style={{ fontSize: 12, color: GULL, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 14 }}>GJØREMÅL</div>
                <Oppgaver />
              </div>
            </div>
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
