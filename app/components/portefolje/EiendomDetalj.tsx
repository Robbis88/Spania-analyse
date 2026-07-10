'use client'
import { useState } from 'react'
import { FARGER, RADIUS } from '../../lib/styles'
import { EIERETAPPE_ETIKETT } from '../../lib/portefolje'
import { supabase } from '../../lib/supabase'
import { loggAktivitet } from '../../lib/logg'
import { visToast } from '../../lib/toast'
import { useEiendomData } from './useEiendomData'
import { EiendomOversikt } from './faner/EiendomOversikt'
import { EiendomBeslutning } from './faner/EiendomBeslutning'
import { EiendomLaan } from './faner/EiendomLaan'
import { EiendomInntekter } from './faner/EiendomInntekter'
import { EiendomLeietakere } from './faner/EiendomLeietakere'
import { EiendomKostnader } from './faner/EiendomKostnader'
import { EiendomVerdi } from './faner/EiendomVerdi'
import { EiendomCashflow } from './faner/EiendomCashflow'
import { EiendomDokumenter } from './faner/EiendomDokumenter'
import { EiendomBilder } from './faner/EiendomBilder'
import { EiendomKvitteringer } from './faner/EiendomKvitteringer'
import { EiendomOppussing } from './faner/EiendomOppussing'
import { EiendomTilbud } from './faner/EiendomTilbud'
import { EiendomTidslinje } from './faner/EiendomTidslinje'
import { EiendomAi } from './faner/EiendomAi'
import { EiendomRegnskap } from './faner/EiendomRegnskap'
import { TilbudHistorikk } from '../TilbudHistorikk'

type Fane = 'oversikt' | 'regnskap' | 'beslutning' | 'laan' | 'inntekter' | 'leietakere' | 'kostnader' | 'verdi' | 'cashflow' | 'dokumenter' | 'bilder' | 'kvitteringer' | 'oppussing' | 'tilbud' | 'forespørsler' | 'tidslinje' | 'ai'

const FANER: Array<{ id: Fane; lbl: string; ikon: string }> = [
  { id: 'oversikt',     lbl: 'Oversikt',     ikon: '📊' },
  { id: 'regnskap',     lbl: 'Regnskap',     ikon: '💼' },
  { id: 'beslutning',   lbl: 'Beslutning',   ikon: '💡' },
  { id: 'laan',         lbl: 'Lån',          ikon: '🏦' },
  { id: 'inntekter',    lbl: 'Inntekter',    ikon: '💰' },
  { id: 'leietakere',   lbl: 'Leietakere',   ikon: '👥' },
  { id: 'kostnader',    lbl: 'Kostnader',    ikon: '💸' },
  { id: 'verdi',        lbl: 'Verdi',        ikon: '📈' },
  { id: 'cashflow',     lbl: 'Cashflow',     ikon: '💼' },
  { id: 'dokumenter',   lbl: 'Dokumenter',   ikon: '📁' },
  { id: 'bilder',       lbl: 'Bilder',       ikon: '📸' },
  { id: 'kvitteringer', lbl: 'Kvitteringer', ikon: '💳' },
  { id: 'oppussing',    lbl: 'Oppussing',    ikon: '🔨' },
  { id: 'tilbud',       lbl: 'Tilbud',       ikon: '📝' },
  { id: 'forespørsler', lbl: 'Forespørsler', ikon: '📤' },
  { id: 'tidslinje',    lbl: 'Tidslinje',    ikon: '🕓' },
  { id: 'ai',           lbl: 'AI-forslag',   ikon: '✨' },
]

type Props = { prosjektId: string; onTilbake: () => void; onSeOffmarket?: () => void }

export function EiendomDetalj({ prosjektId, onTilbake, onSeOffmarket }: Props) {
  const { data, laster, feil, refresh } = useEiendomData(prosjektId)
  const [aktivFane, setAktivFane] = useState<Fane>('oversikt')
  const [sletter, setSletter] = useState(false)

  async function slettEiendom() {
    if (!data.prosjekt) return
    const navn = data.prosjekt.navn
    if (!confirm(`Slett «${navn}» fra porteføljen?\n\nDette sletter også alle tilhørende lån, leietakere, inntekter, kostnader, verdivurderinger og cashflow-rader. Kan ikke angres.`)) return
    setSletter(true)
    const { error } = await supabase.from('prosjekter').delete().eq('id', prosjektId)
    if (error) {
      visToast('Sletting feilet: ' + error.message, 'feil', 5000)
      setSletter(false)
      return
    }
    await loggAktivitet({ handling: 'slettet eiendom fra portefølje', tabell: 'prosjekter', rad_id: prosjektId, detaljer: { navn } })
    visToast('Eiendom slettet', 'suksess', 2500)
    onTilbake()
  }

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {p.off_market && onSeOffmarket && (
            <button onClick={onSeOffmarket}
              title="Åpne off-market-vurderingen med budkalkyle, sammenlignbare salg og bank-PDF"
              style={{
                background: FARGER.creamLys, border: `1px solid ${FARGER.gull}`,
                color: FARGER.mork, borderRadius: RADIUS.sm,
                padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
              🔍 Se off-market-vurdering
            </button>
          )}
          <button onClick={slettEiendom} disabled={sletter}
            title="Slett eiendom fra portefølje"
            style={{
              background: 'transparent', border: `1px solid ${FARGER.feil}55`,
              color: FARGER.feil, borderRadius: RADIUS.sm,
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              cursor: sletter ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              opacity: sletter ? 0.6 : 1,
            }}>
            {sletter ? '⏳ Sletter…' : '🗑 Slett eiendom'}
          </button>
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
      {aktivFane === 'oversikt'   && <EiendomOversikt data={data} />}
      {aktivFane === 'regnskap'   && <EiendomRegnskap data={data} onEndret={refresh} />}
      {aktivFane === 'beslutning' && <EiendomBeslutning data={data} />}
      {aktivFane === 'laan'       && <EiendomLaan data={data} onEndret={refresh} />}
      {aktivFane === 'inntekter'  && <EiendomInntekter data={data} onEndret={refresh} />}
      {aktivFane === 'leietakere' && <EiendomLeietakere data={data} onEndret={refresh} />}
      {aktivFane === 'kostnader'  && <EiendomKostnader data={data} onEndret={refresh} />}
      {aktivFane === 'verdi'      && <EiendomVerdi data={data} onEndret={refresh} />}
      {aktivFane === 'cashflow'   && <EiendomCashflow data={data} onEndret={refresh} />}
      {aktivFane === 'dokumenter'   && <EiendomDokumenter data={data} />}
      {aktivFane === 'bilder'       && <EiendomBilder data={data} />}
      {aktivFane === 'kvitteringer' && <EiendomKvitteringer data={data} />}
      {aktivFane === 'oppussing'    && <EiendomOppussing data={data} onEndret={refresh} />}
      {aktivFane === 'tilbud'       && <EiendomTilbud data={data} />}
      {aktivFane === 'forespørsler' && <TilbudHistorikk prosjektId={prosjektId} />}
      {aktivFane === 'tidslinje'    && <EiendomTidslinje data={data} />}
      {aktivFane === 'ai'           && <EiendomAi data={data} onEndret={refresh} />}
    </div>
  )
}

const tilbakeKnappStil: React.CSSProperties = {
  background: FARGER.flateLys, border: 'none', borderRadius: RADIUS.sm,
  padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginBottom: 20,
  color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
}
