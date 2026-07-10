'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle, selectStyle } from '../lib/styles'
import { KortFortalt } from './KortFortalt'
import type { Konsernlaan } from '../types'

type SelskapKapital = {
  id: string; navn: string; land: 'norge' | 'spania'; valuta: 'NOK' | 'EUR'
  antall_eiendommer: number; samlet_verdi: number; bundet_ek: number; frigjorbar_refi: number
  fri_likviditet: number; laanekapasitet: number
  konsern_fordring: number; konsern_gjeld: number; paalopte_renter_fordring: number
  kjopekraft: number
}
type Konsolidert = { valuta: string; bundet_ek: number; frigjorbar_refi: number; fri_likviditet: number; laanekapasitet: number; kjopekraft: number }

const fmt = (n: number, valuta: string) => {
  const v = Math.round(n || 0).toLocaleString('nb-NO')
  return valuta === 'EUR' ? `€${v}` : `${v} kr`
}

export function Kapital() {
  const [selskaper, setSelskaper] = useState<SelskapKapital[]>([])
  const [konsolidert, setKonsolidert] = useState<Konsolidert[]>([])
  const [konsernlaan, setKonsernlaan] = useState<Konsernlaan[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)

  const hent = useCallback(async () => {
    setLaster(true); setFeil(null)
    try {
      const r = await fetch('/api/kapital')
      const d = await r.json()
      if (!r.ok || d.feil) { setFeil(d.feil || 'Kunne ikke hente'); return }
      setSelskaper(d.selskaper || [])
      setKonsolidert(d.konsolidert || [])
      setKonsernlaan(d.konsernlaan || [])
    } catch { setFeil('Kunne ikke hente kapitaloversikt') } finally { setLaster(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  async function lagreManuelt(id: string, fri_likviditet: number, laanekapasitet: number) {
    await fetch('/api/selskaper', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fri_likviditet, laanekapasitet }),
    })
    await hent()
  }

  const kontekst = useMemo(() => {
    if (laster || selskaper.length === 0) return ''
    const kons = konsolidert.map(k => `Konsolidert (${k.valuta}): kjøpekraft ${fmt(k.kjopekraft, k.valuta)}, fri likviditet ${fmt(k.fri_likviditet, k.valuta)}, lånekapasitet ${fmt(k.laanekapasitet, k.valuta)}, bundet EK ${fmt(k.bundet_ek, k.valuta)}`)
    const per = selskaper.map(s => `${s.navn} (${s.valuta}): kjøpekraft ${fmt(s.kjopekraft, s.valuta)}, bundet EK ${fmt(s.bundet_ek, s.valuta)}, frigjørbar ved refi ${fmt(s.frigjorbar_refi, s.valuta)}, ${s.antall_eiendommer} eiendom(mer)${s.konsern_fordring > 0 ? `, konsern-fordring ${fmt(s.konsern_fordring, s.valuta)}` : ''}${s.konsern_gjeld > 0 ? `, konsern-gjeld ${fmt(s.konsern_gjeld, s.valuta)}` : ''}`)
    return [...kons, ...per].join('\n')
  }, [laster, selskaper, konsolidert])

  if (laster) return <div style={{ padding: 40, color: FARGER.tekstLys }}>Laster kapitaloversikt…</div>

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 300, color: FARGER.mork, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Kapital</h1>
      <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '0 0 24px', maxWidth: 640, lineHeight: 1.6 }}>
        Hvor mye kan vi kjøpe for neste runde? Bundet egenkapital beregnes fra porteføljen; fri likviditet og lånekapasitet legger du inn manuelt.
      </p>

      {feil && <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}`, padding: 14, color: '#7a0c1e', borderRadius: RADIUS.md, marginBottom: 20 }}>{feil}</div>}

      <KortFortalt tittel="Kapital / kjøpekraft" kontekst={kontekst} />

      {/* Kjøpekraft-hero per valuta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
        {konsolidert.map(k => (
          <div key={k.valuta} style={{ background: FARGER.mork, color: FARGER.creamLys, borderRadius: RADIUS.lg, padding: 22, boxShadow: SHADOW.md }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', fontWeight: 700, color: FARGER.gull, marginBottom: 8 }}>KJØPEKRAFT · {k.valuta}</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmt(k.kjopekraft, k.valuta)}</div>
            <div style={{ fontSize: 12, color: 'rgba(253,252,247,0.7)', marginTop: 8, lineHeight: 1.6 }}>
              Fri likviditet {fmt(k.fri_likviditet, k.valuta)} + refi {fmt(k.frigjorbar_refi, k.valuta)} + ramme {fmt(k.laanekapasitet, k.valuta)}<br />
              Bundet EK i portefølje: {fmt(k.bundet_ek, k.valuta)} (frigjørbar ved salg)
            </div>
          </div>
        ))}
      </div>

      {/* Per selskap */}
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.2em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Per selskap</div>
      <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
        {selskaper.map(s => <SelskapKort key={s.id} s={s} onLagre={lagreManuelt} />)}
      </div>

      <KonsernlaanSeksjon selskaper={selskaper} konsernlaan={konsernlaan} onEndret={hent} />
    </div>
  )
}

function SelskapKort({ s, onLagre }: { s: SelskapKapital; onLagre: (id: string, fri: number, ramme: number) => Promise<void> }) {
  const [fri, setFri] = useState(String(s.fri_likviditet || 0))
  const [ramme, setRamme] = useState(String(s.laanekapasitet || 0))
  const [lagrer, setLagrer] = useState(false)
  const endret = Number(fri) !== s.fri_likviditet || Number(ramme) !== s.laanekapasitet

  const tall = (lbl: string, v: number, farge?: string) => (
    <div>
      <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 2 }}>{lbl}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: farge || FARGER.mork }}>{fmt(v, s.valuta)}</div>
    </div>
  )

  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.sm, padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>{s.land === 'norge' ? '🇳🇴' : '🇪🇸'}</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: FARGER.mork }}>{s.navn}</span>
        <span style={{ fontSize: 12, color: FARGER.tekstLys }}>· {s.antall_eiendommer} eiendom(mer)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 18 }}>
        {tall('Bundet egenkapital', s.bundet_ek, FARGER.gull)}
        {tall('Samlet verdi', s.samlet_verdi)}
        {tall('Frigjørbar (refi 75 %)', s.frigjorbar_refi)}
        {tall('Kjøpekraft', s.kjopekraft, FARGER.suksess)}
        {s.konsern_fordring > 0 && tall('Konsern-fordring', s.konsern_fordring)}
        {s.konsern_gjeld > 0 && tall('Konsern-gjeld', s.konsern_gjeld, FARGER.feil)}
        {s.paalopte_renter_fordring > 0 && tall('Påløpte renter (fordring)', s.paalopte_renter_fordring)}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', borderTop: `1px solid ${FARGER.kantUltralys}`, paddingTop: 16 }}>
        <div>
          <label style={labelStyle}>Fri likviditet ({s.valuta})</label>
          <input type="number" value={fri} onChange={e => setFri(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} />
        </div>
        <div>
          <label style={labelStyle}>Lånekapasitet / ramme ({s.valuta})</label>
          <input type="number" value={ramme} onChange={e => setRamme(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} />
        </div>
        <button
          onClick={async () => { setLagrer(true); await onLagre(s.id, Number(fri) || 0, Number(ramme) || 0); setLagrer(false) }}
          disabled={!endret || lagrer}
          style={{
            background: endret ? FARGER.mork : FARGER.flateMid, color: endret ? FARGER.creamLys : FARGER.tekstLys,
            border: 'none', padding: '10px 20px', fontSize: 13, fontWeight: 600, borderRadius: RADIUS.pill,
            cursor: endret && !lagrer ? 'pointer' : 'default',
          }}>
          {lagrer ? 'Lagrer…' : 'Lagre'}
        </button>
      </div>
    </div>
  )
}

const TOM_LAAN = { fra_selskap: '', til_selskap: '', hovedstol: '', valuta: 'NOK', rente_pct: '', startdato: '', notat: '' }

function KonsernlaanSeksjon({ selskaper, konsernlaan, onEndret }: {
  selskaper: SelskapKapital[]; konsernlaan: Konsernlaan[]; onEndret: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...TOM_LAAN })
  const [lagrer, setLagrer] = useState(false)
  const navn = (id: string | null) => selskaper.find(s => s.id === id)?.navn || '—'

  async function lagre() {
    if (!form.fra_selskap || !form.til_selskap || !form.startdato || !Number(form.hovedstol)) return
    setLagrer(true)
    await fetch('/api/konsernlaan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fra_selskap: form.fra_selskap, til_selskap: form.til_selskap,
        hovedstol: Number(form.hovedstol), valuta: form.valuta, rente_pct: Number(form.rente_pct) || 0,
        startdato: form.startdato, notat: form.notat, nedbetalinger: [],
      }),
    })
    setForm({ ...TOM_LAAN })
    setLagrer(false)
    await onEndret()
  }

  async function slett(id: string) {
    if (!confirm('Slette dette konsernlånet?')) return
    await fetch(`/api/konsernlaan?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    await onEndret()
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.2em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Konsernlån</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 16px', maxWidth: 620, lineHeight: 1.6 }}>
        Lån mellom selskapene (f.eks. Loeiendom AS → LO-casas). Renter vises, men bokføres ikke her. Rentesats settes manuelt etter råd fra rådgiver.
      </p>

      {konsernlaan.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {konsernlaan.map(l => (
            <div key={l.id} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.md, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: FARGER.mork }}>
                <strong>{navn(l.fra_selskap)}</strong> → <strong>{navn(l.til_selskap)}</strong>
                <span style={{ color: FARGER.tekstMid }}> · {fmt(l.hovedstol, l.valuta)} · {l.rente_pct} % · fra {l.startdato}</span>
                {l.notat && <span style={{ color: FARGER.tekstLys }}> · {l.notat}</span>}
              </div>
              <button onClick={() => slett(l.id)} style={{ background: FARGER.feilBg, color: FARGER.feil, border: 'none', borderRadius: RADIUS.sm, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Slett</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Fra selskap (långiver)</label>
            <select value={form.fra_selskap} onChange={e => setForm({ ...form, fra_selskap: e.target.value })} style={selectStyle}>
              <option value="">Velg…</option>
              {selskaper.map(s => <option key={s.id} value={s.id}>{s.navn}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Til selskap (låntaker)</label>
            <select value={form.til_selskap} onChange={e => setForm({ ...form, til_selskap: e.target.value })} style={selectStyle}>
              <option value="">Velg…</option>
              {selskaper.map(s => <option key={s.id} value={s.id}>{s.navn}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Hovedstol</label>
            <input type="number" value={form.hovedstol} onChange={e => setForm({ ...form, hovedstol: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Valuta</label>
            <select value={form.valuta} onChange={e => setForm({ ...form, valuta: e.target.value })} style={selectStyle}>
              <option value="NOK">NOK</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Rente (%)</label>
            <input type="number" step="0.1" value={form.rente_pct} onChange={e => setForm({ ...form, rente_pct: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Startdato</label>
            <input type="date" value={form.startdato} onChange={e => setForm({ ...form, startdato: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notat</label>
            <input value={form.notat} onChange={e => setForm({ ...form, notat: e.target.value })} style={inputStyle} />
          </div>
        </div>
        <button onClick={lagre} disabled={lagrer}
          style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', padding: '10px 22px', fontSize: 13, fontWeight: 600, borderRadius: RADIUS.pill, cursor: 'pointer', opacity: lagrer ? 0.6 : 1 }}>
          {lagrer ? 'Lagrer…' : '+ Legg til konsernlån'}
        </button>
      </div>
    </div>
  )
}
