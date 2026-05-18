'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import {
  STORRELSE, STORRELSE_ETIKETT,
  TJENESTE_TYPE, TJENESTE_ETIKETT, TJENESTE_BESKRIVELSE,
  beregnPris,
  type Storrelse, type TjenesteType,
} from '../lib/inspeksjon'

const MØRK = FARGER.mork
const CREAM = FARGER.cream
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

export default function InspeksjonSide() {
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

  const pris = useMemo(() => beregnPris(storrelse, tjeneste), [storrelse, tjeneste])
  const erAbo = tjeneste !== 'engangs'

  async function send() {
    if (!navn.trim() || !epost.trim() || !adresse.trim()) {
      setFeil('Fyll inn navn, e-post og adresse')
      return
    }
    setSender(true); setFeil('')
    try {
      const res = await fetch('/api/inspeksjon/bestill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kunde_navn: navn, kunde_epost: epost, kunde_telefon: telefon,
          kunde_sprak: 'no',
          adresse, kompleks, leilighet_nr: leilighet,
          bra_m2: braM2 ? Number(braM2) : undefined,
          storrelse, tjeneste_type: tjeneste,
          onsket_dato: onsketDato || undefined,
          fleksibel, melding,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setFeil(data.feil || 'Noe gikk galt. Prøv igjen.')
      } else {
        setSendt({ id: data.id, pris: data.pris_eur, kundeToken: data.kunde_token })
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Noe gikk galt. Prøv igjen.')
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
          <Link href="/" className="nav-lenke" style={{ fontSize: 13, color: FARGER.tekstMid, textDecoration: 'none', fontWeight: 500, letterSpacing: '-0.005em' }}>
            ← Til portalen
          </Link>
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
          <div className="anim-fade-up" style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 22 }}>BOLIGINSPEKSJON</div>
          <h1 className="anim-fade-up" style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.05, fontWeight: 300, color: MØRK, margin: '0 0 24px', letterSpacing: '-0.025em', animationDelay: '60ms' }}>
            Sov trygt — vi sjekker leiligheten for deg
          </h1>
          <p className="anim-fade-up" style={{ fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.6, color: FARGER.tekstMid, margin: '0 auto clamp(28px, 5vw, 40px)', maxWidth: 680, fontWeight: 300, animationDelay: '120ms' }}>
            Lokal håndverker med 30+ års erfaring tar full sjekk av leiligheten din langs Costa del Sol — lekkasjer, fukt, slitasje. Du får skriftlig rapport med foto, og tilbud på utbedring hvis noe er funnet.
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
            Bestill inspeksjon
            <span aria-hidden>↓</span>
          </a>
        </div>
      </section>

      {/* TJENESTER */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px, 8vw, 80px) clamp(16px, 4vw, 28px) clamp(32px, 5vw, 56px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px, 5vw, 44px)' }}>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>Velg tjeneste</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 300, color: MØRK, margin: 0, letterSpacing: '-0.025em' }}>Tre måter å holde leiligheten trygg</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 18 }}>
          {TJENESTE_TYPE.map((t, i) => (
            <button key={t} onClick={() => setTjeneste(t)} className="kort-loft anim-fade-up"
              style={{
                background: tjeneste === t ? MØRK : FARGER.hvit,
                color: tjeneste === t ? CREAM_LYS : MØRK,
                border: `1px solid ${tjeneste === t ? MØRK : FARGER.kantUltralys}`,
                padding: 26, borderRadius: RADIUS.lg,
                textAlign: 'left', cursor: 'pointer',
                boxShadow: tjeneste === t ? SHADOW.md : SHADOW.sm,
                fontFamily: 'inherit',
                animationDelay: `${i * 60}ms`,
                transition: `background ${MOTION.normal}, color ${MOTION.normal}, box-shadow ${MOTION.normal}, transform ${MOTION.normal}`,
              }}>
              <div style={{ fontSize: 11, color: tjeneste === t ? `${CREAM_LYS}99` : GULL, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>
                {t === 'engangs' ? 'Engang' : t === 'manedlig_visuell' ? 'Månedlig' : 'Kvartalsvis'}
              </div>
              <div style={{ fontSize: 19, fontWeight: 500, marginBottom: 10, letterSpacing: '-0.015em' }}>{TJENESTE_ETIKETT[t]}</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: tjeneste === t ? `${CREAM_LYS}cc` : FARGER.tekstMid, margin: 0, fontWeight: 300 }}>
                {TJENESTE_BESKRIVELSE[t]}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* PRIS-KALKULATOR + BESTILLING */}
      <section id="bestill" style={{ background: CREAM_LYS, padding: 'clamp(48px, 8vw, 80px) 0' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 clamp(16px, 4vw, 28px)' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>Bestill</div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 300, color: MØRK, margin: 0, letterSpacing: '-0.025em' }}>Klar på 60 sekunder</h2>
          </div>

          {sendt ? (
            <div className="anim-scale-in" style={{ background: FARGER.hvit, borderRadius: RADIUS.xl, padding: 'clamp(28px, 5vw, 48px)', boxShadow: SHADOW.lg, textAlign: 'center', border: `1px solid ${FARGER.kantUltralys}` }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <h3 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, color: MØRK, margin: '0 0 14px', letterSpacing: '-0.02em' }}>Takk — bestillingen er mottatt</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: FARGER.tekstMid, margin: '0 auto 22px', maxWidth: 540 }}>
                Vi tar kontakt på <strong style={{ color: MØRK }}>{epost}</strong> innen 24 timer for å avtale tidspunkt. Pris bekreftet: <strong style={{ color: MØRK }}>€{sendt.pris}</strong>.
              </p>

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
                  🔖 Lagre denne lenken
                </div>
                <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '0 0 14px', lineHeight: 1.55 }}>
                  Du finner alltid status, rapporter og tilbud på din egen oversiktsside:
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
                  📋 Kopier lenken
                </button>
              </div>

              <p style={{ fontSize: 13, color: FARGER.tekstLys, margin: '0 0 28px', fontStyle: 'italic' }}>
                Referanse: {sendt.id}
              </p>
              <Link href={`/inspeksjon/min/${sendt.kundeToken}`} className="knapp-hover-loft" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: MØRK, color: CREAM_LYS, textDecoration: 'none',
                padding: '14px 28px', fontSize: 13, fontWeight: 600,
                letterSpacing: '-0.005em',
                borderRadius: RADIUS.pill, boxShadow: SHADOW.sm,
              }}>
                Åpne min side →
              </Link>
            </div>
          ) : (
            <div style={{ background: FARGER.hvit, borderRadius: RADIUS.xl, padding: 'clamp(24px, 5vw, 40px)', boxShadow: SHADOW.md, border: `1px solid ${FARGER.kantUltralys}` }}>
              {/* Tjeneste-summary */}
              <div style={{ background: CREAM_LYS, borderRadius: RADIUS.lg, padding: 18, marginBottom: 24, border: `1px solid ${FARGER.gull}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Valgt</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: MØRK, letterSpacing: '-0.01em' }}>{TJENESTE_ETIKETT[tjeneste]}</div>
                  <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 2 }}>{STORRELSE_ETIKETT[storrelse]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 600, color: MØRK, letterSpacing: '-0.025em', lineHeight: 1 }}>€{pris}</div>
                  <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 4 }}>{erAbo ? 'per besøk' : 'engang'}</div>
                </div>
              </div>

              {/* Form */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl="Størrelse">
                  <select value={storrelse} onChange={e => setStorrelse(e.target.value as Storrelse)} style={input}>
                    {STORRELSE.map(s => <option key={s} value={s}>{STORRELSE_ETIKETT[s]}</option>)}
                  </select>
                </Felt>
                <Felt lbl="Tjeneste">
                  <select value={tjeneste} onChange={e => setTjeneste(e.target.value as TjenesteType)} style={input}>
                    {TJENESTE_TYPE.map(t => <option key={t} value={t}>{TJENESTE_ETIKETT[t]}</option>)}
                  </select>
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl="Ditt navn *">
                  <input value={navn} onChange={e => setNavn(e.target.value)} style={input} placeholder="Fornavn Etternavn" />
                </Felt>
                <Felt lbl="E-post *">
                  <input type="email" value={epost} onChange={e => setEpost(e.target.value)} style={input} placeholder="navn@epost.com" />
                </Felt>
                <Felt lbl="Telefon">
                  <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} style={input} placeholder="+34 6XX XX XX XX" />
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl="Adresse *" full>
                  <input value={adresse} onChange={e => setAdresse(e.target.value)} style={input} placeholder="Gate, område, by" />
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl="Kompleks / urbanización">
                  <input value={kompleks} onChange={e => setKompleks(e.target.value)} style={input} placeholder="F.eks. Calaburra-Chaparral" />
                </Felt>
                <Felt lbl="Leilighet nr.">
                  <input value={leilighet} onChange={e => setLeilighet(e.target.value)} style={input} placeholder="A-12" />
                </Felt>
                <Felt lbl="BRA (m²)">
                  <input type="number" value={braM2} onChange={e => setBraM2(e.target.value)} style={input} placeholder="80" />
                </Felt>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                <Felt lbl="Ønsket dato">
                  <input type="date" value={onsketDato} onChange={e => setOnsketDato(e.target.value)} style={input} />
                </Felt>
                <Felt lbl="Fleksibel?" full>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 14, color: FARGER.tekstMid, cursor: 'pointer' }}>
                    <input type="checkbox" checked={fleksibel} onChange={e => setFleksibel(e.target.checked)} style={{ accentColor: GULL, width: 18, height: 18 }} />
                    <span>Jeg er fleksibel — finn et tidspunkt som passer</span>
                  </label>
                </Felt>
              </div>

              <Felt lbl="Melding (valgfri)">
                <textarea value={melding} onChange={e => setMelding(e.target.value)} rows={4}
                  placeholder="Spesielle bekymringer? Tidligere lekkasjer? Adgang til leiligheten (nøkkel hos megler)?"
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
                {sender ? '⏳ Sender bestilling…' : `📋 Send bestilling — €${pris}`}
              </button>

              <p style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 14, textAlign: 'center', lineHeight: 1.55 }}>
                Bestillingen er uforpliktende — vi bekrefter pris og tidspunkt på e-post før vi kommer.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* HVORDAN */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(48px, 8vw, 80px) clamp(16px, 4vw, 28px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(28px, 5vw, 44px)' }}>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>Slik fungerer det</div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 300, color: MØRK, margin: 0, letterSpacing: '-0.025em' }}>Fire enkle steg</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 18 }}>
          {[
            { n: '01', t: 'Du bestiller', b: 'Velg tjeneste og leilighetsstørrelse — du får pris med en gang. Vi bekrefter tidspunkt på e-post.' },
            { n: '02', t: 'Vi sjekker', b: 'Lokal håndverker går grundig gjennom leiligheten. Sjekker bad, kjøkken, terrasse, ventilasjon, elektrisk, vinduer.' },
            { n: '03', t: 'Du får rapport', b: 'Skriftlig rapport med bilder og prioriterte funn — det er trygt, det er en merknad, eller det haster.' },
            { n: '04', t: 'Vi utbedrer', b: 'Hvis noe trenger oppmerksomhet, får du tilbud på utbedring direkte. Du velger om vi gjør jobben eller ikke.' },
          ].map((s, i) => (
            <div key={i} className="anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 14 }}>{s.n}</div>
              <div style={{ fontSize: 19, fontWeight: 500, color: MØRK, marginBottom: 10, letterSpacing: '-0.015em' }}>{s.t}</div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: FARGER.tekstMid, margin: 0, fontWeight: 300 }}>{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: MØRK, color: CREAM_LYS, padding: '40px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, letterSpacing: '0.06em' }}>
          BOLIGINSPEKSJON · LEGANGER &amp; OSVAAG EIENDOM
        </div>
        <div style={{ fontSize: 12, opacity: 0.5 }}>
          Costa del Sol · post@loeiendom.com
        </div>
      </footer>
    </main>
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
