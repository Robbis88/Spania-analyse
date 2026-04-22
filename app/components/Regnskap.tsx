'use client'
import { useState } from 'react'
import { useProsjekter } from '../lib/useProsjekter'
import { type Prosjekt, tomtProsjekt } from '../types'
import { totalInvestering, månedligKostnad, månedligCashflow, yield_pst, roi } from '../lib/beregninger'
import { fmt, statusFarge } from '../lib/styles'
import { ProsjektFelter } from './ProsjektFelter'
import { Oppussingsbudsjett } from './Oppussingsbudsjett'
import { Utleieanalyse } from './Utleieanalyse'
import { SendteEposter } from './SendteEposter'
import { ProsjektBilder } from './ProsjektBilder'
import { lastNedPDF } from '../lib/pdf'

export function Regnskap({
  onTilbake, visProsjektId, onSettVisProsjekt,
}: {
  onTilbake: () => void
  visProsjektId: string | null
  onSettVisProsjekt: (id: string | null) => void
}) {
  const { prosjekter, laster, leggTil, oppdater, slett } = useProsjekter()
  const [nyttProsjekt, setNyttProsjekt] = useState<Prosjekt>(tomtProsjekt())
  const [visNyttSkjema, setVisNyttSkjema] = useState(false)
  const [redigerProsjekt, setRedigerProsjekt] = useState<Prosjekt | null>(null)
  const [aktivTab, setAktivTab] = useState<'oversikt' | 'arsrapport' | 'oppussing' | 'utleie'>('oversikt')
  const [valgtAr, setValgtAr] = useState(new Date().getFullYear())

  async function leggTilProsjekt() {
    if (!nyttProsjekt.navn) return
    await leggTil(nyttProsjekt)
    setNyttProsjekt(tomtProsjekt())
    setVisNyttSkjema(false)
  }

  async function lagreRedigering() {
    if (!redigerProsjekt) return
    await oppdater(redigerProsjekt)
    setRedigerProsjekt(null)
  }

  async function slettProsjekt(id: string) {
    if (!confirm('Er du sikker?')) return
    await slett(id)
    if (visProsjektId === id) onSettVisProsjekt(null)
  }

  return (
    <div>
      <button onClick={() => { onTilbake(); onSettVisProsjekt(null); setVisNyttSkjema(false); setRedigerProsjekt(null) }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 36 }}>📊</div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Regnskap</h2>
            <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Alle eiendomsprosjekter</p>
          </div>
        </div>
        {!visProsjektId && <button onClick={() => setVisNyttSkjema(!visNyttSkjema)} style={{ background: '#7B2D8B', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Nytt prosjekt</button>}
      </div>

      {laster && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div>}

      {prosjekter.length > 0 && !visProsjektId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { lbl: '🏠 Prosjekter', val: prosjekter.length.toString() },
            { lbl: '💰 Total investert', val: fmt(prosjekter.reduce((s, p) => s + totalInvestering(p), 0)) },
            { lbl: '📈 Cashflow/mnd', val: fmt(prosjekter.reduce((s, p) => s + månedligCashflow(p), 0)) },
            { lbl: '✅ Aktive utleier', val: prosjekter.filter(p => p.status === 'Utleie').length.toString() },
          ].map((item, i) => (
            <div key={i} style={{ background: '#f9f0ff', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.lbl}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#7B2D8B' }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {visNyttSkjema && !visProsjektId && (
        <div style={{ background: '#f9f0ff', border: '2px solid #7B2D8B22', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#7B2D8B' }}>Nytt prosjekt</h3>
          <ProsjektFelter data={nyttProsjekt} onChange={setNyttProsjekt} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={leggTilProsjekt} style={{ flex: 1, background: '#7B2D8B', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>✅ Lagre prosjekt</button>
            <button onClick={() => setVisNyttSkjema(false)} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
          </div>
        </div>
      )}

      {!visProsjektId && prosjekter.map(p => {
        const sf = statusFarge(p.status)
        const cf = månedligCashflow(p)
        return (
          <div key={p.id} style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{p.navn}</div>
                <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
                {p.dato_kjopt && <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>Kjøpt: {p.dato_kjopt}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onSettVisProsjekt(p.id)} style={{ background: '#7B2D8B', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Åpne</button>
                <button onClick={() => slettProsjekt(p.id)} style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Slett</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {[
                { lbl: 'Total investert', val: fmt(totalInvestering(p)) },
                { lbl: 'Cashflow/mnd', val: fmt(cf), farge: cf >= 0 ? '#2D7D46' : '#C8102E' },
                { lbl: 'Yield', val: yield_pst(p).toFixed(1) + '%' },
                { lbl: 'ROI ved salg', val: roi(p).toFixed(1) + '%' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{item.lbl}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: ('farge' in item) ? item.farge : '#1a1a2e' }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {!visProsjektId && prosjekter.length === 0 && !visNyttSkjema && !laster && (
        <div style={{ background: '#f9f0ff', border: '2px dashed #d4b8f4', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Ingen prosjekter ennå</div>
          <div style={{ fontSize: 14 }}>Trykk &quot;Nytt prosjekt&quot; for å komme i gang!</div>
        </div>
      )}

      {visProsjektId && (() => {
        const p = prosjekter.find(pr => pr.id === visProsjektId)
        if (!p) return null
        const sf = statusFarge(p.status)
        const cf = månedligCashflow(p)
        const redigerer = redigerProsjekt?.id === p.id

        const arsinntekt = p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).reduce((s, m) => s + m.inntekt, 0)
        const arskostnadLogg = p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).reduce((s, m) => s + m.kostnad, 0)
        const fastKostAr = månedligKostnad(p) * 12
        const totalKostAr = arskostnadLogg + fastKostAr
        const nettoresultat = arsinntekt - totalKostAr

        return (
          <div>
            <button onClick={() => { onSettVisProsjekt(null); setRedigerProsjekt(null); setAktivTab('oversikt') }} style={{ background: '#f0f0f0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 20, color: '#444', fontWeight: 500 }}>← Tilbake</button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{p.navn}</h2>
                <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{p.status}</span>
                <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setRedigerProsjekt(redigerer ? null : { ...p })} style={{ background: redigerer ? '#f0f0f0' : '#1a1a2e', color: redigerer ? '#444' : 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {redigerer ? 'Avbryt' : '✏️ Rediger'}
                </button>
                {redigerer && <button onClick={lagreRedigering} style={{ background: '#2D7D46', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💾 Lagre</button>}
              </div>
            </div>

            {redigerer && redigerProsjekt && (
              <div style={{ background: '#f9f0ff', border: '2px solid #7B2D8B22', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#7B2D8B' }}>✏️ Rediger prosjekt</h3>
                <ProsjektFelter data={redigerProsjekt} onChange={setRedigerProsjekt} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={lagreRedigering} style={{ flex: 1, background: '#2D7D46', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>💾 Lagre endringer</button>
                  <button onClick={() => setRedigerProsjekt(null)} style={{ background: '#f0f0f0', color: '#444', border: 'none', padding: 14, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Avbryt</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { lbl: '💰 Total investert', val: fmt(totalInvestering(p)), farge: '#7B2D8B' },
                { lbl: '📈 Cashflow/mnd', val: fmt(cf), farge: cf >= 0 ? '#2D7D46' : '#C8102E' },
                { lbl: '📊 Yield', val: yield_pst(p).toFixed(1) + '%', farge: '#185FA5' },
                { lbl: '🏷️ ROI ved salg', val: roi(p).toFixed(1) + '%', farge: '#B05E0A' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#f9f0ff', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.lbl}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: item.farge }}>{item.val}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {([
                { id: 'oversikt' as const, lbl: '📊 Oversikt' },
                { id: 'arsrapport' as const, lbl: '📋 Årsrapport' },
                ...(p.kategori === 'flipp' ? [{ id: 'oppussing' as const, lbl: '🔨 Oppussing' }] : []),
                ...(p.kategori === 'utleie' ? [{ id: 'utleie' as const, lbl: '🏖️ Utleie' }] : []),
              ]).map(t => (
                <button key={t.id} onClick={() => setAktivTab(t.id)}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: aktivTab === t.id ? '#1a1a2e' : '#f0f0f0', color: aktivTab === t.id ? 'white' : '#444' }}>
                  {t.lbl}
                </button>
              ))}
            </div>

            {aktivTab === 'oppussing' && p.kategori === 'flipp' && (
              <Oppussingsbudsjett prosjekt={p} />
            )}

            {aktivTab === 'utleie' && p.kategori === 'utleie' && (
              <Utleieanalyse prosjekt={p} />
            )}

            {aktivTab === 'oversikt' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>💸 Investeringer</div>
                  {[
                    { lbl: 'Kjøpesum', val: fmt(p.kjøpesum) },
                    { lbl: 'Kjøpskostnader', val: fmt(p.kjøpskostnader) },
                    { lbl: 'Oppussing budsjett', val: fmt(p.oppussingsbudsjett) },
                    { lbl: 'Oppussing faktisk', val: fmt(p.oppussing_faktisk) },
                    { lbl: 'Møblering', val: fmt(p.møblering) },
                    { lbl: 'Forventet salgsverdi', val: fmt(p.forventet_salgsverdi) },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
                      <span style={{ color: '#666' }}>{r.lbl}</span><span style={{ fontWeight: 600 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📅 Månedlig</div>
                  {[
                    { lbl: 'Leieinntekt', val: fmt(p.leieinntekt_mnd), farge: '#2D7D46' },
                    { lbl: 'Lånebetaling', val: fmt(p.lån_mnd), farge: '#C8102E' },
                    { lbl: 'Fellesutgifter', val: fmt(p.fellesutgifter_mnd), farge: '#C8102E' },
                    { lbl: 'Strøm', val: fmt(p.strøm_mnd), farge: '#C8102E' },
                    { lbl: 'Forsikring', val: fmt(p.forsikring_mnd), farge: '#C8102E' },
                    { lbl: 'Forvaltning', val: fmt(p.forvaltning_mnd), farge: '#C8102E' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
                      <span style={{ color: '#666' }}>{r.lbl}</span><span style={{ fontWeight: 600, color: r.farge }}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #eee', fontSize: 14, marginTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>Cashflow</span>
                    <span style={{ fontWeight: 700, color: cf >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(cf)}</span>
                  </div>
                </div>
              </div>
            )}

            {aktivTab === 'oversikt' && <ProsjektBilder prosjektId={p.id} />}
            {aktivTab === 'oversikt' && <SendteEposter prosjektId={p.id} />}

            {aktivTab === 'arsrapport' && (
              <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📋 Årsrapport</h3>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select value={valgtAr} onChange={e => setValgtAr(Number(e.target.value))}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14 }}>
                      {[2024, 2025, 2026, 2027].map(ar => <option key={ar} value={ar}>{ar}</option>)}
                    </select>
                    <button onClick={() => lastNedPDF(p, valgtAr)}
                      style={{ background: '#C8102E', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      📥 Last ned PDF
                    </button>
                  </div>
                </div>

                <div style={{ background: '#f0faf4', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a4d2b' }}>💰 Inntekter {valgtAr}</div>
                  {p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).length === 0 && (
                    <div style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>Ingen inntekter registrert for {valgtAr} – legg til i månedlig logg under</div>
                  )}
                  {p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #d0ead8' : 'none', fontSize: 13 }}>
                      <span style={{ color: '#444' }}>{m.måned}{m.notat ? ' – ' + m.notat : ''}</span>
                      <span style={{ fontWeight: 600, color: '#2D7D46' }}>{fmt(m.inntekt)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #2D7D46', fontSize: 14, marginTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>Sum inntekter</span>
                    <span style={{ fontWeight: 700, color: '#2D7D46' }}>{fmt(arsinntekt)}</span>
                  </div>
                </div>

                <div style={{ background: '#fde8ec', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#7a0c1e' }}>📉 Kostnader {valgtAr}</div>
                  {[
                    { lbl: 'Lånebetaling (12 mnd)', val: p.lån_mnd * 12 },
                    { lbl: 'Fellesutgifter (12 mnd)', val: p.fellesutgifter_mnd * 12 },
                    { lbl: 'Strøm (12 mnd)', val: p.strøm_mnd * 12 },
                    { lbl: 'Forsikring (12 mnd)', val: p.forsikring_mnd * 12 },
                    { lbl: 'Forvaltning (12 mnd)', val: p.forvaltning_mnd * 12 },
                    { lbl: 'Variable kostnader (logg)', val: arskostnadLogg },
                  ].filter(r => r.val > 0).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i > 0 ? '1px solid #f5a3b0' : 'none', fontSize: 13 }}>
                      <span style={{ color: '#444' }}>{r.lbl}</span>
                      <span style={{ fontWeight: 600, color: '#C8102E' }}>{fmt(r.val)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #C8102E', fontSize: 14, marginTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>Sum kostnader</span>
                    <span style={{ fontWeight: 700, color: '#C8102E' }}>{fmt(totalKostAr)}</span>
                  </div>
                </div>

                <div style={{ background: nettoresultat >= 0 ? '#e8f5ed' : '#fde8ec', border: `2px solid ${nettoresultat >= 0 ? '#2D7D46' : '#C8102E'}`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📊 Resultat {valgtAr}</div>
                  {([
                    { lbl: 'Sum inntekter', val: fmt(arsinntekt), farge: '#2D7D46' },
                    { lbl: 'Sum kostnader', val: fmt(totalKostAr), farge: '#C8102E' },
                    { lbl: 'Netto resultat', val: fmt(nettoresultat), farge: nettoresultat >= 0 ? '#2D7D46' : '#C8102E', bold: true },
                    { lbl: 'Yield (faktisk)', val: totalInvestering(p) > 0 ? ((arsinntekt / totalInvestering(p)) * 100).toFixed(1) + '%' : '–', farge: '#185FA5' },
                    { lbl: 'Total investering', val: fmt(totalInvestering(p)), farge: '#7B2D8B' },
                  ] as const).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none', fontSize: 13 }}>
                      <span style={{ color: '#444', fontWeight: ('bold' in r && r.bold) ? 700 : 400 }}>{r.lbl}</span>
                      <span style={{ fontWeight: 700, color: r.farge, fontSize: ('bold' in r && r.bold) ? 15 : 13 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {p.notater && (
              <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📝 Notater</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.notater}</div>
              </div>
            )}

          </div>
        )
      })()}
    </div>
  )
}
