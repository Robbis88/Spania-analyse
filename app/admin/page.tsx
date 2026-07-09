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
const Bilagsinnboks = dynamic(() => import('../components/Bilagsinnboks').then(m => m.Bilagsinnboks), { ssr: false, loading: laster })

type Seksjon = 'hjem' | 'loeiendom' | 'locasas' | 'eiendommer' | 'varsler' | 'analyse' | 'norge' | 'kapital' | 'selge' | 'regnskap' | 'bilag' | 'timer' | 'handverkere' | 'selskaper' | 'logg' | null

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
  bilag: 'Bilagsinnboks',
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

type NavLink = { id: Seksjon | 'gjoremal'; lbl: string; ikon: string }
// Sidemeny (C2) — kontrollrommet gruppert i Hovedmeny / Verktøy / System.
// Flipp/Utleie/Portefølje er tatt ut av navigasjonen (C10 steg 8): de er dekket
// av Eiendommer-registeret + selskapsdashboardene. Render-grenene og komponentene
// beholdes til `er_portefolje`-migrasjonen er kjørt, så fjerningen er reversibel.
const NAV_GRUPPER: Array<{ tittel: string; lenker: NavLink[] }> = [
  { tittel: 'Hovedmeny', lenker: [
    { id: 'hjem', lbl: 'Hjem', ikon: '🏠' },
    { id: 'analyse', lbl: 'Analyse', ikon: '🔍' },
    { id: 'loeiendom', lbl: 'Loeiendom', ikon: '🏢' },
    { id: 'locasas', lbl: 'Lo Casas', ikon: '🌅' },
    { id: 'eiendommer', lbl: 'Eiendommer', ikon: '🗂️' },
    { id: 'kapital', lbl: 'Kapital', ikon: '💰' },
    { id: 'varsler', lbl: 'Varsler', ikon: '🔔' },
  ] },
  { tittel: 'Verktøy', lenker: [
    { id: 'norge', lbl: 'Norske boliger', ikon: '🇳🇴' },
    { id: 'selge', lbl: 'Selge', ikon: '🏷️' },
    { id: 'regnskap', lbl: 'Regnskap', ikon: '📊' },
    { id: 'bilag', lbl: 'Bilag', ikon: '📄' },
    { id: 'handverkere', lbl: 'Håndverkere', ikon: '🔨' },
    { id: 'selskaper', lbl: 'Selskaper', ikon: '🏛️' },
    { id: 'timer', lbl: 'Timer', ikon: '⏱️' },
    { id: 'gjoremal', lbl: 'Gjøremål', ikon: '✅' },
  ] },
  { tittel: 'System', lenker: [
    { id: 'logg', lbl: 'Aktivitetslogg', ikon: '📜' },
  ] },
]

export default function Home() {
  const [bruker, setBruker] = useState<string | null>(null)
  const [aktivSeksjon, setAktivSeksjon] = useState<Seksjon>(null)
  const [visProsjekt, setVisProsjekt] = useState<string | null>(null)
  const [erMobil, setErMobil] = useState(false)
  const [smalSkjerm, setSmalSkjerm] = useState(false)
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
    function sjekkBredde() {
      setErMobil(window.innerWidth < BREAKPOINT.mobil)
      setSmalSkjerm(window.innerWidth < BREAKPOINT.tablet)
    }
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

  const SIDEBAR_W = 236
  const navKlikk = (id: NavLink['id']) => {
    if (id === 'gjoremal') gåTilGjoremal()
    else gåTil(id as Seksjon)
    setMobilMenyApen(false)
  }
  const erAktiv = (id: NavLink['id']) => id === 'hjem' ? (!aktivSeksjon || aktivSeksjon === 'hjem') : aktivSeksjon === id

  const sidemeny = (iDrawer: boolean) => (
    <aside style={{
      width: SIDEBAR_W, background: FARGER.mork, color: FARGER.creamLys,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 40,
      boxShadow: iDrawer ? SHADOW.xl : 'none',
    }}>
      {/* Logo */}
      <button onClick={() => { hjem(); setMobilMenyApen(false) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, padding: '18px 18px 16px' }}>
        <Image src="/logo.png" alt="Leganger & Osvaag" width={34} height={34} style={{ objectFit: 'contain', borderRadius: 8 }} priority />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: FARGER.creamLys, letterSpacing: '0.12em', textAlign: 'left', lineHeight: 1.3 }}>LEGANGER &amp;<br />OSVAAG</span>
      </button>

      {/* Nav-grupper */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 12px' }}>
        {NAV_GRUPPER.map(g => (
          <div key={g.tittel} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9.5, color: 'rgba(253,252,247,0.4)', letterSpacing: '0.22em', fontWeight: 700, textTransform: 'uppercase', padding: '0 10px', marginBottom: 8 }}>{g.tittel}</div>
            <div style={{ display: 'grid', gap: 2 }}>
              {g.lenker.map(l => {
                const aktiv = erAktiv(l.id)
                return (
                  <button key={l.id} onClick={() => navKlikk(l.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                      background: aktiv ? 'rgba(184,154,111,0.18)' : 'transparent',
                      borderLeft: `2.5px solid ${aktiv ? FARGER.gull : 'transparent'}`,
                      border: 'none', borderRadius: RADIUS.sm,
                      color: aktiv ? FARGER.creamLys : 'rgba(253,252,247,0.66)',
                      fontSize: 13, fontWeight: aktiv ? 600 : 500,
                      padding: '9px 10px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
                      boxShadow: aktiv ? `inset 2.5px 0 0 ${FARGER.gull}` : 'none',
                    }}>
                    <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{l.ikon}</span>
                    {l.lbl}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bunn: portal + bruker + logg ut */}
      <div style={{ borderTop: '1px solid rgba(253,252,247,0.1)', padding: '12px 16px 16px' }}>
        <Link href="/" style={{ fontSize: 11.5, color: 'rgba(253,252,247,0.55)', textDecoration: 'none', fontWeight: 500 }}>↗ Portal</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ width: 32, height: 32, borderRadius: RADIUS.pill, background: FARGER.gull, color: FARGER.mork, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{bruker.charAt(0).toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: FARGER.creamLys, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bruker.charAt(0).toUpperCase() + bruker.slice(1)}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(253,252,247,0.45)' }}>Admin</div>
          </div>
          <button onClick={loggUt} title="Logg ut" style={{ background: 'none', border: 'none', color: 'rgba(253,252,247,0.55)', fontSize: 15, cursor: 'pointer', padding: 4 }}>⎋</button>
        </div>
      </div>
    </aside>
  )

  const iDag = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  const selskapVerdi = aktivSeksjon === 'loeiendom' ? 'loeiendom' : aktivSeksjon === 'locasas' ? 'locasas' : 'alle'

  return (
    <div style={{ background: CREAM, minHeight: '100vh', color: MØRK }}>
      {/* SIDEMENY — fast på desktop, uttrekk på smal skjerm */}
      {!smalSkjerm && sidemeny(false)}
      {smalSkjerm && mobilMenyApen && (
        <>
          <div onClick={() => setMobilMenyApen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.4)', zIndex: 39 }} />
          {sidemeny(true)}
        </>
      )}

      {/* HOVEDOMRÅDE */}
      <div style={{ marginLeft: smalSkjerm ? 0 : SIDEBAR_W, minWidth: 0 }}>
        {/* TOPPLINJE */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: scrollet ? 'rgba(250, 250, 246, 0.85)' : 'rgba(250, 250, 246, 0.72)',
          backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: `1px solid ${scrollet ? FARGER.kantUltralys : 'transparent'}`,
          boxShadow: scrollet ? SHADOW.xs : 'none',
          padding: erMobil ? '10px 16px' : '12px 26px',
          display: 'flex', alignItems: 'center', gap: 12,
          transition: `background ${MOTION.normal}, border-color ${MOTION.normal}, box-shadow ${MOTION.normal}`,
        }}>
          {smalSkjerm && (
            <button onClick={() => setMobilMenyApen(o => !o)} aria-label="Meny"
              style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, cursor: 'pointer', width: 38, height: 38, fontSize: 16, color: MØRK, borderRadius: RADIUS.pill, boxShadow: SHADOW.xs, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mobilMenyApen ? '✕' : '☰'}
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Selskapsvelger */}
          <select value={selskapVerdi} onChange={e => { const v = e.target.value; if (v === 'loeiendom') gåTil('loeiendom'); else if (v === 'locasas') gåTil('locasas'); else hjem() }}
            style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: erMobil ? '8px 10px' : '8px 14px', fontSize: 12.5, fontWeight: 600, color: MØRK, cursor: 'pointer', fontFamily: 'inherit', boxShadow: SHADOW.xs, outline: 'none' }}>
            <option value="alle">🏢 Alle selskaper</option>
            <option value="loeiendom">Loeiendom (Norge)</option>
            <option value="locasas">Lo Casas (Spania)</option>
          </select>

          {!erMobil && (
            <span style={{ fontSize: 12.5, color: FARGER.tekstMid, fontWeight: 500, background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: '8px 14px', boxShadow: SHADOW.xs, whiteSpace: 'nowrap' }}>📅 {iDag}</span>
          )}

          <button onClick={() => gåTil('varsler')} aria-label="Varsler"
            style={{ position: 'relative', background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, width: 38, height: 38, fontSize: 15, cursor: 'pointer', boxShadow: SHADOW.xs, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔔
          </button>

          {!smalSkjerm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 4 }}>
              <span style={{ width: 34, height: 34, borderRadius: RADIUS.pill, background: FARGER.mork, color: FARGER.creamLys, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{bruker.charAt(0).toUpperCase()}</span>
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: MØRK }}>{bruker.charAt(0).toUpperCase() + bruker.slice(1)}</div>
                <div style={{ fontSize: 10.5, color: FARGER.tekstLys }}>Admin</div>
              </div>
            </div>
          )}
        </header>

        {/* INNHOLD */}
        {!aktivSeksjon && (
          <main style={{ maxWidth: 1280, margin: '0 auto', padding: erMobil ? '22px 16px 100px' : '30px 30px 100px' }}>
            <HjemDashboard bruker={bruker} onÅpneEiendom={() => gåTil('eiendommer')} onÅpnePortefolje={() => gåTil('eiendommer')} onÅpneVarsler={() => gåTil('varsler')} />
            <div id="gjoremal" style={{ marginTop: 44 }}>
              <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 20, textTransform: 'uppercase' }}>Gjøremål</div>
              <Oppgaver />
            </div>
          </main>
        )}

        {aktivSeksjon && (
          <main style={{ maxWidth: 1180, margin: '0 auto', padding: erMobil ? '18px 16px 100px' : '30px 30px 100px' }}>
            <Breadcrumbs aktivSeksjon={aktivSeksjon} visProsjekt={visProsjekt} prosjektNavn={prosjektNavn} onHjem={hjem} onTilbakeSeksjon={() => setVisProsjekt(null)} />

            {aktivSeksjon === 'hjem' && <HjemDashboard bruker={bruker} onÅpneEiendom={() => gåTil('eiendommer')} onÅpnePortefolje={() => gåTil('eiendommer')} onÅpneVarsler={() => gåTil('varsler')} />}
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
            {aktivSeksjon === 'bilag' && <Bilagsinnboks />}
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
      </div>

      <AgentChat />
    </div>
  )
}
