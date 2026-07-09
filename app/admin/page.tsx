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
const Selge = dynamic(() => import('../components/Selge').then(m => m.Selge), { ssr: false, loading: laster })
const Regnskap = dynamic(() => import('../components/Regnskap').then(m => m.Regnskap), { ssr: false, loading: laster })
const Aktivitetslogg = dynamic(() => import('../components/Aktivitetslogg').then(m => m.Aktivitetslogg), { ssr: false, loading: laster })
const NorskeBoliger = dynamic(() => import('../components/NorskeBoliger').then(m => m.NorskeBoliger), { ssr: false, loading: laster })
const Timer = dynamic(() => import('../components/Timer').then(m => m.Timer), { ssr: false, loading: laster })
const Handverkere = dynamic(() => import('../components/Handverkere').then(m => m.Handverkere), { ssr: false, loading: laster })
const Selskaper = dynamic(() => import('../components/Selskaper').then(m => m.Selskaper), { ssr: false, loading: laster })
const Kapital = dynamic(() => import('../components/Kapital').then(m => m.Kapital), { ssr: false, loading: laster })
const HjemDashboard = dynamic(() => import('../components/HjemDashboard').then(m => m.HjemDashboard), { ssr: false, loading: laster })
const SelskapDashboard = dynamic(() => import('../components/SelskapDashboard').then(m => m.SelskapDashboard), { ssr: false, loading: laster })
const Varsler = dynamic(() => import('../components/Varsler').then(m => m.Varsler), { ssr: false, loading: laster })
const EiendomsRegister = dynamic(() => import('../components/EiendomsRegister').then(m => m.EiendomsRegister), { ssr: false, loading: laster })

type Seksjon = 'hjem' | 'loeiendom' | 'locasas' | 'eiendommer' | 'varsler' | 'analyse' | 'norge' | 'kapital' | 'selge' | 'regnskap' | 'timer' | 'handverkere' | 'selskaper' | 'logg' | null

const MØRK = FARGER.mork
const CREAM = FARGER.cream
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

function TomtSelskap({ navn }: { navn: string }) {
  return (
    <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 40, textAlign: 'center', color: FARGER.tekstLys, fontSize: 14 }}>
      Fant ikke selskapet «{navn}». Kjør migrasjonen <code>B1_selskaper.sql</code> i Supabase.
    </div>
  )
}

const SEKSJON_LBL: Record<Exclude<Seksjon, null>, string> = {
  hjem: 'Hjem',
  loeiendom: 'Loeiendom',
  locasas: 'Lo Casas',
  eiendommer: 'Eiendommer',
  varsler: 'Varsler',
  analyse: 'Boliganalyse',
  norge: 'Norske boliger',
  kapital: 'Kapital',
  selge: 'Selge',
  regnskap: 'Regnskap',
  timer: 'Timer',
  handverkere: 'Håndverkere',
  selskaper: 'Selskaper',
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
// Primær nav (C2) — kontrollrommet
const NAV_PRIMAER: NavLink[] = [
  { id: 'hjem', lbl: 'Hjem' },
  { id: 'analyse', lbl: 'Analyse' },
  { id: 'loeiendom', lbl: 'Loeiendom' },
  { id: 'locasas', lbl: 'Lo Casas' },
  { id: 'eiendommer', lbl: 'Eiendommer' },
  { id: 'kapital', lbl: 'Kapital' },
  { id: 'varsler', lbl: 'Varsler' },
]
// Sekundærfunksjoner — vises etter et skille.
// Flipp/Utleie/Portefølje er tatt ut av navigasjonen (C10 steg 8): de er dekket
// av Eiendommer-registeret + selskapsdashboardene. Render-grenene og komponentene
// beholdes til `er_portefolje`-migrasjonen er kjørt, så fjerningen er reversibel.
const NAV_MER: NavLink[] = [
  { id: 'norge', lbl: 'Norske boliger' },
  { id: 'selge', lbl: 'Selge' },
  { id: 'regnskap', lbl: 'Regnskap' },
  { id: 'timer', lbl: 'Timer' },
  { id: 'handverkere', lbl: 'Håndverk' },
  { id: 'selskaper', lbl: 'Selskaper' },
  { id: 'gjoremal', lbl: 'Gjøremål' },
  { id: 'logg', lbl: 'Logg' },
]
const NAV_LINKS: NavLink[] = [...NAV_PRIMAER, ...NAV_MER]

export default function Home() {
  const [bruker, setBruker] = useState<string | null>(null)
  const [aktivSeksjon, setAktivSeksjon] = useState<Seksjon>(null)
  const [visProsjekt, setVisProsjekt] = useState<string | null>(null)
  const [erMobil, setErMobil] = useState(false)
  const [mobilMenyApen, setMobilMenyApen] = useState(false)
  const [prosjektNavn, setProsjektNavn] = useState<Record<string, string>>({})
  const [scrollet, setScrollet] = useState(false)
  const [selskaper, setSelskaper] = useState<Array<{ id: string; navn: string; land: 'norge' | 'spania' }>>([])

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

  useEffect(() => {
    if (!bruker) return
    fetch('/api/selskaper').then(r => r.json()).then(d => setSelskaper(d.selskaper || [])).catch(() => {})
  }, [bruker])

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

  const norgeSelskap = selskaper.find(s => s.land === 'norge')
  const spaniaSelskap = selskaper.find(s => s.land === 'spania')

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
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: erMobil ? '24px 18px 100px' : '36px 28px 100px' }}>
          <HjemDashboard onÅpneEiendom={() => gåTil('eiendommer')} onÅpnePortefolje={() => gåTil('eiendommer')} />
          <div id="gjoremal" style={{ marginTop: 44 }}>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 20, textTransform: 'uppercase' }}>Gjøremål</div>
            <Oppgaver />
          </div>
        </main>
      )}

      {aktivSeksjon && (
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: erMobil ? '20px 18px 100px' : '36px 28px 100px' }}>
          <Breadcrumbs aktivSeksjon={aktivSeksjon} visProsjekt={visProsjekt} prosjektNavn={prosjektNavn} onHjem={hjem} onTilbakeSeksjon={() => setVisProsjekt(null)} />

          {aktivSeksjon === 'hjem' && <HjemDashboard onÅpneEiendom={() => gåTil('eiendommer')} onÅpnePortefolje={() => gåTil('eiendommer')} />}
          {aktivSeksjon === 'varsler' && <Varsler onÅpne={() => gåTil('eiendommer')} />}
          {aktivSeksjon === 'eiendommer' && <EiendomsRegister />}
          {aktivSeksjon === 'loeiendom' && (norgeSelskap
            ? <SelskapDashboard selskapId={norgeSelskap.id} navn={norgeSelskap.navn} land="norge" onÅpne={() => gåTil('eiendommer')} />
            : <TomtSelskap navn="Loeiendom" />)}
          {aktivSeksjon === 'locasas' && (spaniaSelskap
            ? <SelskapDashboard selskapId={spaniaSelskap.id} navn={spaniaSelskap.navn} land="spania" onÅpne={() => gåTil('eiendommer')} />
            : <TomtSelskap navn="Lo Casas" />)}
          {aktivSeksjon === 'analyse' && <Boliganalyse onTilbake={hjem} />}
          {aktivSeksjon === 'norge' && <NorskeBoliger onTilbake={hjem} />}
          {aktivSeksjon === 'timer' && <Timer onTilbake={hjem} />}
          {aktivSeksjon === 'handverkere' && <Handverkere onTilbake={hjem} />}
          {aktivSeksjon === 'selskaper' && <Selskaper />}
          {aktivSeksjon === 'kapital' && <Kapital />}
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
