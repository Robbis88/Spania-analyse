'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS } from '../../lib/styles'
import { belaningsgrad } from '../../lib/portefolje'
import { fmtNok } from '../../lib/format'
import type { EiendomKortData } from './EiendomKort'

const fmtPct = (n: number | null) => n === null || !Number.isFinite(n) ? '–' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
const fmtVal = (n: number, valuta: string) => (valuta === 'EUR' ? '€' : '') + Math.round(n || 0).toLocaleString('nb-NO') + (valuta === 'EUR' ? '' : ' kr')

type RangRad = {
  id: string; navn: string; marked: string; valuta: string
  bundet_ek: number; langtid_yield_pst: number | null; cashflow_mnd: number | null
  stress_cashflow_mnd: number | null; markedsleie_mnd: number | null
  flagg: Array<{ farge: 'rod' | 'gul'; tekst: string }>
}
type KjopekraftRad = { valuta: string; kjopekraft: number; bundet_ek: number }

type Props = {
  eiendommer: EiendomKortData[]
  onApne: (id: string) => void
}

export function PortefoljeDashboard({ eiendommer, onApne }: Props) {
  const stats = useMemo(() => {
    const totalVerdi = eiendommer.reduce((s, e) => s + e.total_verdi, 0)
    const totalGjeld = eiendommer.reduce((s, e) => s + e.total_restgjeld, 0)
    const totalEK = totalVerdi - totalGjeld
    const totalLeie = eiendommer.reduce((s, e) => s + e.leie_mnd, 0)
    const totalDrift = eiendommer.reduce((s, e) => s + e.kostnader_mnd, 0)
    const totalLaan = eiendommer.reduce((s, e) => s + e.laan_mnd, 0)
    const totalCf = totalLeie - totalDrift - totalLaan
    const ltv = belaningsgrad(totalGjeld, totalVerdi)

    // Beste/verste cashflow
    const sortertCf = [...eiendommer].sort((a, b) => b.cashflow_mnd - a.cashflow_mnd)
    const besteCf = sortertCf[0] || null
    const versteCf = sortertCf.length > 1 ? sortertCf[sortertCf.length - 1] : null

    // Beste/verste verdiutvikling — kun for eiendommer med ≥ 2 vurderinger
    const medVurdering = eiendommer.filter(e => e.verdiokning_pct !== null) as Array<EiendomKortData & { verdiokning_pct: number }>
    const sortertVerdi = [...medVurdering].sort((a, b) => b.verdiokning_pct - a.verdiokning_pct)
    const besteVerdi = sortertVerdi[0] || null
    const versteVerdi = sortertVerdi.length > 1 ? sortertVerdi[sortertVerdi.length - 1] : null

    return { totalVerdi, totalGjeld, totalEK, totalLeie, totalDrift, totalLaan, totalCf, ltv, besteCf, versteCf, besteVerdi, versteVerdi }
  }, [eiendommer])

  const [rang, setRang] = useState<RangRad[]>([])
  const [kjopekraft, setKjopekraft] = useState<KjopekraftRad[]>([])
  useEffect(() => {
    fetch('/api/portefolje-rangering').then(r => r.json()).then(d => setRang(d.rader || [])).catch(() => {})
    fetch('/api/kapital').then(r => r.json()).then(d => setKjopekraft(d.konsolidert || [])).catch(() => {})
  }, [])

  if (eiendommer.length === 0) return null

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 12 }}>
        OVERSIKT
      </div>

      {/* Kjøpekraft (B3) */}
      {kjopekraft.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
          {kjopekraft.map(k => (
            <div key={k.valuta} style={{ background: FARGER.mork, color: FARGER.creamLys, borderRadius: RADIUS.md, padding: 14 }}>
              <div style={{ fontSize: 10, color: FARGER.gull, letterSpacing: '0.16em', fontWeight: 700, marginBottom: 4 }}>KJØPEKRAFT · {k.valuta}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtVal(k.kjopekraft, k.valuta)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Topplinje */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
        <Kpi lbl="Total verdi" stor={fmtNok(stats.totalVerdi)} />
        <Kpi lbl="Total restgjeld" stor={fmtNok(stats.totalGjeld)} />
        <Kpi lbl="Total egenkapital" stor={fmtNok(stats.totalEK)} farge={stats.totalEK >= 0 ? FARGER.suksess : FARGER.feil} />
        <Kpi lbl="Belåningsgrad" stor={stats.ltv ? stats.ltv.toFixed(0) + '%' : '–'} farge={stats.ltv > 85 ? FARGER.feil : stats.ltv > 75 ? FARGER.advarsel : FARGER.suksess} />
        <Kpi lbl="Eiendommer" stor={String(eiendommer.length)} />
      </div>

      {/* Andre rad — månedlig */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Kpi lbl="Leie / mnd" stor={fmtNok(stats.totalLeie)} farge={FARGER.suksess} />
        <Kpi lbl="Drift / mnd" stor={fmtNok(stats.totalDrift)} farge={FARGER.feil} />
        <Kpi lbl="Lån / mnd" stor={fmtNok(stats.totalLaan)} farge={FARGER.feil} />
        <Kpi lbl="Cashflow / mnd" stor={fmtNok(stats.totalCf)} farge={stats.totalCf >= 0 ? FARGER.suksess : FARGER.feil} />
        <Kpi lbl="Cashflow / år" stor={fmtNok(stats.totalCf * 12)} farge={stats.totalCf >= 0 ? FARGER.suksess : FARGER.feil} />
      </div>

      {/* Beste / verste-rader */}
      {(stats.besteCf || stats.besteVerdi) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {stats.besteCf && stats.versteCf && (
            <BestVerstKort
              tittel="Cashflow"
              beste={{ navn: stats.besteCf.navn, verdi: fmtNok(stats.besteCf.cashflow_mnd) + ' / mnd', id: stats.besteCf.id }}
              verste={{ navn: stats.versteCf.navn, verdi: fmtNok(stats.versteCf.cashflow_mnd) + ' / mnd', id: stats.versteCf.id }}
              onApne={onApne}
            />
          )}
          {stats.besteVerdi && stats.versteVerdi && (
            <BestVerstKort
              tittel="Verdiutvikling"
              beste={{ navn: stats.besteVerdi.navn, verdi: fmtPct(stats.besteVerdi.verdiokning_pct), id: stats.besteVerdi.id }}
              verste={{ navn: stats.versteVerdi.navn, verdi: fmtPct(stats.versteVerdi.verdiokning_pct), id: stats.versteVerdi.id }}
              onApne={onApne}
            />
          )}
        </div>
      )}

      {/* Rangering (B6) */}
      {rang.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>
            Rangering — avkastning på bundet EK
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {rang.map(r => (
              <button key={r.id} onClick={() => onApne(r.id)}
                style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: r.langtid_yield_pst === null ? FARGER.tekstLys : r.langtid_yield_pst < 6 ? FARGER.feil : FARGER.suksess, minWidth: 62 }}>
                  {r.langtid_yield_pst === null ? '–' : r.langtid_yield_pst.toFixed(1) + '%'}
                </span>
                <span style={{ flex: 1, minWidth: 140 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork }}>{r.navn}</span>
                  <span style={{ fontSize: 11, color: FARGER.tekstLys, display: 'block' }}>
                    Bundet EK {fmtVal(r.bundet_ek, r.valuta)}{r.cashflow_mnd !== null ? ` · cashflow ${fmtVal(r.cashflow_mnd, r.valuta)}/mnd` : ''}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.flagg.map((f, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: RADIUS.pill,
                      background: f.farge === 'rod' ? FARGER.feilBg : FARGER.advarselBg,
                      color: f.farge === 'rod' ? FARGER.feil : FARGER.advarsel,
                    }}>{f.tekst}</span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ lbl, stor, farge }: { lbl: string; stor: string; farge?: string }) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 12 }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.05em' }}>{lbl}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: farge || FARGER.mork }}>{stor}</div>
    </div>
  )
}

function BestVerstKort({ tittel, beste, verste, onApne }: {
  tittel: string
  beste: { navn: string; verdi: string; id: string }
  verste: { navn: string; verdi: string; id: string }
  onApne: (id: string) => void
}) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
        {tittel}
      </div>
      <BestVerstRad emoji="🏆" lbl="Best" navn={beste.navn} verdi={beste.verdi} farge={FARGER.suksess} onApne={() => onApne(beste.id)} />
      <BestVerstRad emoji="⚠️" lbl="Verst" navn={verste.navn} verdi={verste.verdi} farge={FARGER.feil} onApne={() => onApne(verste.id)} />
    </div>
  )
}

function BestVerstRad({ emoji, lbl, navn, verdi, farge, onApne }: {
  emoji: string; lbl: string; navn: string; verdi: string; farge: string; onApne: () => void
}) {
  return (
    <button onClick={onApne}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '6px 0', textAlign: 'left', fontFamily: 'inherit',
        borderTop: `1px solid ${FARGER.flateLys}`,
      }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: FARGER.tekstLys, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{lbl}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{navn}</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: farge, whiteSpace: 'nowrap' }}>{verdi}</span>
      <span style={{ fontSize: 11, color: FARGER.tekstLys }}>↗</span>
    </button>
  )
}
