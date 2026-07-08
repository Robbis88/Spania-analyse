'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW } from '../../../lib/styles'
import { fmtNok, SumKort } from './faneUi'
import { beregnBeslutning, type ScenarioResultat } from '../../../lib/beslutning'
import { defaultSkatteprofil, medDefaults } from '../../../lib/skatteprofil'
import type { AirbnbData, Selskap, Skatteprofil } from '../../../types'
import type { EiendomData } from '../useEiendomData'

const pst = (n: number | undefined) => (n === undefined || !Number.isFinite(n)) ? '–' : n.toFixed(1) + ' %'

export function EiendomBeslutning({ data }: { data: EiendomData }) {
  const p = data.prosjekt!
  const [skatteprofil, setSkatteprofil] = useState<Skatteprofil>(defaultSkatteprofil(p.marked === 'norge' ? 'norge' : 'spania'))
  const [anbefaling, setAnbefaling] = useState<string | null>(null)
  const [ber, setBer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  // Hent selskapets skatteprofil (faller tilbake til default for markedet)
  useEffect(() => {
    fetch('/api/selskaper')
      .then(r => r.json())
      .then((d: { selskaper?: Selskap[] }) => {
        const s = (d.selskaper || []).find(x => x.id === p.selskap_id)
        if (s) setSkatteprofil(medDefaults(s.land, s.skatteprofil))
      })
      .catch(() => { /* beholder default */ })
  }, [p.selskap_id])

  const beslutning = useMemo(() => beregnBeslutning({
    prosjekt: p,
    laan: data.laan,
    inntekter: data.inntekter,
    kostnader: data.kostnader,
    verdivurderinger: data.verdivurderinger,
    skatteprofil,
    airbnbData: (p.airbnb_data as AirbnbData | null) || null,
  }), [p, data.laan, data.inntekter, data.kostnader, data.verdivurderinger, skatteprofil])

  async function beOmAnbefaling() {
    setBer(true); setFeil(null)
    try {
      const r = await fetch('/api/beslutning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beslutning, prosjektNavn: p.navn, marked: p.marked || 'spania' }),
      })
      const d = await r.json()
      if (!r.ok || d.feil) { setFeil(d.feil || 'Kunne ikke hente anbefaling'); return }
      setAnbefaling(d.anbefaling || '')
    } catch {
      setFeil('Kunne ikke hente anbefaling')
    } finally {
      setBer(false)
    }
  }

  return (
    <div>
      {/* Kapitalgrunnlag */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <SumKort lbl="Markedsverdi" verdi={fmtNok(beslutning.verdi)} />
        <SumKort lbl="Restgjeld" verdi={fmtNok(beslutning.restgjeld)} />
        <SumKort lbl="Bundet egenkapital" verdi={fmtNok(beslutning.bundet_ek)} farge={FARGER.gull} />
      </div>

      {/* AI-anbefaling */}
      <div style={{ background: FARGER.mork, borderRadius: RADIUS.lg, padding: 22, marginBottom: 22, color: FARGER.creamLys, boxShadow: SHADOW.md }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>💡 Anbefaling</div>
          <button onClick={beOmAnbefaling} disabled={ber}
            style={{
              background: FARGER.gull, color: FARGER.mork, border: 'none',
              padding: '9px 18px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              borderRadius: RADIUS.pill, cursor: ber ? 'default' : 'pointer', opacity: ber ? 0.6 : 1,
            }}>
            {ber ? 'Vurderer…' : (anbefaling ? 'Vurder på nytt' : 'Be om anbefaling')}
          </button>
        </div>
        {feil && <div style={{ marginTop: 12, fontSize: 13, color: '#ffb4b4' }}>{feil}</div>}
        {anbefaling && (
          <p style={{ marginTop: 14, marginBottom: 0, fontSize: 14, lineHeight: 1.65, color: 'rgba(253,252,247,0.92)', whiteSpace: 'pre-wrap' }}>{anbefaling}</p>
        )}
        {!anbefaling && !feil && (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(253,252,247,0.6)' }}>
            Tallene under er beregnet. Trykk «Be om anbefaling» for en vurdering i klartekst med begrunnelse — regnestykket står alltid under.
          </p>
        )}
      </div>

      {/* Fire scenarier */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {beslutning.scenarier.map(s => (
          <ScenarioKort key={s.type} s={s} erBeste={beslutning.beste === s.type} terskel={beslutning.terskel_yield_pst} />
        ))}
      </div>

      <p style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 18, lineHeight: 1.6 }}>
        Yield regnes på bundet egenkapital (verdi − gjeld − salgskostnad − gevinstskatt). Forutsetninger:
        salgskostnad {beslutning.salgskostnad > 0 ? '2 %' : '2 %'}, refinansiering opp til 75 % LTV. Terskel for svak leie: {beslutning.terskel_yield_pst} %.
        Skattesatser hentes fra selskapets skatteprofil.
      </p>
    </div>
  )
}

function ScenarioKort({ s, erBeste, terskel }: { s: ScenarioResultat; erBeste: boolean; terskel: number }) {
  const svakLeie = typeof s.yield_bundet_ek_pst === 'number' && s.yield_bundet_ek_pst < terskel
  return (
    <div style={{
      background: FARGER.hvit, borderRadius: RADIUS.lg, padding: 18,
      border: erBeste ? `2px solid ${FARGER.gull}` : `1px solid ${FARGER.kantUltralys}`,
      boxShadow: SHADOW.sm, opacity: s.tilgjengelig ? 1 : 0.6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.01em' }}>{s.tittel}</div>
        {erBeste && <span style={{ fontSize: 10, fontWeight: 700, color: FARGER.gull, letterSpacing: '0.1em' }}>BESTE YIELD</span>}
      </div>

      {!s.tilgjengelig ? (
        <div style={{ fontSize: 12, color: FARGER.tekstLys, fontStyle: 'italic' }}>{s.utilgjengeligGrunn}</div>
      ) : (
        <>
          {typeof s.yield_bundet_ek_pst === 'number' && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: svakLeie ? FARGER.feil : FARGER.suksess }}>{pst(s.yield_bundet_ek_pst)}</span>
              <span style={{ fontSize: 11, color: FARGER.tekstLys, marginLeft: 6 }}>yield på bundet EK</span>
              {svakLeie && <div style={{ fontSize: 11, color: FARGER.feil, marginTop: 2 }}>⚠️ under terskel ({terskel} %)</div>}
            </div>
          )}
          <div>
            {s.detaljer.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', fontSize: 12.5 }}>
                <span style={{ color: FARGER.tekstMid }}>{d.lbl}</span>
                <span style={{ fontWeight: 600, color: d.verdi < 0 ? FARGER.feil : FARGER.mork }}>
                  {d.pst ? pst(d.verdi) : fmtNok(d.verdi)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
