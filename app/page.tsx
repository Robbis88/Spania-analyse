'use client'
import { useState } from 'react'

const PASSORD = 'Isabella26'

export default function Home() {
  const [loggetInn, setLoggetInn] = useState(false)
  const [passordInput, setPassordInput] = useState('')
  const [passordFeil, setPassordFeil] = useState(false)
  const [aktivSeksjon, setAktivSeksjon] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [airbnbLoading, setAirbnbLoading] = useState(false)
  const [airbnbAnalyse, setAirbnbAnalyse] = useState('')
  const [airbnbScore, setAirbnbScore] = useState<any>(null)
  const [visSkjema, setVisSkjema] = useState(false)
  const [bolig, setBolig] = useState({
    type: '', beliggenhet: '', soverom: '', bad: '',
    areal: '', avstand_strand: '', basseng: 'felles',
    parkering: 'privat', havutsikt: 'nei', standard: 'moderne',
    pris: '', ekstra: '', markedspris_bra_m2: '', oppbudsjett: ''
  })

  function loggInn() {
    if (passordInput === PASSORD) {
      setLoggetInn(true)
      setPassordFeil(false)
    } else {
      setPassordFeil(true)
    }
  }

  async function analyser() {
    setLoading(true)
    setResult(null)
    setAirbnbAnalyse('')
    setAirbnbScore(null)
    setVisSkjema(false)
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyText: input })
      })
      const data = await res.json()
      setResult(data)
      setBolig({
        type: data.type || '',
        beliggenhet: data.beliggenhet || '',
        soverom: data.soverom?.toString() || '',
        bad: '',
        areal: data.areal?.toString() || '',
        avstand_strand: data.avstand_strand_m?.toString() || '',
        basseng: 'felles',
        parkering: 'privat',
        havutsikt: 'nei',
        standard: data.bolig_standard || 'moderne',
        pris: data.pris?.toString() || '',
        ekstra: '',
        markedspris_bra_m2: data.markedspris_bra_m2?.toString() || '',
        oppbudsjett: ''
      })
      setVisSkjema(true)
    } catch {
      setResult({ ai_vurdering: 'Noe gikk galt, prøv igjen.' })
    }
    setLoading(false)
  }

  async function kjørAirbnbAnalyse() {
    setAirbnbLoading(true)
    setAirbnbAnalyse('')
    setAirbnbScore(null)
    try {
      const res = await fetch('/api/airbnb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolig })
      })
      const data = await res.json()
      setAirbnbAnalyse(data.analyse || '')
      setAirbnbScore(data.score || null)
    } catch {
      setAirbnbAnalyse('Noe gikk galt, prøv igjen.')
    }
    setAirbnbLoading(false)
  }

  function nullstill() {
    setInput('')
    setResult(null)
    setAirbnbAnalyse('')
    setAirbnbScore(null)
    setVisSkjema(false)
  }

  const fmt = (n: number) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'
  const fmtPct = (n: number) => n ? n.toFixed(1) + '%' : '–'

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'sans-serif' }
  const selectStyle = { width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd' }
  const labelStyle = { fontSize: 12, color: '#666', marginBottom: 5, display: 'block' as const }
  const fieldStyle = { display: 'flex', flexDirection: 'column' as const }

  const ScoreKort = ({ s }: { s: any }) => (
    <div style={{
      background: s.lys === '🟢' ? '#e8f5ed' : s.lys === '🟡' ? '#fff8e1' : '#fde8ec',
      border: `2px solid ${s.lys === '🟢' ? '#2D7D46' : s.lys === '🟡' ? '#B05E0A' : '#C8102E'}`,
      borderRadius: 16, padding: 24, marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 56 }}>{s.lys}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.lys === '🟢' ? '#1a4d2b' : s.lys === '🟡' ? '#6b3a0a' : '#7a0c1e' }}>{s.lysTekst}</div>
          <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{s.lysInfo}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: s.lys === '🟢' ? '#1a4d2b' : s.lys === '🟡' ? '#6b3a0a' : '#7a0c1e' }}>{s.total}</div>
          <div style={{ fontSize: 12, color: '#888' }}>/ 10</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { lbl: '📍 Lokasjon', val: s.lokasjon },
          { lbl: '🏠 Eiendom', val: s.eiendom },
          { lbl: '💰 Pris vs marked', val: s.pris_vs_marked },
          { lbl: '📈 Airbnb', val: s.airbnb_potensial },
          { lbl: '💸 Cashflow', val: s.cashflow },
          { lbl: '🔨 Oppussing', val: s.oppussing_potensial },
          { lbl: '⚠️ Risiko', val: s.risiko },
        ].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.75)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#B05E0A' : '#C8102E' }}>{item.val}</div>
            <div style={{ background: '#e0e0e0', borderRadius: 3, height: 4, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ width: `${item.val * 10}%`, height: 4, background: item.val >= 7 ? '#2D7D46' : item.val >= 5 ? '#EF9F27' : '#C8102E', borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { lbl: 'Brutto år 1', val: fmt(s.brutto_ar1) },
          { lbl: 'Brutto etablert', val: fmt(s.brutto_etablert) },
          { lbl: 'Netto estimat', val: fmt(s.netto_estimat) },
        ].map((item, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2D7D46' }}>{item.val}</div>
          </div>
        ))}
      </div>
      {(s.maks_oppussing_5pst > 0 || s.maks_oppussing_6pst > 0 || s.maks_oppussing_7pst > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🔨 Maks oppussingsbudsjett</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { lbl: 'Ved 5% yield', val: s.maks_oppussing_5pst },
              { lbl: 'Ved 6% yield', val: s.maks_oppussing_6pst },
              { lbl: 'Ved 7% yield', val: s.maks_oppussing_7pst },
            ].map((item, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{item.lbl}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.val > 0 ? '#2D7D46' : '#C8102E' }}>{fmt(item.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {s.tips && s.tips.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>💡 Hva må til for grønn?</div>
          {s.tips.map((t: string, i: number) => (
            <div key={i} style={{ fontSize: 13, padding: '4px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>→ {t}</div>
          ))}
        </div>
      )}
    </div>
  )

  if (!loggetInn) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f8', fontFamily: 'sans-serif' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏡</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Leganger Eiendom</h1>
            <p style={{ color: '#666', marginTop: 8, fontSize: 14 }}>Din partner for eiendomsinvestering i Spania</p>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: '#666', marginBottom: 6, display: 'block' }}>Passord</label>
            <input
              type="password"
              value={passordInput}
              onChange={e => setPassordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loggInn()}
              placeholder="Skriv inn passord"
              style={{ width: '100%', padding: '12px 14px', fontSize: 15, borderRadius: 8, border: passordFeil ? '2px solid #C8102E' : '1.5px solid #ddd', fontFamily: 'sans-serif' }}
            />
            {passordFeil && (
              <div style={{ color: '#C8102E', fontSize: 13, marginTop: 6 }}>Feil passord, prøv igjen.</div>
            )}
          </div>
          <button
            onClick={loggInn}
            style={{ width: '100%', background: '#C8102E', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Logg inn
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px', fontFamily: 'sans-serif' }}>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏡</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Leganger Eiendom</h1>
        <p style={{ color: '#666', marginTop: 8 }}>Din partner for eiendomsinvestering i Spania</p>
        <button onClick={() => { setLoggetInn(false); setAktivSeksjon(null) }} style={{ marginTop: 8, background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer' }}>Logg ut</button>
      </div>

      {/* FORSIDE – FIRE BOKSER */}
      {!aktivSeksjon && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          {[
            { id: 'flipp', emoji: '🔨', tittel: 'Boligflipp', beskrivelse: 'Analyser kjøp, oppussing og videresalg for maksimal gevinst', farge: '#185FA5', bg: '#f0f7ff' },
            { id: 'utleie', emoji: '🏖️', tittel: 'Boligutleie', beskrivelse: 'Analyser Airbnb-potensial, leieinntekter og investorscore', farge: '#C8102E', bg: '#fff5f5' },
            { id: 'selge', emoji: '💰', tittel: 'Selge bolig', beskrivelse: 'Analyser markedsverdi og beste salgsstrategi', farge: '#2D7D46', bg: '#f0faf4' },
            { id: 'regnskap', emoji: '📊', tittel: 'Regnskap', beskrivelse: 'Oversikt over inntekter, kostnader og lønnsomhet', farge: '#7B2D8B', bg: '#f9f0ff' },
          ].map((boks, i) => (
            <div
              key={i}
              onClick={() => setAktivSeksjon(boks.id)}
              style={{ background: boks.bg, border: `2px solid ${boks.farge}22`, borderRadius: 16, padding: 28, cursor: 'pointer', textAlign: 'center' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>{boks.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: boks.farge, marginBottom: 8 }}>{boks.tittel}</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 16 }}>{boks.beskrivelse}</div>
              <div style={{ background: boks.farge, color: 'white', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>Åpne →</div>
            </div>
          ))}
        </div>
      )}

      {/* BOLIGUTLEIE */}
      {aktivSeksjon === 'utleie' && (
        <div>
          <button onClick={() => { setAktivSeksjon(null); nullstill() }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>
            ← Tilbake
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 36 }}>🏖️</div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Boligutleie – Spania</h2>
              <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Analyser Airbnb-potensial og investorscore</p>
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
              <button
                onClick={analyser}
                disabled={loading || !input}
                style={{ flex: 1, background: loading ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? '⏳ Analyserer...' : '🔍 Analyser eiendom'}
              </button>
              {(input || result) && (
                <button onClick={nullstill} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: '14px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  🗑️ Nullstill
                </button>
              )}
            </div>
          </div>

          {result && (
            <div>
              <div style={{ background: '#1a1a2e', color: 'white', borderRadius: 12, padding: 24, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{result.type} · {result.beliggenhet}</div>
                <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>{result.tittel}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                  {[
                    { lbl: 'Pris', val: fmt(result.pris) },
                    { lbl: 'Egenkapital', val: fmt(result.ek_krav) },
                    { lbl: 'Mnd. betaling', val: fmt(result.mnd_betaling) },
                    { lbl: 'Yield', val: fmtPct(result.yield_estimat) },
                  ].map((item, i) => (
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

              <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>🏛️ VFT-turistlisens</div>
                  <div style={{
                    background: result.vft_score >= 60 ? '#e8f5ed' : result.vft_score >= 35 ? '#fff8e1' : '#fde8ec',
                    color: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#B05E0A' : '#C8102E',
                    padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700
                  }}>{result.vft_score}/100</div>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: result.vft_score + '%', height: 8, background: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#EF9F27' : '#C8102E', borderRadius: 6 }} />
                </div>
              </div>

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
                          value={(bolig as any)[f.key]}
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
                        <select style={selectStyle} value={(bolig as any)[f.key]} onChange={e => setBolig(b => ({ ...b, [f.key]: e.target.value }))}>
                          {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 3 – Oppussingsbudsjett (valgfritt)</div>
                    <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Legg inn budsjett så beregner vi maks du kan bruke og fortsatt ha lønnsom utleie.</p>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <input
                        type="number"
                        value={bolig.oppbudsjett}
                        onChange={e => setBolig(b => ({ ...b, oppbudsjett: e.target.value }))}
                        placeholder="F.eks. 100000"
                        style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #ddd' }}
                      />
                      <span style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>euro</span>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 600, color: '#C8102E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steg 4 – Kjør full analyse</div>
                  <button
                    onClick={kjørAirbnbAnalyse}
                    disabled={airbnbLoading}
                    style={{ width: '100%', background: airbnbLoading ? '#999' : '#C8102E', color: 'white', border: 'none', padding: 16, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: airbnbLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {airbnbLoading ? '⏳ Analyserer – 20-30 sekunder...' : '🚀 Kjør Airbnb-analyse og få score'}
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12 }}>📊 Fullstendig Airbnb-analyse</div>
                  <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#222' }}>{airbnbAnalyse}</div>
                </div>
              )}

              <button onClick={nullstill} style={{ width: '100%', background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, marginBottom: 32 }}>
                🗑️ Nullstill og analyser ny eiendom
              </button>
            </div>
          )}
        </div>
      )}

      {/* BOLIGFLIPP */}
      {aktivSeksjon === 'flipp' && (
        <div>
          <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>
            ← Tilbake
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 36 }}>🔨</div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Boligflipp</h2>
              <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Analyser kjøp, oppussing og videresalg</p>
            </div>
          </div>
          <div style={{ background: '#f0f7ff', border: '2px dashed #b8d4f4', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Under utvikling</div>
            <div style={{ fontSize: 14 }}>Boligflipp-analysen kommer i neste versjon!</div>
          </div>
        </div>
      )}

      {/* SELGE BOLIG */}
      {aktivSeksjon === 'selge' && (
        <div>
          <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>
            ← Tilbake
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 36 }}>💰</div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Selge bolig</h2>
              <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Analyser markedsverdi og salgsstrategi</p>
            </div>
          </div>
          <div style={{ background: '#f0faf4', border: '2px dashed #b8dfc7', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Under utvikling</div>
            <div style={{ fontSize: 14 }}>Selge bolig-analysen kommer i neste versjon!</div>
          </div>
        </div>
      )}

      {/* REGNSKAP */}
      {aktivSeksjon === 'regnskap' && (
        <div>
          <button onClick={() => setAktivSeksjon(null)} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>
            ← Tilbake
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ fontSize: 36 }}>📊</div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Regnskap</h2>
              <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Oversikt over inntekter, kostnader og lønnsomhet</p>
            </div>
          </div>
          <div style={{ background: '#f9f0ff', border: '2px dashed #d4b8f4', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Under utvikling</div>
            <div style={{ fontSize: 14 }}>Regnskapsmodulen kommer i neste versjon!</div>
          </div>
        </div>
      )}

    </main>
  )
}