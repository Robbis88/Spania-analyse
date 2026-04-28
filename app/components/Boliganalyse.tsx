'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { type AirbnbData, type Bolig, type BoligData, tomBolig, tomtProsjekt, type Prosjekt } from '../types'
import { inputStyle, selectStyle, labelStyle, fieldStyle, fmt, fmtPct } from '../lib/styles'
import { ScoreKort, type Score } from './ScoreKort'
import { byggProsjektPdf } from '../lib/pdf'
import { visToast } from '../lib/toast'

function lastNedBase64Pdf(base64: string, filnavn: string) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filnavn
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

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
  const [steg, setSteg] = useState<'idle' | 'analyserer' | 'utleie' | 'ferdig'>('idle')
  const [airbnbAnalyse, setAirbnbAnalyse] = useState('')
  const [airbnbScore, setAirbnbScore] = useState<Score | null>(null)
  const [airbnbData, setAirbnbData] = useState<AirbnbData | null>(null)
  const [visSkjema, setVisSkjema] = useState(false)
  const [lagreMelding, setLagreMelding] = useState('')
  const [bolig, setBolig] = useState<Bolig>(tomBolig())
  const [lagretId, setLagretId] = useState<string | null>(null)
  const [pdfLaster, setPdfLaster] = useState(false)

  function nullstill() {
    setInput(''); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null); setVisSkjema(false); setLagreMelding(''); setSteg('idle')
    setLagretId(null); setPdfLaster(false)
  }

  async function lastNedPdf(id: string) {
    setPdfLaster(true)
    try {
      const data = await byggProsjektPdf(id, supabase)
      if (!data) {
        visToast('Klarte ikke å bygge PDF', 'feil')
      } else {
        lastNedBase64Pdf(data.base64, data.filnavn)
        visToast('PDF lastet ned: ' + data.filnavn, 'suksess', 3500)
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Ukjent feil'
      visToast('PDF-bygging feilet: ' + m, 'feil', 4000)
    }
    setPdfLaster(false)
  }

  function apneChatMedProsjekt(id: string) {
    window.dispatchEvent(new CustomEvent<{ prosjektId: string }>('app-open-chat', {
      detail: { prosjektId: id },
    }))
  }

  async function kjørAirbnbAnalyse(boligForAnalyse: Bolig) {
    setAirbnbLoading(true); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null)
    try {
      const res = await fetch('/api/airbnb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bolig: boligForAnalyse }) })
      const data = await res.json()
      setAirbnbAnalyse(data.analyse || ''); setAirbnbScore(data.score || null); setAirbnbData(data.data || null)
    } catch {
      setAirbnbAnalyse('Noe gikk galt, prøv igjen.')
    }
    setAirbnbLoading(false)
  }

  async function analyser() {
    setLoading(true); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null); setVisSkjema(false); setLagreMelding('')
    setSteg('analyserer')
    try {
      const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyText: input }) })
      const data: AnalyseResultat = await res.json()
      setResult(data)
      const nyBolig: Bolig = {
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
      }
      setBolig(nyBolig)
      setVisSkjema(true)
      setLoading(false)

      // Kjør utleieanalyse umiddelbart i samme flyt
      setSteg('utleie')
      await kjørAirbnbAnalyse(nyBolig)
      setSteg('ferdig')
    } catch {
      setResult({ ai_vurdering: 'Noe gikk galt, prøv igjen.' })
      setLoading(false)
      setSteg('idle')
    }
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
    const bruker = hentAktivBruker() || 'ukjent'
    const { error } = await supabase.from('prosjekter').insert([{ ...nytt, bruker }])
    if (error) {
      setLagreMelding('❌ Feil ved lagring: ' + error.message)
      setTimeout(() => setLagreMelding(''), 5000)
      return
    }
    await loggAktivitet({ handling: 'lagret ny bolig fra Boliganalyse', tabell: 'prosjekter', rad_id: nytt.id, detaljer: { navn, kategori } })
    setLagretId(nytt.id)
    setLagreMelding(`✅ Lagret som ${kategori === 'flipp' ? 'flipp-prosjekt' : 'utleieprosjekt'} med status «Under vurdering». Henter PDF...`)
    // Auto-last ned PDF i samme flyt slik brukeren har en fysisk fil
    void lastNedPdf(nytt.id)
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
      <div style={{ background: '#f8f8f8', borderRadius: 6, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#b89a6f', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lim inn bolig-info</div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Lim inn Finn.no-lenke eller beskriv eiendommen&#10;&#10;Eks: Villa 4 soverom, 180m², privat pool, 500m fra strand, €650 000, Marbella Golden Mile"
          style={{ width: '100%', height: 120, padding: 12, fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', resize: 'vertical', fontFamily: 'sans-serif' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={analyser} disabled={loading || airbnbLoading || !input} style={{ flex: 1, background: (loading || airbnbLoading) ? '#888' : '#0e1726', color: 'white', border: 'none', padding: 14, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: (loading || airbnbLoading) ? 'not-allowed' : 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {steg === 'analyserer' && '⏳ Analyserer bolig...'}
            {steg === 'utleie' && '⏳ Kjører utleieanalyse (20–30 s)...'}
            {(steg === 'idle' || steg === 'ferdig') && '🚀 Kjør full analyse'}
          </button>
          {(input || result) && <button onClick={nullstill} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: '14px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>🗑️ Nullstill</button>}
        </div>
      </div>
      {result && (
        <div>
          <div style={{ background: '#0e1726', color: 'white', borderRadius: 6, padding: 24, marginBottom: 16 }}>
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
          <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 6 }}>🤖 AI-vurdering</div>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', margin: 0 }}>{result.ai_vurdering}</p>
          </div>
          {result.vft_score !== undefined && (
            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 24 }}>
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
            <div style={{ background: '#f8f8f8', borderRadius: 6, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#b89a6f', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sjekk og korriger detaljer (valgfritt)</div>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>Vi har fylt inn det vi fant. Hvis du korrigerer noe under, klikk &quot;Oppdater analyse&quot; nederst for å kjøre utleieanalysen på nytt med de nye verdiene.</p>
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
              <button onClick={() => kjørAirbnbAnalyse(bolig)} disabled={airbnbLoading}
                style={{ width: '100%', background: airbnbLoading ? '#888' : '#0e1726', color: 'white', border: 'none', padding: 12, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: airbnbLoading ? 'not-allowed' : 'pointer', marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {airbnbLoading ? '⏳ Oppdaterer...' : '🔄 Oppdater analyse med korrigerte verdier'}
              </button>
            </div>
          )}
          {airbnbScore && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#b89a6f', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score og trafikklys</div>
              <ScoreKort s={airbnbScore} />
            </div>
          )}
          {airbnbAnalyse && (
            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12 }}>📊 Fullstendig analyse</div>
              <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#222' }}>{airbnbAnalyse}</div>
            </div>
          )}
          <div style={{ background: '#fdfcf7', border: '1px solid #b89a6f33', borderRadius: 6, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0e1726', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legg til som bolig til vurdering</div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 14, marginTop: 4 }}>Boligen lagres med status «Under vurdering» og en fullverdig PDF-analyse lastes ned automatisk. PDF-en kan sendes til megler/bank fra chat-roboten — boligen blir liggende der til du sletter den eller endrer status.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <button onClick={() => lagreAnalyseSomProsjekt('utleie')} disabled={!!lagretId} style={{ background: lagretId ? '#888' : '#0e1726', color: 'white', border: 'none', borderRadius: 6, padding: 14, fontSize: 12, fontWeight: 600, cursor: lagretId ? 'not-allowed' : 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Til vurdering — utleie</button>
              <button onClick={() => lagreAnalyseSomProsjekt('flipp')} disabled={!!lagretId} style={{ background: lagretId ? '#888' : 'transparent', color: lagretId ? 'white' : '#0e1726', border: '1px solid #b89a6f55', borderRadius: 6, padding: 14, fontSize: 12, fontWeight: 600, cursor: lagretId ? 'not-allowed' : 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Til vurdering — flipp</button>
            </div>
            {lagreMelding && (
              <div style={{ marginTop: 12, padding: 12, background: lagreMelding.startsWith('✅') ? '#e8f5ed' : '#fde8ec', border: `1.5px solid ${lagreMelding.startsWith('✅') ? '#2D7D46' : '#C8102E'}`, borderRadius: 8, fontSize: 13, color: lagreMelding.startsWith('✅') ? '#1a4d2b' : '#7a0c1e', fontWeight: 500 }}>
                {lagreMelding}
              </div>
            )}
            {lagretId && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #b89a6f33' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0e1726', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Send analysen videre</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <button onClick={() => lastNedPdf(lagretId)} disabled={pdfLaster}
                    style={{ background: pdfLaster ? '#888' : '#0e1726', color: 'white', border: 'none', borderRadius: 6, padding: 12, fontSize: 12, fontWeight: 600, cursor: pdfLaster ? 'not-allowed' : 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {pdfLaster ? '⏳ Bygger PDF...' : '📄 Last ned PDF igjen'}
                  </button>
                  <button onClick={() => apneChatMedProsjekt(lagretId)}
                    style={{ background: '#c9a876', color: 'white', border: 'none', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    📧 Send til megler / bank
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 10, lineHeight: 1.5 }}>Chat-roboten åpnes med boligen pre-valgt. Be den om å lage e-postutkast til megler eller bank — du får godkjenne før det sendes, og PDF-en blir lagt ved automatisk.</div>
              </div>
            )}
          </div>
          <button onClick={nullstill} style={{ width: '100%', background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, marginBottom: 32 }}>🗑️ Nullstill og analyser ny eiendom</button>
        </div>
      )}
    </div>
  )
}
