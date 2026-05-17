'use client'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { PortalHeader } from '../../components/portal/PortalHeader'
import { InteresseModal } from '../../components/portal/InteresseModal'
import { plukkOversettelse, plukkOversettelseListe, useSprak, useValuta } from '../../lib/i18n'
import { FARGER, RADIUS, SHADOW, MOTION } from '../../lib/styles'

const MØRK = FARGER.mork
const CREAM = FARGER.cream
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

type BoligDetalj = {
  id: string
  navn: string
  til_leie: boolean
  til_salgs: boolean
  pris_natt: number | null
  pris_uke: number | null
  min_netter: number | null
  maks_gjester: number | null
  utleie_beskrivelse: string | null
  utleie_kort: string | null
  fasiliteter: string[]
  salgspris_eur: number | null
  salg_beskrivelse: string | null
  salg_kort: string | null
  byggear: number | null
  tomt_m2: number | null
  kort_avstand: Record<string, string>
  bolig_data: {
    type?: string; beliggenhet?: string; soverom?: string | number; bad?: string | number;
    areal?: string | number; avstand_strand?: string | number; basseng?: string;
    parkering?: string; havutsikt?: string;
  }
  bilder: { id: string; url: string | null }[]
  navn_oversettelser?: Record<string, string> | null
  utleie_kort_oversettelser?: Record<string, string> | null
  utleie_beskrivelse_oversettelser?: Record<string, string> | null
  salg_kort_oversettelser?: Record<string, string> | null
  salg_beskrivelse_oversettelser?: Record<string, string> | null
  utleie_fasiliteter_oversettelser?: Record<string, string[]> | null
}


export default function BoligDetaljSide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { sprak, t } = useSprak()
  const [bolig, setBolig] = useState<BoligDetalj | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [aktivBilde, setAktivBilde] = useState(0)
  const [modalApen, setModalApen] = useState(false)
  const [erMobil, setErMobil] = useState(false)

  useEffect(() => {
    function sjekk() { setErMobil(window.innerWidth < 900) }
    sjekk()
    window.addEventListener('resize', sjekk)
    return () => window.removeEventListener('resize', sjekk)
  }, [])

  // Henter boligen når id endres. Feilteksten lokaliseres senere via t.feil_oppstod
  // i render — å ha t.feil_oppstod i deps trigger refetch ved språkbytte.
  useEffect(() => {
    let avbrutt = false
    fetch(`/api/utleie-portal/${id}`)
      .then(r => r.json())
      .then((data: { bolig?: BoligDetalj; feil?: string }) => {
        if (avbrutt) return
        if (data.feil) setFeil(data.feil)
        else if (data.bolig) setBolig(data.bolig)
        setLaster(false)
      })
      .catch(e => {
        if (avbrutt) return
        setFeil(e instanceof Error ? e.message : '__feil__')
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [id])

  return (
    <div style={{ background: CREAM, minHeight: '100vh', color: MØRK }}>
      <PortalHeader onRegistrerInteresse={() => setModalApen(true)} />

      <main>
        {laster && (
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(32px, 5vw, 56px) clamp(18px, 4vw, 28px)' }}>
            <div className="skimmer" style={{ height: 14, width: 120, marginBottom: 24, borderRadius: 4 }} />
            <div className="skimmer" style={{ height: 14, width: 100, marginBottom: 16, borderRadius: 4 }} />
            <div className="skimmer" style={{ height: 44, width: '70%', marginBottom: 18, borderRadius: 6 }} />
            <div className="skimmer" style={{ height: 18, width: '90%', marginBottom: 10, borderRadius: 4 }} />
            <div className="skimmer" style={{ height: 18, width: '60%', marginBottom: 32, borderRadius: 4 }} />
            <div className="skimmer" style={{ aspectRatio: '16 / 9', borderRadius: RADIUS.lg }} />
          </div>
        )}
        {feil && (
          <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 28px' }}>
            <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, padding: 20, color: '#7a0c1e', borderRadius: RADIUS.md }}>{feil === '__feil__' ? t.feil_oppstod : feil}</div>
            <Link href="/" style={{ display: 'inline-block', marginTop: 20, fontSize: 14, color: FARGER.tekstMid, textDecoration: 'none' }}>← {t.tilbake_til_boliger}</Link>
          </div>
        )}

        {bolig && (
          <>
            {/* HERO */}
            <section style={{
              background: `linear-gradient(180deg, ${CREAM_LYS} 0%, ${CREAM} 100%)`,
              position: 'relative', overflow: 'hidden',
            }}>
              <div aria-hidden style={{
                position: 'absolute', top: '-30%', right: '-15%',
                width: '50%', height: '120%',
                background: `radial-gradient(circle, ${GULL}12 0%, transparent 60%)`,
                pointerEvents: 'none',
              }} />
              <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(28px, 5vw, 48px) clamp(18px, 4vw, 28px) clamp(40px, 7vw, 64px)', position: 'relative' }}>
                <Link href="/" className="anim-fade-up" style={{
                  fontSize: 13, color: FARGER.tekstMid, textDecoration: 'none',
                  letterSpacing: '-0.005em',
                  marginBottom: 26, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px 6px 10px',
                  background: FARGER.hvit,
                  border: `1px solid ${FARGER.kantUltralys}`,
                  borderRadius: RADIUS.pill,
                  boxShadow: SHADOW.xs,
                  transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                }}>
                  <span aria-hidden>←</span> {t.tilbake_til_boliger}
                </Link>
                <div className="anim-fade-up" style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 16, animationDelay: '40ms' }}>
                  {(bolig.bolig_data.beliggenhet || 'SPANIA').toUpperCase()}
                </div>
                <h1 className="anim-fade-up" style={{ fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 300, color: MØRK, margin: '0 0 20px', lineHeight: 1.05, letterSpacing: '-0.025em', animationDelay: '80ms' }}>
                  {plukkOversettelse(bolig.navn_oversettelser, sprak, bolig.navn)}
                </h1>
                {(() => {
                  const kort = bolig.til_salgs
                    ? plukkOversettelse(bolig.salg_kort_oversettelser, sprak, bolig.salg_kort)
                    : plukkOversettelse(bolig.utleie_kort_oversettelser, sprak, bolig.utleie_kort)
                  return kort ? (
                    <p className="anim-fade-up" style={{ fontSize: 18, color: FARGER.tekstMid, lineHeight: 1.6, margin: '0 0 36px', maxWidth: 720, fontWeight: 300, animationDelay: '120ms' }}>
                      {kort}
                    </p>
                  ) : null
                })()}

                <PrisStripe bolig={bolig} onForesporsel={() => setModalApen(true)} />
              </div>
            </section>

            {/* GALLERI */}
            {bolig.bilder.length > 0 && (
              <section style={{ background: CREAM, padding: 'clamp(28px, 5vw, 48px) 0' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 clamp(16px, 4vw, 28px)' }}>
                  <BildeGalleri bilder={bolig.bilder} aktiv={aktivBilde} onVelg={setAktivBilde} />
                </div>
              </section>
            )}

            {/* INNHOLD */}
            <section style={{ background: CREAM_LYS, padding: 'clamp(48px, 8vw, 80px) 0' }}>
              <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 clamp(16px, 4vw, 28px)', display: 'grid', gridTemplateColumns: erMobil ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: erMobil ? 40 : 72 }}>
                <div>
                  {(() => {
                    const full = bolig.til_salgs
                      ? plukkOversettelse(bolig.salg_beskrivelse_oversettelser, sprak, bolig.salg_beskrivelse)
                      : plukkOversettelse(bolig.utleie_beskrivelse_oversettelser, sprak, bolig.utleie_beskrivelse)
                    return full ? (
                      <Seksjon eyebrow={t.om_boligen} tittel={t.om_boligen}>
                        <p style={{ fontSize: 16, color: FARGER.tekstMid, lineHeight: 1.85, margin: 0, whiteSpace: 'pre-wrap', fontWeight: 300 }}>
                          {full}
                        </p>
                      </Seksjon>
                    ) : null
                  })()}

                  <Seksjon eyebrow={t.spesifikasjoner} tittel={t.spesifikasjoner}>
                    <SpecTabell bolig={bolig} />
                  </Seksjon>

                  {(() => {
                    const fas = plukkOversettelseListe(bolig.utleie_fasiliteter_oversettelser, sprak, bolig.fasiliteter)
                    return fas.length > 0 ? (
                      <Seksjon eyebrow={t.fasiliteter} tittel={t.fasiliteter}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 32px' }}>
                          {fas.map((f, i) => (
                            <div key={i} style={{ fontSize: 14.5, color: FARGER.tekstMid, padding: '12px 0', borderBottom: `1px solid ${FARGER.kantUltralys}`, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{
                                color: GULL, fontSize: 12,
                                width: 20, height: 20, borderRadius: RADIUS.pill,
                                background: `${GULL}18`,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>✓</span>{f}
                            </div>
                          ))}
                        </div>
                      </Seksjon>
                    ) : null
                  })()}

                  {Object.keys(bolig.kort_avstand).length > 0 && (
                    <Seksjon eyebrow={t.beliggenhet} tittel={t.beliggenhet}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                        {Object.entries(bolig.kort_avstand).map(([navn, avstand], i) => (
                          <div key={i} style={{
                            background: FARGER.hvit,
                            border: `1px solid ${FARGER.kantUltralys}`,
                            padding: '16px 18px',
                            borderRadius: RADIUS.md,
                            boxShadow: SHADOW.xs,
                          }}>
                            <div style={{ fontSize: 11, color: GULL, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6, fontWeight: 700 }}>{navn}</div>
                            <div style={{ fontSize: 16, color: MØRK, fontWeight: 500, letterSpacing: '-0.01em' }}>{avstand}</div>
                          </div>
                        ))}
                      </div>
                    </Seksjon>
                  )}
                </div>

                <SidePanel bolig={bolig} onForesporsel={() => setModalApen(true)} erMobil={erMobil} />
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />

      <InteresseModal apen={modalApen} onLukk={() => setModalApen(false)} prosjektId={bolig?.id} prosjektNavn={bolig?.navn} />
    </div>
  )
}

function PrisStripe({ bolig, onForesporsel }: { bolig: BoligDetalj; onForesporsel: () => void }) {
  const { t } = useSprak()
  const { formater } = useValuta()
  return (
    <div className="anim-fade-up" style={{
      display: 'flex', alignItems: 'center', gap: 'clamp(20px, 3vw, 36px)',
      flexWrap: 'wrap',
      background: FARGER.hvit,
      border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg,
      padding: 'clamp(20px, 3vw, 28px)',
      boxShadow: SHADOW.sm,
      animationDelay: '160ms',
    }}>
      {bolig.til_salgs && bolig.salgspris_eur && (
        <div>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', marginBottom: 6, textTransform: 'uppercase', fontWeight: 700 }}>{t.til_salgs}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: MØRK, letterSpacing: '-0.02em' }}>{formater(bolig.salgspris_eur)}</div>
        </div>
      )}
      {bolig.til_leie && bolig.pris_natt && (
        <div>
          <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', marginBottom: 6, textTransform: 'uppercase', fontWeight: 700 }}>{t.til_leie}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: MØRK, letterSpacing: '-0.02em' }}>{formater(bolig.pris_natt)}<span style={{ fontSize: 14, color: FARGER.tekstLys, fontWeight: 400 }}>{t.per_natt}</span></div>
        </div>
      )}
      {bolig.bolig_data.areal && (
        <div style={{ paddingLeft: 24, borderLeft: `1px solid ${FARGER.kantUltralys}` }}>
          <div style={{ fontSize: 11, color: FARGER.tekstLys, letterSpacing: '0.16em', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>{t.areal}</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: MØRK, letterSpacing: '-0.01em' }}>{bolig.bolig_data.areal} m²</div>
        </div>
      )}
      {bolig.byggear && (
        <div style={{ paddingLeft: 24, borderLeft: `1px solid ${FARGER.kantUltralys}` }}>
          <div style={{ fontSize: 11, color: FARGER.tekstLys, letterSpacing: '0.16em', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>{t.byggear}</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: MØRK, letterSpacing: '-0.01em' }}>{bolig.byggear}</div>
        </div>
      )}
      <div style={{ flex: 1, textAlign: 'right', minWidth: 200 }}>
        <button onClick={onForesporsel} className="knapp-hover-loft"
          style={{
            background: MØRK, color: CREAM_LYS, border: 'none',
            padding: '14px 28px', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.02em', cursor: 'pointer',
            borderRadius: RADIUS.pill,
            boxShadow: SHADOW.sm,
          }}>
          {t.registrer_interesse}
        </button>
      </div>
    </div>
  )
}

function Seksjon({ eyebrow, tittel, children }: { eyebrow: string; tittel: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 72 }}>
      <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>{eyebrow}</div>
      <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 300, color: MØRK, margin: '0 0 32px', letterSpacing: '-0.025em', lineHeight: 1.15 }}>{tittel}</h2>
      {children}
    </section>
  )
}

function SpecTabell({ bolig }: { bolig: BoligDetalj }) {
  const { t } = useSprak()
  const rader: Array<[string, string]> = []
  if (bolig.bolig_data.type) rader.push([t.type_bolig, String(bolig.bolig_data.type)])
  if (bolig.bolig_data.areal) rader.push([t.areal, `${bolig.bolig_data.areal} m²`])
  if (bolig.tomt_m2) rader.push([t.tomt, `${bolig.tomt_m2} m²`])
  if (bolig.bolig_data.soverom) rader.push([t.soverom, String(bolig.bolig_data.soverom)])
  if (bolig.bolig_data.bad) rader.push([t.bad, String(bolig.bolig_data.bad)])
  if (bolig.byggear) rader.push([t.byggear, String(bolig.byggear)])
  if (bolig.bolig_data.basseng && bolig.bolig_data.basseng !== 'ingen') rader.push([t.basseng, bolig.bolig_data.basseng])
  if (bolig.bolig_data.parkering && bolig.bolig_data.parkering !== 'ingen') rader.push([t.parkering, bolig.bolig_data.parkering])
  if (bolig.bolig_data.havutsikt && bolig.bolig_data.havutsikt !== 'nei') rader.push([t.havutsikt, bolig.bolig_data.havutsikt])
  if (bolig.bolig_data.avstand_strand) rader.push([t.avstand_strand, `${bolig.bolig_data.avstand_strand} m`])
  if (bolig.maks_gjester) rader.push([t.maks_gjester, String(bolig.maks_gjester)])
  if (bolig.min_netter) rader.push([t.min_opphold, `${bolig.min_netter} ${t.natter}`])

  if (rader.length === 0) return null

  return (
    <div style={{
      background: FARGER.hvit,
      border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg,
      padding: 'clamp(8px, 2vw, 20px) clamp(16px, 3vw, 24px)',
      boxShadow: SHADOW.xs,
    }}>
      {rader.map(([lbl, val], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: i === rader.length - 1 ? 'none' : `1px solid ${FARGER.kantUltralys}`, fontSize: 14.5, gap: 16 }}>
          <span style={{ color: FARGER.tekstMid, fontWeight: 400 }}>{lbl}</span>
          <span style={{ color: MØRK, fontWeight: 500, textAlign: 'right' }}>{val}</span>
        </div>
      ))}
    </div>
  )
}

function BildeGalleri({ bilder, aktiv, onVelg }: { bilder: { id: string; url: string | null }[]; aktiv: number; onVelg: (i: number) => void }) {
  if (bilder.length === 0) return null
  const aktivBilde = bilder[aktiv] || bilder[0]
  return (
    <div>
      <div style={{
        width: '100%', aspectRatio: '16 / 9',
        background: FARGER.kantLys,
        overflow: 'hidden', marginBottom: 14,
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.md,
      }}>
        {aktivBilde.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={aktivBilde.url} alt="" loading="eager" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: `opacity ${MOTION.normal}` }} />
        )}
      </div>
      {bilder.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(bilder.length, 8)}, 1fr)`, gap: 10 }}>
          {bilder.slice(0, 8).map((b, i) => (
            <button key={b.id} onClick={() => onVelg(i)}
              style={{
                border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden',
                aspectRatio: '4 / 3', background: FARGER.kantLys,
                opacity: i === aktiv ? 1 : 0.6,
                outline: i === aktiv ? `2px solid ${GULL}` : `1px solid ${FARGER.kantUltralys}`,
                outlineOffset: i === aktiv ? -2 : -1,
                transition: `opacity ${MOTION.rask}, transform ${MOTION.rask}`,
                borderRadius: RADIUS.md,
                transform: i === aktiv ? 'scale(1)' : 'scale(0.98)',
              }}>
              {b.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SidePanel({ bolig, onForesporsel, erMobil }: { bolig: BoligDetalj; onForesporsel: () => void; erMobil: boolean }) {
  const { t } = useSprak()
  const { formater } = useValuta()
  return (
    <aside style={{
      position: erMobil ? 'static' : 'sticky',
      top: erMobil ? 'auto' : 104,
      alignSelf: 'start',
      background: FARGER.hvit,
      border: `1px solid ${FARGER.kantUltralys}`,
      padding: erMobil ? 24 : 32,
      borderRadius: RADIUS.xl,
      boxShadow: SHADOW.md,
    }}>
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: `1px solid ${FARGER.kantUltralys}` }}>
        {bolig.til_salgs && bolig.salgspris_eur && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{t.til_salgs}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: MØRK, letterSpacing: '-0.02em' }}>{formater(bolig.salgspris_eur)}</div>
          </div>
        )}
        {bolig.til_leie && (
          <div>
            <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{t.til_leie}</div>
            {bolig.pris_natt && <div style={{ fontSize: 24, fontWeight: 600, color: MØRK, letterSpacing: '-0.02em' }}>{formater(bolig.pris_natt)}<span style={{ fontSize: 13, color: FARGER.tekstLys, fontWeight: 400 }}>{t.per_natt}</span></div>}
            {bolig.pris_uke && <div style={{ fontSize: 14, color: FARGER.tekstMid, marginTop: 6 }}>{formater(bolig.pris_uke)}{t.per_uke}</div>}
            {bolig.min_netter && <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 8 }}>{t.min_opphold}: {bolig.min_netter} {t.natter}</div>}
          </div>
        )}
        {!bolig.salgspris_eur && !bolig.pris_natt && (
          <div style={{ fontSize: 14, color: FARGER.tekstLys, fontStyle: 'italic' }}>{t.pris_paa_foresporsel}</div>
        )}
      </div>

      <button onClick={onForesporsel} className="knapp-hover-loft"
        style={{
          width: '100%', background: MØRK, color: CREAM_LYS, border: 'none',
          padding: 16, fontSize: 13, fontWeight: 600,
          letterSpacing: '0.02em', cursor: 'pointer',
          marginBottom: 10,
          borderRadius: RADIUS.pill,
          boxShadow: SHADOW.sm,
        }}>
        {t.registrer_interesse}
      </button>
      <a href="mailto:post@loeiendom.com"
        style={{
          display: 'block', textAlign: 'center', width: '100%', padding: 14,
          fontSize: 13, fontWeight: 500, color: MØRK, textDecoration: 'none',
          border: `1px solid ${FARGER.kantUltralys}`, letterSpacing: '-0.005em',
          boxSizing: 'border-box',
          borderRadius: RADIUS.pill,
          background: FARGER.flateLys,
          transition: `background ${MOTION.rask}`,
        }}>
        post@loeiendom.com
      </a>
    </aside>
  )
}

function Footer() {
  const { t } = useSprak()
  return (
    <footer style={{ background: MØRK, color: CREAM_LYS, padding: '56px 28px 40px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', textAlign: 'center', fontSize: 12, color: 'rgba(250,250,246,0.45)', letterSpacing: '0.04em' }}>
        {t.copyright} {new Date().getFullYear()}
      </div>
    </footer>
  )
}
