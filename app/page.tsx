'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const MØRK = '#1a2a3e'
const CREAM = '#f8f5ee'
const CREAM_LYS = '#faf7f0'
const GULL = '#c9a876'

type Bolig = {
  id: string
  navn: string
  kort_beskrivelse: string | null
  pris_natt: number | null
  maks_gjester: number | null
  beliggenhet: string | null
  soverom: string | number | null
  bilde_url: string | null
}

const fmtEur = (n: number | null) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : null

export default function Forside() {
  const [boliger, setBoliger] = useState<Bolig[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)

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
        setFeil(e instanceof Error ? e.message : 'Ukjent feil')
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', background: CREAM, minHeight: '100vh' }}>
      <Header />

      <section style={{ background: `linear-gradient(135deg, ${CREAM} 0%, ${CREAM_LYS} 100%)`, borderBottom: `1px solid ${GULL}22` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 28px 64px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: GULL, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 14 }}>FERIEUTLEIE I SPANIA</div>
          <h1 style={{ fontSize: 46, lineHeight: 1.15, fontWeight: 700, color: MØRK, margin: 0, marginBottom: 18 }}>
            Solfylte hjem ved Middelhavet
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: '#555', margin: '0 auto 32px', maxWidth: 600 }}>
            Håndplukkede utleieboliger i Spanias mest ettertraktede områder. Direkte kontakt med eier — ingen skjulte gebyrer.
          </p>
          <a href="#boliger" style={{ background: MØRK, color: 'white', textDecoration: 'none', borderRadius: 10, padding: '16px 32px', fontSize: 15, fontWeight: 700, letterSpacing: '0.02em', display: 'inline-block' }}>
            Se ledige boliger ↓
          </a>
        </div>
      </section>

      <section id="boliger" style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 28px 96px' }}>
        <div style={{ fontSize: 12, color: GULL, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 12 }}>VÅRE BOLIGER</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: MØRK, margin: '0 0 32px' }}>Tilgjengelige nå</h2>

        {laster && <div style={{ textAlign: 'center', color: '#888', padding: 60 }}>⏳ Henter boliger...</div>}
        {feil && <div style={{ background: '#fde8ec', border: '1.5px solid #C8102E', borderRadius: 10, padding: 20, color: '#7a0c1e' }}>Feil ved lasting: {feil}</div>}
        {!laster && !feil && boliger.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 60, background: '#fff', borderRadius: 16, border: `1px solid ${GULL}33` }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏖️</div>
            <p style={{ fontSize: 15, margin: 0 }}>Ingen boliger publisert ennå. Kom tilbake snart!</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {boliger.map(b => <BoligKort key={b.id} bolig={b} />)}
        </div>
      </section>

      <Footer />
    </div>
  )
}

function Header() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: CREAM_LYS,
      borderBottom: `1px solid ${GULL}44`,
      padding: '12px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <Image src="/logo.png" alt="Leganger & Osvaag Eiendom" width={44} height={44} style={{ objectFit: 'contain' }} priority />
        <span style={{ fontSize: 14, fontWeight: 700, color: MØRK, letterSpacing: '0.08em' }}>LEGANGER &amp; OSVAAG</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <a href="#boliger" style={{ fontSize: 14, color: MØRK, textDecoration: 'none', fontWeight: 500 }}>Boliger</a>
        <a href="#kontakt" style={{ fontSize: 14, color: MØRK, textDecoration: 'none', fontWeight: 500 }}>Kontakt</a>
        <Link href="/admin" style={{ fontSize: 12, color: '#777', textDecoration: 'none', border: `1px solid ${GULL}66`, padding: '6px 12px', borderRadius: 6 }}>Logg inn</Link>
      </div>
    </nav>
  )
}

function BoligKort({ bolig }: { bolig: Bolig }) {
  const pris = fmtEur(bolig.pris_natt)
  return (
    <Link href={`/bolig/${bolig.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: `1px solid ${GULL}33`, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 32px ${MØRK}22` }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
      >
        <div style={{ width: '100%', height: 220, background: '#f0ede5', position: 'relative' }}>
          {bolig.bilde_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bolig.bilde_url} alt={bolig.navn} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#ccc' }}>🏖️</div>
          )}
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.05em', marginBottom: 6 }}>{bolig.beliggenhet || 'Spania'}</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: MØRK, margin: '0 0 10px', lineHeight: 1.3 }}>{bolig.navn}</h3>
          {bolig.kort_beskrivelse && <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5, margin: '0 0 14px' }}>{bolig.kort_beskrivelse}</p>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${GULL}22`, paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: '#777' }}>
              {bolig.soverom ? `${bolig.soverom} sov` : ''}
              {bolig.soverom && bolig.maks_gjester ? ' · ' : ''}
              {bolig.maks_gjester ? `${bolig.maks_gjester} gjester` : ''}
            </div>
            {pris && <div style={{ fontSize: 16, fontWeight: 700, color: MØRK }}>{pris}<span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}> /natt</span></div>}
          </div>
        </div>
      </div>
    </Link>
  )
}

function Footer() {
  return (
    <footer id="kontakt" style={{ background: MØRK, color: 'white', padding: '48px 28px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>LEGANGER &amp; OSVAAG</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>Eiendomsutleie i Spania siden 2024</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10, color: GULL }}>KONTAKT</div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <a href="mailto:post@loeiendom.com" style={{ color: 'white', textDecoration: 'none' }}>post@loeiendom.com</a><br />
            <a href="https://loeiendom.com" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>loeiendom.com</a>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: '32px auto 0', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
        © {new Date().getFullYear()} Leganger &amp; Osvaag Eiendom
      </div>
    </footer>
  )
}
