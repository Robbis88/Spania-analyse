'use client'
import { useCallback, useEffect, useState } from 'react'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle, selectStyle } from '../lib/styles'
import type { Maal } from '../types'

type KonsRad = { valuta: string; kjopekraft: number; bundet_ek: number }
type SelskRad = { id: string; navn: string; valuta: string; antall_eiendommer: number; bundet_ek: number }
type RangRad = { id: string; navn: string; valuta: string; cashflow_mnd: number | null; flagg: Array<{ farge: 'rod' | 'gul'; tekst: string }> }

const fmtVal = (n: number, valuta: string) => (valuta === 'EUR' ? '€' : '') + Math.round(n || 0).toLocaleString('nb-NO') + (valuta === 'EUR' ? '' : ' kr')
const ENHET_LBL: Record<string, string> = { antall_boliger: 'boliger', egenkapital: 'egenkapital', cashflow_mnd: 'cashflow/mnd' }

export function DagligBrief({ onÅpnePortefolje }: { onÅpnePortefolje?: () => void }) {
  const [kons, setKons] = useState<KonsRad[]>([])
  const [selsk, setSelsk] = useState<SelskRad[]>([])
  const [rang, setRang] = useState<RangRad[]>([])
  const [maal, setMaal] = useState<Maal[]>([])
  const [brief, setBrief] = useState<string | null>(null)
  const [ber, setBer] = useState(false)
  const [visMaal, setVisMaal] = useState(false)

  const hent = useCallback(async () => {
    const [k, r, m] = await Promise.all([
      fetch('/api/kapital').then(x => x.json()).catch(() => ({})),
      fetch('/api/portefolje-rangering').then(x => x.json()).catch(() => ({})),
      fetch('/api/maal').then(x => x.json()).catch(() => ({})),
    ])
    setKons(k.konsolidert || [])
    setSelsk(k.selskaper || [])
    setRang(r.rader || [])
    setMaal(m.maal || [])
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  const flaggede = rang.filter(r => r.flagg.length > 0)

  function maalStatus(m: Maal): { naa: number } {
    if (m.enhet === 'antall_boliger') {
      const kilde = m.selskap_id ? selsk.filter(s => s.id === m.selskap_id) : selsk
      return { naa: kilde.reduce((s, x) => s + x.antall_eiendommer, 0) }
    }
    if (m.enhet === 'egenkapital') {
      const kilde = m.selskap_id ? selsk.filter(s => s.id === m.selskap_id) : selsk
      return { naa: kilde.reduce((s, x) => s + x.bundet_ek, 0) }
    }
    return { naa: rang.reduce((s, x) => s + (x.cashflow_mnd || 0), 0) }
  }

  async function beOmBrief() {
    setBer(true)
    try {
      const maal_status = maal.map(m => {
        const { naa } = maalStatus(m)
        return { beskrivelse: m.beskrivelse, naa: Math.round(naa), maaltall: m.maaltall, status: naa >= m.maaltall ? 'nådd' : `${Math.round((naa / m.maaltall) * 100)} %` }
      })
      const r = await fetch('/api/brief', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kjopekraft: kons,
          flagg: flaggede.flatMap(f => f.flagg.map(g => ({ navn: f.navn, tekst: g.tekst }))),
          maal_status,
        }),
      })
      const d = await r.json()
      setBrief(d.brief || d.feil || '')
    } catch { setBrief('Kunne ikke lage brief') } finally { setBer(false) }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Kjøpekraft + AI-brief */}
      <div style={{ background: FARGER.mork, color: FARGER.creamLys, borderRadius: RADIUS.lg, padding: 24, marginBottom: 18, boxShadow: SHADOW.md }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {kons.length === 0 && <div style={{ fontSize: 13, color: 'rgba(253,252,247,0.6)' }}>Kjøpekraft vises når selskaper og portefølje er lagt inn.</div>}
            {kons.map(k => (
              <div key={k.valuta}>
                <div style={{ fontSize: 10, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 4 }}>KJØPEKRAFT · {k.valuta}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtVal(k.kjopekraft, k.valuta)}</div>
              </div>
            ))}
          </div>
          <button onClick={beOmBrief} disabled={ber}
            style={{ background: FARGER.gull, color: FARGER.mork, border: 'none', padding: '10px 18px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', borderRadius: RADIUS.pill, cursor: ber ? 'default' : 'pointer', opacity: ber ? 0.6 : 1 }}>
            {ber ? 'Skriver…' : 'Dagens brief'}
          </button>
        </div>
        {brief && <p style={{ marginTop: 16, marginBottom: 0, fontSize: 14, lineHeight: 1.65, color: 'rgba(253,252,247,0.92)', whiteSpace: 'pre-wrap' }}>{brief}</p>}
      </div>

      {/* Flaggede eiendommer */}
      {flaggede.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>Krever oppmerksomhet</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {flaggede.slice(0, 6).map(f => (
              <button key={f.id} onClick={onÅpnePortefolje}
                style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, minWidth: 140 }}>{f.navn}</span>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {f.flagg.map((g, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: RADIUS.pill, background: g.farge === 'rod' ? FARGER.feilBg : FARGER.advarselBg, color: g.farge === 'rod' ? FARGER.feil : FARGER.advarsel }}>{g.tekst}</span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mål */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase' }}>Mål</div>
          <button onClick={() => setVisMaal(v => !v)} style={{ background: 'none', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: FARGER.tekstMid }}>
            {visMaal ? 'Lukk' : 'Administrer mål'}
          </button>
        </div>

        {maal.length === 0 && !visMaal && <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic' }}>Ingen mål satt ennå.</div>}

        <div style={{ display: 'grid', gap: 8 }}>
          {maal.map(m => {
            const { naa } = maalStatus(m)
            const pct = m.maaltall > 0 ? Math.min(100, (naa / m.maaltall) * 100) : 0
            const naadd = naa >= m.maaltall
            return (
              <div key={m.id} style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: FARGER.mork }}>{m.beskrivelse}</span>
                  <span style={{ color: naadd ? FARGER.suksess : FARGER.tekstMid, fontWeight: 600 }}>
                    {m.enhet === 'antall_boliger' ? `${Math.round(naa)} / ${m.maaltall}` : `${fmtVal(naa, 'NOK')} / ${fmtVal(m.maaltall, 'NOK')}`} {ENHET_LBL[m.enhet]}
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
