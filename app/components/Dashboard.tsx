'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS } from '../lib/styles'
import type { DashboardData, DashboardProsjekt, DashboardVarsel } from '../api/dashboard/route'

type Props = {
  onApneProsjekt: (prosjektId: string) => void
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
  info:     { bg: '#faf7ee', tekst: '#5a6171', ramme: '#b89a6f44' },
  advarsel: { bg: '#fff8e1', tekst: '#7a4a08', ramme: '#B05E0A66' },
  kritisk:  { bg: '#fde8ec', tekst: '#7a0c1e', ramme: '#C8102E66' },
}

const VARSEL_IKON: Record<DashboardVarsel['type'], string> = {
  overskridelse:     '⚠️',
  utlopende_dokument: '📄',
  forfalt_sjekkpunkt: '⏰',
  ocr_venter:        '⏳',
}

export function Dashboard({ onApneProsjekt }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [filter, setFilter] = useState<'alle' | 'flipp' | 'utleie' | 'norge'>('alle')

  useEffect(() => {
    let avbrutt = false
    fetch('/api/dashboard')
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
  }, [])

  const filtrerte = useMemo(() => {
    if (!data) return []
    if (filter === 'alle') return data.prosjekter
    if (filter === 'norge') return data.prosjekter.filter(p => p.marked === 'norge')
    return data.prosjekter.filter(p => p.kategori === filter)
  }, [data, filter])

  if (laster) return <div style={{ textAlign: 'center', padding: 60, color: FARGER.tekstLys }}>⏳ Bygger dashboard…</div>
  if (feil) return <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}`, padding: 16, borderRadius: RADIUS.md, color: '#7a0c1e' }}>{feil}</div>
  if (!data || data.totaler.antall_prosjekter === 0) {
    return (
      <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 40, textAlign: 'center', color: FARGER.tekstLys }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Ingen prosjekter ennå</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Lag ditt første via Boliganalyse, Norske boliger eller Regnskap.</div>
      </div>
    )
  }

  const t = data.totaler

  return (
    <div>
      {/* Topplinje med totaler */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <KpiKort lbl="Prosjekter" stor={`${t.antall_prosjekter}`} liten={`${t.antall_flipp} flipp · ${t.antall_utleie} utleie · ${t.antall_norske} Norge`} />
        {(t.kapital_eur > 0 || t.kapital_nok === 0) && (
          <KpiKort lbl="Kapital bundet (Spania)" stor={fmtEur(t.kapital_eur)} liten={t.forventet_fortjeneste_eur > 0 ? `+ ${fmtEur(t.forventet_fortjeneste_eur)} forventet` : ''} />
        )}
        {t.kapital_nok > 0 && (
          <KpiKort lbl="Kapital bundet (Norge)" stor={fmtNok(t.kapital_nok)} liten={t.forventet_fortjeneste_nok > 0 ? `+ ${fmtNok(t.forventet_fortjeneste_nok)} forventet` : ''} />
        )}
        <KpiKort lbl="Aktive utleier" stor={`${t.aktive_utleier}`} liten="med leieinntekt > 0" />
      </div>

      {/* Varsler */}
      {data.varsler.length > 0 && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            🔔 Handlingspunkter ({data.varsler.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.varsler.slice(0, 8).map((v, i) => {
              const f = VARSEL_FARGE[v.alvorlighet]
              return (
                <button key={i} onClick={() => onApneProsjekt(v.prosjekt_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    background: f.bg, border: `1px solid ${f.ramme}`, borderRadius: RADIUS.sm,
                    padding: '8px 12px', cursor: 'pointer', color: f.tekst, fontSize: 12,
                    width: '100%',
                  }}>
                  <span style={{ fontSize: 16 }}>{VARSEL_IKON[v.type]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: FARGER.mork }}>{v.prosjekt_navn}</div>
                    <div>{v.beskrivelse}</div>
                  </div>
                  <span style={{ fontSize: 11, color: FARGER.tekstLys }}>↗</span>
                </button>
              )
            })}
            {data.varsler.length > 8 && (
              <div style={{ fontSize: 11, color: FARGER.tekstLys, textAlign: 'center', padding: 4 }}>
                + {data.varsler.length - 8} flere — åpne prosjekter for å se dem
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {([
          { id: 'alle' as const, lbl: `Alle (${data.prosjekter.length})` },
          { id: 'flipp' as const, lbl: `Flipp (${t.antall_flipp})` },
          { id: 'utleie' as const, lbl: `Utleie (${t.antall_utleie})` },
          { id: 'norge' as const, lbl: `Norge (${t.antall_norske})` },
        ]).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{
              padding: '6px 14px', borderRadius: RADIUS.sm, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: filter === f.id ? FARGER.mork : FARGER.flateMid,
              color: filter === f.id ? '#fff' : FARGER.tekstMid,
            }}>
            {f.lbl}
          </button>
        ))}
      </div>

      {/* Prosjekt-kort */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
        {filtrerte.map(p => <ProsjektKort key={p.id} p={p} onApne={() => onApneProsjekt(p.id)} />)}
      </div>
      {filtrerte.length === 0 && (
        <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
          Ingen prosjekter i dette filteret.
        </div>
      )}
    </div>
  )
}

function KpiKort({ lbl, stor, liten }: { lbl: string; stor: string; liten?: string }) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.05em' }}>{lbl}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: FARGER.mork }}>{stor}</div>
      {liten && <div style={{ fontSize: 11, color: FARGER.tekstMid, marginTop: 4 }}>{liten}</div>}
    </div>
  )
}

function ProsjektKort({ p, onApne }: { p: DashboardProsjekt; onApne: () => void }) {
  const anb = ANBEFALING_FARGE[p.anbefaling.type]
  const sjekkPst = p.sjekkliste.totalt > 0 ? (p.sjekkliste.ok / p.sjekkliste.totalt) * 100 : 0
  const oppPst = p.oppussing.totalt > 0 ? (p.oppussing.ferdig / p.oppussing.totalt) * 100 : 0

  return (
    <button onClick={onApne}
      style={{
        textAlign: 'left', cursor: 'pointer',
        background: '#fff', border: `1.5px solid ${FARGER.kantLys}`,
        borderRadius: RADIUS.md, padding: 16, fontFamily: 'inherit',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = FARGER.gull }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = FARGER.kantLys }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.navn}</div>
          <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2 }}>
            {p.marked === 'norge' ? '🇳🇴 Norge' : '🇪🇸 Spania'} · {p.kategori === 'flipp' ? 'Flipp' : 'Utleie'} · {p.status}
          </div>
        </div>
        <span style={{ background: anb.bg, color: anb.tekst, padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {anb.emoji} {p.anbefaling.type === 'utlei_deretter_salg' ? 'Hybrid' : p.anbefaling.type === 'leie' ? 'Behold' : p.anbefaling.type === 'salg' ? 'Selg' : 'Avvent'}
        </span>
      </div>

      {/* Anbefalings-tekst */}
      <div style={{ fontSize: 12, color: anb.tekst, fontStyle: 'italic', marginBottom: 10 }}>
        {p.anbefaling.tekst}
      </div>

      {/* KPI-grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 }}>
        <KpiMini lbl="Investert" val={fmtBelop(p.total_invest, p.valuta)} />
        <KpiMini lbl="ROI" val={p.roi_pct !== null ? p.roi_pct.toFixed(1) + '%' : '–'} farge={p.roi_pct !== null ? (p.roi_pct >= 15 ? '#1a4d2b' : p.roi_pct >= 0 ? '#0e1726' : '#7a0c1e') : undefined} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {p.oppussing.totalt > 0 && (
            <div>
              <div style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                <span>Oppussing</span>
                <span>{p.oppussing.ferdig}/{p.oppussing.totalt}{p.oppussing.overskridelser > 0 && ` · ⚠️ ${p.oppussing.overskridelser} over budsjett`}</span>
              </div>
              <ProgressBar pct={oppPst} farge={p.oppussing.overskridelser > 0 ? '#C8102E' : '#2D7D46'} />
            </div>
          )}
          {p.sjekkliste.totalt > 0 && (
            <div>
              <div style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
                <span>Dokumenter</span>
                <span>{p.sjekkliste.ok}/{p.sjekkliste.totalt} på plass</span>
              </div>
              <ProgressBar pct={sjekkPst} farge="#b89a6f" />
            </div>
          )}
        </div>
      )}
    </button>
  )
}

function KpiMini({ lbl, val, farge }: { lbl: string; val: string; farge?: string }) {
  return (
    <div style={{ background: FARGER.creamLys, padding: 8, borderRadius: RADIUS.sm }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 2 }}>{lbl}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: farge || FARGER.mork }}>{val}</div>
    </div>
  )
}

function ProgressBar({ pct, farge }: { pct: number; farge: string }) {
  return (
    <div style={{ height: 6, background: FARGER.flateMid, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: farge, transition: 'width 0.3s' }} />
    </div>
  )
}
