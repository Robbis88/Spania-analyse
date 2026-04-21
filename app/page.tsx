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

const SEKSJONER = [
  { id: 'analyse' as const, emoji: '🔍', tittel: 'Boliganalyse', beskrivelse: 'Analyser en ny eiendom og vurder potensial', farge: '#C8102E', bg: '#fff5f5' },
  { id: 'flipp' as const, emoji: '🔨', tittel: 'Boligflipp', beskrivelse: 'Dine flipp-prosjekter', farge: '#185FA5', bg: '#f0f7ff' },
  { id: 'utleie' as const, emoji: '🏖️', tittel: 'Boligutleie', beskrivelse: 'Dine utleieboliger', farge: '#2D7D46', bg: '#f0faf4' },
  { id: 'selge' as const, emoji: '💰', tittel: 'Selge bolig', beskrivelse: 'Verktøy for salg av eiendom', farge: '#B05E0A', bg: '#fff8e1' },
  { id: 'regnskap' as const, emoji: '📊', tittel: 'Regnskap', beskrivelse: 'Oversikt over inntekter og kostnader', farge: '#7B2D8B', bg: '#f9f0ff' },
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

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px', paddingBottom: 100 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Image src="/logo.png" alt="Leganger & Osvaag Eiendom" width={140} height={140} style={{ objectFit: 'contain' }} priority />
          <div>
            <button onClick={() => { setLoggetInn(false); setAktivSeksjon(null); setVisProsjekt(null) }} style={{ marginTop: 4, background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer' }}>Logg ut</button>
          </div>
        </div>

        {!aktivSeksjon && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              {SEKSJONER.map((boks, i) => (
                <div
                  key={i}
                  onClick={() => setAktivSeksjon(boks.id)}
                  style={{ background: boks.bg, border: `2px solid ${boks.farge}22`, borderRadius: 16, padding: 28, cursor: 'pointer', textAlign: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{boks.emoji}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: boks.farge, marginBottom: 8 }}>{boks.tittel}</div>
                  <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 16 }}>{boks.beskrivelse}</div>
                  <div style={{ background: boks.farge, color: 'white', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>Åpne →</div>
                </div>
              ))}
            </div>
            <Oppgaver />
          </div>
        )}

        {aktivSeksjon === 'analyse' && <Boliganalyse onTilbake={() => setAktivSeksjon(null)} />}
        {aktivSeksjon === 'flipp' && <BoligerSeksjon kategori="flipp" onTilbake={() => setAktivSeksjon(null)} onÅpneProsjekt={åpneProsjekt} />}
        {aktivSeksjon === 'utleie' && <BoligerSeksjon kategori="utleie" onTilbake={() => setAktivSeksjon(null)} onÅpneProsjekt={åpneProsjekt} />}
        {aktivSeksjon === 'selge' && <Selge onTilbake={() => setAktivSeksjon(null)} />}
        {aktivSeksjon === 'regnskap' && (
          <Regnskap
            onTilbake={() => { setAktivSeksjon(null); setVisProsjekt(null) }}
            visProsjektId={visProsjekt}
            onSettVisProsjekt={setVisProsjekt}
          />
        )}
      </main>

      <AgentChat />
    </div>
  )
}
