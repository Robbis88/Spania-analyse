'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loggAktivitet } from '../lib/logg'
import type { Oppgave } from '../types'
import { beregnEffektivPrioritet, fristTekst } from '../lib/oppgaver'
import { prioritetFarge, prioritetLabel, inputStyle, selectStyle, labelStyle, fieldStyle } from '../lib/styles'

export function Oppgaver() {
  const [oppgaver, setOppgaver] = useState<Oppgave[]>([])
  const [nyTittel, setNyTittel] = useState('')
  const [nyAnsvar, setNyAnsvar] = useState('')
  const [nyPrioritet, setNyPrioritet] = useState<'hast' | 'normal' | 'lav'>('normal')
  const [nyFrist, setNyFrist] = useState('')
  const [visNyOppgave, setVisNyOppgave] = useState(false)

  useEffect(() => { hentOppgaver() }, [])

  async function hentOppgaver() {
    const { data } = await supabase.from('oppgaver').select('*').order('opprettet', { ascending: false })
    if (data) {
      const sortert = [...data].sort((a, b) => {
        if (a.status === 'ferdig' && b.status !== 'ferdig') return 1
        if (a.status !== 'ferdig' && b.status === 'ferdig') return -1
        const pr = { hast: 0, normal: 1, lav: 2 }
        return pr[beregnEffektivPrioritet(a as Oppgave)] - pr[beregnEffektivPrioritet(b as Oppgave)]
      })
      setOppgaver(sortert as Oppgave[])
    }
  }

  async function leggTilOppgave() {
    if (!nyTittel) return
    const id = Date.now().toString()
    await supabase.from('oppgaver').insert([{ id, tittel: nyTittel, ansvar: nyAnsvar, prioritet: nyPrioritet, frist: nyFrist, status: 'aktiv' }])
    await loggAktivitet({ handling: 'opprettet oppgave', tabell: 'oppgaver', rad_id: id, detaljer: { tittel: nyTittel } })
    setNyTittel(''); setNyAnsvar(''); setNyPrioritet('normal'); setNyFrist('')
    setVisNyOppgave(false); await hentOppgaver()
  }

  async function toggleOppgave(o: Oppgave) {
    const ny = o.status === 'aktiv' ? 'ferdig' : 'aktiv'
    await supabase.from('oppgaver').update({ status: ny }).eq('id', o.id)
    await loggAktivitet({ handling: ny === 'ferdig' ? 'krysset av oppgave' : 'gjenåpnet oppgave', tabell: 'oppgaver', rad_id: o.id, detaljer: { tittel: o.tittel } })
    await hentOppgaver()
  }

  async function slettOppgave(id: string) {
    const o = oppgaver.find(x => x.id === id)
    await supabase.from('oppgaver').delete().eq('id', id)
    await loggAktivitet({ handling: 'slettet oppgave', tabell: 'oppgaver', rad_id: id, detaljer: { tittel: o?.tittel } })
    await hentOppgaver()
  }

  return (
    <div style={{
      background: 'white',
      border: '1.5px solid #D8687F55',
      borderRadius: 16,
      marginBottom: 24,
      overflow: 'hidden',
      boxShadow: '0 4px 14px rgba(216, 104, 127, 0.12)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #FFDDE5 0%, #F4A4B5 100%)',
        padding: '16px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -10, top: -14, fontSize: 90, opacity: 0.2, lineHeight: 1, transform: 'rotate(14deg)' }}>🌺</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1, gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#6e1f35' }}>🌺 Gjøremål</h2>
          <button onClick={() => setVisNyOppgave(!visNyOppgave)} style={{ background: '#6e1f35', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Ny oppgave</button>
        </div>
      </div>
      <div style={{ padding: 20 }}>
      {visNyOppgave && (
        <div style={{ background: '#f8f8f8', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div style={fieldStyle}><label style={labelStyle}>Oppgave</label><input style={inputStyle} value={nyTittel} onChange={e => setNyTittel(e.target.value)} placeholder="Hva skal gjøres?" onKeyDown={e => e.key === 'Enter' && leggTilOppgave()} /></div>
            <div style={fieldStyle}><label style={labelStyle}>Ansvar</label><input style={inputStyle} value={nyAnsvar} onChange={e => setNyAnsvar(e.target.value)} placeholder="Hvem?" /></div>
            <div style={fieldStyle}><label style={labelStyle}>Frist</label><input style={inputStyle} type="date" value={nyFrist} onChange={e => setNyFrist(e.target.value)} /></div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Prioritet</label>
              <select style={selectStyle} value={nyPrioritet} onChange={e => setNyPrioritet(e.target.value as 'hast' | 'normal' | 'lav')}>
                <option value="hast">🔴 Hast</option><option value="normal">🟡 Normal</option><option value="lav">⚪ Lav</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={leggTilOppgave} style={{ flex: 1, background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>✅ Legg til</button>
            <button onClick={() => setVisNyOppgave(false)} style={{ background: '#f0f0f0', color: '#444', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>Avbryt</button>
          </div>
        </div>
      )}
      {oppgaver.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa', fontSize: 14 }}>Ingen oppgaver ennå!</div>}
      {oppgaver.map(o => {
        const ep = beregnEffektivPrioritet(o)
        const pf = prioritetFarge(ep, o.status)
        const ft = o.status === 'ferdig' ? '' : fristTekst(o.frist)
        return (
          <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', marginBottom: 8, background: pf.bg, border: `1.5px solid ${pf.border}`, borderRadius: 10, opacity: o.status === 'ferdig' ? 0.6 : 1 }}>
            <input type="checkbox" checked={o.status === 'ferdig'} onChange={() => toggleOppgave(o)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: o.status === 'ferdig' ? '#888' : '#1a1a2e', textDecoration: o.status === 'ferdig' ? 'line-through' : 'none' }}>{o.tittel}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                {o.ansvar && <div style={{ fontSize: 12, color: '#888' }}>👤 {o.ansvar}</div>}
                {ft && <div style={{ fontSize: 12, fontWeight: 500, color: pf.color }}>{ft}</div>}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: pf.color, whiteSpace: 'nowrap' }}>{o.status === 'ferdig' ? '🟢 Ferdig' : prioritetLabel(ep)}</div>
            <button onClick={() => slettOppgave(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#ccc', flexShrink: 0 }}>🗑️</button>
          </div>
        )
      })}
      </div>
    </div>
  )
}
