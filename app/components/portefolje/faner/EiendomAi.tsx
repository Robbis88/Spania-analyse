'use client'
import { useState } from 'react'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import type { EiendomData } from '../useEiendomData'
import { TomTilstand, fmtNok } from './faneUi'

const STRATEGI_ETIKETT: Record<string, string> = {
  behold: '🏖️ Behold som utleie',
  puss_opp: '🔨 Puss opp før neste steg',
  selg: '💰 Selg nå',
  refinansier: '🏦 Refinansier lånet',
  oke_leie: '📈 Øk leien',
}

const STATUS_FARGE: Record<string, { bg: string; tekst: string }> = {
  sterk:      { bg: '#e8f5ed', tekst: '#1a4d2b' },
  akseptabel: { bg: '#faf7ee', tekst: '#7a4a08' },
  svak:       { bg: '#fff8e1', tekst: '#7a4a08' },
  kritisk:    { bg: '#fde8ec', tekst: '#7a0c1e' },
}

type AiData = {
  oppsummering?: string
  leie_vurdering?: { kan_okes?: boolean; estimat_okning_kr?: number; begrunnelse?: string }
  rente_vurdering?: { er_hoy?: boolean; kommentar?: string }
  refinansiering?: { anbefal?: boolean; potensial_per_mnd?: number; kommentar?: string }
  strategi?: { anbefaling?: string; begrunnelse?: string }
  cashflow_diagnose?: { status?: string; hovedaarsak?: string; tiltak?: string[] }
  oppgraderinger?: Array<{ navn: string; estimat_kostnad: number; forventet_verdiokning: number; begrunnelse: string }>
}

type Props = { data: EiendomData; onEndret: () => void | Promise<void> }

export function EiendomAi({ data, onEndret }: Props) {
  // Bruker dataen direkte fra prosjektet (ingen lokal speiling) — hooket lar
  // refresh() oppdatere visningen etter at AI-en har kjørt.
  const ai = (data.prosjekt?.portefolje_ai_data ? data.prosjekt.portefolje_ai_data as AiData : null)
  const generert = data.prosjekt?.portefolje_ai_generert || null
  const [kjorer, setKjorer] = useState(false)

  async function kjor(tvingNy = false) {
    if (!data.prosjekt) return
    setKjorer(true)
    const res = await fetch('/api/portefolje/ai-forslag', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prosjekt_id: data.prosjekt.id, tving_ny: tvingNy }),
    })
    setKjorer(false)
    const resp = await res.json().catch(() => ({}))
    if (!res.ok) {
      visToast(resp?.feil || 'AI feilet', 'feil', 4000)
      return
    }
    if (!resp.cachet) visToast('AI-analyse oppdatert', 'suksess', 2500)
    await onEndret()  // re-henter prosjektet → ny ai-data plukkes opp neste render
  }

  if (!ai) {
    return (
      <div>
        <TomTilstand tekst="Ingen AI-analyse ennå. Trykk under for å la Claude vurdere leie, rente, refinansiering og oppgraderinger." />
        <button onClick={() => kjor(false)} disabled={kjorer}
          style={{ background: kjorer ? FARGER.tekstLys : FARGER.mork, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: RADIUS.sm, fontSize: 13, fontWeight: 600, cursor: kjorer ? 'wait' : 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {kjorer ? '⏳ Genererer…' : '✨ Kjør AI-analyse'}
        </button>
      </div>
    )
  }

  const cf = ai.cashflow_diagnose
  const cfFarge = cf?.status ? STATUS_FARGE[cf.status] : null

  return (
    <div>
      {/* Header med metadata */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          {generert && (
            <div style={{ fontSize: 11, color: FARGER.tekstLys }}>
              Sist generert: {new Date(generert).toLocaleString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <button onClick={() => kjor(true)} disabled={kjorer}
          style={{ background: kjorer ? FARGER.tekstLys : FARGER.flateMid, color: FARGER.mork, border: 'none', padding: '8px 14px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: kjorer ? 'wait' : 'pointer' }}>
          {kjorer ? '⏳' : '🔄 Kjør på nytt'}
        </button>
      </div>

      {/* Oppsummering + strategi */}
      {ai.oppsummering && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Oppsummering
          </div>
          <p style={{ fontSize: 14, color: FARGER.mork, lineHeight: 1.6, margin: 0 }}>{ai.oppsummering}</p>

          {ai.strategi?.anbefaling && (
            <div style={{ marginTop: 14, padding: 14, background: FARGER.creamLys, borderRadius: RADIUS.sm }}>
              <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
                Hovedanbefaling
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.mork, marginBottom: 6 }}>
                {STRATEGI_ETIKETT[ai.strategi.anbefaling] || ai.strategi.anbefaling}
              </div>
              {ai.strategi.begrunnelse && (
                <p style={{ fontSize: 13, color: FARGER.tekstMid, lineHeight: 1.6, margin: 0 }}>{ai.strategi.begrunnelse}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cashflow-diagnose */}
      {cf?.status && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              💼 Cashflow-diagnose
            </div>
            {cfFarge && (
              <span style={{ background: cfFarge.bg, color: cfFarge.tekst, padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                {cf.status}
              </span>
            )}
          </div>
          {cf.hovedaarsak && <p style={{ fontSize: 13, color: FARGER.mork, lineHeight: 1.6, margin: '0 0 10px' }}>{cf.hovedaarsak}</p>}
          {cf.tiltak && cf.tiltak.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, marginBottom: 6 }}>Konkrete tiltak:</div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: FARGER.tekstMid, lineHeight: 1.7 }}>
                {cf.tiltak.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tre vurderinger side om side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 14 }}>
        {ai.leie_vurdering && (
          <VurderingsKort
            ikon="📈"
            tittel="Leie"
            badge={ai.leie_vurdering.kan_okes ? 'Kan økes' : 'OK nivå'}
            badgeFarge={ai.leie_vurdering.kan_okes ? FARGER.suksess : FARGER.tekstMid}
            tall={ai.leie_vurdering.estimat_okning_kr ? '+' + fmtNok(ai.leie_vurdering.estimat_okning_kr) + '/mnd' : null}
            tekst={ai.leie_vurdering.begrunnelse} />
        )}
        {ai.rente_vurdering && (
          <VurderingsKort
            ikon="💰"
            tittel="Rente"
            badge={ai.rente_vurdering.er_hoy ? 'For høy' : 'OK'}
            badgeFarge={ai.rente_vurdering.er_hoy ? FARGER.feil : FARGER.suksess}
            tekst={ai.rente_vurdering.kommentar} />
        )}
        {ai.refinansiering && (
          <VurderingsKort
            ikon="🏦"
            tittel="Refinansiering"
            badge={ai.refinansiering.anbefal ? 'Anbefalt' : 'Ikke nødvendig'}
            badgeFarge={ai.refinansiering.anbefal ? FARGER.advarsel : FARGER.tekstMid}
            tall={ai.refinansiering.potensial_per_mnd ? 'Spar ' + fmtNok(ai.refinansiering.potensial_per_mnd) + '/mnd' : null}
            tekst={ai.refinansiering.kommentar} />
        )}
      </div>

      {/* Oppgraderinger */}
      {ai.oppgraderinger && ai.oppgraderinger.length > 0 && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            🔨 Oppgraderinger med best ROI
          </div>
          {ai.oppgraderinger.map((o, i) => {
            const roi = o.estimat_kostnad > 0 ? (o.forventet_verdiokning / o.estimat_kostnad - 1) * 100 : 0
            return (
              <div key={i} style={{ borderTop: i > 0 ? `1px solid ${FARGER.flateLys}` : 'none', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork }}>{o.navn}</div>
                  <div style={{ fontSize: 12, color: roi >= 0 ? FARGER.suksess : FARGER.feil, fontWeight: 600 }}>
                    ROI {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                  </div>
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 6 }}>
                  Kostnad {fmtNok(o.estimat_kostnad)} → forventet verdiøkning {fmtNok(o.forventet_verdiokning)}
                </div>
                <p style={{ fontSize: 13, color: FARGER.tekstMid, lineHeight: 1.5, margin: 0 }}>{o.begrunnelse}</p>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 10, color: FARGER.tekstLys, fontStyle: 'italic', textAlign: 'center', padding: 12 }}>
        AI-anbefalinger er rådgivende — ikke en juridisk eller finansiell garanti. Verifisér alltid med rådgiver før viktige beslutninger.
      </div>
    </div>
  )
}

function VurderingsKort({ ikon, tittel, badge, badgeFarge, tall, tekst }: {
  ikon: string; tittel: string; badge: string; badgeFarge: string; tall?: string | null; tekst?: string
}) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{ikon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork }}>{tittel}</span>
        <span style={{ marginLeft: 'auto', background: badgeFarge + '22', color: badgeFarge, padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>{badge}</span>
      </div>
      {tall && <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork, marginBottom: 6 }}>{tall}</div>}
      {tekst && <p style={{ fontSize: 12, color: FARGER.tekstMid, lineHeight: 1.5, margin: 0 }}>{tekst}</p>}
    </div>
  )
}
