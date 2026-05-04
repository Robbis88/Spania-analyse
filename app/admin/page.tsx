'use client'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Innlogging } from '../components/Innlogging'
import { fjernAktivBruker, hentAktivBruker, settAktivBruker } from '../lib/aktivBruker'
import { supabase } from '../lib/supabase'
import { BREAKPOINT, FARGER } from '../lib/styles'

// Lazy-loadede seksjoner — bare den brukeren åpner havner i nedlastet JS.
// Bytter ut ~3000+ linjer fra initial admin-bundle.
const laster = () => <div style={{ textAlign: 'center', padding: 60, color: FARGER.tekstLys }}>Laster…</div>
const Oppgaver = dynamic(() => import('../components/Oppgaver').then(m => m.Oppgaver), { ssr: false, loading: laster })
const AgentChat = dynamic(() => import('../components/AgentChat').then(m => m.AgentChat), { ssr: false, loading: laster })
const Boliganalyse = dynamic(() => import('../components/Boliganalyse').then(m => m.Boliganalyse), { ssr: false, loading: laster })
const BoligerSeksjon = dynamic(() => import('../components/BoligerSeksjon').then(m => m.BoligerSeksjon), { ssr: false, loading: laster })
const Selge = dynamic(() => import('../components/Selge').then(m => m.Selge), { ssr: false, loading: laster })
const Regnskap = dynamic(() => import('../components/Regnskap').then(m => m.Regnskap), { ssr: false, loading: laster })
const Aktivitetslogg = dynamic(() => import('../components/Aktivitetslogg').then(m => m.Aktivitetslogg), { ssr: false, loading: laster })
const NorskeBoliger = dynamic(() => import('../components/NorskeBoliger').then(m => m.NorskeBoliger), { ssr: false, loading: laster })
const Dashboard = dynamic(() => import('../components/Dashboard').then(m => m.Dashboard), { ssr: false, loading: laster })
const Portefolje = dynamic(() => import('../components/portefolje/Portefolje').then(m => m.Portefolje), { ssr: false, loading: laster })

type Seksjon = 'analyse' | 'norge' | 'portefolje' | 'flipp' | 'utleie' | 'selge' | 'regnskap' | 'logg' | null

const MØRK = FARGER.mork
const CREAM = FARGER.cream
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

type Snarvei = {
  id: Exclude<Seksjon, null>
  ikon: string
  tittel: string
  beskrivelse: string
}

const SEKSJONER: Snarvei[] = [
  { id: 'analyse', ikon: '01', tittel: 'Boliganalyse', beskrivelse: 'Vurder ny eiendom — score, yield og strategi (Spania)' },
  { id: 'norge', ikon: '02', tittel: 'Norske boliger', beskrivelse: 'Flippe-kalkulator for norske Finn-annonser' },
  { id: 'portefolje', ikon: '03', tittel: 'Min portefølje', beskrivelse: 'Eide eiendommer i Norge — verdi, lån, leie, cashflow' },
  { id: 'flipp', ikon: '04', tittel: 'Boligflipp', beskrivelse: 'Kjøp, puss opp, selg med fortjeneste' },
  { id: 'utleie', ikon: '05', tittel: 'Boligutleie', beskrivelse: 'Aktive utleieboliger og prognoser' },
  { id: 'selge', ikon: '06', tittel: 'Selge bolig', beskrivelse: 'Salg, skatt og sluttkalkyle' },
  { id: 'regnskap', ikon: '07', tittel: 'Regnskap', beskrivelse: 'Tall, oversikt og årsrapport' },
]

const SEKSJON_LBL: Record<Exclude<Seksjon, null>, string> = {
  analyse: 'Boliganalyse',
  norge: 'Norske boliger',
  portefolje: 'Min portefølje',
  flipp: 'Flipp',
  utleie: 'Utleie',
  selge: 'Selge',
  regnskap: 'Regnskap',
  logg: 'Aktivitetslogg',
}

function Breadcrumbs({ aktivSeksjon, visProsjekt, prosjektNavn, onHjem, onTilbakeSeksjon }: {
  aktivSeksjon: Exclude<Seksjon, null>
  visProsjekt: string | null
  prosjektNavn: Record<string, string>
  onHjem: () => void
  onTilbakeSeksjon: () => void
}) {
  const seksjonLbl = SEKSJON_LBL[aktivSeksjon]
  const navn = visProsjekt ? prosjektNavn[visProsjekt] : null
  return (
    <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <button onClick={onHjem} style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', padding: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Hjem</button>
      <span style={{ color: GULL }}>/</span>
      {visProsjekt ? (
        <>
          <button onClick={onTilbakeSeksjon} style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', padding: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{seksjonLbl}</button>
          <span style={{ color: GULL }}>/</span>
          <span style={{ color: MØRK, fontWeight: 600 }}>{navn || 'Prosjekt'}</span>
        </>
      ) : (
        <span style={{ color: MØRK, fontWeight: 600 }}>{seksjonLbl}</span>
      )}
    </div>
  )
}

type NavLink = { id: Seksjon | 'gjoremal'; lbl: string }
const NAV_LINKS: NavLink[] = [
  { id: 'analyse', lbl: 'Analyse' },
  { id: 'norge', lbl: 'Norge' },
  { id: 'portefolje', lbl: 'Portefølje' },
  { id: 'flipp', lbl: 'Flipp' },
  { id: 'utleie', lbl: 'Utleie' },
  { id: 'selge', lbl: 'Selge' },
  { id: 'regnskap', lbl: 'Regnskap' },
  { id: 'gjoremal', lbl: 'Gjøremål' },
  { id: 'logg', lbl: 'Logg' },
]

export default function Home() {
  const [bruker, setBruker] = useState<string | null>(null)
  const [aktivSeksjon, setAktivSeksjon] = useState<Seksjon>(null)
  const [visProsjekt, setVisProsjekt] = useState<string | null>(null)
  const [erMobil, setErMobil] = useState(false)
  const [mobilMenyApen, setMobilMenyApen] = useState(false)
  const [prosjektNavn, setProsjektNavn] = useState<Record<string, string>>({})

  useEffect(() => {
    const lagret = hentAktivBruker()
    if (!lagret) return
    // Verifiser at server-sesjonen faktisk er gyldig før vi viser admin-UI.
    // Hindrer at innlogget-i-localStorage + ingen-cookie viser en tom admin
    // hvor alle API-kall returnerer 401.
    fetch('/api/auth')
      .then(r => {
        if (r.ok) setBruker(lagret)
        else fjernAktivBruker()
      })
      .catch(() => { /* nettverksfeil — vi lar bruker prøve å logge inn på nytt */ })
  }, [])

  useEffect(() => {
    function sjekkBredde() { setErMobil(window.innerWidth < BREAKPOINT.mobil) }
    sjekkBredde()
    window.addEventListener('resize', sjekkBredde)
    return () => window.removeEventListener('resize', sjekkBredde)
  }, [])

  useEffect(() => {
    if (!bruker) return
    supabase.from('prosjekter').select('id, navn').then(({ data }) => {
      const map: Record<string, string> = {}
      for (const p of (data || []) as Array<{ id: string; navn: string }>) map[p.id] = p.navn
      setProsjektNavn(map)
    })
  }, [bruker, visProsjekt])

  function loggInn(b: string) {
    settAktivBruker(b)
    setBruker(b)
  }

  function loggUt() {
    fjernAktivBruker()
    fetch('/api/auth', { method: 'DELETE' }).catch(() => {})
    setBruker(null)
    setAktivSeksjon(null)
    setVisProsjekt(null)
  }

  if (!bruker) return <Innlogging onLoggetInn={loggInn} />

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
    <div style={{ fontFamily: 'sans-serif', background: CREAM, minHeight: '100vh', color: MØRK }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(250, 250, 246, 0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${FARGER.gullSvak}`,
        padding: erMobil ? '12px 18px' : '14px 28px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={hjem} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 12, flex: erMobil ? 1 : 'initial' }}>
          <Image src="/logo.png" alt="Leganger & Osvaag" width={erMobil ? 36 : 40} height={erMobil ? 36 : 40} style={{ objectFit: 'contain' }} priority />
          {!erMobil && <span style={{ fontSize: 13, fontWeight: 600, color: MØRK, letterSpacing: '0.18em' }}>LEGANGER &amp; OSVAAG</span>}
        </button>

        {!erMobil && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 26, flexWrap: 'wrap' }}>
            {NAV_LINKS.map(l => {
              const aktiv = aktivSeksjon === l.id
              const onClick = l.id === 'gjoremal' ? gåTilGjoremal : () => gåTil(l.id as Seksjon)
              return (
                <button key={l.id} onClick={onClick}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: aktiv ? 700 : 500,
                    color: aktiv ? MØRK : FARGER.tekstMid,
                    padding: '6px 2px',
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    borderBottom: aktiv ? `1px solid ${GULL}` : '1px solid transparent',
                  }}>{l.lbl}</button>
              )
            })}
          </div>
        )}

        {!erMobil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/" style={{ fontSize: 11, color: FARGER.tekstLys, textDecoration: 'none', letterSpacing: '0.12em', textTransform: 'uppercase' }}>↗ Portal</Link>
            <span style={{ fontSize: 12, color: MØRK, fontWeight: 600 }}>{bruker.charAt(0).toUpperCase() + bruker.slice(1)}</span>
            <button onClick={loggUt} style={{ background: 'none', border: 'none', color: FARGER.tekstLys, fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Logg ut</button>
          </div>
        )}

        {erMobil && (
          <button onClick={() => setMobilMenyApen(o => !o)}
            aria-label="Meny"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, fontSize: 22, color: MØRK }}>
            {mobilMenyApen ? '✕' : '☰'}
          </button>
        )}
      </nav>

      {erMobil && mobilMenyApen && (
        <div style={{ background: CREAM_LYS, borderBottom: `1px solid ${FARGER.gullSvak}`, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_LINKS.map(l => {
            const aktiv = aktivSeksjon === l.id
            const onClick = () => {
              if (l.id === 'gjoremal') gåTilGjoremal()
              else gåTil(l.id as Seksjon)
              setMobilMenyApen(false)
            }
            return (
              <button key={l.id} onClick={onClick}
                style={{
                  background: aktiv ? FARGER.flateLys : 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: aktiv ? 700 : 500, color: MØRK,
                  padding: '12px 14px', textAlign: 'left',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{l.lbl}</button>
            )
          })}
          <div style={{ borderTop: `1px solid ${FARGER.gullSvak}`, marginTop: 6, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
            <span style={{ fontSize: 12, color: MØRK, fontWeight: 600 }}>{bruker.charAt(0).toUpperCase() + bruker.slice(1)}</span>
            <button onClick={loggUt} style={{ background: 'none', border: 'none', color: FARGER.tekstLys, fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Logg ut</button>
          </div>
        </div>
      )}

      {!aktivSeksjon && (
        <>
          <section style={{ background: `linear-gradient(180deg, ${CREAM_LYS} 0%, ${CREAM} 100%)`, borderBottom: `1px solid ${FARGER.gullSvak}` }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: erMobil ? '60px 24px' : '96px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 22 }}>ADMIN</div>
              <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 50px)', lineHeight: 1.1, fontWeight: 300, color: MØRK, margin: '0 0 20px', letterSpacing: '-0.01em' }}>
                Velkommen, {bruker.charAt(0).toUpperCase() + bruker.slice(1)}
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: FARGER.tekstMid, margin: '0 auto 36px', maxWidth: 540, fontWeight: 300 }}>
                Analyser eiendommer, følg opp prosjekter og publiser boliger til portalen — alt på ett sted.
              </p>
              <button onClick={() => gåTil('analyse')} style={{
                background: MØRK, color: CREAM_LYS, border: 'none',
                padding: '16px 32px', fontSize: 12, fontWeight: 600,
                letterSpacing: '0.16em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}>
                Analyser ny bolig →
              </button>
            </div>
          </section>

          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 28px 16px' }}>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 18 }}>OVERSIKT — SPANIA</div>
            <Dashboard marked="spania" onApneProsjekt={(id) => { setAktivSeksjon('regnskap'); setVisProsjekt(id) }} />
            <p style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 12, fontStyle: 'italic' }}>
              Norske prosjekter ligger i sin egen Norge-fane med eget dashboard.
            </p>
          </section>

          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px 80px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: erMobil ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: 48 }}>
              <div>
                <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 18 }}>SNARVEIER</div>
                <div style={{ display: 'grid', gridTemplateColumns: erMobil ? '1fr' : 'repeat(2, 1fr)', gap: 0, border: `1px solid ${FARGER.gullSvak}` }}>
                  {SEKSJONER.map((boks, i) => (
                    <button
                      key={boks.id}
                      onClick={() => gåTil(boks.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderRight: !erMobil && i % 2 === 0 ? `1px solid ${FARGER.gullSvak}` : 'none',
                        borderBottom: i < SEKSJONER.length - (erMobil ? 1 : 2) ? `1px solid ${FARGER.gullSvak}` : 'none',
                        padding: '32px 28px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s',
                        fontFamily: 'sans-serif',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = FARGER.flateLys }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >
                      <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.16em', fontWeight: 700, marginBottom: 12 }}>{boks.ikon}</div>
                      <div style={{ fontSize: 20, fontWeight: 400, color: MØRK, marginBottom: 6, letterSpacing: '-0.005em' }}>{boks.tittel}</div>
                      <div style={{ fontSize: 13, color: FARGER.tekstMid, lineHeight: 1.5, fontWeight: 300 }}>{boks.beskrivelse}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div id="gjoremal">
                <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 18 }}>GJØREMÅL</div>
                <Oppgaver />
              </div>
            </div>
          </section>
        </>
      )}

      {aktivSeksjon && (
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: erMobil ? '20px 18px 100px' : '36px 28px 100px' }}>
          <Breadcrumbs aktivSeksjon={aktivSeksjon} visProsjekt={visProsjekt} prosjektNavn={prosjektNavn} onHjem={hjem} onTilbakeSeksjon={() => setVisProsjekt(null)} />

          {aktivSeksjon === 'analyse' && <Boliganalyse onTilbake={hjem} />}
          {aktivSeksjon === 'norge' && <NorskeBoliger onTilbake={hjem} />}
          {aktivSeksjon === 'portefolje' && <Portefolje onTilbake={hjem} />}
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
          {aktivSeksjon === 'logg' && <Aktivitetslogg onTilbake={hjem} />}
        </main>
      )}

      <AgentChat />
    </div>
  )
}
