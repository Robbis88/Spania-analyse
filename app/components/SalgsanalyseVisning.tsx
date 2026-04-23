'use client'
import { useState } from 'react'
import type { Prosjekt, SalgsanalyseData } from '../types'
import { fmt } from '../lib/styles'
import { visToast } from '../lib/toast'

type Props = {
  prosjekt: Prosjekt
  onOppdatert: () => void
}

const STATUS_ETIKETT = {
  ok: { tekst: '✅ OK', bg: '#e8f5ed', farge: '#1a4d2b' },
  maa_sjekkes: { tekst: '⚠️ Må sjekkes', bg: '#fff8e1', farge: '#6b3a0a' },
  mangler: { tekst: '❌ Mangler', bg: '#fde8ec', farge: '#7a0c1e' },
} as const

const PRIO_ETIKETT = {
  hoy: { tekst: '🔴 Høy', farge: '#C8102E' },
  middels: { tekst: '🟡 Middels', farge: '#B05E0A' },
  lav: { tekst: '⚪ Lav', farge: '#888' },
} as const

const VURDERING_ETIKETT = {
  sterk: { tekst: '🟢 Sterk investering', bg: '#e8f5ed', farge: '#1a4d2b' },
  middels: { tekst: '🟡 Middels investering', bg: '#fff8e1', farge: '#6b3a0a' },
  svak: { tekst: '🔴 Svak investering', bg: '#fde8ec', farge: '#7a0c1e' },
} as const

const MALGRUPPE_ETIKETT: Record<string, string> = {
  investor: '💼 Investor',
  feriebolig: '🏖️ Feriebolig',
  fastboende: '🏠 Fastboende',
  utleie: '🔑 Utleie',
  ingen: '—',
}

export function SalgsanalyseVisning({ prosjekt, onOppdatert }: Props) {
  const [genererer, setGenererer] = useState(false)
  const [feil, setFeil] = useState('')
  const data = prosjekt.salgsanalyse_data as SalgsanalyseData | null | undefined

  async function generer() {
    setGenererer(true); setFeil('')
    try {
      const res = await fetch('/api/selge/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prosjekt_id: prosjekt.id }),
      })
      const resData = await res.json()
      if (!res.ok || resData.feil) throw new Error(resData.feil || `HTTP ${res.status}`)
      onOppdatert()
      visToast('Salgsanalyse ferdig — se resultatet nedenfor')
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Ukjent feil'
      setFeil(m)
      visToast('Feilet: ' + m, 'feil', 5000)
    }
    setGenererer(false)
  }

  async function kopier(tekst: string, etikett: string) {
    try {
      await navigator.clipboard.writeText(tekst)
      visToast(`${etikett} kopiert`, 'suksess', 1600)
    } catch {
      visToast('Kunne ikke kopiere', 'feil')
    }
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>🤖 AI-salgsanalyse</h3>
          {prosjekt.salgsanalyse_generert && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              Sist generert: {new Date(prosjekt.salgsanalyse_generert).toLocaleString('nb-NO')}
            </div>
          )}
        </div>
        <button onClick={generer} disabled={genererer}
          title="Genererer annonse, bildeplan, dokumentcheck, prisstrategi, investeringsanalyse, forbedringsforslag og målgruppe"
          style={{ background: genererer ? '#999' : '#6a4c93', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: genererer ? 'wait' : 'pointer' }}>
          {genererer ? '⏳ Genererer (10–20 s)...' : data ? '🔄 Generer på nytt' : '✨ Generer salgsanalyse'}
        </button>
      </div>

      {feil && <div style={{ background: '#fde8ec', color: '#7a0c1e', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>⚠️ {feil}</div>}

      {!data && !genererer && (
        <div style={{ background: '#faf7f0', border: '1.5px dashed #c9a87655', borderRadius: 10, padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
          Trykk &quot;Generer salgsanalyse&quot; for å få: salgsannonse, bildeplan, dokumentcheck, prisstrategi, investeringsanalyse, forbedringsforslag og målgruppe
        </div>
      )}

      {data && (
        <>
          {/* 1. SALGSANNONSE */}
          <Seksjon tittel="🏡 Salgsannonse" farge="#185FA5">
            <p style={{ fontSize: 14, fontStyle: 'italic', lineHeight: 1.6, marginTop: 0 }}>{data.salgsannonse.intro}</p>
            <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
              {data.salgsannonse.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{data.salgsannonse.beskrivelse}</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8f5ee', padding: 10, borderRadius: 8, marginBottom: 10 }}>
              <strong>Om området:</strong><br />{data.salgsannonse.omraade}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#185FA5' }}>→ {data.salgsannonse.cta}</div>
            <button onClick={() => {
              const full = [data.salgsannonse.intro, '', ...data.salgsannonse.bullets.map(b => '• ' + b), '', data.salgsannonse.beskrivelse, '', data.salgsannonse.omraade, '', data.salgsannonse.cta].join('\n')
              kopier(full, 'Annonse')
            }}
              style={{ marginTop: 10, background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
              📋 Kopier hele annonsen
            </button>
          </Seksjon>

          {/* 2. BILDEPLAN */}
          <Seksjon tittel="📸 Bildeplan" farge="#D4814E">
            <BildeplanKol tittel="Interiør" liste={data.bildeplan.interior} />
            <BildeplanKol tittel="Eksteriør" liste={data.bildeplan.eksterior} />
            <BildeplanKol tittel="Fasiliteter" liste={data.bildeplan.fasiliteter} />
            <BildeplanKol tittel="Nærområde" liste={data.bildeplan.naeromraade} />
            {data.bildeplan.tips.length > 0 && (
              <div style={{ background: '#fff8e1', borderRadius: 8, padding: 10, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b3a0a', marginBottom: 4 }}>💡 Ekstra produksjons-tips</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#6b3a0a', lineHeight: 1.6 }}>
                  {data.bildeplan.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </Seksjon>

          {/* 3. DOKUMENTCHECK */}
          <Seksjon tittel="🧾 Dokumentcheck" farge="#2D7D46">
            {data.dokumentcheck.map((d, i) => {
              const s = STATUS_ETIKETT[d.status]
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start', padding: '8px 0', borderTop: i > 0 ? '1px solid #eee' : 'none' }}>
                  <span style={{ background: s.bg, color: s.farge, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, whiteSpace: 'nowrap' }}>{s.tekst}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.navn}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.5 }}>{d.kommentar}</div>
                  </div>
                </div>
              )
            })}
          </Seksjon>

          {/* 4. PRISSTRATEGI */}
          <Seksjon tittel="💰 Prisstrategi" farge="#B08030">
            <div style={{ background: '#faf7f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Estimert markedspris</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#B08030' }}>{fmt(data.prisstrategi.estimert_markedspris_eur)}</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 6, lineHeight: 1.5 }}>{data.prisstrategi.estimert_markedspris_begrunnelse}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div style={{ background: '#e8f5ed', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a4d2b', marginBottom: 4 }}>⚡ RASKT SALG</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a4d2b' }}>{fmt(data.prisstrategi.strategi_rask.pris_eur)}</div>
                <div style={{ fontSize: 12, color: '#1a4d2b', marginTop: 4, lineHeight: 1.5 }}>{data.prisstrategi.strategi_rask.begrunnelse}</div>
              </div>
              <div style={{ background: '#f0f7ff', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f3b6b', marginBottom: 4 }}>🎯 MAKS PROFITT</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f3b6b' }}>{fmt(data.prisstrategi.strategi_maks.pris_eur)}</div>
                <div style={{ fontSize: 12, color: '#0f3b6b', marginTop: 4, lineHeight: 1.5 }}>{data.prisstrategi.strategi_maks.begrunnelse}</div>
              </div>
            </div>
            {data.prisstrategi.anbefalte_tiltak.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>TILTAK FØR MAKS-SALG:</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                  {data.prisstrategi.anbefalte_tiltak.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </>
            )}
          </Seksjon>

          {/* 5. INVESTERINGSANALYSE */}
          <Seksjon tittel="📊 Investeringsanalyse (utleie)" farge="#185FA5">
            {(() => { const v = VURDERING_ETIKETT[data.investeringsanalyse.vurdering]
              return <div style={{ display: 'inline-block', background: v.bg, color: v.farge, fontWeight: 700, fontSize: 13, padding: '6px 14px', borderRadius: 20, marginBottom: 12 }}>{v.tekst}</div>
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#888' }}>Korttidsleie (Airbnb) / år</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2D7D46' }}>{fmt(data.investeringsanalyse.korttid_arlig_inntekt_eur)}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.5 }}>{data.investeringsanalyse.korttid_begrunnelse}</div>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#888' }}>Langtidsleie / år</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2D7D46' }}>{fmt(data.investeringsanalyse.langtid_arlig_inntekt_eur)}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.5 }}>{data.investeringsanalyse.langtid_begrunnelse}</div>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, color: '#888' }}>Brutto yield</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>{data.investeringsanalyse.yield_pst.toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 8 }}><strong>Sesong:</strong> {data.investeringsanalyse.sesong_varierer}</div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}><strong>ROI-kommentar:</strong> {data.investeringsanalyse.roi_kommentar}</div>
          </Seksjon>

          {/* 6. FORBEDRINGSFORSLAG */}
          <Seksjon tittel="🧠 Forbedringsforslag" farge="#6a4c93">
            {[...data.forbedringsforslag]
              .sort((a, b) => {
                const rang = { hoy: 0, middels: 1, lav: 2 }
                return rang[a.prioritet] - rang[b.prioritet]
              })
              .map((f, i) => {
                const pr = PRIO_ETIKETT[f.prioritet]
                const nettoGevinst = f.verdi_potensial_eur - f.kostnad_estimat_eur
                return (
                  <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #eee' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: pr.farge }}>{pr.tekst}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{f.tiltak}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Kostnad: <strong style={{ color: '#C8102E' }}>{fmt(f.kostnad_estimat_eur)}</strong></span>
                      <span>Verdiøkning: <strong style={{ color: '#2D7D46' }}>{fmt(f.verdi_potensial_eur)}</strong></span>
                      <span>Netto: <strong style={{ color: nettoGevinst >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(nettoGevinst)}</strong></span>
                    </div>
                  </div>
                )
              })}
          </Seksjon>

          {/* 7. MÅLGRUPPE */}
          <Seksjon tittel="🎯 Målgruppe" farge="#C8102E">
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ background: '#f0f7ff', color: '#0f3b6b', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                Primær: {MALGRUPPE_ETIKETT[data.malgruppe.primaer] || data.malgruppe.primaer}
              </span>
              {data.malgruppe.sekundaer !== 'ingen' && (
                <span style={{ background: '#f8f5ee', color: '#555', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                  Sekundær: {MALGRUPPE_ETIKETT[data.malgruppe.sekundaer] || data.malgruppe.sekundaer}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{data.malgruppe.begrunnelse}</div>
          </Seksjon>
        </>
      )}
    </div>
  )
}

function Seksjon({ tittel, farge, children }: { tittel: string; farge: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: farge, marginBottom: 10, letterSpacing: '0.02em' }}>{tittel}</div>
      {children}
    </div>
  )
}

function BildeplanKol({ tittel, liste }: { tittel: string; liste: string[] }) {
  if (liste.length === 0) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4 }}>{tittel.toUpperCase()}</div>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
        {liste.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </div>
  )
}
