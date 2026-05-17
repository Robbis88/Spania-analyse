'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import type { DashboardData, DashboardProsjekt, DashboardVarsel } from '../api/dashboard/route'

type Props = {
  onApneProsjekt: (prosjektId: string) => void
  marked?: 'spania' | 'norge'  // hvis satt, viser dashboardet kun det markedet
}

const fmtEur = (n: number) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'
const fmtNok = (n: number) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'
const fmtBelop = (n: number, valuta: 'EUR' | 'NOK') => valuta === 'EUR' ? fmtEur(n) : fmtNok(n)

const ANBEFALING_FARGE: Record<DashboardProsjekt['anbefaling']['type'], { bg: string; tekst: string; emoji: string }> = {
  leie:                { bg: '#e8f5ed', tekst: '#1a4d2b', emoji: '🏖️' },
  salg:                { bg: '#f0ede5', tekst: '#7a4a08', emoji: '💰' },
  utlei_deretter_salg: { bg: '#faf7ee', tekst: '#7a4a08', emoji: '🔄' },
  avvent:              { bg: '#fde8ec', tekst: '#7a0c1e', emoji: '⚠️' },
}

const VARSEL_FARGE: Record<DashboardVarsel['alvorlighet'], { bg: string; tekst: string; ramme: string }> = {
  info:     { bg: '#faf7ee', tekst: '#5a6171', ramme: '#b89a6f33' },
  advarsel: { bg: '#fff8e1', tekst: '#7a4a08', ramme: '#B05E0A44' },
  kritisk:  { bg: '#fde8ec', tekst: '#7a0c1e', ramme: '#C8102E44' },
}

const VARSEL_IKON: Record<DashboardVarsel['type'], string> = {
  overskridelse:     '⚠️',
  utlopende_dokument: '📄',
  forfalt_sjekkpunkt: '⏰',
  ocr_venter:        '⏳',
}

export function Dashboard({ onApneProsjekt, marked }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [filter, setFilter] = useState<'alle' | 'flipp' | 'utleie'>('alle')

  useEffect(() => {
    let avbrutt = false
    const url = marked ? `/api/dashboard?marked=${marked}` : '/api/dashboard'
    fetch(url)
      .then(r => r.json())
      .then((d: DashboardData & { feil?: string }) => {
        if (avbrutt) return
        if (d.feil) setFeil(d.feil)
        else setData(d)
        setLaster(false)
      })
      .catch(e => {
        if (avbrutt) return
        setFeil(e instanceof Error ? e.message : 'Kunne ikke hente dashboard')
        setLaster(false)
      })
    return () => { avbrutt = true }
  }, [marked])

  const filtrerte = useMemo(() => {
    if (!data) return []
    if (filter === 'alle') return data.prosjekter
    return data.prosjekter.filter(p => p.kategori === filter)
  }, [data, filter])

  if (laster) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 18, boxShadow: SHADOW.sm }}>
            <div className="skimmer" style={{ height: 16, width: '60%', marginBottom: 10, borderRadius: 4 }} />
            <div className="skimmer" style={{ height: 12, width: '40%', marginBottom: 18, borderRadius: 4 }} />
            <div className="skimmer" style={{ height: 60, borderRadius: RADIUS.md }} />
          </div>
        ))}
      </div>
    )
  }
  if (feil) return <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, padding: 18, borderRadius: RADIUS.md, color: '#7a0c1e' }}>{feil}</div>
  if (!data || data.totaler.antall_prosjekter === 0) {
    return (
      <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 48, textAlign: 'center', color: FARGER.tekstMid }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Ingen prosjekter ennå</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Lag ditt første via Boliganalyse, Norske boliger eller Regnskap.</div>
      </div>
    )
  }

  const t = data.totaler

  return (
    <div>
      {/* Topplinje med totaler */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiKort
          lbl="Prosjekter"
          stor={`${t.antall_prosjekter}`}
          liten={marked === 'norge' ? `${t.antall_prosjekter} norske` : `${t.antall_flipp} flipp · ${t.antall_utleie} utleie`}
        />
        {marked !== 'norge' && (t.kapital_eur > 0 || t.kapital_nok === 0) && (
          <KpiKort lbl="Kapital bundet" stor={fmtEur(t.kapital_eur)} liten={t.forventet_fortjeneste_eur > 0 ? `+ ${fmtEur(t.forventet_fortjeneste_eur)} forventet` : ''} />
        )}
        {marked !== 'spania' && t.kapital_nok > 0 && (
          <KpiKort lbl="Kapital bundet" stor={fmtNok(t.kapital_nok)} liten={t.forventet_fortjeneste_nok > 0 ? `+ ${fmtNok(t.forventet_fortjeneste_nok)} forventet` : ''} />
        )}
        {marked !== 'norge' && (
          <KpiKort lbl="Aktive utleier" stor={`${t.aktive_utleier}`} liten="med leieinntekt > 0" />
        )}
      </div>

      {/* Varsler */}
      {data.varsler.length > 0 && (
        <div style={{
          background: FARGER.hvit,
          border: `1px solid ${FARGER.kantUltralys}`,
          borderRadius: RADIUS.lg,
          padding: 20,
          marginBottom: 20,
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>
            🔔 Handlingspunkter ({data.varsler.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.varsler.slice(0, 8).map((v, i) => {
              const f = VARSEL_FARGE[v.alvorlighet]
              return (
                <button key={i} onClick={() => onApneProsjekt(v.prosjekt_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    background: f.bg, border: `1px solid ${f.ramme}`,
                    borderRadius: RADIUS.md,
                    padding: '10px 14px', cursor: 'pointer', color: f.tekst, fontSize: 13,
                    width: '100%',
                    transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)' }}>
                  <span style={{ fontSize: 18 }}>{VARSEL_IKON[v.type]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>{v.prosjekt_navn}</div>
                    <div>{v.beskrivelse}</div>
                  </div>
                  <span style={{ fontSize: 12, color: FARGER.tekstLys }}>↗</span>
                </button>
              )
            })}
            {data.varsler.length > 8 && (
              <div style={{ fontSize: 12, color: FARGER.tekstLys, textAlign: 'center', padding: 6 }}>
                + {data.varsler.length - 8} flere — åpne prosjekter for å se dem
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter — flipp/utleie kun relevant for Spania (norske er alltid flipp i denne flyten) */}
      {marked !== 'norge' && (
        <div style={{
          display: 'inline-flex', gap: 4,
          background: FARGER.hvit,
          padding: 5,
          borderRadius: RADIUS.pill,
          boxShadow: SHADOW.sm,
          border: `1px solid ${FARGER.kantUltralys}`,
          marginBottom: 16,
        }}>
          {([
            { id: 'alle' as const, lbl: `Alle (${data.prosjekter.length})` },
            { id: 'flipp' as const, lbl: `Flipp (${t.antall_flipp})` },
            { id: 'utleie' as const, lbl: `Utleie (${t.antall_utleie})` },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                padding: '8px 16px', borderRadius: RADIUS.pill,
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: filter === f.id ? FARGER.mork : 'transparent',
                color: filter === f.id ? FARGER.creamLys : FARGER.tekstMid,
                letterSpacing: '-0.005em',
                transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
              }}>
              {f.lbl}
            </button>
          ))}
        </div>
      )}

      {/* Prosjekt-kort */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {filtrerte.map((p, i) => <ProsjektKort key={p.id} p={p} kortIndex={i} onApne={() => onApneProsjekt(p.id)} />)}
      </div>
      {filtrerte.length === 0 && (
        <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
          Ingen prosjekter i dette filteret.
        </div>
      )}
    </div>
  )
}

function KpiKort({ lbl, stor, liten }: { lbl: string; stor: string; liten?: string }) {
  return (
    <div style={{
      background: FARGER.hvit,
      border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg,
      padding: 18,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.02em' }}>{stor}</div>
      {liten && <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 6 }}>{liten}</div>}
    </div>
  )
}

function ProsjektKort({ p, kortIndex, onApne }: { p: DashboardProsjekt; kortIndex: number; onApne: () => void }) {
  const anb = ANBEFALING_FARGE[p.anbefaling.type]
  const sjekkPst = p.sjekkliste.totalt > 0 ? (p.sjekkliste.ok / p.sjekkliste.totalt) * 100 : 0
  const oppPst = p.oppussing.totalt > 0 ? (p.oppussing.ferdig / p.oppussing.totalt) * 100 : 0

  return (
    <button onClick={onApne}
      className="kort-loft anim-fade-up"
      style={{
        textAlign: 'left', cursor: 'pointer',
        background: FARGER.hvit,
        border: `1px solid ${FARGER.kantUltralys}`,
        borderRadius: RADIUS.lg, padding: 20, fontFamily: 'inherit',
        boxShadow: SHADOW.sm,
        animationDelay: `${Math.min(kortIndex, 8) * 40}ms`,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.015em' }}>{p.navn}</div>
          <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 4 }}>
            {p.marked === 'norge' ? '🇳🇴 Norge' : '🇪🇸 Spania'} · {p.kategori === 'flipp' ? 'Flipp' : 'Utleie'} · {p.status}
          </div>
        </div>
        <span style={{ background: anb.bg, color: anb.tekst, padding: '5px 12px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
          {anb.emoji} {p.anbefaling.type === 'utlei_deretter_salg' ? 'Hybrid' : p.anbefaling.type === 'leie' ? 'Behold' : p.anbefaling.type === 'salg' ? 'Selg' : 'Avvent'}
        </span>
      </div>

      {/* Anbefalings-tekst */}
      <div style={{ fontSize: 13, color: anb.tekst, fontStyle: 'italic', marginBottom: 14, lineHeight: 1.5 }}>
        {p.anbefaling.tekst}
      </div>

      {/* KPI-grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
        <KpiMini lbl="Investert" val={fmtBelop(p.total_invest, p.valuta)} />
        <KpiMini lbl="ROI" val={p.roi_pct !== null ? p.roi_pct.toFixed(1) + '%' : '–'} farge={p.roi_pct !== null ? (p.roi_pct >= 15 ? '#1a4d2b' : p.roi_pct >= 0 ? FARGER.mork : '#7a0c1e') : undefined} />
        {p.cashflow_mnd !== null && (
          <KpiMini lbl="Cashflow/mnd" val={fmtBelop(p.cashflow_mnd, p.valuta)} farge={p.cashflow_mnd >= 0 ? '#1a4d2b' : '#7a0c1e'} />
        )}
        {p.yield_pct !== null && (
          <KpiMini lbl="Yield" val={p.yield_pct.toFixed(1) + '%'} />
        )}
        {p.kvittering_sum > 0 && (
          <KpiMini lbl="Kvitteringer" val={fmtBelop(p.kvittering_sum, p.valuta)} />
        )}
      </div>

      {/* Progress: oppussing + sjekkliste */}
      {(p.oppussing.totalt > 0 || p.sjekkliste.totalt > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {p.oppussing.totalt > 0 && (
            <div>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Oppussing</span>
                <span>{p.oppussing.ferdig}/{p.oppussing.totalt}{p.oppussing.overskridelser > 0 && ` · ⚠️ ${p.oppussing.overskridelser} over budsjett`}</span>
              </div>
              <ProgressBar pct={oppPst} farge={p.oppussing.overskridelser > 0 ? '#C8102E' : '#2D7D46'} />
            </div>
          )}
          {p.sjekkliste.totalt > 0 && (
            <div>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Dokumenter</span>
                <span>{p.sjekkliste.ok}/{p.sjekkliste.totalt} på plass</span>
              </div>
              <ProgressBar pct={sjekkPst} farge={FARGER.gull} />
            </div>
          )}
        </div>
      )}
    </button>
  )
}

function KpiMini({ lbl, val, farge }: { lbl: string; val: string; farge?: string }) {
  return (
    <div style={{ background: FARGER.flateLys, padding: 10, borderRadius: RADIUS.md }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: farge || FARGER.mork, letterSpacing: '-0.01em' }}>{val}</div>
    </div>
  )
}

function ProgressBar({ pct, farge }: { pct: number; farge: string }) {
  return (
    <div style={{ height: 6, background: FARGER.flateMid, borderRadius: RADIUS.pill, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: farge, borderRadius: RADIUS.pill, transition: `width ${MOTION.normal}` }} />
    </div>
  )
}
