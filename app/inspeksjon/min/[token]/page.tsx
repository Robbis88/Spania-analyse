'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, use } from 'react'
import { FARGER, RADIUS, SHADOW } from '../../../lib/styles'
import {
  STORRELSE_ETIKETT, TJENESTE_ETIKETT,
  BESTILLING_STATUS_ETIKETT,
  type BestillingStatus, type Storrelse, type TjenesteType,
} from '../../../lib/inspeksjon'

type Bestilling = {
  id: string
  opprettet: string
  adresse: string
  kompleks: string | null
  leilighet_nr: string | null
  storrelse: Storrelse
  tjeneste_type: TjenesteType
  pris_eur: number
  onsket_dato: string | null
  status: BestillingStatus
  planlagt_tidspunkt: string | null
}

type Rapport = {
  id: string
  bestilling_id: string
  opprettet: string
  besokt_dato: string
  oppsummering: string | null
  anbefalinger: string | null
  bilde_stier: string[] | null
}

type Tilbud = {
  id: string
  bestilling_id: string
  opprettet: string
  tittel: string
  beskrivelse: string
  pris_eur: number
  estimert_dager: number | null
  status: 'utkast' | 'sendt' | 'akseptert' | 'avvist' | 'utfort'
  sendt_tidspunkt: string | null
}

type Svar = {
  kunde: { navn: string; epost: string }
  bestillinger: Bestilling[]
  rapporter: Rapport[]
  tilbud: Tilbud[]
  bildeUrler: Record<string, string>
}

const MØRK = FARGER.mork
const CREAM = FARGER.cream
const CREAM_LYS = FARGER.creamLys
const GULL = FARGER.gull

const fmtDato = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtDatoTid = (s: string | null) =>
  s ? new Date(s).toLocaleString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function MinSide({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<Svar | null>(null)
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(true)

  useEffect(() => {
    let avbrutt = false
    fetch(`/api/inspeksjon/kunde/${token}`)
      .then(r => r.json())
      .then(d => {
        if (avbrutt) return
        if (d.feil) setFeil(d.feil)
        else setData(d as Svar)
        setLaster(false)
      })
      .catch(e => {
        if (avbrutt) return
        setFeil(e instanceof Error ? e.message : 'Kunne ikke hente data')
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [token])

  return (
    <main style={{ background: CREAM, minHeight: '100vh', color: MØRK }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(250, 250, 246, 0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: `1px solid ${FARGER.kantUltralys}`,
        padding: '14px 28px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Leganger & Osvaag" width={40} height={40} style={{ objectFit: 'contain' }} priority />
            <span style={{ fontSize: 13, fontWeight: 600, color: MØRK, letterSpacing: '0.18em' }}>LEGANGER &amp; OSVAAG</span>
          </Link>
          <Link href="/inspeksjon" className="nav-lenke" style={{ fontSize: 13, color: FARGER.tekstMid, textDecoration: 'none', fontWeight: 500, letterSpacing: '-0.005em' }}>
            Bestill ny inspeksjon →
          </Link>
        </div>
      </header>

      <section style={{ maxWidth: 1000, margin: '0 auto', padding: 'clamp(40px, 8vw, 80px) clamp(16px, 4vw, 28px)' }}>
        {laster && (
          <div style={{ textAlign: 'center', padding: 60, color: FARGER.tekstLys }}>⏳ Laster…</div>
        )}

        {feil && !laster && (
          <div className="anim-fade-up" style={{
            background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`,
            borderRadius: RADIUS.lg, padding: 28, textAlign: 'center', color: '#7a0c1e',
          }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.005em' }}>Fant ikke side</div>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>{feil}</div>
            <Link href="/inspeksjon" style={{
              marginTop: 22, display: 'inline-flex', alignItems: 'center', gap: 8,
              background: MØRK, color: CREAM_LYS, textDecoration: 'none',
              padding: '12px 22px', fontSize: 13, fontWeight: 600,
              borderRadius: RADIUS.pill, boxShadow: SHADOW.sm,
              letterSpacing: '-0.005em',
            }}>
              ← Tilbake til bestilling
            </Link>
          </div>
        )}

        {data && (
          <>
            <div className="anim-fade-up" style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>Min side</div>
              <h1 style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 300, color: MØRK, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
                Hei {data.kunde.navn.split(' ')[0]}
              </h1>
              <p style={{ fontSize: 15, color: FARGER.tekstMid, marginTop: 10, lineHeight: 1.55 }}>
                Her ser du alle dine inspeksjoner — kommende besøk, rapporter og eventuelle tilbud.
                Du kan lagre denne lenken og komme tilbake når som helst.
              </p>
            </div>

            {/* Bestillinger */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>Inspeksjoner</div>
              {data.bestillinger.length === 0 ? (
                <div style={{ background: FARGER.hvit, border: `1px dashed ${GULL}55`, borderRadius: RADIUS.lg, padding: 36, textAlign: 'center', color: FARGER.tekstMid }}>
                  Ingen bestillinger ennå.
                </div>
              ) : data.bestillinger.map(b => {
                const rapport = data.rapporter.find(r => r.bestilling_id === b.id)
                const tilbudListe = data.tilbud.filter(t => t.bestilling_id === b.id)
                const sf = BESTILLING_STATUS_ETIKETT[b.status]
                return (
                  <div key={b.id} className="anim-fade-up" style={{
                    background: FARGER.hvit,
                    border: `1px solid ${FARGER.kantUltralys}`,
                    borderRadius: RADIUS.lg, padding: 24, marginBottom: 16,
                    boxShadow: SHADOW.sm,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 600, color: MØRK, letterSpacing: '-0.015em' }}>
                          📍 {b.adresse}{b.leilighet_nr ? ` · ${b.leilighet_nr}` : ''}
                        </div>
                        {b.kompleks && (
                          <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 4 }}>{b.kompleks}</div>
                        )}
                        <div style={{ fontSize: 13, color: FARGER.tekstLys, marginTop: 6 }}>
                          {STORRELSE_ETIKETT[b.storrelse]} · {TJENESTE_ETIKETT[b.tjeneste_type]} · €{b.pris_eur}
                        </div>
                      </div>
                      <span style={{ background: sf.bg, color: sf.tekst, fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: RADIUS.pill, letterSpacing: '0.02em' }}>
                        {sf.lbl}
                      </span>
                    </div>

                    {b.planlagt_tidspunkt && b.status === 'planlagt' && (
                      <div style={{ background: '#e8f0fe', border: `1px solid #1a3a6e22`, borderRadius: RADIUS.md, padding: 14, marginTop: 12 }}>
                        <div style={{ fontSize: 11, color: '#1a3a6e', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>🗓 Planlagt</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: MØRK, letterSpacing: '-0.005em' }}>{fmtDatoTid(b.planlagt_tidspunkt)}</div>
                      </div>
                    )}

                    {rapport && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${FARGER.kantUltralys}` }}>
                        <div style={{ fontSize: 11, color: '#1a4d2b', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>
                          📋 Inspeksjonsrapport
                        </div>
                        <div style={{ fontSize: 12, color: FARGER.tekstLys, marginBottom: 12 }}>
                          Besøkt {fmtDato(rapport.besokt_dato)}
                        </div>
                        {rapport.oppsummering && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 12, color: FARGER.tekstMid, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Oppsummering</div>
                            <div style={{ fontSize: 14, color: MØRK, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{rapport.oppsummering}</div>
                          </div>
                        )}
                        {rapport.anbefalinger && (
                          <div>
                            <div style={{ fontSize: 12, color: FARGER.tekstMid, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Anbefalinger</div>
                            <div style={{ fontSize: 14, color: MØRK, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{rapport.anbefalinger}</div>
                          </div>
                        )}
                        {Array.isArray(rapport.bilde_stier) && rapport.bilde_stier.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 12, color: FARGER.tekstMid, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Bilder fra inspeksjonen</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                              {rapport.bilde_stier.map(sti => {
                                const url = data.bildeUrler[sti]
                                if (!url) return null
                                return (
                                  <a key={sti} href={url} target="_blank" rel="noreferrer" style={{
                                    background: FARGER.flateMid, borderRadius: RADIUS.md,
                                    overflow: 'hidden', aspectRatio: '4/3',
                                    boxShadow: SHADOW.xs, display: 'block',
                                  }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} />
                                  </a>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {tilbudListe.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${FARGER.kantUltralys}` }}>
                        <div style={{ fontSize: 11, color: '#7a4a08', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>
                          📧 Utbedrings-tilbud ({tilbudListe.length})
                        </div>
                        {tilbudListe.map(t => (
                          <div key={t.id} style={{ background: '#fef9e8', border: `1px solid #7a6a0822`, borderRadius: RADIUS.md, padding: 14, marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: MØRK, letterSpacing: '-0.005em' }}>{t.tittel}</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: MØRK, letterSpacing: '-0.01em' }}>€{t.pris_eur}</div>
                            </div>
                            <div style={{ fontSize: 13.5, color: FARGER.tekstMid, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.beskrivelse}</div>
                            {t.estimert_dager && (
                              <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 6 }}>
                                Estimert tid: {t.estimert_dager} {Number(t.estimert_dager) === 1 ? 'dag' : 'dager'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ textAlign: 'center', padding: 28, background: FARGER.creamLys, borderRadius: RADIUS.lg, border: `1px solid ${GULL}22` }}>
              <p style={{ fontSize: 14, color: FARGER.tekstMid, marginTop: 0, marginBottom: 16, lineHeight: 1.55 }}>
                Trenger du en ny inspeksjon?
              </p>
              <Link href="/inspeksjon" className="knapp-hover-loft" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: MØRK, color: CREAM_LYS, textDecoration: 'none',
                padding: '14px 26px', fontSize: 13, fontWeight: 600,
                borderRadius: RADIUS.pill, boxShadow: SHADOW.sm,
                letterSpacing: '-0.005em',
              }}>
                Bestill inspeksjon →
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
