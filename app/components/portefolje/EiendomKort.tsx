'use client'
import { FARGER, RADIUS } from '../../lib/styles'
import { EIERETAPPE_ETIKETT, cashflowFarge } from '../../lib/portefolje'
import type { Prosjekt } from '../../types'

export type EiendomKortData = Prosjekt & {
  // Pre-aggregerte tall (fra Portefolje.tsx eller dashboard)
  total_verdi: number
  total_restgjeld: number
  leie_mnd: number
  kostnader_mnd: number
  laan_mnd: number
  cashflow_mnd: number
  verdiokning_kr: number | null    // siste verdi - eldste verdi (null hvis < 2 vurderinger)
  verdiokning_pct: number | null   // prosent
  yield_pct: number                 // brutto yield (årlig leie / verdi)
}

const fmtNok = (n: number) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'

const FARGE_FOR_CF: Record<'gronn' | 'gul' | 'rod', { bg: string; tekst: string; ramme: string }> = {
  gronn: { bg: '#e8f5ed', tekst: '#1a4d2b', ramme: '#2D7D4644' },
  gul:   { bg: '#fff8e1', tekst: '#7a4a08', ramme: '#B05E0A66' },
  rod:   { bg: '#fde8ec', tekst: '#7a0c1e', ramme: '#C8102E66' },
}

export function EiendomKort({ e, onApne }: { e: EiendomKortData; onApne: () => void }) {
  const cf = e.cashflow_mnd
  const farge = FARGE_FOR_CF[cashflowFarge(cf)]
  const adresse = (e.bolig_data && typeof e.bolig_data === 'object' && 'beliggenhet' in e.bolig_data)
    ? String((e.bolig_data as { beliggenhet?: string }).beliggenhet || '')
    : ''

  const ek = e.total_verdi - e.total_restgjeld

  return (
    <button onClick={onApne}
      style={{
        textAlign: 'left', cursor: 'pointer',
        background: '#fff', border: `1.5px solid ${farge.ramme}`,
        borderRadius: RADIUS.md, padding: 16, fontFamily: 'inherit',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.borderColor = FARGER.gull }}
      onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.borderColor = farge.ramme }}>
      {/* Tittel + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.navn}
          </div>
          {adresse && (
            <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2 }}>{adresse}</div>
          )}
        </div>
        <span style={{ background: farge.bg, color: farge.tekst, padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {EIERETAPPE_ETIKETT[e.eieretappe || 'eid']}
        </span>
      </div>

      {/* KPI-grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <KpiMini lbl="Estimert verdi" val={fmtNok(e.total_verdi)} />
        <KpiMini lbl="Restgjeld" val={fmtNok(e.total_restgjeld)} />
        <KpiMini lbl="Egenkapital" val={fmtNok(ek)} farge={ek >= 0 ? '#1a4d2b' : '#7a0c1e'} />
        <KpiMini lbl="Cashflow/mnd" val={fmtNok(cf)} farge={farge.tekst} />
      </div>

      {/* Detaljlinje */}
      {(e.leie_mnd > 0 || e.laan_mnd > 0) && (
        <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 10, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <span>Leie: <strong>{fmtNok(e.leie_mnd)}</strong></span>
          <span>Lån/mnd: <strong>{fmtNok(e.laan_mnd)}</strong></span>
          <span>Drift/mnd: <strong>{fmtNok(e.kostnader_mnd)}</strong></span>
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
