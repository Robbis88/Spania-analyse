'use client'
import { useState } from 'react'
import { useProsjekter } from '../lib/useProsjekter'
import type { Prosjekt, SalgInput } from '../types'
import { beregnSalg, månedligCashflow, totalInvestering } from '../lib/beregninger'
import { inputStyle, selectStyle, labelStyle, fieldStyle, fmt, statusFarge, FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { SalgsanalyseVisning } from './SalgsanalyseVisning'

type Markedsdata = {
  markedspris_bra_m2?: number
  pris?: number
  ai_vurdering?: string
  error?: string
}

const tilbakeStil: React.CSSProperties = {
  background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
  borderRadius: RADIUS.pill, padding: '8px 16px 8px 12px',
  fontSize: 13, cursor: 'pointer', marginBottom: 22,
  color: FARGER.tekstMid, fontWeight: 500,
  boxShadow: SHADOW.xs,
  display: 'inline-flex', alignItems: 'center', gap: 6,
  letterSpacing: '-0.005em',
  transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
}

const seksjonsKort: React.CSSProperties = {
  background: FARGER.hvit,
  border: `1px solid ${FARGER.kantUltralys}`,
  borderRadius: RADIUS.lg,
  padding: 22,
  marginBottom: 16,
  boxShadow: SHADOW.sm,
}

const eyebrowStil: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: FARGER.gull,
  marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.18em',
}

export function Selge({ onTilbake }: { onTilbake: () => void }) {
  const { prosjekter, laster, oppdater, hent } = useProsjekter()
  const [selgBolig, setSelgBolig] = useState<string | null>(null)
  const [salgInput, setSalgInput] = useState<SalgInput>({
    salgspris: 0, megler_pst: 5, advokat_pst: 1, plusvalia: 0, skatteresidens: 'eu', ventetid_ar: 0,
  })
  const [markedsprisLoading, setMarkedsprisLoading] = useState(false)
  const [markedsprisData, setMarkedsprisData] = useState<Markedsdata | null>(null)

  const eideBoliger = prosjekter.filter(p => p.status !== 'Under vurdering' && p.status !== 'Solgt')

  async function hentMarkedspris(p: Prosjekt) {
    setMarkedsprisLoading(true); setMarkedsprisData(null)
    try {
      const tekst = `Bolig i ${p.notater.includes('Beliggenhet:') ? (p.notater.split('Beliggenhet:')[1]?.split('\n')[0]?.trim() || p.navn) : p.navn}. Til salgs.`
      const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyText: tekst }) })
      const data = await res.json()
      setMarkedsprisData(data)
    } catch {
      setMarkedsprisData({ error: 'Kunne ikke hente markedspris' })
    }
    setMarkedsprisLoading(false)
  }

  async function markerSomSolgt(p: Prosjekt, salgspris: number) {
    if (!confirm(`Markere "${p.navn}" som solgt for €${salgspris.toLocaleString('nb-NO')}?`)) return
    await oppdater({
      ...p,
      status: 'Solgt',
      forventet_salgsverdi: salgspris,
      notater: (p.notater || '') + `\n\n--- Solgt ${new Date().toLocaleDateString('nb-NO')} for €${salgspris.toLocaleString('nb-NO')} ---`,
    })
    setSelgBolig(null)
  }

  if (selgBolig) {
    const p = prosjekter.find(pr => pr.id === selgBolig)
    if (!p) return null
    const s = beregnSalg(p, salgInput)
    const cf = månedligCashflow(p)
    const ventetidCashflow = cf * 12 * salgInput.ventetid_ar
    const sf = statusFarge(p.status)

    return (
      <div>
        <button onClick={() => setSelgBolig(null)} className="nav-lenke" style={tilbakeStil}>
          <span aria-hidden>←</span> Tilbake til liste
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>💰 Selge: {p.navn}</h2>
            <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: RADIUS.pill, display: 'inline-block', marginTop: 8 }}>{p.status}</span>
          </div>
        </div>

        <SalgsanalyseVisning prosjekt={p} onOppdatert={hent} />

        <div style={seksjonsKort}>
          <div style={eyebrowStil}>Steg 1 – Sett salgspris</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Ønsket salgspris (€)</label>
              <input style={inputStyle} type="number" value={salgInput.salgspris || ''} onChange={e => setSalgInput(s => ({ ...s, salgspris: Number(e.target.value) }))} placeholder={p.forventet_salgsverdi.toString()} />
            </div>
            <div style={{ ...fieldStyle, justifyContent: 'flex-end' }}>
              <button onClick={() => hentMarkedspris(p)} disabled={markedsprisLoading} className="knapp-hover-loft" style={{
                background: markedsprisLoading ? FARGER.tekstLys : FARGER.mork,
                color: FARGER.creamLys, border: 'none',
                borderRadius: RADIUS.pill, padding: '11px 18px',
                fontSize: 13, fontWeight: 600, cursor: markedsprisLoading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: SHADOW.sm,
                transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
              }}>
                {markedsprisLoading ? '⏳ Henter…' : '📊 Hent markedspris'}
              </button>
            </div>
          </div>
          {markedsprisData && !markedsprisData.error && (
            <div className="anim-fade-up" style={{ background: FARGER.flateLys, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.md, padding: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: FARGER.mork }}>📍 Markedsdata</div>
              {markedsprisData.markedspris_bra_m2 && <div>Markedspris per m²: <strong>€{markedsprisData.markedspris_bra_m2.toLocaleString('nb-NO')}</strong></div>}
              {markedsprisData.pris && <div>Estimert salgspris for tilsvarende: <strong>€{markedsprisData.pris.toLocaleString('nb-NO')}</strong></div>}
              {markedsprisData.ai_vurdering && <div style={{ marginTop: 8, color: FARGER.tekstMid, fontStyle: 'italic', lineHeight: 1.55 }}>{markedsprisData.ai_vurdering}</div>}
            </div>
          )}
          {markedsprisData?.error && <div style={{ color: FARGER.feil, fontSize: 13 }}>{markedsprisData.error}</div>}
        </div>

        <div style={seksjonsKort}>
          <div style={eyebrowStil}>Steg 2 – Salgskostnader og skatt</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Megler %</label>
              <input style={inputStyle} type="number" step="0.1" value={salgInput.megler_pst || ''} onChange={e => setSalgInput(s => ({ ...s, megler_pst: Number(e.target.value) }))} placeholder="5" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Advokat %</label>
              <input style={inputStyle} type="number" step="0.1" value={salgInput.advokat_pst || ''} onChange={e => setSalgInput(s => ({ ...s, advokat_pst: Number(e.target.value) }))} placeholder="1" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Plusvalía Municipal (€)</label>
              <input style={inputStyle} type="number" value={salgInput.plusvalia || ''} onChange={e => setSalgInput(s => ({ ...s, plusvalia: Number(e.target.value) }))} placeholder="0" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Skatteresidens</label>
              <select style={selectStyle} value={salgInput.skatteresidens} onChange={e => setSalgInput(s => ({ ...s, skatteresidens: e.target.value as 'eu' | 'ikke_eu' }))}>
                <option value="eu">🇪🇺 EU/EØS (19%)</option>
                <option value="ikke_eu">🌍 Ikke-EU (24%)</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 12, fontStyle: 'italic', lineHeight: 1.55 }}>
            💡 Plusvalía varierer per kommune og avhenger av valor catastral + eiertid. Spør kommunen (ayuntamiento) eller advokaten din for eksakt beløp.
          </div>
        </div>

        <div className="anim-fade-up" style={{
          background: s.nettoFortjeneste >= 0 ? '#e8f5ed' : '#fde8ec',
          border: `1px solid ${s.nettoFortjeneste >= 0 ? '#2D7D4633' : '#C8102E33'}`,
          borderRadius: RADIUS.xl,
          padding: 26, marginBottom: 16,
          boxShadow: SHADOW.md,
        }}>
          <div style={{ ...eyebrowStil, color: s.nettoFortjeneste >= 0 ? '#1a4d2b' : '#7a0c1e' }}>Steg 3 – Resultat</div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: FARGER.tekstMid, marginBottom: 6 }}>Netto fortjeneste etter alt</div>
            <div style={{ fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: 600, color: s.nettoFortjeneste >= 0 ? '#2D7D46' : '#C8102E', letterSpacing: '-0.03em', lineHeight: 1 }}>{fmt(s.nettoFortjeneste)}</div>
            <div style={{ fontSize: 14, color: FARGER.tekstMid, marginTop: 8 }}>ROI: <strong style={{ color: s.roiPst >= 0 ? '#2D7D46' : '#C8102E' }}>{s.roiPst.toFixed(1)}%</strong></div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.75)', borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: FARGER.mork, letterSpacing: '-0.005em' }}>💵 Inntekter fra salg</div>
            {[
              { lbl: 'Salgspris', val: fmt(s.salgspris) },
              { lbl: `Megler (${salgInput.megler_pst}%)`, val: '- ' + fmt(s.meglerBelop), farge: '#C8102E' },
              { lbl: `Advokat (${salgInput.advokat_pst}%)`, val: '- ' + fmt(s.advokatBelop), farge: '#C8102E' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', fontSize: 13 }}>
                <span>{r.lbl}</span><span style={{ fontWeight: 600, color: r.farge }}>{r.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', borderTop: `1px solid rgba(14,23,38,0.15)`, fontSize: 14, fontWeight: 700, marginTop: 6 }}>
              <span>Netto salgssum</span><span>{fmt(s.nettoSalgssum)}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.75)', borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: FARGER.mork, letterSpacing: '-0.005em' }}>🏛️ Spansk skatt</div>
            {([
              { lbl: 'Total kjøp + oppussing (fradrag)', val: fmt(s.totalKjop) },
              { lbl: 'Kapitalgevinst (grunnlag)', val: fmt(s.kapitalgevinst), bold: true },
              { lbl: `CGT ${(s.cgtSats * 100).toFixed(0)}% (IRNR, Modelo 210)`, val: '- ' + fmt(s.cgt), farge: '#C8102E' },
              { lbl: 'Plusvalía Municipal', val: '- ' + fmt(salgInput.plusvalia), farge: '#C8102E' },
            ] as const).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', fontSize: 13 }}>
                <span style={{ fontWeight: ('bold' in r && r.bold) ? 600 : 400 }}>{r.lbl}</span><span style={{ fontWeight: 600, color: ('farge' in r) ? r.farge : undefined }}>{r.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', borderTop: `1px solid rgba(14,23,38,0.15)`, fontSize: 14, fontWeight: 700, marginTop: 6 }}>
              <span>Total skatt</span><span style={{ color: '#C8102E' }}>{fmt(s.totalSkatt)}</span>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.75)', borderRadius: RADIUS.md, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: FARGER.mork, letterSpacing: '-0.005em' }}>💳 3% tilbakeholdelse (kjøper holder tilbake)</div>
            <div style={{ fontSize: 13.5, color: FARGER.tekstMid, lineHeight: 1.7 }}>
              Kjøper holder tilbake <strong>{fmt(s.retention3pst)}</strong> (3% av salgspris) som forskudd på CGT. Dette sendes til spanske skattemyndigheter via Modelo 211.
              <br /><br />
              {s.differanseRetention > 0 ? (
                <span>⚠️ CGT er høyere enn 3% retention. Du må betale <strong style={{ color: '#C8102E' }}>{fmt(s.differanseRetention)}</strong> ekstra via Modelo 210 (innen 4 måneder).</span>
              ) : s.differanseRetention < 0 ? (
                <span>✅ CGT er lavere enn 3% retention. Du får tilbake <strong style={{ color: '#2D7D46' }}>{fmt(Math.abs(s.differanseRetention))}</strong> når du leverer Modelo 210.</span>
              ) : (
                <span>Retention dekker akkurat CGT.</span>
              )}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: RADIUS.md, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: FARGER.mork, letterSpacing: '-0.005em' }}>📊 Oppsummering</div>
            {([
              { lbl: 'Salgspris', val: fmt(s.salgspris) },
              { lbl: '- Salgskostnader', val: fmt(s.salgskostnader), farge: '#C8102E' },
              { lbl: '- Total skatt', val: fmt(s.totalSkatt), farge: '#C8102E' },
              { lbl: '- Total investert (kjøp + oppussing + møblering)', val: fmt(s.totalInvestert), farge: '#C8102E' },
              { lbl: '= Netto fortjeneste', val: fmt(s.nettoFortjeneste), farge: s.nettoFortjeneste >= 0 ? '#2D7D46' : '#C8102E', bold: true },
            ] as const).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', fontSize: 13 }}>
                <span style={{ fontWeight: ('bold' in r && r.bold) ? 600 : 400 }}>{r.lbl}</span>
                <span style={{ fontWeight: 700, color: ('farge' in r) ? r.farge : undefined, fontSize: ('bold' in r && r.bold) ? 15 : 13 }}>{r.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: '#fff8e1', border: '1px solid #EF9F2744',
          borderRadius: RADIUS.lg, padding: 22, marginBottom: 16,
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ ...eyebrowStil, color: '#B05E0A' }}>🎯 Break-even</div>
          <div style={{ fontSize: 14, color: FARGER.tekstMid, lineHeight: 1.6 }}>
            Minste salgspris for å gå i null (dekke alle kostnader, ingen gevinst):
            <div style={{ fontSize: 'clamp(26px, 4vw, 32px)', fontWeight: 600, color: '#B05E0A', marginTop: 8, letterSpacing: '-0.025em', lineHeight: 1 }}>{fmt(s.breakEvenUtenGevinst)}</div>
            <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 6 }}>Dette gir 0 CGT fordi det ikke er gevinst. Plusvalía og salgskostnader er tatt med.</div>
          </div>
        </div>

        {p.status === 'Utleie' && (
          <div style={{
            background: FARGER.creamLys, border: `1px solid ${FARGER.gull}33`,
            borderRadius: RADIUS.lg, padding: 22, marginBottom: 16,
            boxShadow: SHADOW.sm,
          }}>
            <div style={eyebrowStil}>⏰ Vente eller selge nå?</div>
            <div style={{ fontSize: 14, color: FARGER.tekstMid, marginBottom: 14 }}>
              Din månedlige cashflow: <strong style={{ color: cf >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(cf)}</strong>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Hvor mange år vil du vente med å selge?</label>
              <input style={inputStyle} type="number" value={salgInput.ventetid_ar || ''} onChange={e => setSalgInput(s => ({ ...s, ventetid_ar: Number(e.target.value) }))} placeholder="0" />
            </div>
            {salgInput.ventetid_ar > 0 && (
              <div className="anim-fade-up" style={{ background: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.md, padding: 16, marginTop: 14, fontSize: 13, lineHeight: 1.75 }}>
                <div>Cashflow i {salgInput.ventetid_ar} år: <strong style={{ color: ventetidCashflow >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(ventetidCashflow)}</strong></div>
                <div>Total fortjeneste hvis du selger nå: <strong>{fmt(s.nettoFortjeneste)}</strong></div>
                <div>Total fortjeneste hvis du venter {salgInput.ventetid_ar} år (samme salgspris): <strong>{fmt(s.nettoFortjeneste + ventetidCashflow)}</strong></div>
                <div style={{ marginTop: 10, fontStyle: 'italic', color: FARGER.tekstMid }}>
                  💡 For at det skal lønne seg å vente, må salgsprisen om {salgInput.ventetid_ar} år være høyere enn {fmt(s.salgspris - ventetidCashflow)} (hvis cashflow er positiv) eller du må regne med prisøkning som overstiger tap.
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <button onClick={() => markerSomSolgt(p, salgInput.salgspris)} disabled={!salgInput.salgspris} className="knapp-hover-loft" style={{
            background: salgInput.salgspris ? '#2D7D46' : FARGER.tekstLys,
            color: FARGER.creamLys, border: 'none',
            borderRadius: RADIUS.pill, padding: '14px 20px',
            fontSize: 14, fontWeight: 600,
            cursor: salgInput.salgspris ? 'pointer' : 'not-allowed',
            letterSpacing: '-0.005em',
            boxShadow: salgInput.salgspris ? SHADOW.sm : 'none',
          }}>✅ Marker som solgt</button>
          <button onClick={() => oppdater({ ...p, forventet_salgsverdi: salgInput.salgspris })} disabled={!salgInput.salgspris} className="knapp-hover-loft" style={{
            background: salgInput.salgspris ? FARGER.mork : FARGER.tekstLys,
            color: FARGER.creamLys, border: 'none',
            borderRadius: RADIUS.pill, padding: '14px 20px',
            fontSize: 14, fontWeight: 600,
            cursor: salgInput.salgspris ? 'pointer' : 'not-allowed',
            letterSpacing: '-0.005em',
            boxShadow: salgInput.salgspris ? SHADOW.sm : 'none',
          }}>💾 Lagre som forventet salgsverdi</button>
        </div>

        <div style={{ fontSize: 12, color: FARGER.tekstLys, fontStyle: 'italic', marginBottom: 32, lineHeight: 1.7 }}>
          ⚠️ Dette er kun et estimat. Faktisk skatt kan variere basert på dokumenterte fradrag, avtaler mellom Norge og Spania (dobbelbeskatningsavtalen), og individuelle forhold. Konsulter alltid en spansk gestor/advokat før du signerer en salgsavtale.
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onTilbake} className="nav-lenke" style={tilbakeStil}>
        <span aria-hidden>←</span> Tilbake
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ fontSize: 40 }}>💰</div>
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>Selge bolig</h2>
          <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14 }}>Beregn salgspris, skatt og fortjeneste</p>
        </div>
      </div>
      {laster ? (
        <div>
          {[0, 1].map(i => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 14, boxShadow: SHADOW.sm }}>
              <div className="skimmer" style={{ height: 20, width: '40%', marginBottom: 14, borderRadius: 4 }} />
              <div className="skimmer" style={{ height: 50, borderRadius: RADIUS.md }} />
            </div>
          ))}
        </div>
      ) : eideBoliger.length === 0 ? (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 48, textAlign: 'center', color: FARGER.tekstMid }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: FARGER.mork, letterSpacing: '-0.005em' }}>Du har ingen boliger å selge ennå</div>
          <div style={{ fontSize: 13 }}>Boliger med status «Kjøpt», «Under oppussing» eller «Utleie» vises her</div>
        </div>
      ) : (
        <div>
          {eideBoliger.map((p, i) => {
            const sf = statusFarge(p.status)
            return (
              <div key={p.id} onClick={() => {
                setSelgBolig(p.id)
                setSalgInput({ salgspris: p.forventet_salgsverdi || 0, megler_pst: 5, advokat_pst: 1, plusvalia: 0, skatteresidens: 'eu', ventetid_ar: 0 })
                setMarkedsprisData(null)
              }} className="kort-loft anim-fade-up" style={{
                background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
                borderRadius: RADIUS.lg, padding: 22, marginBottom: 14, cursor: 'pointer',
                boxShadow: SHADOW.sm,
                animationDelay: `${Math.min(i, 8) * 40}ms`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: FARGER.mork, letterSpacing: '-0.015em' }}>{p.navn}</div>
                    <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: RADIUS.pill }}>{p.status}</span>
                    <span style={{ fontSize: 12, color: FARGER.tekstLys, marginLeft: 10 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
                  </div>
                  <button className="knapp-hover-loft" style={{
                    background: '#B05E0A', color: FARGER.creamLys, border: 'none',
                    borderRadius: RADIUS.pill, padding: '9px 18px',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    letterSpacing: '-0.005em',
                    boxShadow: SHADOW.sm,
                  }}>💰 Beregn salg →</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <div style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 12 }}>
                    <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Total investert</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.01em' }}>{fmt(totalInvestering(p))}</div>
                  </div>
                  <div style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 12 }}>
                    <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Forventet salgsverdi</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#B05E0A', letterSpacing: '-0.01em' }}>{fmt(p.forventet_salgsverdi)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
