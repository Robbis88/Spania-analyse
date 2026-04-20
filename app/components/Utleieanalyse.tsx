'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AirbnbData, LanInfo, Leietype, OppussingPerAr, Prosjekt, Utleieanalyse as Analyse, UtleieScenario } from '../types'
import { fmt, inputStyle, labelStyle, fieldStyle } from '../lib/styles'
import {
  KOSTNAD_LABEL, MANED_NAVN, aarligYield, beregnAar, manedligLaanebetaling, sumKostnaderAr,
} from '../lib/utleie'

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

  const last = useCallback(async () => {
    setLaster(true)
    const { data: rad } = await supabase
      .from('utleieanalyse').select('*').eq('bolig_id', prosjekt.id).maybeSingle()
    let a = rad as Analyse | null
    if (!a) {
      a = tomAnalyse(prosjekt.id, prosjekt.kjøpesum || 0)
      await supabase.from('utleieanalyse').insert([a])
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
  }

  async function oppdaterLan(endring: Partial<LanInfo>) {
    if (!analyse) return
    const nyttLan: LanInfo = { ...(analyse.lan || {}), ...endring }
    await oppdater({ lan: nyttLan })
  }

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
    return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div>
  }

  if (!data) {
    return (
      <div style={{ background: '#fff8e1', border: '2px solid #B05E0A44', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#7a400a', marginBottom: 8 }}>⚠️ Mangler analyse-data</div>
        <p style={{ fontSize: 14, color: '#6b3a0a', margin: 0, lineHeight: 1.6 }}>
          Denne boligen ble lagret før utleieanalysen ble bygget. Gå til <strong>Boliganalyse</strong>, analyser samme eiendom på nytt og lagre som utleieprosjekt – da får du tilgang til tallene utleieanalysen trenger.
        </p>
      </div>
    )
  }

  const lanMnd = manedligLaanebetaling(analyse.lan)
  const kostnaderHele = sumKostnaderAr(data)

  return (
    <div>
      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🏖️ Leietype og scenario</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {(['korttid', 'langtid'] as Leietype[]).map(t => (
            <button key={t} onClick={() => oppdater({ leietype: t })}
              style={{ background: analyse.leietype === t ? '#2D7D46' : '#f0f0f0', color: analyse.leietype === t ? 'white' : '#444', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {t === 'korttid' ? 'Korttidsleie (Airbnb)' : 'Langtidsleie'}
            </button>
          ))}
        </div>
        {analyse.leietype === 'korttid' && (
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Scenario</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['konservativt', 'realistisk', 'sterkt'] as UtleieScenario[]).map(s => (
                <button key={s} onClick={() => oppdater({ scenario: s })}
                  style={{ background: analyse.scenario === s ? '#185FA5' : '#f0f0f0', color: analyse.scenario === s ? 'white' : '#444', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
              {data.langtidsleie_maned_lav && data.langtidsleie_maned_hoy
                ? ` · Analysen foreslår €${data.langtidsleie_maned_lav}–${data.langtidsleie_maned_hoy}`
                : ''}
            </label>
            <input style={{ ...inputStyle, width: 200 }} type="number" value={analyse.langtidsleie_maned || ''}
              onBlur={e => oppdater({ langtidsleie_maned: Number(e.target.value) || null })}
              onChange={e => setAnalyse({ ...analyse, langtidsleie_maned: Number(e.target.value) || null })} />
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💰 Kjøp og oppstart</div>
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
            <label style={labelStyle}>Etablert fra og med år</label>
            <input style={inputStyle} type="number" min={1} max={10} value={analyse.progresjon_til_etablert_ar || ''}
              onBlur={e => oppdater({ progresjon_til_etablert_ar: Number(e.target.value) || 3 })}
              onChange={e => setAnalyse({ ...analyse, progresjon_til_etablert_ar: Number(e.target.value) || 3 })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Horisont (år)</label>
            <input style={inputStyle} type="number" min={1} max={15} value={analyse.horisont_ar || ''}
              onBlur={e => oppdater({ horisont_ar: Number(e.target.value) || 5 })}
              onChange={e => setAnalyse({ ...analyse, horisont_ar: Number(e.target.value) || 5 })} />
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🏦 Finansiering</div>
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

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🔨 Oppussingskostnader per år</div>
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px' }}>Legg inn beløp for de årene du planlegger større oppussing eller oppgraderinger.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {aarListe.map(ar => {
            const post = analyse.oppussing_per_ar?.find(o => o.ar === ar)
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
              </div>
            )
          })}
        </div>
      </div>

      {iAarOversikt && nesteAarOversikt && (
        <>
          <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📊 Oversikt {iAar} og {iAar + 1}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[iAarOversikt, nesteAarOversikt].map((o, i) => (
                <div key={o.ar} style={{ background: '#f8f8f8', borderRadius: 10, padding: 16 }}>
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

            <div style={{ background: '#f0faf4', border: '1.5px solid #2D7D4644', borderRadius: 10, padding: 14 }}>
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

          <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💸 Kostnadsnedbrytning (hele år, fra analysen)</div>
            {Object.entries(data.kostnader_ar || {}).filter(([, v]) => (v as number) > 0).map(([k, v], i) => (
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

          <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📅 Leieinntekt per måned ({iAar + 1})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
              {nesteAarOversikt.per_maned_inntekt.map((belop, i) => (
                <div key={i} style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#888' }}>{MANED_NAVN[i]}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: belop > 0 ? '#2D7D46' : '#aaa' }}>{belop > 0 ? fmt(belop) : '–'}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
