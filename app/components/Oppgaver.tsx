'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loggAktivitet } from '../lib/logg'
import type { Oppgave } from '../types'
import { beregnEffektivPrioritet, fristTekst } from '../lib/oppgaver'
import { prioritetFarge, prioritetLabel, inputStyle, selectStyle, labelStyle, fieldStyle, FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

export function Oppgaver() {
  const [oppgaver, setOppgaver] = useState<Oppgave[]>([])
  const [nyTittel, setNyTittel] = useState('')
  const [nyAnsvar, setNyAnsvar] = useState('')
  const [nyPrioritet, setNyPrioritet] = useState<'hast' | 'normal' | 'lav'>('normal')
  const [nyFrist, setNyFrist] = useState('')
  const [visNyOppgave, setVisNyOppgave] = useState(false)

  useEffect(() => { hentOppgaver() }, [])

  async function hentOppgaver() {
    const { data } = await supabase
      .from('oppgaver')
      .select('id, tittel, ansvar, prioritet, status, frist, opprettet')
      .order('opprettet', { ascending: false })
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
      background: FARGER.hvit,
      border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg,
      marginBottom: 24,
      overflow: 'hidden',
      boxShadow: SHADOW.sm,
    }}>
      <div style={{
        background: FARGER.creamLys,
        padding: '18px 22px',
        borderBottom: `1px solid ${FARGER.kantUltralys}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: FARGER.mork, letterSpacing: '-0.005em' }}>Aktive oppgaver</h2>
          <button onClick={() => setVisNyOppgave(!visNyOppgave)} className="knapp-hover-loft"
            style={{
              background: FARGER.mork, color: FARGER.creamLys, border: 'none',
              borderRadius: RADIUS.pill, padding: '9px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: SHADOW.sm,
              transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
            }}>
            + Ny oppgave
          </button>
        </div>
      </div>
      <div style={{ padding: 22 }}>
      {visNyOppgave && (
        <div className="anim-fade-down" style={{
          background: FARGER.flateLys,
          borderRadius: RADIUS.md,
          padding: 18,
          marginBottom: 18,
          border: `1px solid ${FARGER.kantUltralys}`,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
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
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={leggTilOppgave} className="knapp-hover-loft" style={{
              flex: 1, background: FARGER.mork, color: FARGER.creamLys,
              border: 'none', borderRadius: RADIUS.pill, padding: 12,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: SHADOW.sm,
            }}>Legg til</button>
            <button onClick={() => setVisNyOppgave(false)} style={{
              background: FARGER.hvit, color: FARGER.tekstMid,
              border: `1px solid ${FARGER.kantUltralys}`,
              borderRadius: RADIUS.pill, padding: '12px 20px',
              fontSize: 13, cursor: 'pointer', fontWeight: 500,
            }}>Avbryt</button>
          </div>
        </div>
      )}
      {oppgaver.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: FARGER.tekstLys, fontSize: 14 }}>Ingen oppgaver ennå</div>}
      {oppgaver.map(o => {
        const ep = beregnEffektivPrioritet(o)
        const pf = prioritetFarge(ep, o.status)
        const ft = o.status === 'ferdig' ? '' : fristTekst(o.frist)
        return (
          <div key={o.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '12px 14px', marginBottom: 8,
            background: pf.bg, border: `1px solid ${pf.border}`,
            borderRadius: RADIUS.md,
            opacity: o.status === 'ferdig' ? 0.6 : 1,
            transition: `opacity ${MOTION.rask}`,
          }}>
            <input type="checkbox" checked={o.status === 'ferdig'} onChange={() => toggleOppgave(o)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: o.status === 'ferdig' ? FARGER.tekstLys : FARGER.mork, textDecoration: o.status === 'ferdig' ? 'line-through' : 'none', letterSpacing: '-0.005em' }}>{o.tittel}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                {o.ansvar && <div style={{ fontSize: 12, color: FARGER.tekstLys }}>👤 {o.ansvar}</div>}
                {ft && <div style={{ fontSize: 12, fontWeight: 500, color: pf.color }}>{ft}</div>}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: pf.color, whiteSpace: 'nowrap' }}>{o.status === 'ferdig' ? '🟢 Ferdig' : prioritetLabel(ep)}</div>
            <button onClick={() => slettOppgave(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: FARGER.tekstLys, flexShrink: 0, opacity: 0.6, transition: `opacity ${MOTION.rask}` }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>🗑️</button>
          </div>
        )
      })}
      </div>
    </div>
  )
}
