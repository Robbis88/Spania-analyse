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
  forhandlingsvurdering?: {
    anbefalt_avvik_pst?: number
    anbefalt_avvik_kr?: number
    begrunnelse?: string
    forhandlingsspaker?: string[]
  }
  mangler_i_rapporten?: Array<{ punkt: string; hvorfor_viktig: string }>
  aldersrelaterte_risikoer?: Array<{ risiko: string; hvordan_sjekke: string; estimat_om_funnet_nok?: number }>
  sporsmal_til_megler?: string[]
  takst_kvalitet?: {
    grundighet?: 'overfladisk' | 'normal' | 'grundig'
    kommentar?: string
  }
  samlet_oppussingsbehov?: {
    minimum_nok?: number
    realistisk_nok?: number
    maksimum_nok?: number
  }
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
  /** Kontrollert: data og filnavn ligger i parent slik at de kan lagres i prosjektet */
  data: TakstData | null
  filnavn: string | null
  onData: (data: TakstData | null) => void
  onFilnavn: (navn: string | null) => void
  /** Når brukeren trykker "Bruk markedsverdi" — kalkulator-state oppdateres */
  onBrukMarkedsverdi: (nok: number) => void
  /** Når brukeren trykker "Legg til alle" — oppussingsposter legges til kalkulator-listen */
  onLeggTilOppussingsposter: (poster: Array<{ navn: string; kostnad: number; notat: string }>) => void
}

export function TakstAnalyse({ data, filnavn, onData, onFilnavn, onBrukMarkedsverdi, onLeggTilOppussingsposter }: Props) {
  const [analyserer, setAnalyserer] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const filInputRef = useRef<HTMLInputElement>(null)

  async function analyser(fil: File) {
    if (analyserer) return
    setAnalyserer(true)
    onData(null)
    onFilnavn(fil.name)
    try {
      const form = new FormData()
      form.append('fil', fil)
      const res = await fetch('/api/analyse-takst', { method: 'POST', body: form })
      // Prøv JSON først; hvis serveren har returnert HTML (500-feilside) får vi rå tekst
      let resp: { feil?: string; data?: TakstData } = {}
      const tekst = await res.text()
      try { resp = JSON.parse(tekst) } catch { /* ikke JSON */ }
      if (!res.ok || !resp.data) {
        const beskrivelse = resp.feil || `HTTP ${res.status} — serveren svarte ikke med JSON: ${tekst.slice(0, 120)}`
        console.error('Takst-analyse feilet:', { status: res.status, resp, raTekst: tekst.slice(0, 500) })
        visToast(beskrivelse, 'feil', 6000)
        onFilnavn(null)
        return
      }
      onData(resp.data)
      visToast('Takstrapport lest', 'suksess', 2500)
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Ukjent feil'
      console.error('Takst-analyse exception:', e)
      visToast('Nettverksfeil: ' + m, 'feil', 5000)
      onFilnavn(null)
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
    onData(null); onFilnavn(null)
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

          {/* Forhandlingsvurdering */}
          {data.forhandlingsvurdering && (data.forhandlingsvurdering.anbefalt_avvik_kr || data.forhandlingsvurdering.begrunnelse) && (
            <div style={{ background: '#fff8e1', border: `1.5px solid ${FARGER.advarsel}66`, borderRadius: RADIUS.md, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#7a4a08', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                🤝 Forhandlingsposisjon
              </div>
              {(typeof data.forhandlingsvurdering.anbefalt_avvik_pst === 'number' || typeof data.forhandlingsvurdering.anbefalt_avvik_kr === 'number') && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
                  {typeof data.forhandlingsvurdering.anbefalt_avvik_pst === 'number' && (
                    <div>
                      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 2 }}>Anbefalt avvik fra prisantydning</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: data.forhandlingsvurdering.anbefalt_avvik_pst < 0 ? FARGER.suksess : FARGER.feil }}>
                        {data.forhandlingsvurdering.anbefalt_avvik_pst > 0 ? '+' : ''}{data.forhandlingsvurdering.anbefalt_avvik_pst.toFixed(1)} %
                      </div>
                    </div>
                  )}
                  {typeof data.forhandlingsvurdering.anbefalt_avvik_kr === 'number' && (
                    <div>
                      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 2 }}>I kroner</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: data.forhandlingsvurdering.anbefalt_avvik_kr < 0 ? FARGER.suksess : FARGER.feil }}>
                        {data.forhandlingsvurdering.anbefalt_avvik_kr > 0 ? '+' : ''}{Math.round(data.forhandlingsvurdering.anbefalt_avvik_kr).toLocaleString('nb-NO')} kr
                      </div>
                    </div>
                  )}
                </div>
              )}
              {data.forhandlingsvurdering.begrunnelse && (
                <p style={{ fontSize: 13, color: '#7a4a08', lineHeight: 1.6, margin: '0 0 10px' }}>{data.forhandlingsvurdering.begrunnelse}</p>
              )}
              {data.forhandlingsvurdering.forhandlingsspaker && data.forhandlingsvurdering.forhandlingsspaker.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#7a4a08', fontWeight: 600, marginBottom: 6 }}>Konkrete forhandlingsspaker:</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: FARGER.mork, lineHeight: 1.7 }}>
                    {data.forhandlingsvurdering.forhandlingsspaker.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Anbefalte oppussingsposter */}
          {data.anbefalte_oppussingsposter && data.anbefalte_oppussingsposter.length > 0 && (
            <div style={{ marginBottom: 14 }}>
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
            </div>
          )}

          {/* Samlet oppussingsbehov — totalbudsjett */}
          {data.samlet_oppussingsbehov && (data.samlet_oppussingsbehov.minimum_nok || data.samlet_oppussingsbehov.realistisk_nok) && (
            <div style={{ background: FARGER.creamLys, borderRadius: RADIUS.sm, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                💰 Samlet oppussingsbehov
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, fontSize: 13 }}>
                {typeof data.samlet_oppussingsbehov.minimum_nok === 'number' && (
                  <div>
                    <div style={{ fontSize: 10, color: FARGER.tekstLys }}>Minimum (kun kritisk)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.suksess }}>{fmtNok(data.samlet_oppussingsbehov.minimum_nok)}</div>
                  </div>
                )}
                {typeof data.samlet_oppussingsbehov.realistisk_nok === 'number' && (
                  <div>
                    <div style={{ fontSize: 10, color: FARGER.tekstLys }}>Realistisk (+ buffer)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.advarsel }}>{fmtNok(data.samlet_oppussingsbehov.realistisk_nok)}</div>
                  </div>
                )}
                {typeof data.samlet_oppussingsbehov.maksimum_nok === 'number' && (
                  <div>
                    <div style={{ fontSize: 10, color: FARGER.tekstLys }}>Maks (worst case)</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.feil }}>{fmtNok(data.samlet_oppussingsbehov.maksimum_nok)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mangler i rapporten */}
          {data.mangler_i_rapporten && data.mangler_i_rapporten.length > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                🕳️ Det rapporten IKKE sier ({data.mangler_i_rapporten.length})
              </div>
              {data.mangler_i_rapporten.map((m, i) => (
                <div key={i} style={{ borderTop: i > 0 ? `1px solid ${FARGER.flateLys}` : 'none', padding: '8px 0' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>{m.punkt}</div>
                  <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 3, lineHeight: 1.5 }}>{m.hvorfor_viktig}</div>
                </div>
              ))}
            </div>
          )}

          {/* Aldersrelaterte risikoer */}
          {data.aldersrelaterte_risikoer && data.aldersrelaterte_risikoer.length > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                ⏳ Aldersrelaterte risikoer{data.byggear ? ` (bygg ${data.byggear})` : ''}
              </div>
              {data.aldersrelaterte_risikoer.map((r, i) => (
                <div key={i} style={{ borderTop: i > 0 ? `1px solid ${FARGER.flateLys}` : 'none', padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>{r.risiko}</div>
                    {typeof r.estimat_om_funnet_nok === 'number' && r.estimat_om_funnet_nok > 0 && (
                      <span style={{ fontSize: 11, color: FARGER.feil, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        +{fmtNok(r.estimat_om_funnet_nok)} hvis funnet
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 3, lineHeight: 1.5 }}>{r.hvordan_sjekke}</div>
                </div>
              ))}
            </div>
          )}

          {/* Spørsmål til megler */}
          {data.sporsmal_til_megler && data.sporsmal_til_megler.length > 0 && (
            <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                📝 Spørsmål å stille megler / selger ({data.sporsmal_til_megler.length})
              </div>
              <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: FARGER.mork, lineHeight: 1.8 }}>
                {data.sporsmal_til_megler.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}

          {/* Takst-kvalitet */}
          {data.takst_kvalitet?.kommentar && (
            <div style={{ background: '#fff', border: `1px dashed ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Vurdering av takstrapporten
                </span>
                {data.takst_kvalitet.grundighet && (
                  <span style={{
                    background: data.takst_kvalitet.grundighet === 'grundig' ? '#e8f5ed' : data.takst_kvalitet.grundighet === 'normal' ? '#faf7ee' : '#fff8e1',
                    color: data.takst_kvalitet.grundighet === 'grundig' ? FARGER.suksess : data.takst_kvalitet.grundighet === 'normal' ? FARGER.tekstMid : FARGER.advarsel,
                    padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                  }}>{data.takst_kvalitet.grundighet}</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: FARGER.tekstMid, margin: 0, lineHeight: 1.5 }}>{data.takst_kvalitet.kommentar}</p>
            </div>
          )}

          <div style={{ fontSize: 10, color: FARGER.tekstLys, fontStyle: 'italic', marginTop: 8, textAlign: 'center' }}>
            AI-vurdering basert på rapportens innhold + bransjekunnskap. Estimatene er veiledende — verifiser alltid med konkrete tilbud og fagkyndig før budgivning.
          </div>
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
