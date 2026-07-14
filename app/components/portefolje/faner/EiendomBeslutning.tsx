'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle } from '../../../lib/styles'
import { fmtNok, SumKort } from './faneUi'
import { beregnBeslutning, type ScenarioResultat, type Beslutning } from '../../../lib/beslutning'
import { defaultSkatteprofil, medDefaults } from '../../../lib/skatteprofil'
import { supabase } from '../../../lib/supabase'
import { VFT_STATUS, VFT_ETIKETT, type VftStatus } from '../../../lib/strategi'
import type { AirbnbData, Enhet, Selskap, Skatteprofil, Tilbud } from '../../../types'
import type { EiendomData } from '../useEiendomData'

const pst = (n: number | undefined) => (n === undefined || !Number.isFinite(n)) ? '–' : n.toFixed(1) + ' %'

export function EiendomBeslutning({ data }: { data: EiendomData }) {
  const p = data.prosjekt!
  const [skatteprofil, setSkatteprofil] = useState<Skatteprofil>(defaultSkatteprofil(p.marked === 'norge' ? 'norge' : 'spania'))
  const [anbefaling, setAnbefaling] = useState<string | null>(null)
  const [ber, setBer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [akseptertTilbud, setAkseptertTilbud] = useState<number | null>(null)
  const [minReno, setMinReno] = useState<string>('')  // "min vurdering" — vinner hvis satt
  const [vft, setVft] = useState<VftStatus | ''>((p.vft_status as VftStatus) || '')
  // Tidsstyrte planforutsetninger (lagres på prosjektet ved blur)
  const [varighet, setVarighet] = useState<string>(p.oppussing_varighet_mnd != null ? String(p.oppussing_varighet_mnd) : '')
  const [arv, setArv] = useState<string>(p.forventet_salgsverdi ? String(p.forventet_salgsverdi) : '')
  const [forventetLeie, setForventetLeie] = useState<string>(p.forventet_leie_mnd ? String(p.forventet_leie_mnd) : '')
  const [enheter, setEnheter] = useState<Enhet[]>(Array.isArray(p.enheter) ? p.enheter : [])

  async function lagrePlan(felt: 'oppussing_varighet_mnd' | 'forventet_salgsverdi' | 'forventet_leie_mnd', v: string) {
    const tall = v.trim() === '' ? null : Number(v)
    await supabase.from('prosjekter').update({ [felt]: tall }).eq('id', p.id)
  }

  async function lagreEnheter(nye: Enhet[]) {
    setEnheter(nye)
    await supabase.from('prosjekter').update({ enheter: nye }).eq('id', p.id)
  }

  async function settVft(v: VftStatus | '') {
    setVft(v)
    await supabase.from('prosjekter').update({ vft_status: v || null }).eq('id', p.id)
  }

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

  // Akseptert tilbud (B8) → renoveringskost i motoren
  useEffect(() => {
    fetch(`/api/tilbud?prosjekt_id=${encodeURIComponent(p.id)}`)
      .then(r => r.json())
      .then((d: { tilbud?: Tilbud[] }) => {
        const a = (d.tilbud || []).find(t => t.akseptert)
        setAkseptertTilbud(a && typeof a.totalsum === 'number' ? a.totalsum : null)
      })
      .catch(() => { /* ignorer */ })
  }, [p.id])

  // Dine tall vinner: min vurdering > akseptert tilbud > prosjekt.oppussing_faktisk
  const refReno = akseptertTilbud
  const effektivReno = minReno.trim() !== '' ? Number(minReno) : akseptertTilbud

  const beslutning = useMemo(() => beregnBeslutning({
    prosjekt: p,
    laan: data.laan,
    inntekter: data.inntekter,
    kostnader: data.kostnader,
    verdivurderinger: data.verdivurderinger,
    skatteprofil,
    airbnbData: (p.airbnb_data as AirbnbData | null) || null,
    renoveringskost: effektivReno,
    oppussingVarighetMnd: varighet.trim() !== '' ? Number(varighet) : null,
    forventetSalgssum: arv.trim() !== '' ? Number(arv) : null,
    forventetLeieMnd: forventetLeie.trim() !== '' ? Number(forventetLeie) : null,
    enheter: enheter.length > 0 ? enheter : null,
  }), [p, data.laan, data.inntekter, data.kostnader, data.verdivurderinger, skatteprofil, effektivReno, varighet, arv, forventetLeie, enheter])

  async function lagreMinReno() {
    if (minReno.trim() === '') return
    await fetch('/api/estimat-justering', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prosjekt_id: p.id, felt: 'renoveringskost',
        ai_verdi: refReno, min_verdi: Number(minReno),
        kontekst: { marked: p.marked || 'spania' },
      }),
    }).catch(() => { /* logging skal ikke blokkere */ })
  }

  async function beOmAnbefaling() {
    setBer(true); setFeil(null)
    try {
      const r = await fetch('/api/beslutning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beslutning, prosjektNavn: p.navn, marked: p.marked || 'spania', prosjekt_id: p.id }),
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
      {/* Beslutnings-hero — svaret først (answer-first) */}
      <BeslutningHero beslutning={beslutning} />

      {/* Kapitalgrunnlag */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <SumKort lbl="Markedsverdi" verdi={fmtNok(beslutning.verdi)} />
        <SumKort lbl="Restgjeld" verdi={fmtNok(beslutning.restgjeld)} />
        <SumKort lbl="Bundet egenkapital" verdi={fmtNok(beslutning.bundet_ek)} farge={FARGER.gull} />
      </div>

      {/* Renoveringskost — dine tall vinner (B5) */}
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 22, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4 }}>Renoveringskost — akseptert tilbud</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: FARGER.mork }}>{refReno !== null ? fmtNok(refReno) : '– (ingen akseptert)'}</div>
        </div>
        <div>
          <label style={labelStyle}>Min vurdering (vinner)</label>
          <input type="number" value={minReno} onChange={e => setMinReno(e.target.value)} onBlur={lagreMinReno}
            placeholder={refReno !== null ? String(Math.round(refReno)) : '—'} style={{ ...inputStyle, maxWidth: 170 }} />
        </div>
        {minReno.trim() !== '' && (
          <div style={{ fontSize: 12, color: FARGER.gull }}>
            Dine tall brukes i beregningene{refReno !== null ? ` · avvik ${fmtNok(Number(minReno) - refReno)}` : ''}.
          </div>
        )}
      </div>

      {/* Planforutsetninger — tidsstyrt motor */}
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 22 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: FARGER.mork, marginBottom: 4 }}>⏱ Planforutsetninger</div>
        <div style={{ fontSize: 11.5, color: FARGER.tekstLys, marginBottom: 14, maxWidth: 560, lineHeight: 1.5 }}>
          Motoren tar hensyn til hvor lang tid oppussingen tar: holdekostnad (renter + drift) trekkes fra ved flipp, og leiestart utsettes tilsvarende. Forventet salgssum og leie brukes som plantall til faktiske tall finnes.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle}>Oppussing varighet (mnd)</label>
            <input type="number" value={varighet} onChange={e => setVarighet(e.target.value)} onBlur={() => lagrePlan('oppussing_varighet_mnd', varighet)} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Forventet salgssum (ARV)</label>
            <input type="number" value={arv} onChange={e => setArv(e.target.value)} onBlur={() => lagrePlan('forventet_salgsverdi', arv)} placeholder="etter oppussing" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Forventet leie/mnd</label>
            <input type="number" value={forventetLeie} onChange={e => setForventetLeie(e.target.value)} onBlur={() => lagrePlan('forventet_leie_mnd', forventetLeie)} placeholder="planleie" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* VFT-lisens (C6, kun Spania) */}
      {p.marked === 'spania' && (
        <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 22, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>VFT / turistlisens</span>
          <select value={vft} onChange={e => settVft(e.target.value as VftStatus | '')} style={{ ...inputStyle, maxWidth: 180 }}>
            <option value="">Ikke satt</option>
            {VFT_STATUS.map(s => <option key={s} value={s}>{VFT_ETIKETT[s]}</option>)}
          </select>
          {vft !== 'har' && <span style={{ fontSize: 12, color: FARGER.feil }}>Kreves for lovlig korttidsutleie i Spania.</span>}
        </div>
      )}

      {/* Leiligheter — fler-enhets utvikling (B4b) */}
      <LeilighetEditor enheter={enheter} onLagre={lagreEnheter} />

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

      {/* Scenarier (flipp, langtid, korttid, refinansier + evt. utvikle-og-lei) */}
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

// ─── Beslutnings-hero (answer-first: anbefalt bruk øverst) ───────────────────
function BeslutningHero({ beslutning }: { beslutning: Beslutning }) {
  const tilgj = beslutning.scenarier.filter(s => s.tilgjengelig)
  const beste = tilgj.find(s => s.type === beslutning.beste)
  const flip = tilgj.find(s => s.type === 'flipp')
  const refi = tilgj.find(s => s.type === 'utvikle_refi') || tilgj.find(s => s.type === 'refinansier')
  const hoved = beste || flip

  const chip = (lbl: string, val: string, farge: string) => (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(253,252,247,0.55)' }}>{lbl}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: farge, marginTop: 3 }}>{val}</div>
    </div>
  )

  if (!hoved) {
    return (
      <div style={{ background: FARGER.mork, borderRadius: RADIUS.lg, padding: 22, marginBottom: 22, color: FARGER.creamLys, boxShadow: SHADOW.md }}>
        <div style={{ fontSize: 10.5, color: FARGER.gull, letterSpacing: '0.22em', fontWeight: 700 }}>BESLUTNING</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 10 }}>Fyll inn verdi, lån og plan — så regner motoren beste bruk.</div>
        <div style={{ fontSize: 12.5, color: 'rgba(253,252,247,0.6)', marginTop: 6 }}>Sett forventet salgssum (ARV), oppussingsvarighet og evt. leiligheter under, så vises anbefalingen her.</div>
      </div>
    )
  }

  const yieldTxt = typeof hoved.yield_bundet_ek_pst === 'number' ? pst(hoved.yield_bundet_ek_pst) : null

  return (
    <div style={{ background: FARGER.mork, borderRadius: RADIUS.lg, padding: 'clamp(20px, 3vw, 28px)', marginBottom: 22, color: FARGER.creamLys, boxShadow: SHADOW.md }}>
      <div style={{ fontSize: 10.5, color: FARGER.gull, letterSpacing: '0.22em', fontWeight: 700, marginBottom: 10 }}>ANBEFALT BRUK NÅ</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 11, height: 11, borderRadius: RADIUS.pill, background: '#67c298', boxShadow: '0 0 0 5px rgba(103,194,152,0.15)', flexShrink: 0 }} />
        <h2 style={{ fontSize: 'clamp(20px, 2.6vw, 26px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>{hoved.tittel}</h2>
      </div>
      <div style={{ display: 'flex', gap: 'clamp(20px, 4vw, 44px)', flexWrap: 'wrap', marginTop: 18 }}>
        {yieldTxt && chip('Yield på bundet EK', yieldTxt, '#67c298')}
        {typeof hoved.cashflow_mnd === 'number' && chip('Cashflow/mnd', fmtNok(hoved.cashflow_mnd), hoved.cashflow_mnd >= 0 ? '#67c298' : '#ff8a8a')}
        {typeof hoved.frigjort_kapital === 'number' && chip('Frigjort kapital', fmtNok(hoved.frigjort_kapital), FARGER.gull)}
        {flip && flip !== hoved && typeof flip.gevinst_etter_skatt === 'number' && chip('Ved salg: gevinst e. skatt', fmtNok(flip.gevinst_etter_skatt), 'rgba(253,252,247,0.9)')}
      </div>
      <div style={{ fontSize: 12.5, color: 'rgba(253,252,247,0.6)', marginTop: 16, lineHeight: 1.6, maxWidth: 640 }}>
        Beregnet deterministisk fra tallene under.{refi && typeof refi.frigjort_kapital === 'number' && refi.frigjort_kapital > 0 ? ` Refinansiering kan frigjøre ${fmtNok(refi.frigjort_kapital)} og beholde utleie.` : ''} Full begrunnelse i klartekst med «Be om anbefaling» lenger ned.
      </div>
    </div>
  )
}

// ─── Leilighet-editor (fler-enhets utvikling, B4b) ───────────────────────────
function LeilighetEditor({ enheter, onLagre }: { enheter: Enhet[]; onLagre: (e: Enhet[]) => void }) {
  const [rader, setRader] = useState<Enhet[]>(enheter)
  const oppdater = (i: number, felt: keyof Enhet, verdi: string | number) =>
    setRader(r => r.map((x, j) => j === i ? { ...x, [felt]: verdi } : x))
  const leggTil = () => { const nye = [...rader, { navn: '', leie_mnd: 0, drift_mnd: 0 }]; setRader(nye); onLagre(nye) }
  const fjern = (i: number) => { const nye = rader.filter((_, j) => j !== i); setRader(nye); onLagre(nye) }
  const sumLeie = rader.reduce((s, e) => s + (Number(e.leie_mnd) || 0), 0)
  const sumDrift = rader.reduce((s, e) => s + (Number(e.drift_mnd) || 0), 0)

  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 22 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: FARGER.mork, marginBottom: 4 }}>🏘️ Leiligheter — utvikle og lei ut</div>
      <div style={{ fontSize: 11.5, color: FARGER.tekstLys, marginBottom: 14, maxWidth: 560, lineHeight: 1.5 }}>
        Seksjonér boligen til flere enheter, sett leie og drift per enhet. Da regner motoren «utvikle + lei ut» (behold lån) og «refinansier + lei» mot utviklet verdi (ARV over).
      </div>

      {rader.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 28px', gap: 8, fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: FARGER.tekstLys, fontWeight: 600, padding: '0 2px' }}>
            <span>Enhet</span><span>Leie/mnd</span><span>Drift/mnd</span><span></span>
          </div>
          {rader.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 28px', gap: 8, alignItems: 'center' }}>
              <input value={e.navn || ''} placeholder={`Enhet ${i + 1}`} onChange={ev => oppdater(i, 'navn', ev.target.value)} onBlur={() => onLagre(rader)} style={{ ...inputStyle, padding: '8px 10px' }} />
              <input type="number" value={e.leie_mnd || ''} placeholder="0" onChange={ev => oppdater(i, 'leie_mnd', Number(ev.target.value) || 0)} onBlur={() => onLagre(rader)} style={{ ...inputStyle, padding: '8px 10px' }} />
              <input type="number" value={e.drift_mnd || ''} placeholder="0" onChange={ev => oppdater(i, 'drift_mnd', Number(ev.target.value) || 0)} onBlur={() => onLagre(rader)} style={{ ...inputStyle, padding: '8px 10px' }} />
              <button onClick={() => fjern(i)} title="Fjern" style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 17, padding: 0 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 28px', gap: 8, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, fontSize: 13, fontWeight: 700, color: FARGER.mork }}>
            <span>{rader.length} enheter</span><span>{fmtNok(sumLeie)}</span><span>{fmtNok(sumDrift)}</span><span></span>
          </div>
        </div>
      )}

      <button onClick={leggTil} style={{ background: 'none', border: `1px dashed ${FARGER.gullSvak}`, color: FARGER.gull, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: RADIUS.pill, cursor: 'pointer' }}>
        + Legg til leilighet
      </button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.01em' }}>
          {s.tittel}
          {typeof s.varighet_mnd === 'number' && <span style={{ fontSize: 10.5, fontWeight: 600, color: FARGER.tekstMid, marginLeft: 7 }}>⏱ {s.varighet_mnd} mnd</span>}
        </div>
        {erBeste && <span style={{ fontSize: 10, fontWeight: 700, color: FARGER.gull, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>BESTE YIELD</span>}
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
          {s.skatt_linje && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: FARGER.flateLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: '7px 10px', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: FARGER.tekstMid, fontWeight: 600 }}>🧾 {s.skatt_linje.lbl}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: s.skatt_linje.tekst ? FARGER.suksess : ((s.skatt_linje.verdi ?? 0) < 0 ? FARGER.feil : FARGER.mork) }}>
                {s.skatt_linje.tekst ?? fmtNok(s.skatt_linje.verdi ?? 0)}
              </span>
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
