'use client'
import { useState } from 'react'

export default function Home() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [oppbudsjett, setOppbudsjett] = useState('')

  async function analyser() {
    setLoading(true)
    setResult(null)
    setOppbudsjett('')
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyText: input })
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ ai_vurdering: 'Noe gikk galt, prøv igjen.' })
    }
    setLoading(false)
  }

  function nullstill() {
    setInput('')
    setResult(null)
    setOppbudsjett('')
  }

  const fmt = (n: number) => n ? '€' + Math.round(n).toLocaleString('nb-NO') : '–'
  const fmtPct = (n: number) => n ? n.toFixed(1) + '%' : '–'

  const oppussingsAnalyse = () => {
    if (!oppbudsjett || !result?.pris || !result?.areal) return null
    const budsjett = Number(oppbudsjett)
    const total = result.pris + budsjett
    const pris_per_m2_etter = Math.round(total / result.areal)
    const gevinst_standard = result.markedspris_standard_m2 > 0
      ? Math.round(result.markedspris_standard_m2 * result.areal - total) : 0
    const gevinst_bra = result.markedspris_bra_m2 > 0
      ? Math.round(result.markedspris_bra_m2 * result.areal - total) : 0
    const gevinst_luksus = result.markedspris_luksus_m2 > 0
      ? Math.round(result.markedspris_luksus_m2 * result.areal - total) : 0
    return { budsjett, total, pris_per_m2_etter, gevinst_standard, gevinst_bra, gevinst_luksus }
  }

  const opp = oppussingsAnalyse()

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px', fontFamily: 'sans-serif' }}>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🇪🇸</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Spania Eiendomsanalysator</h1>
        <p style={{ color: '#666', marginTop: 8 }}>Lim inn Finn.no-lenke eller beskriv eiendommen</p>
      </div>

      <div style={{ background: '#f8f8f8', borderRadius: 12, padding: 20, marginBottom: 24 }}>
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
            <button
              onClick={nullstill}
              style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: '14px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
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

          {result.airbnb && (
            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🏠 Airbnb-potensial</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { lbl: '🌞 Høysesong', natt: result.airbnb.pris_natt_hoysesong, inntekt: result.airbnb.inntekt_hoysesong, period: 'jun–sep' },
                  { lbl: '🌤 Skulder', natt: result.airbnb.pris_natt_skulder, inntekt: result.airbnb.inntekt_skulder, period: 'apr–mai, okt' },
                  { lbl: '❄️ Lavsesong', natt: result.airbnb.pris_natt_lavsesong, inntekt: result.airbnb.inntekt_lavsesong, period: 'nov–mar' },
                ].map((s, i) => (
                  <div key={i} style={{ background: '#f8f8f8', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{s.lbl}</div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{s.period}</div>
                    <div style={{ fontSize: 13 }}>Natt: <strong>{fmt(s.natt)}</strong></div>
                    <div style={{ fontSize: 13 }}>Inntekt: <strong style={{ color: '#2D7D46' }}>{fmt(s.inntekt)}</strong></div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f0faf4', borderRadius: 8, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[
                  { lbl: 'Brutto per år', val: fmt(result.airbnb.total_arsinntekt) },
                  { lbl: 'Etter gebyr', val: fmt(result.airbnb.etter_plattformgebyr) },
                  { lbl: 'Etter drift', val: fmt(result.airbnb.etter_drift) },
                  { lbl: 'Netto per mnd', val: fmt(result.airbnb.netto_per_mnd) },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, color: '#666' }}>{s.lbl}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2D7D46' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.areal > 0 && result.markedspris_bra_m2 > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔨 Oppussingskalkulator</h3>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                Kjøpt til <strong>{result.pris > 0 ? Math.round(result.pris / result.areal).toLocaleString('nb-NO') : '–'} €/m²</strong>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                {[
                  { lbl: '🏠 Standard', m2: result.markedspris_standard_m2, farge: '#185FA5' },
                  { lbl: '⭐ Bra', m2: result.markedspris_bra_m2, farge: '#B05E0A' },
                  { lbl: '💎 Luksus', m2: result.markedspris_luksus_m2, farge: '#2D7D46' },
                ].map((s, i) => (
                  <div key={i} style={{ background: '#f8f8f8', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.farge, marginBottom: 6 }}>{s.lbl}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{s.m2 > 0 ? s.m2.toLocaleString('nb-NO') + ' €/m²' : '–'}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>≈ {fmt(s.m2 * result.areal)}</div>
                  </div>
                ))}
              </div>

              {result.markedspris_begrunnelse && (
                <div style={{ background: '#f0f7ff', border: '1px solid #b8d4f4', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13, color: '#185FA5', lineHeight: 1.6 }}>
                  💡 {result.markedspris_begrunnelse}
                </div>
              )}

              {result.oppussing_vurdering && (
                <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
                  {result.oppussing_vurdering}
                </div>
              )}

              <div style={{ background: '#f0f7ff', border: '1px solid #b8d4f4', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>💰 Legg inn oppussingsbudsjett</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={oppbudsjett}
                    onChange={e => setOppbudsjett(e.target.value)}
                    placeholder="F.eks. 100000"
                    style={{ flex: 1, padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1.5px solid #b8d4f4' }}
                  />
                  <span style={{ fontSize: 13, color: '#666' }}>euro</span>
                </div>

                {opp && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      <div style={{ background: 'white', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#666' }}>Total investering</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(opp.total)}</div>
                      </div>
                      <div style={{ background: 'white', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#666' }}>Pris/m² etter oppussing</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{opp.pris_per_m2_etter.toLocaleString('nb-NO')} €</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                      {[
                        { lbl: '🏠 Standard', gevinst: opp.gevinst_standard, farge: '#185FA5' },
                        { lbl: '⭐ Bra', gevinst: opp.gevinst_bra, farge: '#B05E0A' },
                        { lbl: '💎 Luksus', gevinst: opp.gevinst_luksus, farge: '#2D7D46' },
                      ].map((s, i) => (
                        <div key={i} style={{ background: 'white', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: s.farge, marginBottom: 6 }}>{s.lbl}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: s.gevinst > 0 ? '#2D7D46' : '#C8102E' }}>
                            {s.gevinst > 0 ? '+' : ''}{fmt(s.gevinst)}
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
                            ROI {opp.total > 0 ? ((s.gevinst / opp.total) * 100).toFixed(1) : 0}%
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{
                      background: opp.gevinst_bra > 0 ? '#e8f5ed' : '#fde8ec',
                      border: `1px solid ${opp.gevinst_bra > 0 ? '#b8dfc7' : '#f5a3b0'}`,
                      borderRadius: 8, padding: 14, fontSize: 14,
                      color: opp.gevinst_bra > 0 ? '#1a4d2b' : '#7a0c1e',
                      fontWeight: 500
                    }}>
                      {opp.gevinst_luksus > 0
                        ? `✅ Med luksusoppussing kan du tjene ${fmt(opp.gevinst_luksus)} på videresalg!`
                        : opp.gevinst_bra > 0
                        ? `✅ Med bra-standard kan du tjene ${fmt(opp.gevinst_bra)} på videresalg!`
                        : opp.gevinst_standard > 0
                        ? `⚠️ Kun lønnsomt med standard oppussing. Gevinst: ${fmt(opp.gevinst_standard)}`
                        : '❌ Med dette budsjettet dekker ikke salgsverdien investeringen. Forhandle ned kjøpspris eller reduser budsjett.'
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🏛️ VFT-turistlisens</h3>
              <div style={{
                background: result.vft_score >= 60 ? '#e8f5ed' : result.vft_score >= 35 ? '#fff8e1' : '#fde8ec',
                color: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#B05E0A' : '#C8102E',
                padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 700
              }}>
                {result.vft_score}/100
              </div>
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{ width: result.vft_score + '%', height: 8, background: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#EF9F27' : '#C8102E', borderRadius: 6 }} />
            </div>
          </div>

          <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🤖 AI-vurdering</h3>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: '#333', margin: 0 }}>{result.ai_vurdering}</p>
          </div>

          {result.anbefalt_strategi && (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 12, padding: 16, marginBottom: 16, fontSize: 14 }}>
              <strong>💡 Anbefalt strategi:</strong> {result.anbefalt_strategi}
            </div>
          )}

          {result.neste_steg && (
            <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>✅ Neste steg</h3>
              {result.neste_steg.map((s: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#C8102E', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>{s}</div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={nullstill}
            style={{ width: '100%', background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
          >
            🗑️ Nullstill og analyser ny eiendom
          </button>

        </div>
      )}
    </main>
  )
}