'use client'
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react'
import type { DokumentStatus, Prosjekt, SalgsanalyseData } from '../types'
import { fmt } from '../lib/styles'
import { visToast } from '../lib/toast'
import { supabase } from '../lib/supabase'

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

// Error boundary så en krasj i visningen ikke tar ned hele siden
class Feilvakt extends Component<{ children: ReactNode }, { feil: Error | null }> {
  state = { feil: null as Error | null }
  static getDerivedStateFromError(feil: Error) { return { feil } }
  componentDidCatch(feil: Error, info: ErrorInfo) {
    console.error('Salgsanalyse-visning krasjet:', feil, info)
  }
  render() {
    if (this.state.feil) {
      return (
        <div style={{ background: '#fde8ec', border: '1.5px solid #C8102E', borderRadius: 8, padding: 14, fontSize: 13, color: '#7a0c1e' }}>
          ⚠️ Kunne ikke vise salgsanalysen — data kan være ufullstendig. Prøv å generere på nytt.
          <br /><small style={{ color: '#a0445a' }}>{this.state.feil.message}</small>
        </div>
      )
    }
    return this.props.children
  }
}

export function SalgsanalyseVisning(props: Props) {
  return <Feilvakt><SalgsanalyseInnhold {...props} /></Feilvakt>
}

function SalgsanalyseInnhold({ prosjekt, onOppdatert }: Props) {
  const [genererer, setGenererer] = useState(false)
  const [feil, setFeil] = useState('')
  const raaData = prosjekt.salgsanalyse_data as SalgsanalyseData | null | undefined
  const data = raaData && typeof raaData === 'object' ? raaData : null

  async function generer() {
    setGenererer(true); setFeil('')
    try {
      const res = await fetch('/api/selge/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prosjekt_id: prosjekt.id }),
      })
      const tekst = await res.text()
      let resData: { data?: SalgsanalyseData; feil?: string } = {}
      try { resData = JSON.parse(tekst) } catch { resData = { feil: `HTTP ${res.status}: ${tekst.slice(0, 200)}` } }
      if (!res.ok || resData.feil) throw new Error(resData.feil || `HTTP ${res.status}`)
      onOppdatert()
      visToast('Salgsanalyse ferdig — se resultatet nedenfor')
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Ukjent feil'
      setFeil(m)
      visToast('Salgsanalyse feilet: ' + m, 'feil', 5000)
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

  // Trygge hentere med fallback
  const annonse = data?.salgsannonse
  const bildeplan = data?.bildeplan
  const dokumenter = Array.isArray(data?.dokumentcheck) ? data.dokumentcheck : []
  const pris = data?.prisstrategi
  const inv = data?.investeringsanalyse
  const forbedringer = Array.isArray(data?.forbedringsforslag) ? data.forbedringsforslag : []
  const malgruppe = data?.malgruppe

  return (
    <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 16 }}>
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
        <div style={{ background: '#faf7f0', border: '1.5px dashed #c9a87655', borderRadius: 6, padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
          Trykk &quot;Generer salgsanalyse&quot; for å få: salgsannonse, bildeplan, dokumentcheck, prisstrategi, investeringsanalyse, forbedringsforslag og målgruppe
        </div>
      )}

      {annonse && (
        <Seksjon tittel="🏡 Salgsannonse" farge="#0e1726">
          {annonse.intro && <p style={{ fontSize: 14, fontStyle: 'italic', lineHeight: 1.6, marginTop: 0 }}>{annonse.intro}</p>}
          {Array.isArray(annonse.bullets) && annonse.bullets.length > 0 && (
            <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
              {annonse.bullets.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          {annonse.beskrivelse && <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{annonse.beskrivelse}</div>}
          {annonse.omraade && (
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8f5ee', padding: 10, borderRadius: 8, marginBottom: 10 }}>
              <strong>Om området:</strong><br />{annonse.omraade}
            </div>
          )}
          {annonse.cta && <div style={{ fontSize: 13, fontWeight: 600, color: '#0e1726' }}>→ {annonse.cta}</div>}
          <button onClick={() => {
            const bullets = Array.isArray(annonse.bullets) ? annonse.bullets.map(b => '• ' + b) : []
            const full = [annonse.intro, '', ...bullets, '', annonse.beskrivelse, '', annonse.omraade, '', annonse.cta].filter(Boolean).join('\n')
            kopier(full, 'Annonse')
          }}
            style={{ marginTop: 10, background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            📋 Kopier hele annonsen
          </button>
        </Seksjon>
      )}

      {bildeplan && (
        <Seksjon tittel="📸 Bildeplan" farge="#D4814E">
          <BildeplanKol tittel="Interiør" liste={bildeplan.interior} />
          <BildeplanKol tittel="Eksteriør" liste={bildeplan.eksterior} />
          <BildeplanKol tittel="Fasiliteter" liste={bildeplan.fasiliteter} />
          <BildeplanKol tittel="Nærområde" liste={bildeplan.naeromraade} />
          {Array.isArray(bildeplan.tips) && bildeplan.tips.length > 0 && (
            <div style={{ background: '#fff8e1', borderRadius: 8, padding: 10, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b3a0a', marginBottom: 4 }}>💡 Ekstra produksjons-tips</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#6b3a0a', lineHeight: 1.6 }}>
                {bildeplan.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </Seksjon>
      )}

      {dokumenter.length > 0 && (
        <Seksjon tittel="🧾 Dokumentcheck" farge="#2D7D46">
          <DokumentcheckListe
            prosjektId={prosjekt.id}
            dokumenter={dokumenter}
            status={prosjekt.dokumentcheck_status || {}}
            onOppdatert={onOppdatert}
          />
        </Seksjon>
      )}

      {pris && (
        <Seksjon tittel="💰 Prisstrategi" farge="#B08030">
          {typeof pris.estimert_markedspris_eur === 'number' && (
            <div style={{ background: '#faf7f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Estimert markedspris</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#B08030' }}>{fmt(pris.estimert_markedspris_eur)}</div>
              {pris.estimert_markedspris_begrunnelse && <div style={{ fontSize: 12, color: '#555', marginTop: 6, lineHeight: 1.5 }}>{pris.estimert_markedspris_begrunnelse}</div>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
            {pris.strategi_rask && (
              <div style={{ background: '#e8f5ed', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a4d2b', marginBottom: 4 }}>⚡ RASKT SALG</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a4d2b' }}>{fmt(pris.strategi_rask.pris_eur || 0)}</div>
                {pris.strategi_rask.begrunnelse && <div style={{ fontSize: 12, color: '#1a4d2b', marginTop: 4, lineHeight: 1.5 }}>{pris.strategi_rask.begrunnelse}</div>}
              </div>
            )}
            {pris.strategi_maks && (
              <div style={{ background: '#fdfcf7', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f3b6b', marginBottom: 4 }}>🎯 MAKS PROFITT</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f3b6b' }}>{fmt(pris.strategi_maks.pris_eur || 0)}</div>
                {pris.strategi_maks.begrunnelse && <div style={{ fontSize: 12, color: '#0f3b6b', marginTop: 4, lineHeight: 1.5 }}>{pris.strategi_maks.begrunnelse}</div>}
              </div>
            )}
          </div>
          {Array.isArray(pris.anbefalte_tiltak) && pris.anbefalte_tiltak.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>TILTAK FØR MAKS-SALG:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                {pris.anbefalte_tiltak.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </>
          )}
        </Seksjon>
      )}

      {inv && (
        <Seksjon tittel="📊 Investeringsanalyse (utleie)" farge="#0e1726">
          {inv.vurdering && (() => {
            const v = VURDERING_ETIKETT[inv.vurdering as keyof typeof VURDERING_ETIKETT] || VURDERING_ETIKETT.middels
            return <div style={{ display: 'inline-block', background: v.bg, color: v.farge, fontWeight: 700, fontSize: 13, padding: '6px 14px', borderRadius: 20, marginBottom: 12 }}>{v.tekst}</div>
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: '#888' }}>Korttidsleie (Airbnb) / år</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2D7D46' }}>{fmt(inv.korttid_arlig_inntekt_eur || 0)}</div>
              {inv.korttid_begrunnelse && <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.5 }}>{inv.korttid_begrunnelse}</div>}
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: '#888' }}>Langtidsleie / år</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2D7D46' }}>{fmt(inv.langtid_arlig_inntekt_eur || 0)}</div>
              {inv.langtid_begrunnelse && <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.5 }}>{inv.langtid_begrunnelse}</div>}
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: '#888' }}>Brutto yield</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0e1726' }}>{typeof inv.yield_pst === 'number' ? inv.yield_pst.toFixed(1) + '%' : '—'}</div>
            </div>
          </div>
          {inv.sesong_varierer && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 8 }}><strong>Sesong:</strong> {inv.sesong_varierer}</div>}
          {inv.roi_kommentar && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}><strong>ROI-kommentar:</strong> {inv.roi_kommentar}</div>}
        </Seksjon>
      )}

      {forbedringer.length > 0 && (
        <Seksjon tittel="🧠 Forbedringsforslag" farge="#6a4c93">
          {[...forbedringer]
            .sort((a, b) => {
              const rang = { hoy: 0, middels: 1, lav: 2 }
              return (rang[a?.prioritet as keyof typeof rang] ?? 3) - (rang[b?.prioritet as keyof typeof rang] ?? 3)
            })
            .map((f, i) => {
              const pr = PRIO_ETIKETT[f?.prioritet as keyof typeof PRIO_ETIKETT] || PRIO_ETIKETT.lav
              const kostnad = f?.kostnad_estimat_eur || 0
              const verdi = f?.verdi_potensial_eur || 0
              const nettoGevinst = verdi - kostnad
              return (
                <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #eee' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pr.farge }}>{pr.tekst}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{f?.tiltak || '—'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Kostnad: <strong style={{ color: '#C8102E' }}>{fmt(kostnad)}</strong></span>
                    <span>Verdiøkning: <strong style={{ color: '#2D7D46' }}>{fmt(verdi)}</strong></span>
                    <span>Netto: <strong style={{ color: nettoGevinst >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(nettoGevinst)}</strong></span>
                  </div>
                </div>
              )
            })}
        </Seksjon>
      )}

      {malgruppe && (
        <Seksjon tittel="🎯 Målgruppe" farge="#C8102E">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {malgruppe.primaer && (
              <span style={{ background: '#fdfcf7', color: '#0f3b6b', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                Primær: {MALGRUPPE_ETIKETT[malgruppe.primaer] || malgruppe.primaer}
              </span>
            )}
            {malgruppe.sekundaer && malgruppe.sekundaer !== 'ingen' && (
              <span style={{ background: '#f8f5ee', color: '#555', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                Sekundær: {MALGRUPPE_ETIKETT[malgruppe.sekundaer] || malgruppe.sekundaer}
              </span>
            )}
          </div>
          {malgruppe.begrunnelse && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{malgruppe.begrunnelse}</div>}
        </Seksjon>
      )}
    </div>
  )
}

function Seksjon({ tittel, farge, children }: { tittel: string; farge: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: farge, marginBottom: 10, letterSpacing: '0.02em' }}>{tittel}</div>
      {children}
    </div>
  )
}

function DokumentcheckListe({ prosjektId, dokumenter, status, onOppdatert }: {
  prosjektId: string
  dokumenter: Array<{ navn: string; status: 'ok' | 'mangler' | 'maa_sjekkes'; kommentar: string }>
  status: Record<string, DokumentStatus>
  onOppdatert: () => void
}) {
  // Lokalt state for optimistisk UI. Synkes til DB med debounce på notat-input
  // og umiddelbart for checkbox.
  const [lokalt, setLokalt] = useState<Record<string, DokumentStatus>>(status)
  const debounceRef = useRef<Record<string, number>>({})

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLokalt(status) }, [status])

  async function lagre(alt: Record<string, DokumentStatus>) {
    await supabase.from('prosjekter').update({ dokumentcheck_status: alt }).eq('id', prosjektId)
    onOppdatert()
  }

  function settHuket(navn: string, huket: boolean) {
    const forrige = lokalt[navn] || { huket: false, notat: '', oppdatert: '' }
    const nytt = { ...forrige, huket, oppdatert: new Date().toISOString() }
    const alt = { ...lokalt, [navn]: nytt }
    setLokalt(alt)
    void lagre(alt)
  }

  function settNotat(navn: string, notat: string) {
    const forrige = lokalt[navn] || { huket: false, notat: '', oppdatert: '' }
    const nytt = { ...forrige, notat, oppdatert: new Date().toISOString() }
    const alt = { ...lokalt, [navn]: nytt }
    setLokalt(alt)
    // Debounce lagring for ikke å pepre Supabase mens bruker skriver
    if (debounceRef.current[navn]) window.clearTimeout(debounceRef.current[navn])
    debounceRef.current[navn] = window.setTimeout(() => {
      void lagre(alt)
    }, 700) as unknown as number
  }

  const antallHuket = Object.values(lokalt).filter(s => s?.huket).length
  const antallTotal = dokumenter.length

  return (
    <>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
        <strong style={{ color: antallHuket === antallTotal && antallTotal > 0 ? '#2D7D46' : '#444' }}>{antallHuket} av {antallTotal} fullført</strong>
      </div>
      {dokumenter.map((d, i) => {
        const navn = d?.navn || `Dokument ${i + 1}`
        const s = STATUS_ETIKETT[d?.status as keyof typeof STATUS_ETIKETT] || STATUS_ETIKETT.maa_sjekkes
        const brukerStatus = lokalt[navn] || { huket: false, notat: '', oppdatert: '' }
        const huket = !!brukerStatus.huket
        return (
          <div key={navn + i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #eee' : 'none', opacity: huket ? 0.65 : 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 10, alignItems: 'start' }}>
              <input
                type="checkbox"
                checked={huket}
                onChange={e => settHuket(navn, e.target.checked)}
                title={huket ? 'Marker som ikke gjort' : 'Marker som gjort'}
                style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }}
              />
              <span style={{ background: s.bg, color: s.farge, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{s.tekst}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, textDecoration: huket ? 'line-through' : 'none' }}>{navn}</div>
                {d?.kommentar && <div style={{ fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.5 }}>{d.kommentar}</div>}
                <textarea
                  value={brukerStatus.notat || ''}
                  onChange={e => settNotat(navn, e.target.value)}
                  placeholder="Ditt notat (ref.nr, hvor det ligger, ventetid osv.)"
                  rows={brukerStatus.notat ? 2 : 1}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'inherit', marginTop: 6, resize: 'vertical', background: '#fafafa' }}
                />
                {brukerStatus.oppdatert && brukerStatus.notat && (
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Sist oppdatert: {new Date(brukerStatus.oppdatert).toLocaleString('nb-NO')}</div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function BildeplanKol({ tittel, liste }: { tittel: string; liste: string[] | undefined }) {
  if (!Array.isArray(liste) || liste.length === 0) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4 }}>{tittel.toUpperCase()}</div>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
        {liste.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </div>
  )
}
