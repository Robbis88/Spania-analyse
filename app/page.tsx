'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PortalHeader } from './components/portal/PortalHeader'
import { InteresseModal } from './components/portal/InteresseModal'
import { plukkOversettelse, useSprak, useValuta } from './lib/i18n'
import { FARGER, RADIUS, SHADOW, MOTION } from './lib/styles'

const MØRK = FARGER.mork
const CREAM = FARGER.cream
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

type Bolig = {
  id: string
  navn: string
  navn_oversettelser?: Record<string, string> | null
  til_leie: boolean
  til_salgs: boolean
  utleie_kort: string | null
  utleie_kort_oversettelser?: Record<string, string> | null
  salg_kort: string | null
  salg_kort_oversettelser?: Record<string, string> | null
  pris_natt: number | null
  salgspris_eur: number | null
  maks_gjester: number | null
  beliggenhet: string | null
  soverom: string | number | null
  bad: string | number | null
  areal: string | number | null
  bilde_url: string | null
  bilde_urler?: string[]
}

type Filter = 'alle' | 'leie' | 'salgs'


export default function Forside() {
  const { t } = useSprak()
  const [boliger, setBoliger] = useState<Bolig[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('alle')
  const [modalApen, setModalApen] = useState(false)

  // Henter listen én gang. Feilmeldingen lokaliseres senere via t.feil_oppstod
  // i render — å ha t.feil_oppstod i deps trigger refetch ved språkbytte.
  useEffect(() => {
    let avbrutt = false
    fetch('/api/utleie-portal')
      .then(r => r.json())
      .then((data: { boliger?: Bolig[]; feil?: string }) => {
        if (avbrutt) return
        if (data.feil) setFeil(data.feil)
        else setBoliger(data.boliger || [])
        setLaster(false)
      })
      .catch(e => {
        if (avbrutt) return
        setFeil(e instanceof Error ? e.message : '__feil__')
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [])

  // Lytter til ?type= i URL ved navigering fra header
  useEffect(() => {
    function lesUrl() {
      if (typeof window === 'undefined') return
      const params = new URLSearchParams(window.location.search)
      const type = params.get('type')
      if (type === 'leie' || type === 'salgs') setFilter(type)
      else setFilter('alle')
    }
    lesUrl()
    window.addEventListener('popstate', lesUrl)
    return () => window.removeEventListener('popstate', lesUrl)
  }, [])

  const filtrert = useMemo(() => boliger.filter(b =>
    filter === 'leie' ? b.til_leie :
    filter === 'salgs' ? b.til_salgs :
    true
  ), [boliger, filter])

  return (
    <div style={{ background: CREAM, minHeight: '100vh', color: MØRK }}>
      <PortalHeader onRegistrerInteresse={() => setModalApen(true)} />

      {/* HERO */}
      <section style={{
        background: `linear-gradient(180deg, ${CREAM_LYS} 0%, ${CREAM} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtil dekorativ glød */}
        <div aria-hidden style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '50%', height: '120%',
          background: `radial-gradient(circle, ${GULL}15 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(80px, 12vw, 140px) clamp(20px, 4vw, 28px) clamp(60px, 10vw, 110px)', textAlign: 'center', position: 'relative' }}>
          <div className="anim-fade-up" style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 'clamp(18px, 3vw, 28px)' }}>{t.hero_eyebrow}</div>
          <h1 className="anim-fade-up" style={{ fontSize: 'clamp(34px, 6vw, 72px)', lineHeight: 1.05, fontWeight: 300, color: MØRK, margin: '0 0 24px', letterSpacing: '-0.025em', animationDelay: '60ms' }}>
            {t.hero_tittel}
          </h1>
          <p className="anim-fade-up" style={{ fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.6, color: FARGER.tekstMid, margin: '0 auto clamp(32px, 5vw, 52px)', maxWidth: 620, fontWeight: 300, animationDelay: '120ms' }}>
            {t.hero_undertittel}
          </p>
          <a href="#boliger" className="anim-fade-up knapp-hover-loft" style={{
            background: MØRK, color: CREAM_LYS, textDecoration: 'none',
            padding: '16px 32px', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.06em',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            borderRadius: RADIUS.pill,
            boxShadow: SHADOW.md,
            animationDelay: '180ms',
          }}>
            {t.hero_cta_se_boliger}
            <span aria-hidden style={{ display: 'inline-block' }}>↓</span>
          </a>
        </div>
      </section>

      {/* LISTE */}
      <section id="boliger" style={{ maxWidth: 1320, margin: '0 auto', padding: 'clamp(56px, 9vw, 100px) clamp(16px, 4vw, 32px) clamp(72px, 11vw, 120px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 56px)' }}>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14 }}>{t.vare_boliger}</div>
          <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 300, color: MØRK, margin: '0 0 32px', letterSpacing: '-0.02em' }}>{t.tilgjengelige_naa}</h2>

          <FilterTabs aktiv={filter} setAktiv={setFilter} />
        </div>

        {laster && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 'clamp(20px, 3vw, 32px)' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: FARGER.hvit, borderRadius: RADIUS.lg, overflow: 'hidden', boxShadow: SHADOW.sm }}>
                <div className="skimmer" style={{ aspectRatio: '4 / 3' }} />
                <div style={{ padding: 22 }}>
                  <div className="skimmer" style={{ height: 14, width: '40%', marginBottom: 12, borderRadius: 4 }} />
                  <div className="skimmer" style={{ height: 22, width: '80%', marginBottom: 12, borderRadius: 4 }} />
                  <div className="skimmer" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {feil && <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}`, padding: 20, color: '#7a0c1e', borderRadius: RADIUS.md }}>{feil === '__feil__' ? t.feil_oppstod : feil}</div>}

        {!laster && !feil && filtrert.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: FARGER.tekstLys }}>
            <p style={{ fontSize: 15, margin: 0, fontStyle: 'italic' }}>{t.ingen_boliger}</p>
          </div>
        )}

        {!laster && filtrert.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 'clamp(20px, 3vw, 32px)' }}>
            {filtrert.map((b, i) => <BoligKort key={b.id} bolig={b} kortIndex={i} />)}
          </div>
        )}
      </section>

      {/* TJENESTE — Boliginspeksjon */}
      <section style={{ background: CREAM_LYS, padding: 'clamp(56px, 8vw, 96px) 0', borderTop: `1px solid ${GULL}22` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 clamp(16px, 4vw, 28px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'clamp(28px, 5vw, 48px)', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14 }}>OGSÅ TILGJENGELIG</div>
              <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 300, color: MØRK, margin: '0 0 18px', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
                Boliginspeksjon — sov trygt mens du er hjemme
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.65, color: '#5a6171', margin: '0 0 26px', fontWeight: 300 }}>
                Eier du en leilighet langs Costa del Sol? La en lokal håndverker med 30+ års erfaring sjekke leiligheten din regelmessig — lekkasjer, fukt og slitasje fanges før det blir dyrt. Du får skriftlig rapport med foto.
              </p>
              <a href="/inspeksjon" className="knapp-hover-loft" style={{
                background: MØRK, color: CREAM_LYS, textDecoration: 'none',
                padding: '14px 28px', fontSize: 13, fontWeight: 600,
                letterSpacing: '-0.005em',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                borderRadius: '999px',
                boxShadow: '0 2px 6px rgba(14,23,38,0.08)',
              }}>
                Se priser og bestill
                <span aria-hidden>→</span>
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {[
                { ikon: '🛁', t: 'Bad og kjøkken', b: 'Lekkasjer, fugemasse, avløp' },
                { ikon: '🌅', t: 'Terrasse og balkong', b: 'Vann-tetning, fliser, rekkverk' },
                { ikon: '⚡', t: 'Elektrisk og vent.', b: 'Sikringer, avtrekk, kondens' },
                { ikon: '📋', t: 'Rapport med foto', b: 'Prioriterte funn — du velger neste steg' },
              ].map((f, i) => (
                <div key={i} style={{
                  background: '#fff',
                  border: `1px solid rgba(14, 23, 38, 0.06)`,
                  borderRadius: 18,
                  padding: 18,
                  boxShadow: '0 1px 2px rgba(14, 23, 38, 0.04), 0 2px 6px rgba(14, 23, 38, 0.04)',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{f.ikon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: MØRK, marginBottom: 4, letterSpacing: '-0.005em' }}>{f.t}</div>
                  <div style={{ fontSize: 12, color: '#5a6171', lineHeight: 1.5 }}>{f.b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer onRegistrerInteresse={() => setModalApen(true)} />

      <InteresseModal apen={modalApen} onLukk={() => setModalApen(false)} />
    </div>
  )
}

function FilterTabs({ aktiv, setAktiv }: { aktiv: Filter; setAktiv: (f: Filter) => void }) {
  const { t } = useSprak()
  const tabs: Array<[Filter, string]> = [
    ['alle', t.alle],
    ['leie', t.til_leie],
    ['salgs', t.til_salgs],
  ]
  return (
    <div style={{
      display: 'inline-flex', gap: 4,
      background: FARGER.hvit,
      padding: 5,
      borderRadius: RADIUS.pill,
      boxShadow: SHADOW.sm,
      border: `1px solid ${FARGER.kantUltralys}`,
    }}>
      {tabs.map(([id, lbl]) => (
        <button key={id} onClick={() => setAktiv(id)}
          style={{
            background: aktiv === id ? MØRK : 'transparent',
            color: aktiv === id ? CREAM_LYS : MØRK,
            border: 'none',
            padding: '11px 22px',
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            borderRadius: RADIUS.pill,
            transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
          }}>
          {lbl}
        </button>
      ))}
    </div>
  )
}

function BoligKort({ bolig, kortIndex }: { bolig: Bolig; kortIndex: number }) {
  const { sprak, t } = useSprak()
  const navn = plukkOversettelse(bolig.navn_oversettelser, sprak, bolig.navn)
  const visKort = bolig.til_salgs
    ? plukkOversettelse(bolig.salg_kort_oversettelser, sprak, bolig.salg_kort)
    : plukkOversettelse(bolig.utleie_kort_oversettelser, sprak, bolig.utleie_kort)

  return (
    <Link href={`/bolig/${bolig.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article className="kort-loft anim-fade-up" style={{
        background: FARGER.hvit,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        boxShadow: SHADOW.sm,
        border: `1px solid ${FARGER.kantUltralys}`,
        animationDelay: `${Math.min(kortIndex, 8) * 40}ms`,
        height: '100%',
        display: 'flex', flexDirection: 'column',
      }}>
        <BildeSlideshow bilder={bolig.bilde_urler && bolig.bilde_urler.length > 0 ? bolig.bilde_urler : (bolig.bilde_url ? [bolig.bilde_url] : [])} alt={navn} offsetMs={kortIndex * 800}>
          <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 6, zIndex: 2 }}>
            {bolig.til_salgs && <Badge>{t.til_salgs}</Badge>}
            {bolig.til_leie && <Badge>{t.til_leie}</Badge>}
          </div>
        </BildeSlideshow>

        <div style={{ padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 10, color: GULL, letterSpacing: '0.18em', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
            {bolig.beliggenhet || 'Spania'}
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 500, color: MØRK, margin: '0 0 10px', lineHeight: 1.25, letterSpacing: '-0.015em' }}>{navn}</h3>
          {visKort && <p style={{ fontSize: 13.5, color: FARGER.tekstMid, lineHeight: 1.6, margin: '0 0 18px', flex: 1 }}>{visKort}</p>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${FARGER.kantUltralys}`, paddingTop: 16, marginTop: 'auto' }}>
            <div style={{ fontSize: 12, color: FARGER.tekstLys, letterSpacing: '0.02em' }}>
              {bolig.areal && <span>{bolig.areal} m²</span>}
              {bolig.areal && bolig.soverom ? <span style={{ margin: '0 8px' }}>·</span> : null}
              {bolig.soverom && <span>{bolig.soverom} {t.kort_sov}</span>}
            </div>
            <Pris bolig={bolig} />
          </div>
        </div>
      </article>
    </Link>
  )
}

// Slideshow med myk fade-loop. Forhåndslaster alle bilder så det ikke flimrer.
// offsetMs forsinkelser starten på hvert kort så ikke alle skifter samtidig.
const SKIFT_INTERVAL = 4500
const FADE_MS = 700

function BildeSlideshow({ bilder, alt, offsetMs, children }: { bilder: string[]; alt: string; offsetMs: number; children?: React.ReactNode }) {
  const [aktiv, setAktiv] = useState(0)
  const [synlig, setSynlig] = useState(false)
  const timer = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Aktiverer slideshow kun når kortet er nær viewport — sparer preload-trafikk
  // og interval-CPU på off-screen kort. Bruker rootMargin så vi rekker å laste
  // før brukeren scroller dit.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSynlig(true)
      return
    }
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setSynlig(true); obs.disconnect(); break }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!synlig || bilder.length <= 1) return
    bilder.forEach(url => { const img = new Image(); img.src = url })

    const startDelay = window.setTimeout(() => {
      timer.current = window.setInterval(() => {
        setAktiv(i => (i + 1) % bilder.length)
      }, SKIFT_INTERVAL)
    }, offsetMs)

    return () => {
      window.clearTimeout(startDelay)
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [bilder, offsetMs, synlig])

  return (
    <div ref={containerRef} style={{ width: '100%', aspectRatio: '4 / 3', background: FARGER.kantLys, position: 'relative', overflow: 'hidden' }}>
      {bilder.length === 0 ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, color: '#ccc8b8' }}>—</div>
      ) : (
        bilder.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt={alt}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === aktiv ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease-in-out`,
            }} />
        ))
      )}
      {children}
    </div>
  )
}

function Pris({ bolig }: { bolig: Bolig }) {
  const { t } = useSprak()
  const { formater } = useValuta()
  if (bolig.til_salgs && bolig.salgspris_eur) {
    return <div style={{ fontSize: 17, fontWeight: 600, color: MØRK, letterSpacing: '-0.01em' }}>{formater(bolig.salgspris_eur)}</div>
  }
  if (bolig.til_leie && bolig.pris_natt) {
    return <div style={{ fontSize: 17, fontWeight: 600, color: MØRK, letterSpacing: '-0.01em' }}>{formater(bolig.pris_natt)}<span style={{ fontSize: 12, color: FARGER.tekstLys, fontWeight: 400 }}>{t.per_natt}</span></div>
  }
  return <div style={{ fontSize: 12, color: FARGER.tekstLys, fontStyle: 'italic' }}>{t.pris_paa_foresporsel}</div>
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'rgba(14, 23, 38, 0.78)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: CREAM_LYS,
      padding: '6px 12px', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      borderRadius: RADIUS.pill,
    }}>
      {children}
    </span>
  )
}

function Footer({ onRegistrerInteresse }: { onRegistrerInteresse: () => void }) {
  const { t } = useSprak()
  return (
    <footer id="kontakt" style={{ background: MØRK, color: CREAM_LYS, padding: '80px 28px 48px', marginTop: 0 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 56 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.18em', marginBottom: 18 }}>LEGANGER &amp; OSVAAG</div>
            <p style={{ fontSize: 14, color: 'rgba(250,250,246,0.65)', lineHeight: 1.7, margin: 0 }}>Eksklusive eiendommer ved Middelhavskysten.</p>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', marginBottom: 16, color: GULL }}>{t.kontakt_oss}</div>
            <div style={{ fontSize: 14, lineHeight: 1.9 }}>
              <a href="mailto:post@loeiendom.com" style={{ color: CREAM_LYS, textDecoration: 'none' }}>post@loeiendom.com</a><br />
              <a href="https://loeiendom.com" style={{ color: 'rgba(250,250,246,0.65)', textDecoration: 'none' }}>loeiendom.com</a>
            </div>
          </div>
          <div>
            <button onClick={onRegistrerInteresse} className="knapp-hover-loft"
              style={{
                background: 'transparent', border: `1px solid ${GULL}88`, color: CREAM_LYS,
                padding: '14px 24px', fontSize: 12, fontWeight: 600,
                letterSpacing: '0.06em',
                cursor: 'pointer', borderRadius: RADIUS.pill,
              }}>
              {t.registrer_interesse} →
            </button>
          </div>
        </div>
        <div style={{ marginTop: 56, paddingTop: 28, borderTop: '1px solid rgba(250,250,246,0.1)', fontSize: 12, color: 'rgba(250,250,246,0.45)', textAlign: 'center', letterSpacing: '0.06em' }}>
          {t.copyright} {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  )
}
