'use client'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Innlogging } from '../components/Innlogging'
import { fjernAktivBruker, hentAktivBruker, settAktivBruker } from '../lib/aktivBruker'
import { supabase } from '../lib/supabase'
import { BREAKPOINT, FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

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
const Timer = dynamic(() => import('../components/Timer').then(m => m.Timer), { ssr: false, loading: laster })
const Handverkere = dynamic(() => import('../components/Handverkere').then(m => m.Handverkere), { ssr: false, loading: laster })

type Seksjon = 'analyse' | 'norge' | 'portefolje' | 'flipp' | 'utleie' | 'selge' | 'regnskap' | 'timer' | 'handverkere' | 'logg' | null

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
  { id: 'timer', ikon: '08', tittel: 'Timer', beskrivelse: 'Loggfør arbeidstimer per prosjekt — felles oversikt' },
  { id: 'handverkere', ikon: '09', tittel: 'Håndverkere', beskrivelse: 'Nettverk av rørleggere, elektrikere, flisleggere osv.' },
]

const SEKSJON_LBL: Record<Exclude<Seksjon, null>, string> = {
  analyse: 'Boliganalyse',
  norge: 'Norske boliger',
  portefolje: 'Min portefølje',
  flipp: 'Flipp',
  utleie: 'Utleie',
  selge: 'Selge',
  regnskap: 'Regnskap',
  timer: 'Timer',
  handverkere: 'Håndverkere',
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
  const krumStil: React.CSSProperties = {
    background: 'none', border: 'none', color: FARGER.tekstMid,
    cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500,
    letterSpacing: '-0.005em',
  }
  return (
    <div style={{ fontSize: 13, color: FARGER.tekstMid, marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button onClick={onHjem} style={krumStil}>Hjem</button>
      <span style={{ color: FARGER.tekstLys, fontSize: 11 }}>/</span>
      {visProsjekt ? (
        <>
          <button onClick={onTilbakeSeksjon} style={krumStil}>{seksjonLbl}</button>
          <span style={{ color: FARGER.tekstLys, fontSize: 11 }}>/</span>
          <span style={{ color: MØRK, fontWeight: 600, letterSpacing: '-0.005em' }}>{navn || 'Prosjekt'}</span>
        </>
      ) : (
        <span style={{ color: MØRK, fontWeight: 600, letterSpacing: '-0.005em' }}>{seksjonLbl}</span>
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
  { id: 'timer', lbl: 'Timer' },
  { id: 'handverkere', lbl: 'Håndverk' },
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
  const [scrollet, setScrollet] = useState(false)

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
    function sjekkScroll() { setScrollet(window.scrollY > 8) }
    sjekkScroll()
    window.addEventListener('scroll', sjekkScroll, { passive: true })
    return () => window.removeEventListener('scroll', sjekkScroll)
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
    <div style={{ background: CREAM, minHeight: '100vh', color: MØRK }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: scrollet ? 'rgba(250, 250, 246, 0.85)' : 'rgba(250, 250, 246, 0.6)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: scrollet ? `1px solid ${FARGER.kantUltralys}` : '1px solid transparent',
        boxShadow: scrollet ? SHADOW.xs : 'none',
        padding: erMobil ? '12px 18px' : '14px 28px',
        display: 'flex', alignItems: 'center', gap: 16,
        transition: `background ${MOTION.normal}, border-color ${MOTION.normal}, box-shadow ${MOTION.normal}`,
      }}>
        <button onClick={hjem} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 12, flex: erMobil ? 1 : 'initial' }}>
          <Image src="/logo.png" alt="Leganger & Osvaag" width={erMobil ? 36 : 40} height={erMobil ? 36 : 40} style={{ objectFit: 'contain' }} priority />
          {!erMobil && <span style={{ fontSize: 13, fontWeight: 600, color: MØRK, letterSpacing: '0.18em' }}>LEGANGER &amp; OSVAAG</span>}
        </button>

        {!erMobil && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            {NAV_LINKS.map(l => {
              const aktiv = aktivSeksjon === l.id
              const onClick = l.id === 'gjoremal' ? gåTilGjoremal : () => gåTil(l.id as Seksjon)
              return (
                <button key={l.id} onClick={onClick} className="nav-lenke"
                  style={{
                    background: aktiv ? FARGER.mork : 'transparent',
                    border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: aktiv ? 600 : 500,
                    color: aktiv ? FARGER.creamLys : FARGER.tekstMid,
                    padding: '8px 14px',
                    letterSpacing: '-0.005em',
                    borderRadius: RADIUS.pill,
                    transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
                  }}>{l.lbl}</button>
              )
            })}
          </div>
        )}

        {!erMobil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" className="nav-lenke" style={{ fontSize: 12, color: FARGER.tekstMid, textDecoration: 'none', letterSpacing: '-0.005em', fontWeight: 500 }}>↗ Portal</Link>
            <div style={{ width: 1, height: 18, background: FARGER.kantUltralys }} />
            <span style={{ fontSize: 13, color: MØRK, fontWeight: 600, letterSpacing: '-0.005em' }}>{bruker.charAt(0).toUpperCase() + bruker.slice(1)}</span>
            <button onClick={loggUt} className="nav-lenke" style={{ background: 'none', border: 'none', color: FARGER.tekstLys, fontSize: 12, cursor: 'pointer', letterSpacing: '-0.005em', fontWeight: 500 }}>Logg ut</button>
          </div>
        )}

        {erMobil && (
          <button onClick={() => setMobilMenyApen(o => !o)}
            aria-label="Meny"
            style={{
              background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
              cursor: 'pointer', padding: 0,
              width: 40, height: 40, fontSize: 17, color: MØRK,
              borderRadius: RADIUS.pill,
              boxShadow: SHADOW.xs,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {mobilMenyApen ? '✕' : '☰'}
          </button>
        )}
      </nav>

      {erMobil && mobilMenyApen && (
        <div className="anim-fade-down" style={{ background: CREAM_LYS, borderTop: `1px solid ${FARGER.kantUltralys}`, padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: SHADOW.md }}>
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
                  background: aktiv ? FARGER.mork : 'transparent',
                  color: aktiv ? FARGER.creamLys : MØRK,
                  border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: aktiv ? 600 : 500,
                  padding: '12px 16px', textAlign: 'left',
                  letterSpacing: '-0.005em',
                  borderRadius: RADIUS.pill,
                }}>{l.lbl}</button>
            )
          })}
          <div style={{ borderTop: `1px solid ${FARGER.kantUltralys}`, marginTop: 10, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 8px 4px' }}>
            <span style={{ fontSize: 13, color: MØRK, fontWeight: 600, letterSpacing: '-0.005em' }}>{bruker.charAt(0).toUpperCase() + bruker.slice(1)}</span>
            <button onClick={loggUt} style={{ background: 'none', border: 'none', color: FARGER.tekstLys, fontSize: 12, cursor: 'pointer', letterSpacing: '-0.005em', fontWeight: 500 }}>Logg ut</button>
          </div>
        </div>
      )}

      {!aktivSeksjon && (
        <>
          <section style={{
            background: `linear-gradient(180deg, ${CREAM_LYS} 0%, ${CREAM} 100%)`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div aria-hidden style={{
              position: 'absolute', top: '-20%', right: '-10%',
              width: '50%', height: '120%',
              background: `radial-gradient(circle, ${GULL}15 0%, transparent 60%)`,
              pointerEvents: 'none',
            }} />
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: erMobil ? '64px 24px' : '110px 28px', textAlign: 'center', position: 'relative' }}>
              <div className="anim-fade-up" style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 22 }}>ADMIN</div>
              <h1 className="anim-fade-up" style={{ fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1.05, fontWeight: 300, color: MØRK, margin: '0 0 22px', letterSpacing: '-0.025em', animationDelay: '60ms' }}>
                Velkommen, {bruker.charAt(0).toUpperCase() + bruker.slice(1)}
              </h1>
              <p className="anim-fade-up" style={{ fontSize: 'clamp(16px, 2vw, 18px)', lineHeight: 1.6, color: FARGER.tekstMid, margin: '0 auto 40px', maxWidth: 580, fontWeight: 300, animationDelay: '120ms' }}>
                Analyser eiendommer, følg opp prosjekter og publiser boliger til portalen — alt på ett sted.
              </p>
              <button onClick={() => gåTil('analyse')} className="anim-fade-up knapp-hover-loft" style={{
                background: MØRK, color: CREAM_LYS, border: 'none',
                padding: '16px 32px', fontSize: 13, fontWeight: 600,
                letterSpacing: '-0.005em',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                borderRadius: RADIUS.pill,
                boxShadow: SHADOW.md,
                animationDelay: '180ms',
              }}>
                Analyser ny bolig
                <span aria-hidden>→</span>
              </button>
            </div>
          </section>

          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 28px 16px' }}>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 20, textTransform: 'uppercase' }}>Oversikt — Spania</div>
            <Dashboard marked="spania" onApneProsjekt={(id) => { setAktivSeksjon('regnskap'); setVisProsjekt(id) }} />
            <p style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 14, fontStyle: 'italic' }}>
              Norske prosjekter ligger i sin egen Norge-fane med eget dashboard.
            </p>
          </section>

          <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 28px 96px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: erMobil ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: erMobil ? 40 : 56 }}>
              <div>
                <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 20, textTransform: 'uppercase' }}>Snarveier</div>
                <div style={{ display: 'grid', gridTemplateColumns: erMobil ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
                  {SEKSJONER.map((boks, i) => (
                    <button
                      key={boks.id}
                      onClick={() => gåTil(boks.id)}
                      className="kort-loft anim-fade-up"
                      style={{
                        background: FARGER.hvit,
                        border: `1px solid ${FARGER.kantUltralys}`,
                        padding: '28px 26px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderRadius: RADIUS.lg,
                        boxShadow: SHADOW.sm,
                        animationDelay: `${Math.min(i, 8) * 40}ms`,
                        display: 'flex', flexDirection: 'column',
                      }}
                    >
                      <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 12 }}>{boks.ikon}</div>
                      <div style={{ fontSize: 19, fontWeight: 500, color: MØRK, marginBottom: 8, letterSpacing: '-0.015em' }}>{boks.tittel}</div>
                      <div style={{ fontSize: 13.5, color: FARGER.tekstMid, lineHeight: 1.55, fontWeight: 400 }}>{boks.beskrivelse}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div id="gjoremal">
                <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 20, textTransform: 'uppercase' }}>Gjøremål</div>
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
          {aktivSeksjon === 'timer' && <Timer onTilbake={hjem} />}
          {aktivSeksjon === 'handverkere' && <Handverkere onTilbake={hjem} />}
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
