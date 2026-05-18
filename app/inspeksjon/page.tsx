'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import {
  STORRELSE,
  TJENESTE_TYPE,
  beregnPris,
  type Storrelse, type TjenesteType,
} from '../lib/inspeksjon'
import {
  INSP_SPRAK_FLAGG, INSP_SPRAK_NAVN,
  tInsp, lestInspSprak, lagreInspSprak,
  type InspSprak, type InspNokkel,
} from '../lib/inspeksjon-i18n'

const MØRK = FARGER.mork
const CREAM = FARGER.cream
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

// Lokale oversettelser for størrelse og tjeneste-tekst — slå opp via i18n-dict.
const STORRELSE_NOKKEL: Record<Storrelse, InspNokkel> = {
  '1-rom': 'storrelse_1', '2-rom': 'storrelse_2',
  '3-rom': 'storrelse_3', '4-rom': 'storrelse_4',
  'villa': 'storrelse_villa',
}
const TJENESTE_LBL_NOKKEL: Record<TjenesteType, InspNokkel> = {
  engangs: 'engangs_lbl',
  manedlig_visuell: 'manedlig_lbl',
  kvartalsvis_grundig: 'kvartalsvis_lbl',
}
const TJENESTE_DESC_NOKKEL: Record<TjenesteType, InspNokkel> = {
  engangs: 'engangs_desc',
  manedlig_visuell: 'manedlig_desc',
  kvartalsvis_grundig: 'kvartalsvis_desc',
}
const TJENESTE_KORT_NOKKEL: Record<TjenesteType, InspNokkel> = {
  engangs: 'type_engangs',
  manedlig_visuell: 'type_manedlig',
  kvartalsvis_grundig: 'type_kvartalsvis',
}

export default function InspeksjonSide() {
  const [sprak, setSprak] = useState<InspSprak>('no')
  useEffect(() => { setSprak(lestInspSprak()) }, [])
  const t = (n: InspNokkel, v?: Record<string, string | number>) => tInsp(sprak, n, v)
  function bytt(s: InspSprak) { setSprak(s); lagreInspSprak(s) }

  const [storrelse, setStorrelse] = useState<Storrelse>('2-rom')
  const [tjeneste, setTjeneste] = useState<TjenesteType>('engangs')
  const [navn, setNavn] = useState('')
  const [epost, setEpost] = useState('')
  const [telefon, setTelefon] = useState('')
  const [adresse, setAdresse] = useState('')
  const [kompleks, setKompleks] = useState('')
  const [leilighet, setLeilighet] = useState('')
  const [braM2, setBraM2] = useState('')
  const [onsketDato, setOnsketDato] = useState('')
  const [fleksibel, setFleksibel] = useState(true)
  const [melding, setMelding] = useState('')
  const [sender, setSender] = useState(false)
  const [sendt, setSendt] = useState<{ id: string; pris: number; kundeToken: string } | null>(null)
  const [feil, setFeil] = useState('')
  const [betaler, setBetaler] = useState(false)

  const pris = useMemo(() => beregnPris(storrelse, tjeneste), [storrelse, tjeneste])
  const erAbo = tjeneste !== 'engangs'

  async function gaaTilBetaling() {
    if (!sendt) return
    setBetaler(true)
    try {
      const res = await fetch('/api/inspeksjon/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bestilling_id: sendt.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok || !data.url) {
        setFeil(data.feil || t('feil_generell'))
        setBetaler(false)
        return
      }
      window.location.href = data.url
    } catch (e) {
      setFeil(e instanceof Error ? e.message : t('feil_generell'))
      setBetaler(false)
    }
  }

  async function send() {
    if (!navn.trim() || !epost.trim() || !adresse.trim()) {
      setFeil(t('feil_fyll_inn'))
      return
    }
    setSender(true); setFeil('')
    try {
      const res = await fetch('/api/inspeksjon/bestill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kunde_navn: navn, kunde_epost: epost, kunde_telefon: telefon,
          kunde_sprak: sprak,
          adresse, kompleks, leilighet_nr: leilighet,
          bra_m2: braM2 ? Number(braM2) : undefined,
          storrelse, tjeneste_type: tjeneste,
          onsket_dato: onsketDato || undefined,
          fleksibel, melding,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setFeil(data.feil || t('feil_generell'))
      } else {
        setSendt({ id: data.id, pris: data.pris_eur, kundeToken: data.kunde_token })
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : t('feil_generell'))
    }
    setSender(false)
  }

  return (
    <main style={{ background: CREAM, minHeight: '100vh', color: MØRK }}>
      {/* Topp-bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(250, 250, 246, 0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${FARGER.kantUltralys}`,
        padding: '14px 28px',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Leganger & Osvaag" width={40} height={40} style={{ objectFit: 'contain' }} priority />
            <span style={{ fontSize: 13, fontWeight: 600, color: MØRK, letterSpacing: '0.18em' }}>LEGANGER &amp; OSVAAG</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <SprakVelger sprak={sprak} bytt={bytt} />
            <Link href="/" className="nav-lenke" style={{ fontSize: 13, color: FARGER.tekstMid, textDecoration: 'none', fontWeight: 500, letterSpacing: '-0.005em' }}>
              {t('tilbake_portal')}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
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
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(64px, 10vw, 110px) clamp(20px, 4vw, 28px) clamp(48px, 7vw, 80px)', textAlign: 'center', position: 'relative' }}>
          <div className="anim-fade-up" style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 22 }}>{t('hero_eyebrow')}</div>
          <h1 className="anim-fade-up" style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.05, fontWeight: 300, color: MØRK, margin: '0 0 24px', letterSpacing: '-0.025em', animationDelay: '60ms' }}>
            {t('hero_tittel')}
          </h1>
          <p className="anim-fade-up" style={{ fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.6, color: FARGER.tekstMid, margin: '0 auto clamp(28px, 5vw, 40px)', maxWidth: 680, fontWeight: 300, animationDelay: '120ms' }}>
            {t('hero_undertittel')}
          </p>
          <a href="#bestill" className="anim-fade-up knapp-hover-loft" style={{
            background: MØRK, color: CREAM_LYS, textDecoration: 'none',
            padding: '16px 32px', fontSize: 13, fontWeight: 600,
            letterSpacing: '-0.005em',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            borderRadius: RADIUS.pill,
            boxShadow: SHADOW.md,
            animationDelay: '180ms',
          }}>
            {t('hero_cta')}
            <span aria-hidden>↓</span>
          </a>
        </div>
      </section>

      {/* TJENESTER */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px, 8vw, 80px) clamp(16px, 4vw, 28px) clamp(32px, 5vw, 56px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px, 5vw, 44px)' }}>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>{t('tjeneste_eyebrow')}</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 300, color: MØRK, margin: 0, letterSpacing: '-0.025em' }}>{t('tjeneste_tittel')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 18 }}>
          {TJENESTE_TYPE.map((tt, i) => (
            <button key={tt} onClick={() => setTjeneste(tt)} className="kort-loft anim-fade-up"
              style={{
                background: tjeneste === tt ? MØRK : FARGER.hvit,
                color: tjeneste === tt ? CREAM_LYS : MØRK,
                border: `1px solid ${tjeneste === tt ? MØRK : FARGER.kantUltralys}`,
                padding: 26, borderRadius: RADIUS.lg,
                textAlign: 'left', cursor: 'pointer',
                boxShadow: tjeneste === tt ? SHADOW.md : SHADOW.sm,
                fontFamily: 'inherit',
                animationDelay: `${i * 60}ms`,
                transition: `background ${MOTION.normal}, color ${MOTION.normal}, box-shadow ${MOTION.normal}, transform ${MOTION.normal}`,
              }}>
              <div style={{ fontSize: 11, color: tjeneste === tt ? `${CREAM_LYS}99` : GULL, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>
                {t(TJENESTE_KORT_NOKKEL[tt])}
              </div>
              <div style={{ fontSize: 19, fontWeight: 500, marginBottom: 10, letterSpacing: '-0.015em' }}>{t(TJENESTE_LBL_NOKKEL[tt])}</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: tjeneste === tt ? `${CREAM_LYS}cc` : FARGER.tekstMid, margin: 0, fontWeight: 300 }}>
                {t(TJENESTE_DESC_NOKKEL[tt])}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* PRIS-KALKULATOR + BESTILLING */}
      <section id="bestill" style={{ background: CREAM_LYS, padding: 'clamp(48px, 8vw, 80px) 0' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 clamp(16px, 4vw, 28px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>{t('bestill_eyebrow')}</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 300, color: MØRK, margin: 0, letterSpacing: '-0.025em' }}>{t('bestill_tittel')}</h2>
          </div>

          {sendt ? (
            <div className="anim-scale-in" style={{ background: FARGER.hvit, borderRadius: RADIUS.xl, padding: 'clamp(28px, 5vw, 48px)', boxShadow: SHADOW.lg, textAlign: 'center', border: `1px solid ${FARGER.kantUltralys}` }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <h3 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, color: MØRK, margin: '0 0 14px', letterSpacing: '-0.02em' }}>{t('takk')}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: FARGER.tekstMid, margin: '0 auto 22px', maxWidth: 540 }}
                dangerouslySetInnerHTML={{
                  __html: t('bekreftet_msg', { epost, pris: sendt.pris })
                    .replace('{epost}', `<strong style="color:${MØRK}">${epost}</strong>`)
                    .replace('{pris}', `<strong style="color:${MØRK}">€${sendt.pris}</strong>`)
                }}
              />

              {/* Betaling-CTA (kun hvis Stripe er aktivert serverside) */}
              <button onClick={gaaTilBetaling} disabled={betaler} className="knapp-hover-loft" style={{
                background: betaler ? FARGER.tekstLys : '#635bff',  // Stripe-lilla
                color: CREAM_LYS, border: 'none',
                padding: '14px 28px', fontSize: 14, fontWeight: 600,
                letterSpacing: '-0.005em',
                borderRadius: RADIUS.pill, cursor: betaler ? 'wait' : 'pointer',
                boxShadow: betaler ? 'none' : SHADOW.md,
                display: 'inline-flex', alignItems: 'center', gap: 10,
                marginBottom: 22,
              }}>
                {betaler ? '⏳…' : `💳 ${erAbo ? 'Start abonnement' : 'Betal'} · €${sendt.pris}`}
              </button>

              {/* Min side-lenke */}
              <div style={{
                background: CREAM_LYS,
                border: `1px solid ${GULL}33`,
                borderRadius: RADIUS.lg,
                padding: 22,
                margin: '0 auto 28px',
                maxWidth: 540,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>
                  {t('lagre_lenken')}
                </div>
                <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '0 0 14px', lineHeight: 1.55 }}>
                  {t('lenken_beskrivelse')}
                </p>
                <Link href={`/inspeksjon/min/${sendt.kundeToken}`} style={{
                  display: 'block',
                  background: FARGER.hvit,
                  border: `1px solid ${FARGER.kantUltralys}`,
                  borderRadius: RADIUS.md,
                  padding: '12px 14px',
                  fontSize: 12.5, color: MØRK,
                  fontFamily: 'monospace',
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                  letterSpacing: '-0.005em',
                }}>
                  loeiendom.com/inspeksjon/min/{sendt.kundeToken}
                </Link>
                <button onClick={() => {
                  navigator.clipboard.writeText(`https://www.loeiendom.com/inspeksjon/min/${sendt.kundeToken}`).catch(() => {})
                }} style={{
                  background: 'none', border: 'none',
                  color: FARGER.tekstMid, fontSize: 12,
                  cursor: 'pointer', marginTop: 10,
                  padding: 0, textDecoration: 'underline',
                  fontWeight: 500,
                }}>
                  {t('kopier_lenke')}
                </button>
              </div>

              <p style={{ fontSize: 13, color: FARGER.tekstLys, margin: '0 0 28px', fontStyle: 'italic' }}>
                {t('referanse')}: {sendt.id}
              </p>
              <Link href={`/inspeksjon/min/${sendt.kundeToken}`} className="knapp-hover-loft" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: MØRK, color: CREAM_LYS, textDecoration: 'none',
                padding: '14px 28px', fontSize: 13, fontWeight: 600,
                letterSpacing: '-0.005em',
                borderRadius: RADIUS.pill, boxShadow: SHADOW.sm,
              }}>
                {t('aapne_min_side')}
              </Link>
            </div>
          ) : (
            <div style={{ background: FARGER.hvit, borderRadius: RADIUS.xl, padding: 'clamp(24px, 5vw, 40px)', boxShadow: SHADOW.md, border: `1px solid ${FARGER.kantUltralys}` }}>
              {/* Tjeneste-summary */}
              <div style={{ background: CREAM_LYS, borderRadius: RADIUS.lg, padding: 18, marginBottom: 24, border: `1px solid ${FARGER.gull}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{t('valgt')}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: MØRK, letterSpacing: '-0.01em' }}>{t(TJENESTE_LBL_NOKKEL[tjeneste])}</div>
                  <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 2 }}>{t(STORRELSE_NOKKEL[storrelse])}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 600, color: MØRK, letterSpacing: '-0.025em', lineHeight: 1 }}>€{pris}</div>
                  <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 4 }}>{erAbo ? t('per_besok') : t('engang')}</div>
                </div>
              </div>

              {/* Form */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl={t('felt_storrelse')}>
                  <select value={storrelse} onChange={e => setStorrelse(e.target.value as Storrelse)} style={input}>
                    {STORRELSE.map(s => <option key={s} value={s}>{t(STORRELSE_NOKKEL[s])}</option>)}
                  </select>
                </Felt>
                <Felt lbl={t('felt_tjeneste')}>
                  <select value={tjeneste} onChange={e => setTjeneste(e.target.value as TjenesteType)} style={input}>
                    {TJENESTE_TYPE.map(tt => <option key={tt} value={tt}>{t(TJENESTE_LBL_NOKKEL[tt])}</option>)}
                  </select>
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl={t('felt_navn')}>
                  <input value={navn} onChange={e => setNavn(e.target.value)} style={input} />
                </Felt>
                <Felt lbl={t('felt_epost')}>
                  <input type="email" value={epost} onChange={e => setEpost(e.target.value)} style={input} />
                </Felt>
                <Felt lbl={t('felt_telefon')}>
                  <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} style={input} />
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl={t('felt_adresse')} full>
                  <input value={adresse} onChange={e => setAdresse(e.target.value)} style={input} />
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl={t('felt_kompleks')}>
                  <input value={kompleks} onChange={e => setKompleks(e.target.value)} style={input} />
                </Felt>
                <Felt lbl={t('felt_leilighet_nr')}>
                  <input value={leilighet} onChange={e => setLeilighet(e.target.value)} style={input} />
                </Felt>
                <Felt lbl={t('felt_bra')}>
                  <input type="number" value={braM2} onChange={e => setBraM2(e.target.value)} style={input} />
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl={t('felt_onsket_dato')}>
                  <input type="date" value={onsketDato} onChange={e => setOnsketDato(e.target.value)} style={input} />
                </Felt>
                <Felt lbl={t('felt_fleksibel_lbl')} full>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 14, color: FARGER.tekstMid, cursor: 'pointer' }}>
                    <input type="checkbox" checked={fleksibel} onChange={e => setFleksibel(e.target.checked)} style={{ accentColor: GULL, width: 18, height: 18 }} />
                    <span>{t('felt_fleksibel')}</span>
                  </label>
                </Felt>
              </div>

              <Felt lbl={t('felt_melding')}>
                <textarea value={melding} onChange={e => setMelding(e.target.value)} rows={4}
                  placeholder={t('felt_melding_placeholder')}
                  style={{ ...input, fontFamily: 'inherit', resize: 'vertical', minHeight: 90 }} />
              </Felt>

              {feil && (
                <div className="anim-fade-up" style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, color: '#7a0c1e', padding: 14, borderRadius: RADIUS.md, fontSize: 14, marginTop: 18 }}>
                  {feil}
                </div>
              )}

              <button onClick={send} disabled={sender} className="knapp-hover-loft" style={{
                marginTop: 24, width: '100%',
                background: sender ? FARGER.tekstLys : MØRK,
                color: CREAM_LYS, border: 'none',
                padding: 16, borderRadius: RADIUS.pill,
                fontSize: 14, fontWeight: 600,
                cursor: sender ? 'wait' : 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: sender ? 'none' : SHADOW.md,
                transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
              }}>
                {sender ? t('sender') : `📋 ${t('send_bestilling')} — €${pris}`}
              </button>

              <p style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 14, textAlign: 'center', lineHeight: 1.55 }}>
                {t('uforpliktende')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* HVORDAN */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(48px, 8vw, 80px) clamp(16px, 4vw, 28px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px, 5vw, 44px)' }}>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>{t('slik_eyebrow')}</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 300, color: MØRK, margin: 0, letterSpacing: '-0.025em' }}>{t('slik_tittel')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 18 }}>
          {[
            { n: '01', tn: 'steg1_t' as const, bn: 'steg1_b' as const },
            { n: '02', tn: 'steg2_t' as const, bn: 'steg2_b' as const },
            { n: '03', tn: 'steg3_t' as const, bn: 'steg3_b' as const },
            { n: '04', tn: 'steg4_t' as const, bn: 'steg4_b' as const },
          ].map((s, i) => (
            <div key={i} className="anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 14 }}>{s.n}</div>
              <div style={{ fontSize: 19, fontWeight: 500, color: MØRK, marginBottom: 10, letterSpacing: '-0.015em' }}>{t(s.tn)}</div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: FARGER.tekstMid, margin: 0, fontWeight: 300 }}>{t(s.bn)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: MØRK, color: CREAM_LYS, padding: '40px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, letterSpacing: '0.06em' }}>
          {t('footer_tagline')}
        </div>
        <div style={{ fontSize: 12, opacity: 0.5 }}>
          Costa del Sol · post@loeiendom.com
        </div>
      </footer>
    </main>
  )
}

// Språkvelger — kompakt dropdown i header
function SprakVelger({ sprak, bytt }: { sprak: InspSprak; bytt: (s: InspSprak) => void }) {
  const [aapen, setAapen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setAapen(o => !o)} style={{
        background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
        borderRadius: RADIUS.pill, padding: '6px 12px',
        fontSize: 12, fontWeight: 500, color: FARGER.tekstMid,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        boxShadow: SHADOW.xs, letterSpacing: '-0.005em',
      }}>
        <span>{INSP_SPRAK_FLAGG[sprak]}</span>
        <span>{INSP_SPRAK_NAVN[sprak]}</span>
        <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
      </button>
      {aapen && (
        <div className="anim-fade-down" style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
          borderRadius: RADIUS.md, padding: 4,
          boxShadow: SHADOW.md, minWidth: 140, zIndex: 50,
        }}>
          {(['no', 'en', 'es'] as InspSprak[]).map(s => (
            <button key={s} onClick={() => { bytt(s); setAapen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: sprak === s ? FARGER.flateLys : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              padding: '8px 12px', borderRadius: RADIUS.sm,
              fontSize: 13, color: FARGER.mork,
              fontWeight: sprak === s ? 600 : 400,
              letterSpacing: '-0.005em',
            }}>
              <span>{INSP_SPRAK_FLAGG[s]}</span>
              <span>{INSP_SPRAK_NAVN[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Felt({ lbl, full, children }: { lbl: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 6, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</label>
      {children}
    </div>
  )
}

const input: React.CSSProperties = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  borderRadius: RADIUS.md,
  border: `1px solid ${FARGER.kant}`,
  background: FARGER.hvit,
  fontFamily: 'inherit', boxSizing: 'border-box',
  outline: 'none',
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
}
