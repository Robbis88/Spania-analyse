'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { FARGER, RADIUS, inputStyle, labelStyle, selectStyle } from '../../../lib/styles'
import type { Hendelsestype } from '../../../lib/logg'
import type { EiendomData } from '../useEiendomData'

type Logg = {
  id: string; bruker: string; handling: string; opprettet: string
  hendelsestype: Hendelsestype | null
  detaljer: Record<string, unknown> | null
}

const IKON: Record<string, string> = {
  kjopt: '🔑', bud: '📨', renovering_start: '🔨', renovering_slutt: '✅',
  verdivurdering: '📈', refinansiert: '🏦', utleid: '👥', tilbud_akseptert: '📝',
  anbefaling_gitt: '💡', solgt: '💰', generell: '•',
}
const MANUELLE: Array<{ v: Hendelsestype; lbl: string }> = [
  { v: 'kjopt', lbl: 'Kjøpt' }, { v: 'bud', lbl: 'Bud lagt' },
  { v: 'renovering_start', lbl: 'Renovering start' }, { v: 'renovering_slutt', lbl: 'Renovering ferdig' },
  { v: 'verdivurdering', lbl: 'Verdivurdering' }, { v: 'refinansiert', lbl: 'Refinansiert' },
  { v: 'utleid', lbl: 'Utleid' }, { v: 'solgt', lbl: 'Solgt' }, { v: 'generell', lbl: 'Annet' },
]

const fmtDato = (s: string) => s ? new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export function EiendomTidslinje({ data }: { data: EiendomData }) {
  const prosjektId = data.prosjekt!.id
  const [logg, setLogg] = useState<Logg[]>([])
  const [laster, setLaster] = useState(true)
  const [visSkjema, setVisSkjema] = useState(false)
  const [handling, setHandling] = useState('')
  const [type, setType] = useState<Hendelsestype>('generell')

  const hent = useCallback(async () => {
    setLaster(true)
    const { data: rader } = await supabase.from('aktivitetslogg').select('*')
      .eq('prosjekt_id', prosjektId).order('opprettet', { ascending: false })
    setLogg((rader || []) as Logg[])
    setLaster(false)
  }, [prosjektId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  async function leggTil() {
    if (!handling.trim()) return
    const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)
    await supabase.from('aktivitetslogg').insert([{
      id, bruker: hentAktivBruker() || 'ukjent', handling: handling.trim(),
      tabell: 'prosjekter', rad_id: prosjektId, prosjekt_id: prosjektId, hendelsestype: type, detaljer: null,
    }])
    setHandling(''); setType('generell'); setVisSkjema(false)
    await hent()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
          Full historikk for eiendommen. Nøkkelhendelser logges automatisk; du kan også legge inn hendelser manuelt.
        </p>
        <button onClick={() => setVisSkjema(v => !v)} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '9px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Hendelse
        </button>
      </div>

      {visSkjema && (
        <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: 12, alignItems: 'end' }}>
          <div><label style={labelStyle}>Hva skjedde?</label><input value={handling} onChange={e => setHandling(e.target.value)} style={inputStyle} placeholder="F.eks. Ny takst mottatt fra DNB" /></div>
          <div><label style={labelStyle}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as Hendelsestype)} style={selectStyle}>
              {MANUELLE.map(m => <option key={m.v} value={m.v}>{m.lbl}</option>)}
            </select>
          </div>
          <button onClick={leggTil} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Lagre</button>
        </div>
      )}

      {laster ? (
        <div style={{ padding: 30, color: FARGER.tekstLys }}>Laster tidslinje…</div>
      ) : logg.length === 0 ? (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys, fontSize: 13 }}>
          Ingen hendelser ennå. De dukker opp her etter hvert som ting skjer med eiendommen.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div style={{ position: 'absolute', left: 9, top: 4, bottom: 4, width: 2, background: FARGER.kantLys }} />
          {logg.map(l => (
            <div key={l.id} style={{ position: 'relative', marginBottom: 18 }}>
              <div style={{ position: 'absolute', left: -28, top: 0, width: 20, height: 20, borderRadius: '50%', background: FARGER.hvit, border: `2px solid ${FARGER.gull}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                {IKON[l.hendelsestype || 'generell'] || '•'}
              </div>
              <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 2 }}>{fmtDato(l.opprettet)} · {l.bruker}</div>
              <div style={{ fontSize: 14, color: FARGER.mork, fontWeight: 500 }}>
                {l.handling.charAt(0).toUpperCase() + l.handling.slice(1)}
              </div>
              {l.detaljer && Object.keys(l.detaljer).length > 0 && (
                <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 2 }}>
                  {Object.entries(l.detaljer).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
