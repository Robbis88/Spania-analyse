'use client'
import { useRef, useState } from 'react'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS } from '../lib/styles'

export type TakstData = {
  vurdert_markedsverdi_nok?: number
  laneverdi_nok?: number
  adresse?: string
  byggear?: number
  areal_bra_m2?: number
  areal_p_rom_m2?: number
  energimerke?: string
  eierform?: string
  tilstandsgrader?: Array<{ del: string; tg: 0 | 1 | 2 | 3; kommentar?: string; estimat_nok?: number }>
  rode_flagg?: Array<{ alvorlighet: 'kritisk' | 'advarsel' | 'info'; tittel: string; beskrivelse: string }>
  anbefalte_oppussingsposter?: Array<{ navn: string; kostnad_estimat_nok: number; begrunnelse: string; prioritet?: 'hast' | 'normal' | 'lav' }>
  ai_oppsummering?: string
}

const fmtNok = (n: number) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'

const TG_FARGE: Record<number, { bg: string; tekst: string; lbl: string }> = {
  0: { bg: '#e8f5ed', tekst: '#1a4d2b', lbl: 'TG0 — Ingen anmerkning' },
  1: { bg: '#faf7ee', tekst: '#5a6171', lbl: 'TG1 — Mindre tiltak' },
  2: { bg: '#fff8e1', tekst: '#7a4a08', lbl: 'TG2 — Vesentlig tiltak' },
  3: { bg: '#fde8ec', tekst: '#7a0c1e', lbl: 'TG3 — Stort/kritisk tiltak' },
}

const ALVOR_FARGE: Record<string, { bg: string; tekst: string; ramme: string; ikon: string }> = {
  kritisk:  { bg: '#fde8ec', tekst: '#7a0c1e', ramme: '#C8102E66', ikon: '🚨' },
  advarsel: { bg: '#fff8e1', tekst: '#7a4a08', ramme: '#B05E0A66', ikon: '⚠️' },
  info:     { bg: '#faf7ee', tekst: '#5a6171', ramme: '#b89a6f44', ikon: 'ℹ️' },
}

type Props = {
  /** Når brukeren trykker "Bruk markedsverdi" — kalkulator-state oppdateres */
  onBrukMarkedsverdi: (nok: number) => void
  /** Når brukeren trykker "Legg til alle" — oppussingsposter legges til kalkulator-listen */
  onLeggTilOppussingsposter: (poster: Array<{ navn: string; kostnad: number; notat: string }>) => void
}

export function TakstAnalyse({ onBrukMarkedsverdi, onLeggTilOppussingsposter }: Props) {
  const [data, setData] = useState<TakstData | null>(null)
  const [analyserer, setAnalyserer] = useState(false)
  const [filnavn, setFilnavn] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const filInputRef = useRef<HTMLInputElement>(null)

  async function analyser(fil: File) {
    if (analyserer) return
    setAnalyserer(true)
    setData(null)
    setFilnavn(fil.name)
    try {
      const form = new FormData()
      form.append('fil', fil)
      const res = await fetch('/api/analyse-takst', { method: 'POST', body: form })
      const resp = await res.json().catch(() => ({}))
      if (!res.ok || !resp.data) {
        visToast(resp?.feil || 'Takst-analyse feilet', 'feil', 4000)
        setFilnavn(null)
        return
      }
      setData(resp.data as TakstData)
      visToast('Takstrapport lest', 'suksess', 2500)
    } catch (e) {
      visToast(e instanceof Error ? e.message : 'Ukjent feil', 'feil', 4000)
      setFilnavn(null)
    } finally {
      setAnalyserer(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const fil = e.dataTransfer.files[0]
    if (fil) void analyser(fil)
  }

  function leggTilAllePoster() {
    if (!data?.anbefalte_oppussingsposter) return
    const poster = data.anbefalte_oppussingsposter.map(p => ({
      navn: p.navn,
      kostnad: p.kostnad_estimat_nok || 0,
      notat: p.begrunnelse || '',
    }))
    onLeggTilOppussingsposter(poster)
    visToast(`Lagt til ${poster.length} oppussingspost${poster.length !== 1 ? 'er' : ''}`, 'suksess', 3000)
  }

  function fjern() {
    setData(null); setFilnavn(null)
    if (filInputRef.current) filInputRef.current.value = ''
  }

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>
        📑 Takstrapport / e-takst
      </div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 14px', fontWeight: 300 }}>
        Last opp PDF — AI leser og henter ut markedsverdi, tilstandsgrader, røde flagg og anbefalte oppussingsposter du kan dra rett inn i kalkulatoren.
      </p>

      {/* Opplastingssone */}
      {!data && (
        <div
          onClick={() => !analyserer && filInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); if (!analyserer) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => !analyserer && onDrop(e)}
          style={{
            background: dragOver ? '#fff8e1' : FARGER.creamLys,
            border: `2px dashed ${dragOver ? FARGER.advarsel : FARGER.gullSvak}`,
            borderRadius: RADIUS.md, padding: 28, textAlign: 'center',
            cursor: analyserer ? 'wait' : 'pointer',
          }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>{analyserer ? '⏳' : '📑'}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, marginBottom: 4 }}>
            {analyserer ? `Leser ${filnavn || 'rapporten'}…` : 'Dra-og-slipp PDF eller klikk for å velge'}
          </div>
          <div style={{ fontSize: 12, color: FARGER.tekstLys }}>
            {analyserer ? 'Dette tar typisk 15-30 sekunder' : 'PDF, JPG, PNG eller WebP — opp til 25 MB'}
          </div>
          <input
            ref={filInputRef} type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) void analyser(f)
            }}
            style={{ display: 'none' }} />
        </div>
      )}

      {/* Resultat */}
      {data && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: FARGER.tekstLys }}>
              📄 {filnavn || 'takstrapport'}
            </span>
            <button onClick={fjern}
              style={{ background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none', padding: '5px 12px', borderRadius: RADIUS.sm, fontSize: 11, cursor: 'pointer' }}>
              Last opp ny
            </button>
          </div>

          {/* AI-oppsummering */}
          {data.ai_oppsummering && (
            <div style={{ background: FARGER.creamLys, borderRadius: RADIUS.sm, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
                Oppsummering
              </div>
              <p style={{ fontSize: 13, color: FARGER.mork, lineHeight: 1.6, margin: 0 }}>{data.ai_oppsummering}</p>
            </div>
          )}

          {/* Nøkkelfakta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
            {typeof data.vurdert_markedsverdi_nok === 'number' && (
              <Kpi lbl="Vurdert markedsverdi" stor={fmtNok(data.vurdert_markedsverdi_nok)} fremhev />
            )}
            {typeof data.laneverdi_nok === 'number' && (
              <Kpi lbl="Låneverdi" stor={fmtNok(data.laneverdi_nok)} />
            )}
            {data.byggear && <Kpi lbl="Byggeår" stor={String(data.byggear)} />}
            {data.areal_bra_m2 && <Kpi lbl="BRA" stor={`${data.areal_bra_m2} m²`} />}
            {data.energimerke && <Kpi lbl="Energimerke" stor={data.energimerke} />}
            {data.eierform && <Kpi lbl="Eierform" stor={data.eierform} />}
          </div>

          {/* "Bruk markedsverdi"-knapp */}
          {typeof data.vurdert_markedsverdi_nok === 'number' && data.vurdert_markedsverdi_nok > 0 && (
            <button onClick={() => { onBrukMarkedsverdi(data.vurdert_markedsverdi_nok!); visToast('Markedsverdi lagt inn i kalkulator', 'suksess', 2500) }}
              style={{ background: FARGER.mork, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
              ↗ Bruk markedsverdi i kalkulator
            </button>
          )}

          {/* Røde flagg */}
          {data.rode_flagg && data.rode_flagg.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                🔔 Viktige forhold ({data.rode_flagg.length})
              </div>
              {data.rode_flagg.map((rf, i) => {
                const f = ALVOR_FARGE[rf.alvorlighet] || ALVOR_FARGE.info
                return (
                  <div key={i} style={{ background: f.bg, border: `1px solid ${f.ramme}`, borderRadius: RADIUS.sm, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16 }}>{f.ikon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: f.tekst, marginBottom: 3 }}>{rf.tittel}</div>
                      <div style={{ fontSize: 12, color: FARGER.mork, lineHeight: 1.5 }}>{rf.beskrivelse}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tilstandsgrader */}
          {data.tilstandsgrader && data.tilstandsgrader.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                📐 Tilstandsgrader ({data.tilstandsgrader.length})
              </div>
              <div style={{ background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                {data.tilstandsgrader.map((tg, i) => {
                  const f = TG_FARGE[tg.tg] || TG_FARGE[1]
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '10px 14px', alignItems: 'center', borderTop: i > 0 ? `1px solid ${FARGER.flateLys}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>{tg.del}</div>
                        {tg.kommentar && <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2, lineHeight: 1.4 }}>{tg.kommentar}</div>}
                      </div>
                      {typeof tg.estimat_nok === 'number' && tg.estimat_nok > 0 && (
                        <span style={{ fontSize: 12, color: FARGER.tekstMid, whiteSpace: 'nowrap' }}>{fmtNok(tg.estimat_nok)}</span>
                      )}
                      <span style={{ background: f.bg, color: f.tekst, padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        TG{tg.tg}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Anbefalte oppussingsposter */}
          {data.anbefalte_oppussingsposter && data.anbefalte_oppussingsposter.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  🔨 Anbefalte oppussingsposter ({data.anbefalte_oppussingsposter.length})
                </div>
                <button onClick={leggTilAllePoster}
                  style={{ background: FARGER.mork, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em' }}>
                  ↘ Legg alle inn i kalkulatoren
                </button>
              </div>
              {data.anbefalte_oppussingsposter.map((p, i) => (
                <div key={i} style={{ background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 12, marginBottom: 6, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork }}>
                      {p.navn}
                      {p.prioritet === 'hast' && <span style={{ marginLeft: 8, fontSize: 10, color: FARGER.feil, fontWeight: 700 }}>HAST</span>}
                    </div>
                    <div style={{ fontSize: 11, color: FARGER.tekstMid, marginTop: 3, lineHeight: 1.5 }}>{p.begrunnelse}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork, whiteSpace: 'nowrap' }}>
                    {fmtNok(p.kostnad_estimat_nok)}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 10, color: FARGER.tekstLys, fontStyle: 'italic', marginTop: 8, textAlign: 'center' }}>
                Estimater er basert på takstmannens anbefalinger og typiske håndverkerpriser i NOK 2025. Verifiser med konkrete tilbud før budgivning.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Kpi({ lbl, stor, fremhev }: { lbl: string; stor: string; fremhev?: boolean }) {
  return (
    <div style={{
      background: fremhev ? '#fff' : FARGER.creamLys,
      border: fremhev ? `1.5px solid ${FARGER.gull}` : `1px solid ${FARGER.kantLys}`,
      borderRadius: RADIUS.sm, padding: 10,
    }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 3 }}>{lbl}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.mork }}>{stor}</div>
    </div>
  )
}
