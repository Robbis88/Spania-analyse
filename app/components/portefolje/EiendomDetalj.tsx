'use client'
import { useState } from 'react'
import { FARGER, RADIUS } from '../../lib/styles'
import { EIERETAPPE_ETIKETT } from '../../lib/portefolje'
import { useEiendomData } from './useEiendomData'
import { EiendomOversikt } from './faner/EiendomOversikt'
import { EiendomLaan } from './faner/EiendomLaan'

type Fane = 'oversikt' | 'laan' | 'inntekter' | 'kostnader' | 'verdi' | 'cashflow' | 'dokumenter' | 'bilder' | 'kvitteringer' | 'oppussing' | 'ai'

const FANER: Array<{ id: Fane; lbl: string; ikon: string }> = [
  { id: 'oversikt',     lbl: 'Oversikt',     ikon: '📊' },
  { id: 'laan',         lbl: 'Lån',          ikon: '🏦' },
  { id: 'inntekter',    lbl: 'Inntekter',    ikon: '💰' },
  { id: 'kostnader',    lbl: 'Kostnader',    ikon: '💸' },
  { id: 'verdi',        lbl: 'Verdi',        ikon: '📈' },
  { id: 'cashflow',     lbl: 'Cashflow',     ikon: '💼' },
  { id: 'dokumenter',   lbl: 'Dokumenter',   ikon: '📁' },
  { id: 'bilder',       lbl: 'Bilder',       ikon: '📸' },
  { id: 'kvitteringer', lbl: 'Kvitteringer', ikon: '💳' },
  { id: 'oppussing',    lbl: 'Oppussing',    ikon: '🔨' },
  { id: 'ai',           lbl: 'AI-forslag',   ikon: '✨' },
]

type Props = { prosjektId: string; onTilbake: () => void }

export function EiendomDetalj({ prosjektId, onTilbake }: Props) {
  const { data, laster, feil, refresh } = useEiendomData(prosjektId)
  const [aktivFane, setAktivFane] = useState<Fane>('oversikt')

  if (laster) return <div style={{ textAlign: 'center', padding: 60, color: FARGER.tekstLys }}>⏳ Laster eiendom…</div>
  if (feil || !data.prosjekt) {
    return (
      <div>
        <button onClick={onTilbake}
          style={tilbakeKnappStil}>← Tilbake</button>
        <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}`, padding: 14, borderRadius: RADIUS.md, color: '#7a0c1e', fontSize: 13 }}>
          {feil || 'Eiendom ikke funnet'}
        </div>
      </div>
    )
  }

  const p = data.prosjekt
  const adresse = (p.bolig_data && typeof p.bolig_data === 'object' && 'beliggenhet' in p.bolig_data)
    ? String((p.bolig_data as { beliggenhet?: string }).beliggenhet || '')
    : ''

  return (
    <div>
      <button onClick={onTilbake} style={tilbakeKnappStil}>← Tilbake til portefølje</button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 8 }}>
            {p.marked === 'norge' ? 'NORGE' : 'SPANIA'} · {EIERETAPPE_ETIKETT[p.eieretappe || 'eid'].toUpperCase()}
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.01em' }}>{p.navn}</h2>
          {adresse && <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14, fontWeight: 300 }}>{adresse}</p>}
        </div>
      </div>

      {/* Fane-bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap', borderBottom: `1px solid ${FARGER.kantLys}`, paddingBottom: 0 }}>
        {FANER.map(f => {
          const aktiv = aktivFane === f.id
          return (
            <button key={f.id} onClick={() => setAktivFane(f.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 14px', fontSize: 12, fontWeight: 600,
                color: aktiv ? FARGER.mork : FARGER.tekstMid,
                borderBottom: aktiv ? `2px solid ${FARGER.gull}` : '2px solid transparent',
                marginBottom: -1, letterSpacing: '0.04em',
              }}>
              {f.ikon} {f.lbl}
            </button>
          )
        })}
      </div>

      {/* Fane-innhold */}
      {aktivFane === 'oversikt'  && <EiendomOversikt data={data} />}
      {aktivFane === 'laan'      && <EiendomLaan data={data} onEndret={refresh} />}
      {aktivFane === 'inntekter' && <FanePlaceholder navn="Inntekter" steg={4} />}
      {aktivFane === 'kostnader' && <FanePlaceholder navn="Kostnader" steg={4} />}
      {aktivFane === 'verdi'     && <FanePlaceholder navn="Verdivurderinger" steg={5} />}
      {aktivFane === 'cashflow'  && <FanePlaceholder navn="Cashflow" steg={5} />}
      {aktivFane === 'dokumenter'   && <FanePlaceholder navn="Dokumenter" steg={6} />}
      {aktivFane === 'bilder'       && <FanePlaceholder navn="Bilder" steg={6} />}
      {aktivFane === 'kvitteringer' && <FanePlaceholder navn="Kvitteringer" steg={6} />}
      {aktivFane === 'oppussing'    && <FanePlaceholder navn="Oppussing" steg={6} />}
      {aktivFane === 'ai'           && <FanePlaceholder navn="AI-forslag" steg={8} />}
    </div>
  )
}

function FanePlaceholder({ navn, steg }: { navn: string; steg: number }) {
  return (
    <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys }}>
      <div style={{ fontSize: 32, marginBottom: 6 }}>🚧</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork }}>{navn}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Bygges i steg {steg}</div>
    </div>
  )
}

const tilbakeKnappStil: React.CSSProperties = {
  background: FARGER.flateLys, border: 'none', borderRadius: RADIUS.sm,
  padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginBottom: 20,
  color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
}
