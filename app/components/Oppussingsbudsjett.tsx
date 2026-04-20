'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LopendePerManed, OppussingBudsjett, OppussingPost, OppussingStandard, Prosjekt } from '../types'
import { inputStyle, labelStyle, fieldStyle, fmt } from '../lib/styles'
import {
  LOPENDE_FELTER, POSTE_FORSLAG, STANDARD_LABEL,
  bruttoFortjeneste, erEstimatUtdatert, lopendePerManed, lopendeTotal,
  roiOppussing, totalPoster, totalkostnad,
} from '../lib/oppussing'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

function tomtBudsjett(boligId: string): OppussingBudsjett {
  return {
    id: nyId(),
    bolig_id: boligId,
    standard: 'bra',
    antall_maneder: 3,
    lopende_per_maned: {},
    estimert_salgspris: null,
    estimat_begrunnelse: null,
    estimat_usikkerhet: null,
    estimat_oppdatert: null,
    estimat_poster_sum: null,
    opprettet: new Date().toISOString(),
  }
}

export function Oppussingsbudsjett({ prosjekt }: { prosjekt: Prosjekt }) {
  const boligId = prosjekt.id
  const [budsjett, setBudsjett] = useState<OppussingBudsjett | null>(null)
  const [poster, setPoster] = useState<OppussingPost[]>([])
  const [laster, setLaster] = useState(true)
  const [estimerer, setEstimerer] = useState(false)
  const [feil, setFeil] = useState('')
  const [egenPost, setEgenPost] = useState('')

  const last = useCallback(async () => {
    setLaster(true)
    const { data: bRad } = await supabase
      .from('oppussing_budsjett').select('*').eq('bolig_id', boligId).maybeSingle()
    let b = bRad as OppussingBudsjett | null
    if (!b) {
      b = tomtBudsjett(boligId)
      await supabase.from('oppussing_budsjett').insert([b])
    }
    setBudsjett(b)
    const { data: pRader } = await supabase
      .from('oppussing_poster').select('*').eq('budsjett_id', b.id).order('rekkefolge')
    setPoster((pRader || []) as OppussingPost[])
    setLaster(false)
  }, [boligId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void last()
  }, [last])

  async function oppdaterBudsjett(endring: Partial<OppussingBudsjett>) {
    if (!budsjett) return
    const neste = { ...budsjett, ...endring }
    setBudsjett(neste)
    await supabase.from('oppussing_budsjett').update(endring).eq('id', budsjett.id)
  }

  async function settLopende(felt: keyof LopendePerManed, verdi: number) {
    if (!budsjett) return
    const neste = { ...budsjett.lopende_per_maned, [felt]: verdi }
    await oppdaterBudsjett({ lopende_per_maned: neste })
  }

  async function leggTilPost(navn: string) {
    if (!budsjett || !navn.trim()) return
    const ny: OppussingPost = {
      id: nyId(),
      budsjett_id: budsjett.id,
      navn: navn.trim(),
      kostnad: 0,
      notat: null,
      rekkefolge: poster.length,
    }
    setPoster([...poster, ny])
    await supabase.from('oppussing_poster').insert([ny])
  }

  async function oppdaterPost(id: string, endring: Partial<OppussingPost>) {
    setPoster(poster.map(p => p.id === id ? { ...p, ...endring } : p))
    await supabase.from('oppussing_poster').update(endring).eq('id', id)
  }

  async function slettPost(id: string) {
    setPoster(poster.filter(p => p.id !== id))
    await supabase.from('oppussing_poster').delete().eq('id', id)
  }

  async function estimerSalgspris() {
    if (!budsjett) return
    setEstimerer(true); setFeil('')
    try {
      const res = await fetch('/api/agent/salgsestimat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boligId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeil(data.error || 'Estimatet feilet')
      } else {
        setBudsjett({
          ...budsjett,
          estimert_salgspris: data.estimert_salgspris,
          estimat_begrunnelse: data.begrunnelse,
          estimat_usikkerhet: data.usikkerhet,
          estimat_oppdatert: new Date().toISOString(),
          estimat_poster_sum: totalPoster(poster),
        })
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Ukjent feil')
    }
    setEstimerer(false)
  }

  if (laster || !budsjett) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div>
  }

  const tk = totalkostnad(prosjekt, budsjett, poster)
  const bf = bruttoFortjeneste(prosjekt, budsjett, poster)
  const roi = roiOppussing(prosjekt, budsjett, poster)
  const utdatert = erEstimatUtdatert(budsjett, poster)
  const lopendeMnd = lopendePerManed(budsjett.lopende_per_maned)
  const lopendeSum = lopendeTotal(budsjett)
  const posterSum = totalPoster(poster)
  const brukteForslagssett = new Set(poster.map(p => p.navn))

  return (
    <div>
      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🧱 Oppussingsposter</div>

        {poster.length === 0 && (
          <div style={{ fontSize: 13, color: '#888', marginBottom: 12, fontStyle: 'italic' }}>Ingen poster ennå – legg til under.</div>
        )}

        {poster.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input style={inputStyle} value={p.navn} onChange={e => setPoster(poster.map(pp => pp.id === p.id ? { ...pp, navn: e.target.value } : pp))} onBlur={e => oppdaterPost(p.id, { navn: e.target.value })} placeholder="Navn" />
            <input style={inputStyle} type="number" value={p.kostnad || ''} onChange={e => setPoster(poster.map(pp => pp.id === p.id ? { ...pp, kostnad: Number(e.target.value) } : pp))} onBlur={e => oppdaterPost(p.id, { kostnad: Number(e.target.value) || 0 })} placeholder="€" />
            <input style={inputStyle} value={p.notat || ''} onChange={e => setPoster(poster.map(pp => pp.id === p.id ? { ...pp, notat: e.target.value } : pp))} onBlur={e => oppdaterPost(p.id, { notat: e.target.value || null })} placeholder="Notat (valgfritt)" />
            <button onClick={() => slettPost(p.id)} style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✕</button>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', marginTop: 6, fontSize: 14, fontWeight: 700 }}>
          <span>Sum poster</span><span>{fmt(posterSum)}</span>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: '#666', marginBottom: 6 }}>Legg til forhåndsdefinert post:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {POSTE_FORSLAG.filter(n => !brukteForslagssett.has(n)).map(n => (
            <button key={n} onClick={() => leggTilPost(n)} style={{ background: '#f0f7ff', color: '#185FA5', border: '1px solid #185FA544', borderRadius: 16, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ {n}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} value={egenPost} onChange={e => setEgenPost(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && egenPost.trim()) { leggTilPost(egenPost); setEgenPost('') } }} placeholder="Egen post (f.eks. Terrassegulv)" />
          <button onClick={() => { if (egenPost.trim()) { leggTilPost(egenPost); setEgenPost('') } }} style={{ background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Legg til</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⭐ Standard på oppussingen</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['standard', 'bra', 'luksus'] as OppussingStandard[]).map(s => (
            <button key={s} onClick={() => oppdaterBudsjett({ standard: s })}
              style={{ background: budsjett.standard === s ? '#185FA5' : '#f0f0f0', color: budsjett.standard === s ? 'white' : '#444', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {STANDARD_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📅 Prosjektvarighet</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input style={{ ...inputStyle, width: 120 }} type="number" value={budsjett.antall_maneder || ''} onChange={e => setBudsjett({ ...budsjett, antall_maneder: Number(e.target.value) || 0 })} onBlur={e => oppdaterBudsjett({ antall_maneder: Number(e.target.value) || 0 })} />
          <span style={{ fontSize: 14, color: '#666' }}>måneder</span>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💸 Løpende kostnader i perioden</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 10 }}>
          {LOPENDE_FELTER.map(f => (
            <div key={f.key} style={fieldStyle}>
              <label style={labelStyle}>{f.lbl} (€/mnd)</label>
              <input style={inputStyle} type="number" value={budsjett.lopende_per_maned[f.key] || ''} onBlur={e => settLopende(f.key, Number(e.target.value) || 0)} onChange={e => setBudsjett({ ...budsjett, lopende_per_maned: { ...budsjett.lopende_per_maned, [f.key]: Number(e.target.value) || 0 } })} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eee', fontSize: 13 }}>
          <span style={{ color: '#666' }}>Per måned</span><span style={{ fontWeight: 600 }}>{fmt(lopendeMnd)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eee', fontSize: 14, fontWeight: 700 }}>
          <span>Totalt over {budsjett.antall_maneder} mnd</span><span>{fmt(lopendeSum)}</span>
        </div>
      </div>

      <div style={{ background: '#f0f7ff', border: '2px solid #185FA544', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#185FA5' }}>🤖 Estimert salgspris fra AI</div>

        {budsjett.estimert_salgspris ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#185FA5' }}>{fmt(budsjett.estimert_salgspris)}</div>
              {budsjett.estimat_usikkerhet && (
                <span style={{ background: '#fff', border: '1px solid #185FA544', borderRadius: 16, padding: '3px 10px', fontSize: 12, color: '#185FA5', fontWeight: 600 }}>
                  Usikkerhet: {budsjett.estimat_usikkerhet}
                </span>
              )}
              {budsjett.estimat_oppdatert && (
                <span style={{ fontSize: 12, color: '#888' }}>Oppdatert: {new Date(budsjett.estimat_oppdatert).toLocaleDateString('nb-NO')}</span>
              )}
            </div>
            {budsjett.estimat_begrunnelse && (
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#333', margin: '0 0 12px' }}>{budsjett.estimat_begrunnelse}</p>
            )}
            {utdatert && (
              <div style={{ background: '#fff8e1', border: '1.5px solid #B05E0A44', borderRadius: 8, padding: 10, fontSize: 13, color: '#7a400a', marginBottom: 10 }}>
                ⚠️ Oppussingsposter har endret seg siden siste estimat. Kjør på nytt for oppdatert tall.
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px' }}>Fyll inn poster og standard først, så estimerer AI-agenten salgspris basert på boligen og området.</p>
        )}

        <button onClick={estimerSalgspris} disabled={estimerer || poster.length === 0} style={{ background: estimerer || poster.length === 0 ? '#999' : '#185FA5', color: 'white', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: estimerer || poster.length === 0 ? 'not-allowed' : 'pointer' }}>
          {estimerer ? '⏳ Estimerer...' : budsjett.estimert_salgspris ? '🔄 Kjør estimat på nytt' : '🤖 Estimer salgspris med AI'}
        </button>

        {feil && (
          <div style={{ marginTop: 10, background: '#fde8ec', border: '1.5px solid #C8102E', borderRadius: 8, padding: 10, fontSize: 13, color: '#7a0c1e' }}>
            ❌ {feil}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📊 Beregning</div>
        {[
          { lbl: 'Kjøpesum', val: fmt(prosjekt.kjøpesum) },
          { lbl: 'Kjøpskostnader', val: fmt(prosjekt.kjøpskostnader) },
          { lbl: 'Sum oppussingsposter', val: fmt(posterSum) },
          { lbl: `Løpende kostnader (${budsjett.antall_maneder} mnd)`, val: fmt(lopendeSum) },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
            <span style={{ color: '#666' }}>{r.lbl}</span><span style={{ fontWeight: 600 }}>{r.val}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #eee', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
          <span>Totalkostnad</span><span>{fmt(tk)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', fontSize: 14 }}>
          <span style={{ color: '#666' }}>Estimert salgspris (AI)</span><span style={{ fontWeight: 600 }}>{budsjett.estimert_salgspris ? fmt(budsjett.estimert_salgspris) : '–'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', fontSize: 15, fontWeight: 700 }}>
          <span>Brutto fortjeneste</span>
          <span style={{ color: bf >= 0 ? '#2D7D46' : '#C8102E' }}>{budsjett.estimert_salgspris ? fmt(bf) : '–'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', fontSize: 15, fontWeight: 700 }}>
          <span>ROI</span>
          <span style={{ color: roi >= 0 ? '#2D7D46' : '#C8102E' }}>{budsjett.estimert_salgspris ? roi.toFixed(1) + '%' : '–'}</span>
        </div>
      </div>
    </div>
  )
}
