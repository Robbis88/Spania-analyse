'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle, selectStyle } from '../lib/styles'
import { BILAG_STATUS_ETIKETT } from '../lib/bilag'
import { KOSTNAD_KATEGORIER, KOSTNAD_ETIKETT } from '../lib/portefolje'
import type { Bilag, BilagStatus } from '../types'

type Selskap = { id: string; navn: string; land: 'norge' | 'spania' }
type ProsjektRad = { id: string; navn: string; marked: string | null; selskap_id: string | null }

const STATUS_FARGE: Record<string, string> = {
  ny: FARGER.tekstLys, foreslatt: FARGER.gull, godkjent: FARGER.suksess, laast: FARGER.mork, avvist: FARGER.feil,
}
const FILTRE: Array<{ key: 'alle' | BilagStatus; lbl: string }> = [
  { key: 'alle', lbl: 'Alle' }, { key: 'ny', lbl: 'Nye' }, { key: 'foreslatt', lbl: 'AI-forslag' },
  { key: 'godkjent', lbl: 'Godkjent' }, { key: 'laast', lbl: 'Låst' },
]
const fmtBelop = (n: number | null, valuta: string) => n == null ? '–' : (valuta === 'EUR' ? '€' : '') + Math.round(n).toLocaleString('nb-NO') + (valuta === 'EUR' ? '' : ' kr')

export function Bilagsinnboks() {
  const [bilag, setBilag] = useState<Bilag[]>([])
  const [selskaper, setSelskaper] = useState<Selskap[]>([])
  const [prosjekter, setProsjekter] = useState<ProsjektRad[]>([])
  const [filter, setFilter] = useState<'alle' | BilagStatus>('alle')
  const [laster, setLaster] = useState(true)
  const [aapen, setAapen] = useState<string | null>(null)
  const [redigert, setRedigert] = useState<Partial<Bilag>>({})
  const [jobber, setJobber] = useState<string | null>(null)
  const filInput = useRef<HTMLInputElement>(null)

  const hent = useCallback(async (): Promise<Bilag[]> => {
    const [b, s, p] = await Promise.all([
      fetch('/api/bilag').then(r => r.json()).catch(() => ({})),
      fetch('/api/selskaper').then(r => r.json()).catch(() => ({})),
      supabase.from('prosjekter').select('id, navn, marked, selskap_id').eq('er_portefolje', true).then(r => r.data || []),
    ])
    const liste = (b.bilag || []) as Bilag[]
    setBilag(liste)
    setSelskaper(s.selskaper || [])
    setProsjekter(p as ProsjektRad[])
    setLaster(false)
    return liste
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  async function lastOpp(fil: File) {
    setJobber('opplasting')
    try {
      const fd = new FormData(); fd.append('fil', fil)
      const r = await fetch('/api/bilag/last-opp', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok || !d.suksess) { visToast(d.feil || 'Opplasting feilet', 'feil', 4000); return }
      visToast('Bilag lastet opp — kjører AI-forslag…', 'suksess', 2500)
      await fetch('/api/bilag/foreslaa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bilag_id: d.bilag_id }) })
      await hent(); apne(d.bilag_id)
    } catch { visToast('Opplasting feilet', 'feil', 4000) } finally {
      setJobber(null); if (filInput.current) filInput.current.value = ''
    }
  }

  async function leggTilManuelt() {
    const r = await fetch('/api/bilag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const d = await r.json()
    if (d.id) { await hent(); apne(d.id) }
  }

  function apne(id: string) {
    const b = bilag.find(x => x.id === id)
    setRedigert(b ? { ...b } : { id })
    setAapen(id)
    // hent på nytt-tilfellet: redigert settes fra oppdatert liste ved neste render via reåpning
  }

  async function foreslaa(id: string) {
    setJobber(id)
    try {
      const r = await fetch('/api/bilag/foreslaa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bilag_id: id }) })
      const d = await r.json()
      if (!r.ok || !d.suksess) { visToast(d.feil || 'Kunne ikke lage forslag', 'feil', 4000); return }
      await hent()
      const oppdatert = { ...(bilag.find(x => x.id === id) || {}), ...redigert }
      setRedigert({ ...oppdatert, ai_forslag: d.ai_forslag })
      visToast('AI-forslag klart', 'suksess', 2000)
    } finally { setJobber(null) }
  }

  function brukForslag() {
    const f = redigert.ai_forslag
    if (!f) return
    setRedigert({
      ...redigert,
      prosjekt_id: f.prosjekt_id ?? redigert.prosjekt_id,
      selskap_id: f.selskap_id ?? redigert.selskap_id,
      kategori: f.kategori ?? redigert.kategori,
      underkategori: f.underkategori ?? redigert.underkategori,
      leverandor: f.felt?.leverandor ?? redigert.leverandor,
      faktura_dato: f.felt?.faktura_dato ?? redigert.faktura_dato,
      forfall_dato: f.felt?.forfall_dato ?? redigert.forfall_dato,
      belop: f.felt?.belop ?? redigert.belop,
      mva: f.felt?.mva ?? redigert.mva,
      valuta: f.felt?.valuta ?? redigert.valuta,
      fakturanummer: f.felt?.fakturanummer ?? redigert.fakturanummer,
    })
    visToast('Forslag lagt inn i feltene — sjekk og lagre', 'suksess', 2500)
  }

  async function lagre(ekstra?: Record<string, unknown>) {
    const r = redigert
    const body = {
      id: r.id, selskap_id: r.selskap_id || null, prosjekt_id: r.prosjekt_id || null,
      leverandor: r.leverandor || null, faktura_dato: r.faktura_dato || null, forfall_dato: r.forfall_dato || null,
      belop: r.belop ?? null, mva: r.mva ?? null, valuta: r.valuta || 'NOK',
      bilagsnummer: r.bilagsnummer || null, fakturanummer: r.fakturanummer || null,
      kategori: r.kategori || null, underkategori: r.underkategori || null, notat: r.notat || null,
      ...ekstra,
    }
    const res = await fetch('/api/bilag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json()
    if (!res.ok || !d.suksess) { visToast(d.feil || 'Kunne ikke lagre', 'feil', 4000); return }
    await hent()
  }

  async function slett(id: string) {
    if (!confirm('Slette dette bilaget?')) return
    await fetch(`/api/bilag?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (aapen === id) { setAapen(null); setRedigert({}) }
    await hent()
  }

  const vist = bilag.filter(b => filter === 'alle' || b.status === filter)
  const antNy = bilag.filter(b => b.status === 'ny' || b.status === 'foreslatt').length

  const upd = <K extends keyof Bilag>(felt: K, v: Bilag[K]) => setRedigert({ ...redigert, [felt]: v })

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 300, color: FARGER.mork, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Bilagsinnboks</h1>
      <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '0 0 4px', maxWidth: 680, lineHeight: 1.6 }}>
        Fakturaer og bilag knyttes til riktig selskap, eiendom og kategori. Regnskapssystemet er fasit for bokføring — her brukes bilagene til styring: prosjektregnskap, kostnadskontroll, cashflow og avvik.
      </p>
      <p style={{ fontSize: 12, color: FARGER.tekstLys, margin: '0 0 20px' }}>
        Flyt: <strong>importér/last opp</strong> → <strong>AI foreslår eiendom + kategori</strong> → <strong>godkjenn/endre</strong> → <strong>lås til prosjektregnskap</strong>. Regnskapsintegrasjon kobles på senere (se BILAG_IMPORT.md).
      </p>

      {/* Verktøylinje */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <button onClick={() => filInput.current?.click()} disabled={jobber === 'opplasting'}
          style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: jobber === 'opplasting' ? 0.6 : 1 }}>
          {jobber === 'opplasting' ? '⏳ Laster opp…' : '⬆ Last opp bilag'}
        </button>
        <button onClick={leggTilManuelt}
          style={{ background: FARGER.hvit, color: FARGER.mork, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Legg til manuelt
        </button>
        <input ref={filInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) void lastOpp(f) }} style={{ display: 'none' }} />
        {antNy > 0 && <span style={{ fontSize: 12, color: FARGER.gull, fontWeight: 600, marginLeft: 4 }}>{antNy} venter på behandling</span>}
      </div>

      {/* Filter */}
      <div style={{ display: 'inline-flex', gap: 4, background: FARGER.hvit, padding: 4, borderRadius: RADIUS.pill, border: `1px solid ${FARGER.kantLys}`, marginBottom: 18 }}>
        {FILTRE.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ background: filter === f.key ? FARGER.mork : 'transparent', color: filter === f.key ? FARGER.creamLys : FARGER.tekstMid, border: 'none', borderRadius: RADIUS.pill, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {f.lbl}
          </button>
        ))}
      </div>

      {laster ? (
        <div style={{ padding: 30, color: FARGER.tekstLys }}>Laster bilag…</div>
      ) : vist.length === 0 ? (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 34, textAlign: 'center', color: FARGER.tekstLys, fontSize: 14 }}>
          {bilag.length === 0 ? 'Innboksen er tom. Last opp et bilag eller legg til manuelt for å teste flyten.' : 'Ingen bilag med dette filteret.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {vist.map(b => {
            const eiendom = prosjekter.find(p => p.id === b.prosjekt_id)
            const apenNaa = aapen === b.id
            return (
              <div key={b.id} style={{ background: FARGER.hvit, border: `1.5px solid ${apenNaa ? FARGER.gull : FARGER.kantLys}`, borderLeft: `4px solid ${STATUS_FARGE[b.status]}`, borderRadius: RADIUS.md, boxShadow: SHADOW.xs, overflow: 'hidden' }}>
                {/* Sammendragsrad */}
                <button onClick={() => apenNaa ? (setAapen(null), setRedigert({})) : apne(b.id)}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: RADIUS.pill, background: STATUS_FARGE[b.status], color: '#fff', letterSpacing: '0.04em' }}>{BILAG_STATUS_ETIKETT[b.status]}</span>
                  <span style={{ flex: 1, minWidth: 140, fontSize: 14, fontWeight: 600, color: FARGER.mork }}>{b.leverandor || (b.filnavn ? `📎 ${b.filnavn}` : 'Uten leverandør')}</span>
                  <span style={{ fontSize: 13, color: FARGER.tekstMid }}>{eiendom ? eiendom.navn : <em style={{ color: FARGER.tekstLys }}>ikke tilknyttet</em>}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork, minWidth: 90, textAlign: 'right' }}>{fmtBelop(b.belop, b.valuta)}</span>
                </button>

                {apenNaa && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${FARGER.kantUltralys}` }}>
                    {/* AI-forslag */}
                    {redigert.ai_forslag && (
                      <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: 12, margin: '14px 0', fontSize: 13 }}>
                        <div style={{ fontWeight: 600, color: FARGER.gull, marginBottom: 4 }}>✨ AI-forslag</div>
                        <div style={{ color: FARGER.tekstMid, lineHeight: 1.5 }}>
                          {(() => { const f = redigert.ai_forslag!; const p = prosjekter.find(x => x.id === f.prosjekt_id); return `${p ? p.navn : 'ukjent eiendom'}${f.kategori ? ` · ${KOSTNAD_ETIKETT[f.kategori] || f.kategori}` : ''}${f.begrunnelse ? ` — ${f.begrunnelse}` : ''}` })()}
                        </div>
                        <button onClick={brukForslag} style={{ marginTop: 8, background: FARGER.gull, color: FARGER.mork, border: 'none', borderRadius: RADIUS.pill, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Bruk forslag</button>
                      </div>
                    )}

                    {/* Felt */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 14 }}>
                      <F lbl="Leverandør"><input value={redigert.leverandor || ''} onChange={e => upd('leverandor', e.target.value)} style={inputStyle} /></F>
                      <F lbl="Fakturanr"><input value={redigert.fakturanummer || ''} onChange={e => upd('fakturanummer', e.target.value)} style={inputStyle} /></F>
                      <F lbl="Bilagsnr"><input value={redigert.bilagsnummer || ''} onChange={e => upd('bilagsnummer', e.target.value)} style={inputStyle} /></F>
                      <F lbl="Fakturadato"><input type="date" value={redigert.faktura_dato || ''} onChange={e => upd('faktura_dato', e.target.value || null)} style={inputStyle} /></F>
                      <F lbl="Forfallsdato"><input type="date" value={redigert.forfall_dato || ''} onChange={e => upd('forfall_dato', e.target.value || null)} style={inputStyle} /></F>
                      <F lbl="Beløp (inkl. mva)"><input type="number" value={redigert.belop ?? ''} onChange={e => upd('belop', e.target.value === '' ? null : Number(e.target.value))} style={inputStyle} /></F>
                      <F lbl="MVA"><input type="number" value={redigert.mva ?? ''} onChange={e => upd('mva', e.target.value === '' ? null : Number(e.target.value))} style={inputStyle} /></F>
                      <F lbl="Valuta">
                        <select value={redigert.valuta || 'NOK'} onChange={e => upd('valuta', e.target.value as Bilag['valuta'])} style={selectStyle}>
                          <option value="NOK">NOK</option><option value="EUR">EUR</option>
                        </select>
                      </F>
                      <F lbl="Selskap">
                        <select value={redigert.selskap_id || ''} onChange={e => upd('selskap_id', e.target.value || null)} style={selectStyle}>
                          <option value="">—</option>
                          {selskaper.map(s => <option key={s.id} value={s.id}>{s.navn}</option>)}
                        </select>
                      </F>
                      <F lbl="Eiendom">
                        <select value={redigert.prosjekt_id || ''} onChange={e => upd('prosjekt_id', e.target.value || null)} style={selectStyle}>
                          <option value="">—</option>
                          {prosjekter.map(p => <option key={p.id} value={p.id}>{p.navn}</option>)}
                        </select>
                      </F>
                      <F lbl="Kategori">
                        <select value={redigert.kategori || ''} onChange={e => upd('kategori', e.target.value || null)} style={selectStyle}>
                          <option value="">—</option>
                          {KOSTNAD_KATEGORIER.map(k => <option key={k} value={k}>{KOSTNAD_ETIKETT[k] || k}</option>)}
                        </select>
                      </F>
                      <F lbl="Underkategori"><input value={redigert.underkategori || ''} onChange={e => upd('underkategori', e.target.value || null)} style={inputStyle} /></F>
                    </div>

                    {/* Handlinger */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                      <button onClick={() => foreslaa(b.id)} disabled={jobber === b.id || b.status === 'laast'}
                        style={{ background: FARGER.hvit, color: FARGER.mork, border: `1.5px solid ${FARGER.gull}`, borderRadius: RADIUS.pill, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: jobber === b.id ? 0.6 : 1 }}>
                        {jobber === b.id ? '⏳ Foreslår…' : '✨ AI-forslag'}
                      </button>
                      <button onClick={() => lagre()} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>💾 Lagre</button>
                      {b.status !== 'laast' && (
                        <>
                          <button onClick={() => lagre({ status: 'godkjent' })} style={{ background: FARGER.suksessBg, color: FARGER.suksess, border: 'none', borderRadius: RADIUS.pill, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Godkjenn</button>
                          <button onClick={() => lagre({ laas: true })} disabled={!redigert.prosjekt_id}
                            title={!redigert.prosjekt_id ? 'Knytt til en eiendom først' : ''}
                            style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '9px 16px', fontSize: 12, fontWeight: 600, cursor: redigert.prosjekt_id ? 'pointer' : 'default', opacity: redigert.prosjekt_id ? 1 : 0.5 }}>🔒 Lås til prosjektregnskap</button>
                        </>
                      )}
                      <button onClick={() => slett(b.id)} style={{ background: FARGER.feilBg, color: FARGER.feil, border: 'none', borderRadius: RADIUS.pill, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>🗑 Slett</button>
                    </div>
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

function F({ lbl, children }: { lbl: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{lbl}</label>{children}</div>
}
