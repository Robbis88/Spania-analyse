'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FORMAAL_ETIKETT, type Formaal } from '../lib/epost'
import { FARGER, RADIUS, SHADOW } from '../lib/styles'

type EpostRad = {
  id: string
  til: string
  mottaker_navn: string | null
  formaal: Formaal
  emne: string
  innhold_sendt: string | null
  status: string
  feilmelding: string | null
  har_vedlegg: boolean
  vedlegg_filnavn: string | null
  sendt_av: string
  sendt_tidspunkt: string | null
  opprettet: string
}

const FORMAAL_FARGE: Record<Formaal, string> = {
  bank_finansieringssamtale: '#0e1726',
  megler_boligsporsmal: '#D4814E',
  megler_befaring: '#D4814E',
  megler_bud: '#C8102E',
  selger_kontakt: '#B08030',
  haandverker_tilbud: '#6b9055',
  annet: '#666',
}

function formaterTid(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

export function SendteEposter({ prosjektId }: { prosjektId: string }) {
  const [rader, setRader] = useState<EpostRad[]>([])
  const [laster, setLaster] = useState(true)
  const [apen, setApen] = useState(false)
  const [utvidetRad, setUtvidetRad] = useState<string | null>(null)

  const hent = useCallback(async () => {
    const { data } = await supabase
      .from('eposter')
      .select('id, til, mottaker_navn, formaal, emne, innhold_sendt, status, feilmelding, har_vedlegg, vedlegg_filnavn, sendt_av, sendt_tidspunkt, opprettet')
      .eq('relatert_prosjekt_id', prosjektId)
      .order('opprettet', { ascending: false })
      .limit(50)
    if (data) setRader(data as EpostRad[])
    setLaster(false)
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  const antall = rader.length

  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 20, marginBottom: 16, boxShadow: SHADOW.sm }}>
      <button onClick={() => setApen(!apen)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, fontSize: 14, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>
        <span>✉️ Sendte e-poster {antall > 0 && <span style={{ color: FARGER.tekstLys, fontWeight: 500 }}>({antall})</span>}</span>
        <span style={{ color: FARGER.tekstLys, fontSize: 12 }}>{apen ? '▲' : '▼'}</span>
      </button>

      {apen && (
        <div className="anim-fade-down" style={{ marginTop: 14 }}>
          {laster && <div style={{ fontSize: 13, color: FARGER.tekstLys, padding: 10 }}>⏳ Laster…</div>}
          {!laster && antall === 0 && (
            <div style={{ fontSize: 13.5, color: FARGER.tekstMid, fontStyle: 'italic', padding: 10 }}>Ingen e-poster sendt for dette prosjektet ennå.</div>
          )}
          {rader.map(r => {
            const erUtvidet = utvidetRad === r.id
            const erFeilet = r.status === 'feilet'
            const farge = FORMAAL_FARGE[r.formaal] || '#666'
            return (
              <div key={r.id} style={{ borderTop: `1px solid ${FARGER.kantUltralys}`, padding: '12px 0' }}>
                <div onClick={() => setUtvidetRad(erUtvidet ? null : r.id)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ background: farge, color: FARGER.creamLys, padding: '3px 10px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                    {FORMAAL_ETIKETT[r.formaal]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.005em' }}>{r.emne}</div>
                    <div style={{ fontSize: 11.5, color: FARGER.tekstLys, marginTop: 2 }}>
                      {r.mottaker_navn ? r.mottaker_navn + ' · ' : ''}{r.til}
                      {' · '}{r.sendt_av}
                      {r.har_vedlegg && ' · 📎'}
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, color: erFeilet ? '#C8102E' : '#2D7D46', fontWeight: 600 }}>
                    {erFeilet ? '❌ Feilet' : '✓ Sendt'}
                  </span>
                  <span style={{ fontSize: 11.5, color: FARGER.tekstLys, whiteSpace: 'nowrap' }}>
                    {formaterTid(r.sendt_tidspunkt || r.opprettet)}
                  </span>
                </div>
                {erUtvidet && (
                  <div className="anim-fade-up" style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 14, marginTop: 10, fontSize: 12.5, color: FARGER.tekstMid, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.65, border: `1px solid ${FARGER.kantUltralys}` }}>
                    {r.innhold_sendt || '(innhold mangler)'}
                    {r.har_vedlegg && <div style={{ marginTop: 10, fontSize: 12, color: FARGER.tekstLys }}>📎 Vedlegg: {r.vedlegg_filnavn}</div>}
                    {erFeilet && r.feilmelding && (
                      <div style={{ marginTop: 10, background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, borderRadius: RADIUS.md, padding: 10, fontSize: 12, color: '#7a0c1e' }}>
                        Feilmelding: {r.feilmelding}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
