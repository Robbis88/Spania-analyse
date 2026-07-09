'use client'
import { useCallback, useEffect, useState } from 'react'
import { FARGER, RADIUS, inputStyle, labelStyle, selectStyle } from '../lib/styles'
import type { Maal } from '../types'

// Mål (B11) — utdrag fra tidligere DagligBrief. Ren sammenligning mot
// porteføljen, ingen egen motor. Får selskaps- og rangeringstall som props
// (Hjem har dem allerede) og henter kun målene selv.
type SelskRad = { id: string; navn: string; antall_eiendommer: number; bundet_ek: number }
type RangRad = { cashflow_mnd: number | null }

const fmtVal = (n: number) => Math.round(n || 0).toLocaleString('nb-NO') + ' kr'
const ENHET_LBL: Record<string, string> = { antall_boliger: 'boliger', egenkapital: 'egenkapital', cashflow_mnd: 'cashflow/mnd' }

export function MaalSeksjon({ selsk, rang }: { selsk: SelskRad[]; rang: RangRad[] }) {
  const [maal, setMaal] = useState<Maal[]>([])
  const [visMaal, setVisMaal] = useState(false)

  const hent = useCallback(async () => {
    const m = await fetch('/api/maal').then(x => x.json()).catch(() => ({}))
    setMaal(m.maal || [])
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  function naaVerdi(m: Maal): number {
    if (m.enhet === 'antall_boliger') {
      const kilde = m.selskap_id ? selsk.filter(s => s.id === m.selskap_id) : selsk
      return kilde.reduce((s, x) => s + x.antall_eiendommer, 0)
    }
    if (m.enhet === 'egenkapital') {
      const kilde = m.selskap_id ? selsk.filter(s => s.id === m.selskap_id) : selsk
      return kilde.reduce((s, x) => s + x.bundet_ek, 0)
    }
    return rang.reduce((s, x) => s + (x.cashflow_mnd || 0), 0)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase' }}>Mål</div>
        <button onClick={() => setVisMaal(v => !v)} style={{ background: 'none', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: FARGER.tekstMid }}>
          {visMaal ? 'Lukk' : 'Administrer mål'}
        </button>
      </div>

      {maal.length === 0 && !visMaal && <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic' }}>Ingen mål satt ennå.</div>}

      <div style={{ display: 'grid', gap: 8 }}>
        {maal.map(m => {
          const naa = naaVerdi(m)
          const pct = m.maaltall > 0 ? Math.min(100, (naa / m.maaltall) * 100) : 0
          const naadd = naa >= m.maaltall
          return (
            <div key={m.id} style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: FARGER.mork }}>{m.beskrivelse}</span>
                <span style={{ color: naadd ? FARGER.suksess : FARGER.tekstMid, fontWeight: 600 }}>
                  {m.enhet === 'antall_boliger' ? `${Math.round(naa)} / ${m.maaltall}` : `${fmtVal(naa)} / ${fmtVal(m.maaltall)}`} {ENHET_LBL[m.enhet]}
                </span>
              </div>
              <div style={{ height: 6, background: FARGER.flateMid, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: naadd ? FARGER.suksess : FARGER.gull }} />
              </div>
            </div>
          )
        })}
      </div>

      {visMaal && <MaalEditor selsk={selsk} maal={maal} onEndret={hent} />}
    </div>
  )
}

function MaalEditor({ selsk, maal, onEndret }: { selsk: SelskRad[]; maal: Maal[]; onEndret: () => Promise<void> | void }) {
  const [beskrivelse, setBeskrivelse] = useState('')
  const [maaltall, setMaaltall] = useState('')
  const [enhet, setEnhet] = useState<Maal['enhet']>('antall_boliger')
  const [selskapId, setSelskapId] = useState('')
  const [frist, setFrist] = useState('')

  async function lagre() {
    if (!beskrivelse.trim() || !Number(maaltall)) return
    await fetch('/api/maal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beskrivelse, maaltall: Number(maaltall), enhet, selskap_id: selskapId || null, frist: frist || null }),
    })
    setBeskrivelse(''); setMaaltall(''); setFrist('')
    onEndret()
  }
  async function slett(id: string) {
    await fetch(`/api/maal?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    onEndret()
  }

  return (
    <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 16, marginTop: 12 }}>
      {maal.map(m => (
        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '4px 0' }}>
          <span>{m.beskrivelse} — {m.maaltall} {ENHET_LBL[m.enhet]}</span>
          <button onClick={() => slett(m.id)} style={{ background: 'none', border: 'none', color: FARGER.feil, cursor: 'pointer', fontSize: 12 }}>Slett</button>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 12, alignItems: 'end' }}>
        <div><label style={labelStyle}>Beskrivelse</label><input value={beskrivelse} onChange={e => setBeskrivelse(e.target.value)} style={inputStyle} placeholder="10 boliger innen 2032" /></div>
        <div><label style={labelStyle}>Måltall</label><input type="number" value={maaltall} onChange={e => setMaaltall(e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Enhet</label>
          <select value={enhet} onChange={e => setEnhet(e.target.value as Maal['enhet'])} style={selectStyle}>
            <option value="antall_boliger">Antall boliger</option>
            <option value="egenkapital">Egenkapital</option>
            <option value="cashflow_mnd">Cashflow/mnd</option>
          </select>
        </div>
        <div><label style={labelStyle}>Selskap (valgfritt)</label>
          <select value={selskapId} onChange={e => setSelskapId(e.target.value)} style={selectStyle}>
            <option value="">Konsern</option>
            {selsk.map(s => <option key={s.id} value={s.id}>{s.navn}</option>)}
          </select>
        </div>
        <button onClick={lagre} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Legg til</button>
      </div>
    </div>
  )
}
