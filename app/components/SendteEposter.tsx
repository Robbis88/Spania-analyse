'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FORMAAL_ETIKETT, type Formaal } from '../lib/epost'

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
    const { data } = await supabase.from('eposter').select('*')
      .eq('relatert_prosjekt_id', prosjektId)
      .order('opprettet', { ascending: false })
    if (data) setRader(data as EpostRad[])
    setLaster(false)
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  const antall = rader.length

  return (
    <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 16, marginBottom: 16 }}>
      <button onClick={() => setApen(!apen)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, fontSize: 14, fontWeight: 700, color: '#0e1726' }}>
        <span>✉️ Sendte e-poster {antall > 0 && <span style={{ color: '#888', fontWeight: 500 }}>({antall})</span>}</span>
        <span style={{ color: '#888', fontSize: 12 }}>{apen ? '▲' : '▼'}</span>
      </button>

      {apen && (
        <div style={{ marginTop: 12 }}>
          {laster && <div style={{ fontSize: 12, color: '#888', padding: 8 }}>⏳ Laster...</div>}
          {!laster && antall === 0 && (
            <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic', padding: 8 }}>Ingen e-poster sendt for dette prosjektet ennå.</div>
          )}
          {rader.map(r => {
            const erUtvidet = utvidetRad === r.id
            const erFeilet = r.status === 'feilet'
            const farge = FORMAAL_FARGE[r.formaal] || '#666'
            return (
              <div key={r.id} style={{ borderTop: '1px solid #f0f0f0', padding: '10px 0' }}>
                <div onClick={() => setUtvidetRad(erUtvidet ? null : r.id)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: farge, color: 'white', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {FORMAAL_ETIKETT[r.formaal]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0e1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.emne}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {r.mottaker_navn ? r.mottaker_navn + ' · ' : ''}{r.til}
                      {' · '}{r.sendt_av}
                      {r.har_vedlegg && ' · 📎'}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: erFeilet ? '#C8102E' : '#2D7D46', fontWeight: 600 }}>
                    {erFeilet ? '❌ Feilet' : '✓ Sendt'}
                  </span>
                  <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                    {formaterTid(r.sendt_tidspunkt || r.opprettet)}
                  </span>
                </div>
                {erUtvidet && (
                  <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 12, marginTop: 8, fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                    {r.innhold_sendt || '(innhold mangler)'}
                    {r.har_vedlegg && <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>📎 Vedlegg: {r.vedlegg_filnavn}</div>}
                    {erFeilet && r.feilmelding && (
                      <div style={{ marginTop: 8, background: '#fde8ec', border: '1px solid #C8102E44', borderRadius: 6, padding: 8, fontSize: 11, color: '#7a0c1e' }}>
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
