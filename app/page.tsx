'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PortalHeader } from './components/portal/PortalHeader'
import { InteresseModal } from './components/portal/InteresseModal'
import { useSprak } from './lib/i18n'

const MØRK = '#0e1726'
const CREAM = '#fafaf6'
const CREAM_LYS = '#fdfcf7'
const GULL = '#b89a6f'

type Bolig = {
  id: string
  navn: string
  til_leie: boolean
  til_salgs: boolean
  utleie_kort: string | null
  salg_kort: string | null
  pris_natt: number | null
  salgspris_eur: number | null
  maks_gjester: number | null
  beliggenhet: string | null
  soverom: string | number | null
  bad: string | number | null
  areal: string | number | null
  bilde_url: string | null
}

type Filter = 'alle' | 'leie' | 'salgs'

const fmtEur = (n: number | null) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : null

export default function Forside() {
  const { t } = useSprak()
  const [boliger, setBoliger] = useState<Bolig[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('alle')
  const [modalApen, setModalApen] = useState(false)

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
        setFeil(e instanceof Error ? e.message : t.feil_oppstod)
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [t.feil_oppstod])

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

  const filtrert = boliger.filter(b =>
    filter === 'leie' ? b.til_leie :
    filter === 'salgs' ? b.til_salgs :
    true
  )

  return (
    <div style={{ fontFamily: 'sans-serif', background: CREAM, minHeight: '100vh', color: MØRK }}>
      <PortalHeader onRegistrerInteresse={() => setModalApen(true)} />

      {/* HERO */}
      <section style={{
        background: `linear-gradient(180deg, ${CREAM_LYS} 0%, ${CREAM} 100%)`,
        borderBottom: `1px solid ${GULL}22`,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 28px 100px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 28 }}>{t.hero_eyebrow}</div>
          <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', lineHeight: 1.08, fontWeight: 300, color: MØRK, margin: '0 0 24px', letterSpacing: '-0.01em' }}>
            {t.hero_tittel}
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#5a6171', margin: '0 auto 44px', maxWidth: 580, fontWeight: 300 }}>
            {t.hero_undertittel}
          </p>
          <a href="#boliger" style={{
            background: MØRK, color: CREAM_LYS, textDecoration: 'none',
            padding: '16px 32px', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            display: 'inline-block',
          }}>
            {t.hero_cta_se_boliger} ↓
          </a>
        </div>
      </section>

      {/* LISTE */}
      <section id="boliger" style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 28px 96px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14 }}>{t.vare_boliger}</div>
          <h2 style={{ fontSize: 36, fontWeight: 300, color: MØRK, margin: '0 0 28px', letterSpacing: '-0.01em' }}>{t.tilgjengelige_naa}</h2>

          <FilterTabs aktiv={filter} setAktiv={setFilter} />
        </div>

        {laster && <div style={{ textAlign: 'center', color: '#888', padding: 80, fontSize: 14 }}>{t.henter}</div>}
        {feil && <div style={{ background: '#fde8ec', border: '1px solid #C8102E', padding: 20, color: '#7a0c1e' }}>{feil}</div>}

        {!laster && !feil && filtrert.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: '#888' }}>
            <p style={{ fontSize: 14, margin: 0, fontStyle: 'italic' }}>{t.ingen_boliger}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 32 }}>
          {filtrert.map(b => <BoligKort key={b.id} bolig={b} />)}
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
    <div style={{ display: 'inline-flex', gap: 0, border: `1px solid ${GULL}44`, padding: 0 }}>
      {tabs.map(([id, lbl]) => (
        <button key={id} onClick={() => setAktiv(id)}
          style={{
            background: aktiv === id ? MØRK : 'transparent',
            color: aktiv === id ? CREAM_LYS : MØRK,
            border: 'none', padding: '12px 28px', fontSize: 11,
            fontWeight: 600, letterSpacing: '0.16em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}>
          {lbl}
        </button>
      ))}
    </div>
  )
}

function BoligKort({ bolig }: { bolig: Bolig }) {
  const { t } = useSprak()
  const visKort = bolig.til_salgs ? bolig.salg_kort : bolig.utleie_kort

  return (
    <Link href={`/bolig/${bolig.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <article style={{ background: CREAM_LYS, transition: 'transform 0.4s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
      >
        <div style={{ width: '100%', aspectRatio: '4 / 3', background: '#e8e4d8', position: 'relative', overflow: 'hidden' }}>
          {bolig.bilde_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bolig.bilde_url} alt={bolig.navn} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.6s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, color: '#ccc8b8' }}>—</div>
          )}
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6 }}>
            {bolig.til_salgs && <Badge>{t.til_salgs}</Badge>}
            {bolig.til_leie && <Badge>{t.til_leie}</Badge>}
          </div>
        </div>

        <div style={{ padding: '24px 6px 8px' }}>
          <div style={{ fontSize: 10, color: GULL, letterSpacing: '0.16em', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
            {bolig.beliggenhet || 'Spania'}
          </div>
          <h3 style={{ fontSize: 19, fontWeight: 400, color: MØRK, margin: '0 0 12px', lineHeight: 1.3, letterSpacing: '-0.005em' }}>{bolig.navn}</h3>
          {visKort && <p style={{ fontSize: 13, color: '#5a6171', lineHeight: 1.6, margin: '0 0 16px' }}>{visKort}</p>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${GULL}33`, paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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

function Pris({ bolig }: { bolig: Bolig }) {
  const { t } = useSprak()
  if (bolig.til_salgs && bolig.salgspris_eur) {
    return <div style={{ fontSize: 16, fontWeight: 500, color: MØRK }}>{fmtEur(bolig.salgspris_eur)}</div>
  }
  if (bolig.til_leie && bolig.pris_natt) {
    return <div style={{ fontSize: 16, fontWeight: 500, color: MØRK }}>{fmtEur(bolig.pris_natt)}<span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>{t.per_natt}</span></div>
  }
  return <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{t.pris_paa_foresporsel}</div>
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'rgba(14, 23, 38, 0.85)', color: CREAM_LYS,
      padding: '5px 11px', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.14em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

function Footer({ onRegistrerInteresse }: { onRegistrerInteresse: () => void }) {
  const { t } = useSprak()
  return (
    <footer id="kontakt" style={{ background: MØRK, color: CREAM_LYS, padding: '64px 28px 40px', marginTop: 0 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 48 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', marginBottom: 16 }}>LEGANGER &amp; OSVAAG</div>
            <p style={{ fontSize: 13, color: 'rgba(250,250,246,0.6)', lineHeight: 1.7, margin: 0 }}>Eksklusive eiendommer ved Middelhavskysten.</p>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', marginBottom: 14, color: GULL }}>{t.kontakt_oss}</div>
            <div style={{ fontSize: 13, lineHeight: 1.9 }}>
              <a href="mailto:post@loeiendom.com" style={{ color: CREAM_LYS, textDecoration: 'none' }}>post@loeiendom.com</a><br />
              <a href="https://loeiendom.com" style={{ color: 'rgba(250,250,246,0.6)', textDecoration: 'none' }}>loeiendom.com</a>
            </div>
          </div>
          <div>
            <button onClick={onRegistrerInteresse}
              style={{ background: 'transparent', border: `1px solid ${GULL}`, color: CREAM_LYS, padding: '12px 20px', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {t.registrer_interesse} →
            </button>
          </div>
        </div>
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(250,250,246,0.1)', fontSize: 11, color: 'rgba(250,250,246,0.4)', textAlign: 'center', letterSpacing: '0.06em' }}>
          {t.copyright} {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  )
}
