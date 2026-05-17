'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loggAktivitet } from '../lib/logg'
import type { AirbnbData, LanInfo, Leietype, OppussingPerAr, Prosjekt, Utleieanalyse as Analyse, UtleieScenario } from '../types'
import { fmt, inputStyle, labelStyle, fieldStyle, FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import {
  KOSTNAD_LABEL, MANED_NAVN, aarligYield, beregnAar, estimertManedligInntekt,
  faktiskNokkel, manedligLaanebetaling, sumKostnaderAr,
} from '../lib/utleie'
import { harUtleieEndringer, prosjektFraUtleieanalyse } from '../lib/prosjektSync'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

function tomAnalyse(boligId: string, defaultKjopspris: number): Analyse {
  const iDag = new Date()
  const iMnd = `${iDag.getFullYear()}-${String(iDag.getMonth() + 1).padStart(2, '0')}`
  return {
    id: nyId(),
    bolig_id: boligId,
    leietype: 'korttid',
    scenario: 'realistisk',
    progresjon_til_etablert_ar: 3,
    total_kjopspris: defaultKjopspris || null,
    kjopsmaaned: iMnd,
    utleiestart: iMnd,
    horisont_ar: 5,
    oppussing_per_ar: [],
    lan: null,
    langtidsleie_maned: null,
    faktiske_inntekter: {},
    analyse_kilde_id: boligId,
    analyse_hentet: iDag.toISOString(),
    opprettet: iDag.toISOString(),
  }
}

export function Utleieanalyse({ prosjekt }: { prosjekt: Prosjekt }) {
  const data = prosjekt.airbnb_data as AirbnbData | null | undefined
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  const [laster, setLaster] = useState(true)
  const [brukLan, setBrukLan] = useState(false)
  const [valgtAr, setValgtAr] = useState(new Date().getFullYear())
  // Aggregerte oppussingsposter per år (fra oppussingsbudsjett)
  const [oppussingPerAr, setOppussingPerAr] = useState<Record<number, number>>({})

  const last = useCallback(async () => {
    setLaster(true)
    const { data: rad } = await supabase
      .from('utleieanalyse').select('*').eq('bolig_id', prosjekt.id).maybeSingle()
    let a = rad as Analyse | null
    if (!a) {
      a = tomAnalyse(prosjekt.id, prosjekt.kjøpesum || 0)
      await supabase.from('utleieanalyse').insert([a])
    } else if (!a.faktiske_inntekter) {
      a = { ...a, faktiske_inntekter: {} }
    }
    setAnalyse(a)
    setBrukLan(!!a.lan && !!a.lan.lanebelop)
    setLaster(false)
  }, [prosjekt.id, prosjekt.kjøpesum])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void last()
  }, [last])

  async function oppdater(endring: Partial<Analyse>) {
    if (!analyse) return
    const neste = { ...analyse, ...endring }
    setAnalyse(neste)
    await supabase.from('utleieanalyse').update(endring).eq('id', analyse.id)

    // Bidirectional sync: oppdater også prosjekter-tabellen hvis økonomi-felt
    // har endret seg. Holder Oversikt/Årsrapport oppdatert.
    if (harUtleieEndringer(analyse, neste)) {
      const oppd = prosjektFraUtleieanalyse(neste)
      if (Object.keys(oppd).length > 0) {
        await supabase.from('prosjekter').update(oppd).eq('id', prosjekt.id)
      }
    }
  }

  async function oppdaterLan(endring: Partial<LanInfo>) {
    if (!analyse) return
    const nyttLan: LanInfo = { ...(analyse.lan || {}), ...endring }
    await oppdater({ lan: nyttLan })
  }

  async function settFaktisk(ar: number, maned: number, belop: number | null) {
    if (!analyse) return
    const n = faktiskNokkel(ar, maned)
    const neste = { ...(analyse.faktiske_inntekter || {}) }
    const slett = belop === null || belop === 0 || Number.isNaN(belop)
    const handling = slett ? 'fjernet faktisk leieinntekt' : 'oppdaterte faktisk leieinntekt'
    if (slett) {
      delete neste[n]
    } else {
      neste[n] = belop as number
    }
    await oppdater({ faktiske_inntekter: neste })

    // Synk til prosjekt.måneder så Årsrapport og Oversikt viser samme tall.
    // måneder-arrayen brukes av Oversikt for cashflow-beregning og Årsrapport for år-aggregat.
    const eksMåneder = prosjekt.måneder || []
    const eksRad = eksMåneder.find(m => m.måned === n)
    let nyMåneder = eksMåneder
    if (slett) {
      if (eksRad) {
        // Behold rad hvis kostnad/notat finnes; ellers fjern
        nyMåneder = (eksRad.kostnad || eksRad.notat) ? eksMåneder.map(m => m.måned === n ? { ...m, inntekt: 0 } : m) : eksMåneder.filter(m => m.måned !== n)
      }
    } else if (eksRad) {
      nyMåneder = eksMåneder.map(m => m.måned === n ? { ...m, inntekt: belop as number } : m)
    } else {
      nyMåneder = [...eksMåneder, { måned: n, inntekt: belop as number, kostnad: 0, notat: '' }].sort((a, b) => a.måned.localeCompare(b.måned))
    }
    await supabase.from('prosjekter').update({ måneder: nyMåneder }).eq('id', prosjekt.id)

    // Hvis dette er inneværende eller fremtidig måned, oppdater også
    // "Leieinntekt/mnd" på Oversikt — det er den nyeste forventede.
    if (!slett && typeof belop === 'number') {
      const naa = new Date()
      const aktiv = ar > naa.getFullYear() || (ar === naa.getFullYear() && maned >= naa.getMonth() + 1)
      if (aktiv && Math.round(belop) !== (prosjekt.leieinntekt_mnd || 0)) {
        await supabase.from('prosjekter').update({ leieinntekt_mnd: Math.round(belop) }).eq('id', prosjekt.id)
      }
    }

    await loggAktivitet({ handling, tabell: 'utleieanalyse', rad_id: analyse.id, detaljer: { bolig: prosjekt.navn, periode: n, belop } })
  }

  // Hent oppussingsposter og aggreger per år. Bruker ferdig_dato hvis satt,
  // ellers frist, ellers nåværende år. Faktisk_kostnad foretrekkes over budsjett.
  const hentOppussingsposter = useCallback(async () => {
    const { data: bud } = await supabase
      .from('oppussing_budsjett').select('id').eq('bolig_id', prosjekt.id).maybeSingle()
    if (!bud) { setOppussingPerAr({}); return }
    const { data: poster } = await supabase
      .from('oppussing_poster')
      .select('kostnad, faktisk_kostnad, frist, ferdig_dato')
      .eq('budsjett_id', bud.id)
    const naa = new Date().getFullYear()
    const map: Record<number, number> = {}
    for (const p of (poster || []) as Array<{ kostnad: number | null; faktisk_kostnad: number | null; frist: string | null; ferdig_dato: string | null }>) {
      const datoStr = p.ferdig_dato || p.frist
      const ar = datoStr ? new Date(datoStr).getFullYear() : naa
      const kost = (typeof p.faktisk_kostnad === 'number' && Number.isFinite(p.faktisk_kostnad))
        ? p.faktisk_kostnad
        : (p.kostnad || 0)
      map[ar] = (map[ar] || 0) + kost
    }
    setOppussingPerAr(map)
  }, [prosjekt.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hentOppussingsposter()
  }, [hentOppussingsposter])

  async function settOppussingAr(ar: number, kostnad: number) {
    if (!analyse) return
    const eksisterer = (analyse.oppussing_per_ar || []).some(o => o.ar === ar)
    let neste: OppussingPerAr[]
    if (eksisterer) {
      neste = (analyse.oppussing_per_ar || []).map(o => o.ar === ar ? { ...o, kostnad } : o)
    } else {
      neste = [...(analyse.oppussing_per_ar || []), { ar, kostnad }].sort((a, b) => a.ar - b.ar)
    }
    await oppdater({ oppussing_per_ar: neste })
  }

  const iAar = new Date().getFullYear()
  const aarListe = useMemo(() => {
    if (!analyse) return []
    const start = analyse.kjopsmaaned ? Number(analyse.kjopsmaaned.split('-')[0]) : iAar
    return Array.from({ length: analyse.horisont_ar || 1 }, (_, i) => start + i)
  }, [analyse, iAar])

  const iAarOversikt = useMemo(() => analyse ? beregnAar(iAar, data || null, analyse) : null, [analyse, data, iAar])
  const nesteAarOversikt = useMemo(() => analyse ? beregnAar(iAar + 1, data || null, analyse) : null, [analyse, data, iAar])

  if (laster || !analyse) {
    return (
      <div>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 14, boxShadow: SHADOW.sm }}>
            <div className="skimmer" style={{ height: 18, width: '40%', marginBottom: 16, borderRadius: 4 }} />
            <div className="skimmer" style={{ height: 60, borderRadius: RADIUS.md }} />
          </div>
        ))}
      </div>
    )
  }

  const gyldigData = !!data && Array.isArray(data.maaneder) && data.maaneder.length === 12 && !!data.scenarier
  if (!gyldigData) {
    return (
      <div style={{ background: '#fff8e1', border: '1px solid #B05E0A44', borderRadius: RADIUS.lg, padding: 26, boxShadow: SHADOW.sm }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#7a400a', marginBottom: 10, letterSpacing: '-0.015em' }}>⚠️ Mangler analyse-data</div>
        <p style={{ fontSize: 14, color: '#6b3a0a', margin: 0, lineHeight: 1.65 }}>
          Denne boligen mangler strukturert airbnb-data, eller ble lagret på et gammelt skjema. Gå til <strong>Boliganalyse</strong>, analyser samme eiendom på nytt og lagre som utleieprosjekt — da får du tilgang til tallene utleieanalysen trenger.
        </p>
      </div>
    )
  }

  const lanMnd = manedligLaanebetaling(analyse.lan)
  const kostnaderHele = sumKostnaderAr(data)

  return (
    <div>
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.015em' }}>🏖️ Leietype og scenario</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {(['korttid', 'langtid'] as Leietype[]).map(t => (
            <button key={t} onClick={() => oppdater({ leietype: t })}
              style={{
                background: analyse.leietype === t ? '#2D7D46' : FARGER.flateLys,
                color: analyse.leietype === t ? FARGER.creamLys : FARGER.tekstMid,
                border: 'none', borderRadius: RADIUS.pill,
                padding: '10px 20px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', letterSpacing: '-0.005em',
                boxShadow: analyse.leietype === t ? SHADOW.sm : 'none',
                transition: `background ${MOTION.rask}, box-shadow ${MOTION.rask}`,
              }}>
              {t === 'korttid' ? 'Korttidsleie (Airbnb)' : 'Langtidsleie'}
            </button>
          ))}
        </div>
        {analyse.leietype === 'korttid' && (
          <div>
            <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Scenario</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['konservativt', 'realistisk', 'sterkt'] as UtleieScenario[]).map(s => (
                <button key={s} onClick={() => oppdater({ scenario: s })}
                  style={{
                    background: analyse.scenario === s ? FARGER.mork : FARGER.flateLys,
                    color: analyse.scenario === s ? FARGER.creamLys : FARGER.tekstMid,
                    border: 'none', borderRadius: RADIUS.pill,
                    padding: '9px 18px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', letterSpacing: '-0.005em',
                    boxShadow: analyse.scenario === s ? SHADOW.sm : 'none',
                    transition: `background ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                  }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
        {analyse.leietype === 'langtid' && (
          <div style={{ marginTop: 4 }}>
            <label style={labelStyle}>
              Månedsleie (€) — langtidsleie
              {data.langtidsleie?.maaned_lav && data.langtidsleie?.maaned_hoy
                ? ` · Analysen foreslår €${data.langtidsleie.maaned_lav}–${data.langtidsleie.maaned_hoy}`
                : ''}
            </label>
            <input style={{ ...inputStyle, width: 200 }} type="number" value={analyse.langtidsleie_maned || ''}
              onBlur={e => oppdater({ langtidsleie_maned: Number(e.target.value) || null })}
              onChange={e => setAnalyse({ ...analyse, langtidsleie_maned: Number(e.target.value) || null })} />
          </div>
        )}
      </div>

      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.015em' }}>💰 Kjøp og oppstart</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Total kjøpspris (€)</label>
            <input style={inputStyle} type="number" value={analyse.total_kjopspris || ''}
              onBlur={e => oppdater({ total_kjopspris: Number(e.target.value) || null })}
              onChange={e => setAnalyse({ ...analyse, total_kjopspris: Number(e.target.value) || null })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Kjøpsmåned</label>
            <input style={inputStyle} type="month" value={analyse.kjopsmaaned || ''}
              onBlur={e => oppdater({ kjopsmaaned: e.target.value || null })}
              onChange={e => setAnalyse({ ...analyse, kjopsmaaned: e.target.value || null })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Utleiestart</label>
            <input style={inputStyle} type="month" value={analyse.utleiestart || ''}
              onBlur={e => oppdater({ utleiestart: e.target.value || null })}
              onChange={e => setAnalyse({ ...analyse, utleiestart: e.target.value || null })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} title="År 1 bruker lavere nattpris og belegg (nybegynner-tall). Når du setter f.eks. 3, interpoleres det lineært i 2 år, og fra år 3 kjører utleien på full kapasitet.">
              Etablert fra og med år <span style={{ color: '#aaa', cursor: 'help' }}>ⓘ</span>
            </label>
            <input style={inputStyle} type="number" min={1} max={10} value={analyse.progresjon_til_etablert_ar || ''}
              onBlur={e => oppdater({ progresjon_til_etablert_ar: Number(e.target.value) || 3 })}
              onChange={e => setAnalyse({ ...analyse, progresjon_til_etablert_ar: Number(e.target.value) || 3 })} />
            <div style={{ fontSize: 10, color: '#888', marginTop: 3, lineHeight: 1.4 }}>
              Antall år til full kapasitet (nattpris + belegg). 3 er typisk for Airbnb.
            </div>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} title="Hvor langt frem i tid prognosen skal vises i tabellen. Påvirker kun visning, ikke beregning.">
              Horisont (år) <span style={{ color: '#aaa', cursor: 'help' }}>ⓘ</span>
            </label>
            <input style={inputStyle} type="number" min={1} max={15} value={analyse.horisont_ar || ''}
              onBlur={e => oppdater({ horisont_ar: Number(e.target.value) || 5 })}
              onChange={e => setAnalyse({ ...analyse, horisont_ar: Number(e.target.value) || 5 })} />
            <div style={{ fontSize: 10, color: '#888', marginTop: 3, lineHeight: 1.4 }}>
              Hvor mange år fremover prognosen skal vise.
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.015em' }}>🏦 Finansiering</div>
          <label style={{ fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={brukLan} onChange={e => { setBrukLan(e.target.checked); if (!e.target.checked) oppdater({ lan: null }) }} />
            Jeg bruker lån
          </label>
        </div>
        {brukLan && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Lånebeløp (€)</label>
              <input style={inputStyle} type="number" value={analyse.lan?.lanebelop || ''}
                onBlur={e => oppdaterLan({ lanebelop: Number(e.target.value) || 0 })}
                onChange={e => setAnalyse({ ...analyse, lan: { ...(analyse.lan || {}), lanebelop: Number(e.target.value) || 0 } })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Rente (%)</label>
              <input style={inputStyle} type="number" step="0.01" value={analyse.lan?.rente_prosent || ''}
                onBlur={e => oppdaterLan({ rente_prosent: Number(e.target.value) || 0 })}
                onChange={e => setAnalyse({ ...analyse, lan: { ...(analyse.lan || {}), rente_prosent: Number(e.target.value) || 0 } })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nedbetalingstid (år)</label>
              <input style={inputStyle} type="number" value={analyse.lan?.nedbetalingstid_ar || ''}
                onBlur={e => oppdaterLan({ nedbetalingstid_ar: Number(e.target.value) || 0 })}
                onChange={e => setAnalyse({ ...analyse, lan: { ...(analyse.lan || {}), nedbetalingstid_ar: Number(e.target.value) || 0 } })} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Beregnet mnd. renter + avdrag</label>
              <div style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600 }}>{fmt(lanMnd)}</div>
            </div>
          </div>
        )}
        {!brukLan && <div style={{ fontSize: 13, color: '#888' }}>Alle tall vises uten lån. Huk av for å legge inn lånebetingelser – da får du sammenligning med og uten lån.</div>}
      </div>

      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.015em' }}>🔨 Oppussingskostnader per år</div>
          {Object.keys(oppussingPerAr).length > 0 && (
            <button
              onClick={async () => {
                if (!analyse) return
                const eksisterende = analyse.oppussing_per_ar || []
                const aar = new Set([...eksisterende.map(o => o.ar), ...Object.keys(oppussingPerAr).map(Number)])
                const ny: OppussingPerAr[] = Array.from(aar).sort((a, b) => a - b).map(ar => ({
                  ar,
                  kostnad: oppussingPerAr[ar] || eksisterende.find(o => o.ar === ar)?.kostnad || 0,
                }))
                await oppdater({ oppussing_per_ar: ny })
              }}
              title="Hent automatisk fra oppussingsposter (faktisk eller budsjett, basert på ferdig-dato eller frist)"
              className="knapp-hover-loft"
              style={{
                background: FARGER.mork, color: FARGER.creamLys, border: 'none',
                padding: '8px 16px', borderRadius: RADIUS.pill,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: SHADOW.sm,
              }}>
              📥 Hent fra Oppussing-fanen
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px' }}>
          Legg inn beløp for de årene du planlegger større oppussing eller oppgraderinger.
          {Object.keys(oppussingPerAr).length > 0 && ' Tall i grått under feltet er det som ligger i Oppussing-fanen for samme år.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {aarListe.map(ar => {
            const post = analyse.oppussing_per_ar?.find(o => o.ar === ar)
            const fraOppussing = oppussingPerAr[ar]
            return (
              <div key={ar} style={fieldStyle}>
                <label style={labelStyle}>{ar} (€)</label>
                <input style={inputStyle} type="number" value={post?.kostnad || ''}
                  onBlur={e => settOppussingAr(ar, Number(e.target.value) || 0)}
                  onChange={e => {
                    const kost = Number(e.target.value) || 0
                    const eksisterer = (analyse.oppussing_per_ar || []).some(o => o.ar === ar)
                    const neste = eksisterer
                      ? (analyse.oppussing_per_ar || []).map(o => o.ar === ar ? { ...o, kostnad: kost } : o)
                      : [...(analyse.oppussing_per_ar || []), { ar, kostnad: kost }].sort((a, b) => a.ar - b.ar)
                    setAnalyse({ ...analyse, oppussing_per_ar: neste })
                  }} />
                {fraOppussing && fraOppussing > 0 && (post?.kostnad || 0) !== fraOppussing && (
                  <button onClick={() => settOppussingAr(ar, fraOppussing)}
                    title="Bruk verdien fra Oppussing-fanen"
                    style={{ background: 'none', border: 'none', color: '#b89a6f', cursor: 'pointer', fontSize: 10, marginTop: 4, padding: 0, textAlign: 'left' }}>
                    📥 {fmt(fraOppussing)}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {iAarOversikt && nesteAarOversikt && (
        <>
          <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.015em' }}>📊 Oversikt {iAar} og {iAar + 1}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[iAarOversikt, nesteAarOversikt].map((o, i) => (
                <div key={o.ar} style={{ background: '#f8f8f8', borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{i === 0 ? 'Inneværende år' : 'Neste hele år'} ({o.ar})</div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    Eid {o.maneder_eid} mnd · Utleie {o.maneder_utleie} mnd · Tom {o.maneder_tom} mnd
                  </div>
                  {[
                    { lbl: 'Brutto leieinntekt', val: fmt(o.brutto_inntekt), farge: '#2D7D46' },
                    { lbl: `Løpende kostnader (${o.maneder_eid}/12)`, val: fmt(o.kostnader_lopende), farge: '#C8102E' },
                    { lbl: 'Oppussing dette året', val: fmt(o.oppussing), farge: '#C8102E' },
                    { lbl: 'Netto uten lån', val: fmt(o.netto_uten_lan), farge: o.netto_uten_lan >= 0 ? '#2D7D46' : '#C8102E', bold: true },
                    ...(brukLan ? [
                      { lbl: `Lån (${o.maneder_eid} mnd)`, val: fmt(o.lan_ar), farge: '#C8102E' },
                      { lbl: 'Netto med lån', val: fmt(o.netto_med_lan), farge: o.netto_med_lan >= 0 ? '#2D7D46' : '#C8102E', bold: true },
                    ] : []),
                  ].map((r, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: j > 0 ? '1px solid #e5e5e5' : 'none', fontSize: 13 }}>
                      <span style={{ color: '#555', fontWeight: ('bold' in r && r.bold) ? 700 : 400 }}>{r.lbl}</span>
                      <span style={{ fontWeight: 600, color: r.farge }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ background: '#f0faf4', border: '1.5px solid #2D7D4644', borderRadius: 6, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#1a4d2b' }}>Sum {iAar}–{iAar + 1}</div>
              {([
                { lbl: 'Brutto (2 år)', val: iAarOversikt.brutto_inntekt + nesteAarOversikt.brutto_inntekt, positiv: true },
                { lbl: 'Netto uten lån (2 år)', val: iAarOversikt.netto_uten_lan + nesteAarOversikt.netto_uten_lan, positiv: null },
                ...(brukLan ? [{ lbl: 'Netto med lån (2 år)', val: iAarOversikt.netto_med_lan + nesteAarOversikt.netto_med_lan, positiv: null }] : []),
                { lbl: 'Yield på kjøpspris (år 2, brutto)', val: aarligYield(nesteAarOversikt.brutto_inntekt, analyse.total_kjopspris || 0), positiv: null, pct: true },
              ] as const).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #c8e5d3' : 'none', fontSize: 13 }}>
                  <span style={{ color: '#1a4d2b' }}>{r.lbl}</span>
                  <span style={{ fontWeight: 700, color: r.val >= 0 ? '#2D7D46' : '#C8102E' }}>
                    {'pct' in r && r.pct ? r.val.toFixed(1) + '%' : fmt(r.val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.015em' }}>💸 Kostnadsnedbrytning (hele år, fra analysen)</div>
            {Object.entries(data.kostnader_arlig || {}).filter(([, v]) => (v as number) > 0).map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
                <span style={{ color: '#555' }}>{KOSTNAD_LABEL[k] || k}</span>
                <span style={{ fontWeight: 600 }}>{fmt(v as number)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #eee', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
              <span>Sum kostnader per hele år</span>
              <span>{fmt(kostnaderHele)}</span>
            </div>
          </div>

          <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.015em' }}>📅 Leieinntekt per måned</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setValgtAr(valgtAr - 1)} style={{
                  background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
                  borderRadius: RADIUS.pill, padding: '7px 14px', fontSize: 13,
                  cursor: 'pointer', color: FARGER.tekstMid, fontWeight: 500,
                  boxShadow: SHADOW.xs,
                }}>←</button>
                <div style={{ fontSize: 15, fontWeight: 600, minWidth: 60, textAlign: 'center', color: FARGER.mork, letterSpacing: '-0.005em' }}>{valgtAr}</div>
                <button onClick={() => setValgtAr(valgtAr + 1)} style={{
                  background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
                  borderRadius: RADIUS.pill, padding: '7px 14px', fontSize: 13,
                  cursor: 'pointer', color: FARGER.tekstMid, fontWeight: 500,
                  boxShadow: SHADOW.xs,
                }}>→</button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>Skriv inn faktisk inntekt når tallet er kjent – tomme felt bruker estimatet fra analysen. Verdier kan endres eller slettes når som helst.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {MANED_NAVN.map((navn, i) => {
                const maned = i + 1
                const estimat = estimertManedligInntekt(data, analyse, valgtAr, maned)
                const nokkel = faktiskNokkel(valgtAr, maned)
                const faktisk = analyse.faktiske_inntekter?.[nokkel]
                const harFaktisk = typeof faktisk === 'number' && !Number.isNaN(faktisk)
                return (
                  <div key={i} style={{ background: harFaktisk ? '#f0faf4' : '#f8f8f8', border: harFaktisk ? '1.5px solid #2D7D4644' : '1.5px solid transparent', borderRadius: 8, padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: '#888' }}>{navn}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: harFaktisk ? '#2D7D46' : '#999' }}>{harFaktisk ? 'FAKTISK' : 'ESTIMAT'}</span>
                    </div>
                    <input
                      type="number"
                      value={harFaktisk ? faktisk : ''}
                      placeholder={estimat > 0 ? Math.round(estimat).toString() : '–'}
                      onBlur={e => {
                        const v = e.target.value.trim() === '' ? null : Number(e.target.value)
                        settFaktisk(valgtAr, maned, v)
                      }}
                      onChange={e => {
                        if (!analyse) return
                        const v = e.target.value.trim() === '' ? null : Number(e.target.value)
                        const neste = { ...(analyse.faktiske_inntekter || {}) }
                        if (v === null || v === 0 || Number.isNaN(v)) delete neste[nokkel]
                        else neste[nokkel] = v
                        setAnalyse({ ...analyse, faktiske_inntekter: neste })
                      }}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 14, fontWeight: harFaktisk ? 700 : 400, color: harFaktisk ? '#2D7D46' : '#444', borderRadius: 6, border: '1px solid #ddd', background: 'white' }} />
                    {!harFaktisk && estimat > 0 && (
                      <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>Estimat {fmt(estimat)}</div>
                    )}
                    {harFaktisk && (
                      <button onClick={() => settFaktisk(valgtAr, maned, null)}
                        style={{ marginTop: 4, fontSize: 10, background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                        Tilbakestill til estimat
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 10, borderTop: '1px solid #eee', fontSize: 14, fontWeight: 700 }}>
              <span>Sum {valgtAr}</span>
              <span>{fmt(beregnAar(valgtAr, data, analyse).brutto_inntekt)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
