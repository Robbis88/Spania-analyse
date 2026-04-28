'use client'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { PortalHeader } from '../../components/portal/PortalHeader'
import { InteresseModal } from '../../components/portal/InteresseModal'
import { useSprak } from '../../lib/i18n'

const MØRK = '#0e1726'
const CREAM = '#fafaf6'
const CREAM_LYS = '#fdfcf7'
const GULL = '#b89a6f'

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
}

const fmtEur = (n: number | null) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : null

export default function BoligDetaljSide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useSprak()
  const [bolig, setBolig] = useState<BoligDetalj | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [aktivBilde, setAktivBilde] = useState(0)
  const [modalApen, setModalApen] = useState(false)

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
        setFeil(e instanceof Error ? e.message : t.feil_oppstod)
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [id, t.feil_oppstod])

  return (
    <div style={{ fontFamily: 'sans-serif', background: CREAM, minHeight: '100vh', color: MØRK }}>
      <PortalHeader onRegistrerInteresse={() => setModalApen(true)} />

      <main>
        {laster && <div style={{ textAlign: 'center', color: '#888', padding: 120 }}>{t.henter}</div>}
        {feil && (
          <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 28px' }}>
            <div style={{ background: '#fde8ec', border: '1px solid #C8102E', padding: 20, color: '#7a0c1e' }}>{feil}</div>
            <Link href="/" style={{ display: 'inline-block', marginTop: 20, fontSize: 13, color: '#666', textDecoration: 'none' }}>{t.tilbake_til_boliger}</Link>
          </div>
        )}

        {bolig && (
          <>
            {/* HERO */}
            <section style={{ background: CREAM_LYS, borderBottom: `1px solid ${GULL}22` }}>
              <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 28px 56px' }}>
                <Link href="/" style={{ fontSize: 11, color: '#888', textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28, display: 'inline-block' }}>
                  {t.tilbake_til_boliger}
                </Link>
                <div style={{ fontSize: 11, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14 }}>
                  {(bolig.bolig_data.beliggenhet || 'SPANIA').toUpperCase()}
                </div>
                <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', fontWeight: 300, color: MØRK, margin: '0 0 18px', lineHeight: 1.1, letterSpacing: '-0.01em' }}>{bolig.navn}</h1>
                {(bolig.utleie_kort || bolig.salg_kort) && (
                  <p style={{ fontSize: 17, color: '#5a6171', lineHeight: 1.65, margin: '0 0 32px', maxWidth: 720, fontWeight: 300 }}>
                    {bolig.til_salgs ? bolig.salg_kort : bolig.utleie_kort}
                  </p>
                )}

                <PrisStripe bolig={bolig} onForesporsel={() => setModalApen(true)} />
              </div>
            </section>

            {/* GALLERI */}
            {bolig.bilder.length > 0 && (
              <section style={{ background: CREAM, padding: '40px 0' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px' }}>
                  <BildeGalleri bilder={bolig.bilder} aktiv={aktivBilde} onVelg={setAktivBilde} />
                </div>
              </section>
            )}

            {/* INNHOLD */}
            <section style={{ background: CREAM_LYS, padding: '64px 0' }}>
              <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 28px', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 64 }}>
                <div>
                  {(bolig.utleie_beskrivelse || bolig.salg_beskrivelse) && (
                    <Seksjon eyebrow={t.om_boligen.toUpperCase()} tittel={t.om_boligen}>
                      <p style={{ fontSize: 15, color: '#444', lineHeight: 1.85, margin: 0, whiteSpace: 'pre-wrap', fontWeight: 300 }}>
                        {bolig.til_salgs ? bolig.salg_beskrivelse : bolig.utleie_beskrivelse}
                      </p>
                    </Seksjon>
                  )}

                  <Seksjon eyebrow={t.spesifikasjoner.toUpperCase()} tittel={t.spesifikasjoner}>
                    <SpecTabell bolig={bolig} />
                  </Seksjon>

                  {bolig.fasiliteter.length > 0 && (
                    <Seksjon eyebrow={t.fasiliteter.toUpperCase()} tittel={t.fasiliteter}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 32px' }}>
                        {bolig.fasiliteter.map((f, i) => (
                          <div key={i} style={{ fontSize: 14, color: '#444', padding: '10px 0', borderBottom: `1px solid ${GULL}22`, fontWeight: 300 }}>
                            <span style={{ color: GULL, marginRight: 12 }}>—</span>{f}
                          </div>
                        ))}
                      </div>
                    </Seksjon>
                  )}

                  {Object.keys(bolig.kort_avstand).length > 0 && (
                    <Seksjon eyebrow={t.beliggenhet.toUpperCase()} tittel={t.beliggenhet}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                        {Object.entries(bolig.kort_avstand).map(([navn, avstand], i) => (
                          <div key={i} style={{ borderLeft: `2px solid ${GULL}`, paddingLeft: 14 }}>
                            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{navn}</div>
                            <div style={{ fontSize: 15, color: MØRK, fontWeight: 400 }}>{avstand}</div>
                          </div>
                        ))}
                      </div>
                    </Seksjon>
                  )}
                </div>

                <SidePanel bolig={bolig} onForesporsel={() => setModalApen(true)} />
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', borderTop: `1px solid ${GULL}33`, paddingTop: 28 }}>
      {bolig.til_salgs && bolig.salgspris_eur && (
        <div>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.16em', marginBottom: 4, textTransform: 'uppercase' }}>{t.til_salgs}</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: MØRK }}>{fmtEur(bolig.salgspris_eur)}</div>
        </div>
      )}
      {bolig.til_leie && bolig.pris_natt && (
        <div>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.16em', marginBottom: 4, textTransform: 'uppercase' }}>{t.til_leie}</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: MØRK }}>{fmtEur(bolig.pris_natt)}<span style={{ fontSize: 14, color: '#888', fontWeight: 300 }}>{t.per_natt}</span></div>
        </div>
      )}
      {bolig.bolig_data.areal && (
        <div>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.16em', marginBottom: 4, textTransform: 'uppercase' }}>{t.areal}</div>
          <div style={{ fontSize: 22, fontWeight: 400, color: MØRK }}>{bolig.bolig_data.areal} m²</div>
        </div>
      )}
      {bolig.byggear && (
        <div>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.16em', marginBottom: 4, textTransform: 'uppercase' }}>{t.byggear}</div>
          <div style={{ fontSize: 22, fontWeight: 400, color: MØRK }}>{bolig.byggear}</div>
        </div>
      )}
      <div style={{ flex: 1, textAlign: 'right', minWidth: 200 }}>
        <button onClick={onForesporsel}
          style={{ background: MØRK, color: CREAM_LYS, border: 'none', padding: '14px 28px', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
          {t.registrer_interesse}
        </button>
      </div>
    </div>
  )
}

function Seksjon({ eyebrow, tittel, children }: { eyebrow: string; tittel: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 64 }}>
      <div style={{ fontSize: 10, color: GULL, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 12 }}>{eyebrow}</div>
      <h2 style={{ fontSize: 26, fontWeight: 300, color: MØRK, margin: '0 0 28px', letterSpacing: '-0.005em' }}>{tittel}</h2>
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
    <div>
      {rader.map(([lbl, val], i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${GULL}22`, fontSize: 14 }}>
          <span style={{ color: '#666', fontWeight: 300 }}>{lbl}</span>
          <span style={{ color: MØRK, fontWeight: 500 }}>{val}</span>
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
      <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#e8e4d8', overflow: 'hidden', marginBottom: 14 }}>
        {aktivBilde.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={aktivBilde.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </div>
      {bilder.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(bilder.length, 8)}, 1fr)`, gap: 8 }}>
          {bilder.slice(0, 8).map((b, i) => (
            <button key={b.id} onClick={() => onVelg(i)}
              style={{
                border: 'none', padding: 0, cursor: 'pointer', overflow: 'hidden',
                aspectRatio: '4 / 3', background: '#e8e4d8',
                opacity: i === aktiv ? 1 : 0.55,
                outline: i === aktiv ? `2px solid ${GULL}` : 'none',
                outlineOffset: -2,
                transition: 'opacity 0.2s',
              }}>
              {b.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SidePanel({ bolig, onForesporsel }: { bolig: BoligDetalj; onForesporsel: () => void }) {
  const { t } = useSprak()
  return (
    <aside style={{ position: 'sticky', top: 96, alignSelf: 'start', background: 'white', border: `1px solid ${GULL}33`, padding: 32 }}>
      <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: `1px solid ${GULL}22` }}>
        {bolig.til_salgs && bolig.salgspris_eur && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{t.til_salgs}</div>
            <div style={{ fontSize: 26, fontWeight: 400, color: MØRK }}>{fmtEur(bolig.salgspris_eur)}</div>
          </div>
        )}
        {bolig.til_leie && (
          <div>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{t.til_leie}</div>
            {bolig.pris_natt && <div style={{ fontSize: 22, fontWeight: 400, color: MØRK }}>{fmtEur(bolig.pris_natt)}<span style={{ fontSize: 13, color: '#888' }}>{t.per_natt}</span></div>}
            {bolig.pris_uke && <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>{fmtEur(bolig.pris_uke)}{t.per_uke}</div>}
            {bolig.min_netter && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{t.min_opphold}: {bolig.min_netter} {t.natter}</div>}
          </div>
        )}
        {!bolig.salgspris_eur && !bolig.pris_natt && (
          <div style={{ fontSize: 14, color: '#888', fontStyle: 'italic' }}>{t.pris_paa_foresporsel}</div>
        )}
      </div>

      <button onClick={onForesporsel}
        style={{
          width: '100%', background: MØRK, color: CREAM_LYS, border: 'none',
          padding: 16, fontSize: 12, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
          marginBottom: 12,
        }}>
        {t.registrer_interesse}
      </button>
      <a href="mailto:post@loeiendom.com"
        style={{
          display: 'block', textAlign: 'center', width: '100%', padding: 14,
          fontSize: 12, fontWeight: 500, color: MØRK, textDecoration: 'none',
          border: `1px solid ${GULL}55`, letterSpacing: '0.1em', textTransform: 'uppercase',
          boxSizing: 'border-box',
        }}>
        post@loeiendom.com
      </a>
    </aside>
  )
}

function Footer() {
  const { t } = useSprak()
  return (
    <footer style={{ background: MØRK, color: CREAM_LYS, padding: '48px 28px 36px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', textAlign: 'center', fontSize: 11, color: 'rgba(250,250,246,0.5)', letterSpacing: '0.06em' }}>
        {t.copyright} {new Date().getFullYear()}
      </div>
    </footer>
  )
}
