'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { type AirbnbData, type Bolig, type BoligData, tomBolig, tomtProsjekt, type Prosjekt } from '../types'
import { inputStyle, selectStyle, labelStyle, fieldStyle, fmt, fmtPct } from '../lib/styles'
import { ScoreKort, type Score } from './ScoreKort'

type AnalyseResultat = {
  tittel?: string
  type?: string
  beliggenhet?: string
  soverom?: number
  areal?: number
  avstand_strand_m?: number
  bolig_standard?: string
  pris?: number
  markedspris_standard_m2?: number
  markedspris_bra_m2?: number
  markedspris_luksus_m2?: number
  markedspris_begrunnelse?: string
  oppussing_vurdering?: string
  anbefalt_strategi?: string
  ek_krav?: number
  mnd_betaling?: number
  yield_estimat?: number
  vft_score?: number
  ai_vurdering?: string
}

export function Boliganalyse({ onTilbake }: { onTilbake: () => void }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AnalyseResultat | null>(null)
  const [loading, setLoading] = useState(false)
  const [airbnbLoading, setAirbnbLoading] = useState(false)
  const [airbnbAnalyse, setAirbnbAnalyse] = useState('')
  const [airbnbScore, setAirbnbScore] = useState<Score | null>(null)
  const [airbnbData, setAirbnbData] = useState<AirbnbData | null>(null)
  const [visSkjema, setVisSkjema] = useState(false)
  const [lagreMelding, setLagreMelding] = useState('')
  const [bolig, setBolig] = useState<Bolig>(tomBolig())

  function nullstill() {
    setInput(''); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null); setVisSkjema(false); setLagreMelding('')
  }

  async function analyser() {
    setLoading(true); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null); setVisSkjema(false); setLagreMelding('')
    try {
      const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyText: input }) })
      const data: AnalyseResultat = await res.json()
      setResult(data)
      setBolig({
        type: data.type || '',
        beliggenhet: data.beliggenhet || '',
        soverom: data.soverom?.toString() || '',
        bad: '',
        areal: data.areal?.toString() || '',
        avstand_strand: data.avstand_strand_m?.toString() || '',
        basseng: 'felles', parkering: 'privat', havutsikt: 'nei',
        standard: data.bolig_standard || 'moderne',
        pris: data.pris?.toString() || '',
        ekstra: '',
        markedspris_bra_m2: data.markedspris_bra_m2?.toString() || '',
        oppbudsjett: '',
      })
      setVisSkjema(true)
    } catch {
      setResult({ ai_vurdering: 'Noe gikk galt, prøv igjen.' })
    }
    setLoading(false)
  }

  async function kjørAirbnbAnalyse() {
    setAirbnbLoading(true); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null)
    try {
      const res = await fetch('/api/airbnb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bolig }) })
      const data = await res.json()
      setAirbnbAnalyse(data.analyse || ''); setAirbnbScore(data.score || null); setAirbnbData(data.data || null)
    } catch {
      setAirbnbAnalyse('Noe gikk galt, prøv igjen.')
    }
    setAirbnbLoading(false)
  }

  async function lagreAnalyseSomProsjekt(kategori: 'flipp' | 'utleie') {
    if (!result) return
    const navn = result.tittel || result.beliggenhet || 'Analysert bolig'
    const bolig_data: BoligData = {
      type: bolig.type || result.type,
      beliggenhet: bolig.beliggenhet || result.beliggenhet,
      soverom: bolig.soverom || result.soverom,
      bad: bolig.bad,
      areal: bolig.areal || result.areal,
      avstand_strand: bolig.avstand_strand || result.avstand_strand_m,
      basseng: bolig.basseng,
      parkering: bolig.parkering,
      havutsikt: bolig.havutsikt,
      standard: bolig.standard || result.bolig_standard,
      pris: bolig.pris || result.pris,
      ekstra: bolig.ekstra,
      markedspris_standard_m2: result.markedspris_standard_m2,
      markedspris_bra_m2: Number(bolig.markedspris_bra_m2) || result.markedspris_bra_m2,
      markedspris_luksus_m2: result.markedspris_luksus_m2,
      markedspris_begrunnelse: result.markedspris_begrunnelse,
      oppussing_vurdering: result.oppussing_vurdering,
      anbefalt_strategi: result.anbefalt_strategi,
      vft_score: result.vft_score,
    }
    const nytt: Prosjekt = {
      ...tomtProsjekt(),
      id: Date.now().toString(),
      navn,
      kategori,
      status: 'Under vurdering',
      kjøpesum: Number(bolig.pris) || result.pris || 0,
      oppussingsbudsjett: Number(bolig.oppbudsjett) || 0,
      lån_mnd: result.mnd_betaling || 0,
      notater:
        `Lagret fra Boliganalyse ${new Date().toLocaleDateString('nb-NO')}\n\n` +
        `Type: ${bolig.type || result.type || '-'}\n` +
        `Beliggenhet: ${bolig.beliggenhet || result.beliggenhet || '-'}\n` +
        `Soverom: ${bolig.soverom || result.soverom || '-'}\n` +
        `Areal: ${bolig.areal || result.areal || '-'} m²\n` +
        (airbnbScore ? `\nScore: ${airbnbScore.total}/10 ${airbnbScore.lys}\n` : '') +
        (result.ai_vurdering ? `\nAI-vurdering: ${result.ai_vurdering}` : ''),
      bolig_data,
      ai_vurdering: result.ai_vurdering || null,
      airbnb_analyse: airbnbAnalyse || null,
      airbnb_score: airbnbScore,
      airbnb_data: airbnbData,
    }
    const { error } = await supabase.from('prosjekter').insert([{ ...nytt, bruker: 'leganger' }])
    if (error) {
      setLagreMelding('❌ Feil ved lagring: ' + error.message)
    } else {
      setLagreMelding(`✅ Lagret som ${kategori === 'flipp' ? 'flipp-prosjekt' : 'utleieprosjekt'}! Finn det under "${kategori === 'flipp' ? 'Boligflipp' : 'Boligutleie'}" eller "Regnskap".`)
    }
    setTimeout(() => setLagreMelding(''), 5000)
  }

  return (
    <div>
      <button onClick={() => { onTilbake(); nullstill() }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 36 }}>🔍</div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Boliganalyse</h2>
          <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Analyser en ny eiendom og vurder potensial</p>
        </div>
      </div>
      <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 1 – Analyser boligen</div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Lim inn Finn.no-lenke eller beskriv eiendommen&#10;&#10;Eks: Villa 4 soverom, 180m², privat pool, 500m fra strand, €650 000, Marbella Golden Mile"
          style={{ width: '100%', height: 120, padding: 12, fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', resize: 'vertical', fontFamily: 'sans-serif' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={analyser} disabled={loading || !input} style={{ flex: 1, background: loading ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '⏳ Analyserer...' : '🔍 Analyser eiendom'}
          </button>
          {(input || result) && <button onClick={nullstill} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: '14px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🗑️ Nullstill</button>}
        </div>
      </div>
      {result && (
        <div>
          <div style={{ background: '#1a1a2e', color: 'white', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{result.type} · {result.beliggenhet}</div>
            <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>{result.tittel}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[{ lbl: 'Pris', val: fmt(result.pris ?? 0) }, { lbl: 'Egenkapital', val: fmt(result.ek_krav ?? 0) }, { lbl: 'Mnd. betaling', val: fmt(result.mnd_betaling ?? 0) }, { lbl: 'Yield', val: fmtPct(result.yield_estimat ?? 0) }].map((item, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{item.lbl}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 6 }}>🤖 AI-vurdering</div>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', margin: 0 }}>{result.ai_vurdering}</p>
          </div>
          {result.vft_score !== undefined && (
            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>🏛️ VFT-turistlisens</div>
                <div style={{ background: result.vft_score >= 60 ? '#e8f5ed' : result.vft_score >= 35 ? '#fff8e1' : '#fde8ec', color: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#B05E0A' : '#C8102E', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{result.vft_score}/100</div>
              </div>
              <div style={{ background: '#f0f0f0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ width: result.vft_score + '%', height: 8, background: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#EF9F27' : '#C8102E', borderRadius: 6 }} />
              </div>
            </div>
          )}
          {visSkjema && (
            <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 2 – Fyll inn og sjekk info</div>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Vi har fylt inn det vi fant. Sjekk og legg til det som mangler.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { key: 'type', lbl: 'Type bolig', placeholder: 'Villa / Leilighet', type: 'text' },
                  { key: 'beliggenhet', lbl: 'By og område', placeholder: 'Marbella', type: 'text' },
                  { key: 'soverom', lbl: 'Soverom', placeholder: '4', type: 'number' },
                  { key: 'bad', lbl: 'Bad', placeholder: '3', type: 'number' },
                  { key: 'areal', lbl: 'Areal (m²)', placeholder: '180', type: 'number' },
                  { key: 'avstand_strand', lbl: 'Avstand strand (m)', placeholder: '300', type: 'number' },
                  { key: 'pris', lbl: 'Kjøpspris (€)', placeholder: '650000', type: 'number' },
                  { key: 'markedspris_bra_m2', lbl: 'Markedspris bra std (€/m²)', placeholder: '3000', type: 'number' },
                  { key: 'ekstra', lbl: 'Ekstra info', placeholder: 'Pool, terrasse, golf...', type: 'text' },
                ].map((f, i) => (
                  <div key={i} style={fieldStyle}>
                    <label style={labelStyle}>{f.lbl}</label>
                    <input
                      style={inputStyle}
                      type={f.type}
                      value={(bolig as unknown as Record<string, string>)[f.key]}
                      onChange={e => setBolig(b => ({ ...b, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
                {[
                  { key: 'basseng', lbl: 'Basseng', opts: [['privat', 'Privat basseng'], ['felles', 'Felles basseng'], ['ingen', 'Ingen basseng']] },
                  { key: 'parkering', lbl: 'Parkering', opts: [['garasje', 'Garasje'], ['privat', 'Privat'], ['felles', 'Felles'], ['ingen', 'Ingen']] },
                  { key: 'havutsikt', lbl: 'Havutsikt', opts: [['ja', 'Full havutsikt'], ['delvis', 'Delvis'], ['nei', 'Nei']] },
                  { key: 'standard', lbl: 'Standard', opts: [['luksus', 'Luksus'], ['moderne', 'Moderne'], ['standard', 'Standard'], ['oppussing', 'Trenger oppussing']] },
                ].map((f, i) => (
                  <div key={i} style={fieldStyle}>
                    <label style={labelStyle}>{f.lbl}</label>
                    <select
                      style={selectStyle}
                      value={(bolig as unknown as Record<string, string>)[f.key]}
                      onChange={e => setBolig(b => ({ ...b, [f.key]: e.target.value }))}
                    >
                      {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 3 – Oppussingsbudsjett (valgfritt)</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="number" value={bolig.oppbudsjett} onChange={e => setBolig(b => ({ ...b, oppbudsjett: e.target.value }))} placeholder="F.eks. 100000" style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd' }} />
                  <span style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>euro</span>
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 4 – Kjør full analyse</div>
              <button onClick={kjørAirbnbAnalyse} disabled={airbnbLoading} style={{ width: '100%', background: airbnbLoading ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 16, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: airbnbLoading ? 'not-allowed' : 'pointer' }}>
                {airbnbLoading ? '⏳ Analyserer – 20-30 sekunder...' : '🚀 Kjør full analyse og få score'}
              </button>
            </div>
          )}
          {airbnbScore && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 5 – Score og trafikklys</div>
              <ScoreKort s={airbnbScore} />
            </div>
          )}
          {airbnbAnalyse && (
            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12 }}>📊 Fullstendig analyse</div>
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#222' }}>{airbnbAnalyse}</div>
            </div>
          )}
          <div style={{ background: '#f0f7ff', border: '2px solid #185FA544', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#185FA5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hva vil du gjøre med denne boligen?</div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 14, marginTop: 4 }}>Lagre boligen som et prosjekt – den blir lagt til i riktig kategori og vises også i Regnskap.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <button onClick={() => lagreAnalyseSomProsjekt('flipp')} style={{ background: '#185FA5', color: 'white', border: 'none', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🔨 Lagre som flipp-prosjekt</button>
              <button onClick={() => lagreAnalyseSomProsjekt('utleie')} style={{ background: '#2D7D46', color: 'white', border: 'none', borderRadius: 8, padding: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🏖️ Lagre som utleieprosjekt</button>
            </div>
            {lagreMelding && (
              <div style={{ marginTop: 12, padding: 12, background: lagreMelding.startsWith('✅') ? '#e8f5ed' : '#fde8ec', border: `1.5px solid ${lagreMelding.startsWith('✅') ? '#2D7D46' : '#C8102E'}`, borderRadius: 8, fontSize: 13, color: lagreMelding.startsWith('✅') ? '#1a4d2b' : '#7a0c1e', fontWeight: 500 }}>
                {lagreMelding}
              </div>
            )}
          </div>
          <button onClick={nullstill} style={{ width: '100%', background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, marginBottom: 32 }}>🗑️ Nullstill og analyser ny eiendom</button>
        </div>
      )}
    </div>
  )
}
