'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS } from '../lib/styles'
import type { Timeloggning } from '../types'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const fmtDato = (s: string) =>
  new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtTimer = (n: number) =>
  Number.isInteger(n) ? `${n}t` : `${n.toFixed(1)}t`

// Konsistent fargevalg per bruker — samme palette som Aktivitetslogg
const BRUKER_FARGER = [
  { bg: '#FFE8D4', tekst: '#7a3b10' },
  { bg: '#D7F0EC', tekst: '#1e5b62' },
  { bg: '#FBEFC9', tekst: '#6e4812' },
  { bg: '#EDF4E4', tekst: '#2e4a1d' },
  { bg: '#FFDDE5', tekst: '#6e1f35' },
  { bg: '#E5DDFA', tekst: '#3e2469' },
]
function brukerFarge(b: string) {
  let h = 0
  for (let i = 0; i < b.length; i++) h = (h * 31 + b.charCodeAt(i)) | 0
  return BRUKER_FARGER[Math.abs(h) % BRUKER_FARGER.length]
}

const idag = () => new Date().toISOString().slice(0, 10)
const ukestart = (d: Date) => {
  const dag = d.getDay() === 0 ? 6 : d.getDay() - 1  // Mandag = 0
  const ny = new Date(d); ny.setDate(d.getDate() - dag); ny.setHours(0, 0, 0, 0)
  return ny
}
const mndStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

export function Timer({ onTilbake }: { onTilbake: () => void }) {
  const [loggninger, setLoggninger] = useState<Timeloggning[]>([])
  const [prosjekter, setProsjekter] = useState<Array<{ id: string; navn: string; marked?: string | null }>>([])
  const [laster, setLaster] = useState(true)
  const [filterBruker, setFilterBruker] = useState<'alle' | string>('alle')
  const [filterMaaned, setFilterMaaned] = useState<string>(new Date().toISOString().slice(0, 7))

  // Skjema-state
  const [aapent, setAapent] = useState(true)
  const [nyDato, setNyDato] = useState(idag())
  const [nyTimer, setNyTimer] = useState<string>('')
  const [nyBeskrivelse, setNyBeskrivelse] = useState('')
  const [nyProsjektId, setNyProsjektId] = useState<string>('')
  const [lagrer, setLagrer] = useState(false)
  const [redigerer, setRedigerer] = useState<string | null>(null)

  const aktivBruker = (typeof window !== 'undefined' ? hentAktivBruker() : null) || 'ukjent'

  const hent = useCallback(async () => {
    setLaster(true)
    const [tRes, pRes] = await Promise.all([
      supabase.from('timeloggninger')
        .select('id, bruker, dato, timer, beskrivelse, prosjekt_id, opprettet')
        .order('dato', { ascending: false })
        .order('opprettet', { ascending: false })
        .limit(500),
      supabase.from('prosjekter').select('id, navn, marked').order('opprettet', { ascending: false }),
    ])
    setLoggninger((tRes.data || []) as Timeloggning[])
    setProsjekter((pRes.data || []) as Array<{ id: string; navn: string; marked?: string | null }>)
    setLaster(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  async function lagre() {
    const t = Number(nyTimer)
    if (!Number.isFinite(t) || t <= 0) { visToast('Antall timer må være > 0', 'feil', 3000); return }
    if (!nyDato) { visToast('Dato mangler', 'feil', 3000); return }
    setLagrer(true)
    try {
      if (redigerer) {
        const { error } = await supabase.from('timeloggninger').update({
          dato: nyDato, timer: t,
          beskrivelse: nyBeskrivelse.trim() || null,
          prosjekt_id: nyProsjektId || null,
        }).eq('id', redigerer)
        if (error) { visToast('Kunne ikke oppdatere: ' + error.message, 'feil', 4000); return }
        visToast('Oppdatert', 'suksess', 2000)
      } else {
        const id = nyId()
        const { error } = await supabase.from('timeloggninger').insert([{
          id, bruker: aktivBruker, dato: nyDato, timer: t,
          beskrivelse: nyBeskrivelse.trim() || null,
          prosjekt_id: nyProsjektId || null,
        }])
        if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
        await loggAktivitet({ handling: 'logget timer', tabell: 'timeloggninger', rad_id: id, detaljer: { dato: nyDato, timer: t, prosjekt_id: nyProsjektId || null } })
        visToast(`${fmtTimer(t)} lagt til`, 'suksess', 2000)
      }
      // Reset skjema men behold dato (vanlig å logge flere ting samme dag)
      setNyTimer(''); setNyBeskrivelse(''); setNyProsjektId('')
      setRedigerer(null)
      await hent()
    } finally {
      setLagrer(false)
    }
  }

  function startRediger(t: Timeloggning) {
    if (t.bruker !== aktivBruker) {
      visToast('Du kan bare redigere dine egne timer', 'feil', 3000); return
    }
    setRedigerer(t.id)
    setNyDato(t.dato)
    setNyTimer(String(t.timer))
    setNyBeskrivelse(t.beskrivelse || '')
    setNyProsjektId(t.prosjekt_id || '')
    setAapent(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function avbrytRediger() {
    setRedigerer(null); setNyTimer(''); setNyBeskrivelse(''); setNyProsjektId('')
  }

  async function slett(t: Timeloggning) {
    if (t.bruker !== aktivBruker) { visToast('Du kan bare slette dine egne timer', 'feil', 3000); return }
    if (!confirm(`Slette ${fmtTimer(t.timer)} fra ${fmtDato(t.dato)}?`)) return
    const { error } = await supabase.from('timeloggninger').delete().eq('id', t.id)
    if (error) { visToast('Sletting feilet: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await hent()
  }

  // === Aggregater ===
  const brukere = useMemo(() => Array.from(new Set(loggninger.map(l => l.bruker))).sort(), [loggninger])

  const filtrerte = useMemo(() => loggninger.filter(l => {
    if (filterBruker !== 'alle' && l.bruker !== filterBruker) return false
    if (filterMaaned && !l.dato.startsWith(filterMaaned)) return false
    return true
  }), [loggninger, filterBruker, filterMaaned])

  const sumValgt = useMemo(() => filtrerte.reduce((s, l) => s + (l.timer || 0), 0), [filtrerte])

  const denneUke = useMemo(() => {
    const start = ukestart(new Date())
    const slutt = new Date(start); slutt.setDate(start.getDate() + 7)
    return loggninger.filter(l => {
      const d = new Date(l.dato)
      return d >= start && d < slutt
    })
  }, [loggninger])

  const denneMnd = useMemo(() => {
    const start = mndStart(new Date())
    return loggninger.filter(l => new Date(l.dato) >= start)
  }, [loggninger])

  function sumPerBruker(rader: Timeloggning[]): Array<{ bruker: string; timer: number }> {
    const map: Record<string, number> = {}
    for (const l of rader) map[l.bruker] = (map[l.bruker] || 0) + (l.timer || 0)
    return Object.entries(map)
      .map(([bruker, timer]) => ({ bruker, timer }))
      .sort((a, b) => b.timer - a.timer)
  }

  const sumPerProsjekt = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of filtrerte) {
      if (l.prosjekt_id) map[l.prosjekt_id] = (map[l.prosjekt_id] || 0) + (l.timer || 0)
    }
    return Object.entries(map)
      .map(([id, timer]) => ({
        id,
        navn: prosjekter.find(p => p.id === id)?.navn || '(slettet prosjekt)',
        marked: prosjekter.find(p => p.id === id)?.marked || null,
        timer,
      }))
      .sort((a, b) => b.timer - a.timer)
  }, [filtrerte, prosjekter])

  // Måned-velger: 12 siste måneder + denne måneden
  const maanedValg = useMemo(() => {
    const liste: Array<{ verdi: string; tekst: string }> = []
    const naa = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(naa.getFullYear(), naa.getMonth() - i, 1)
      const verdi = d.toISOString().slice(0, 7)
      const tekst = d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
      liste.push({ verdi, tekst })
    }
    return liste
  }, [])

  function eksporterCsv() {
    const linjer: string[] = ['dato;bruker;timer;prosjekt;beskrivelse']
    const sortert = [...filtrerte].sort((a, b) => a.dato.localeCompare(b.dato))
    for (const l of sortert) {
      const prosjekt = l.prosjekt_id ? (prosjekter.find(p => p.id === l.prosjekt_id)?.navn || '(slettet)') : ''
      const beskr = (l.beskrivelse || '').replace(/[\r\n;]+/g, ' ')
      linjer.push(`${l.dato};${l.bruker};${l.timer};${prosjekt};${beskr}`)
    }
    const csv = '﻿' + linjer.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const tag = filterBruker === 'alle' ? 'alle' : filterBruker
    a.download = `timer_${tag}_${filterMaaned}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    visToast('CSV lastet ned', 'suksess', 2500)
  }

  return (
    <div>
      <button onClick={onTilbake}
        style={{ background: FARGER.flateLys, border: 'none', borderRadius: RADIUS.sm, padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginBottom: 20, color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        ← Tilbake
      </button>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 10 }}>TIMEBANK</div>
        <h2 style={{ fontSize: 28, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.01em' }}>Timer</h2>
        <p style={{ color: FARGER.tekstMid, margin: '6px 0 0', fontSize: 14, fontWeight: 300 }}>
          Logg arbeidstimer per dag — valgfritt knytt til prosjekt. Alle ser alles logger.
        </p>
      </div>

      {/* Skjema */}
      <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 20, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: aapent ? 16 : 0, gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork }}>
            {redigerer ? '✏️ Rediger time-loggning' : '➕ Logg nye timer'}
          </div>
          <button onClick={() => setAapent(o => !o)}
            style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 12, padding: 4 }}>
            {aapent ? '▲' : '▼'}
          </button>
        </div>
        {aapent && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
              <Felt lbl="Dato">
                <input type="date" value={nyDato} onChange={e => setNyDato(e.target.value)} style={inputStil} />
              </Felt>
              <Felt lbl="Antall timer">
                <input type="number" step="0.5" min="0" placeholder="f.eks. 7.5"
                  value={nyTimer} onChange={e => setNyTimer(e.target.value)} style={inputStil} />
              </Felt>
              <Felt lbl="Prosjekt (valgfritt)" full>
                <select value={nyProsjektId} onChange={e => setNyProsjektId(e.target.value)} style={inputStil}>
                  <option value="">— Ingen kobling —</option>
                  {prosjekter.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.marked === 'norge' ? '🇳🇴 ' : p.marked === 'spania' ? '🇪🇸 ' : ''}{p.navn}
                    </option>
                  ))}
                </select>
              </Felt>
            </div>
            <Felt lbl="Beskrivelse (valgfri)">
              <input value={nyBeskrivelse} onChange={e => setNyBeskrivelse(e.target.value)}
                placeholder="F.eks. «Befaring og bilder», «Møte med megler», «Kvitteringer regnskap»"
                style={inputStil} />
            </Felt>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={lagre} disabled={lagrer || !nyTimer || !nyDato}
                style={{ background: lagrer || !nyTimer ? FARGER.tekstLys : FARGER.mork, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: RADIUS.sm, fontSize: 13, fontWeight: 600, cursor: lagrer || !nyTimer ? 'not-allowed' : 'pointer', letterSpacing: '0.06em' }}>
                {lagrer ? '⏳' : redigerer ? '💾 Oppdater' : '✓ Logg timer'}
              </button>
              {redigerer && (
                <button onClick={avbrytRediger}
                  style={{ background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none', padding: '10px 16px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Avbryt
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sammendrag */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        <SammendragKort tittel="📅 Denne uken" rader={sumPerBruker(denneUke)} />
        <SammendragKort tittel="🗓️ Denne måneden" rader={sumPerBruker(denneMnd)} />
        <SammendragKort tittel="🔍 Valgt utvalg" rader={sumPerBruker(filtrerte)} sumTekst={`${fmtTimer(sumValgt)} totalt`} />
      </div>

      {/* Sum per prosjekt */}
      {sumPerProsjekt.length > 0 && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            🏠 Timer per prosjekt (valgt utvalg)
          </div>
          {sumPerProsjekt.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${FARGER.flateLys}`, fontSize: 13 }}>
              <span style={{ color: FARGER.mork }}>
                {p.marked === 'norge' ? '🇳🇴 ' : p.marked === 'spania' ? '🇪🇸 ' : ''}{p.navn}
              </span>
              <span style={{ fontWeight: 600, color: FARGER.mork }}>{fmtTimer(p.timer)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter + eksport */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterMaaned} onChange={e => setFilterMaaned(e.target.value)} style={{ ...inputStil, width: 'auto', flex: '0 0 auto' }}>
          <option value="">Alle måneder</option>
          {maanedValg.map(m => <option key={m.verdi} value={m.verdi}>{m.tekst}</option>)}
        </select>
        <select value={filterBruker} onChange={e => setFilterBruker(e.target.value)} style={{ ...inputStil, width: 'auto', flex: '0 0 auto' }}>
          <option value="alle">Alle brukere</option>
          {brukere.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={eksporterCsv} disabled={filtrerte.length === 0}
          style={{ background: filtrerte.length === 0 ? FARGER.tekstLys : FARGER.flateMid, color: FARGER.tekstMid, border: 'none', padding: '8px 14px', borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 600, cursor: filtrerte.length === 0 ? 'not-allowed' : 'pointer' }}>
          📥 CSV ({filtrerte.length})
        </button>
      </div>

      {/* Liste */}
      {laster && <div style={{ textAlign: 'center', padding: 30, color: FARGER.tekstLys }}>⏳ Laster…</div>}
      {!laster && filtrerte.length === 0 && (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys, fontSize: 13 }}>
          Ingen loggninger i dette utvalget.
        </div>
      )}

      {filtrerte.map(l => {
        const f = brukerFarge(l.bruker)
        const erMine = l.bruker === aktivBruker
        const prosjekt = l.prosjekt_id ? prosjekter.find(p => p.id === l.prosjekt_id) : null
        return (
          <div key={l.id} style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 12, marginBottom: 8, display: 'grid', gridTemplateColumns: 'auto auto 1fr auto auto', gap: 10, alignItems: 'center' }}>
            <span style={{ background: f.bg, color: f.tekst, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap' }}>
              {l.bruker.charAt(0).toUpperCase() + l.bruker.slice(1)}
            </span>
            <span style={{ fontSize: 12, color: FARGER.tekstLys, whiteSpace: 'nowrap' }}>{fmtDato(l.dato)}</span>
            <div style={{ minWidth: 0 }}>
              {prosjekt && (
                <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 600 }}>
                  {prosjekt.marked === 'norge' ? '🇳🇴 ' : prosjekt.marked === 'spania' ? '🇪🇸 ' : ''}{prosjekt.navn}
                </div>
              )}
              {l.beskrivelse && <div style={{ fontSize: 13, color: FARGER.mork, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.beskrivelse}</div>}
              {!prosjekt && !l.beskrivelse && <div style={{ fontSize: 12, color: FARGER.tekstLys, fontStyle: 'italic' }}>(ingen beskrivelse)</div>}
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: FARGER.mork, whiteSpace: 'nowrap' }}>{fmtTimer(l.timer)}</span>
            {erMine && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => startRediger(l)}
                  style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 12, padding: '4px 6px' }}>
                  ✏️
                </button>
                <button onClick={() => slett(l)}
                  style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 12, padding: '4px 6px' }}>
                  🗑
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Felt({ lbl, full, children }: { lbl: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</label>
      {children}
    </div>
  )
}

function SammendragKort({ tittel, rader, sumTekst }: {
  tittel: string
  rader: Array<{ bruker: string; timer: number }>
  sumTekst?: string
}) {
  const total = rader.reduce((s, r) => s + r.timer, 0)
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {tittel}
      </div>
      {rader.length === 0 ? (
        <div style={{ fontSize: 12, color: FARGER.tekstLys, fontStyle: 'italic' }}>Ingen timer registrert</div>
      ) : (
        <>
          {rader.map(r => {
            const f = brukerFarge(r.bruker)
            return (
              <div key={r.bruker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                <span style={{ background: f.bg, color: f.tekst, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }}>
                  {r.bruker.charAt(0).toUpperCase() + r.bruker.slice(1)}
                </span>
                <span style={{ fontWeight: 600, color: FARGER.mork }}>{fmtTimer(r.timer)}</span>
              </div>
            )
          })}
          <div style={{ borderTop: `1px solid ${FARGER.flateLys}`, paddingTop: 6, marginTop: 6, fontSize: 12, color: FARGER.tekstMid, textAlign: 'right', fontWeight: 600 }}>
            {sumTekst || `Sum: ${fmtTimer(total)}`}
          </div>
        </>
      )}
    </div>
  )
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
