'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle, selectStyle } from '../lib/styles'
import { KortFortalt } from './KortFortalt'
import type { Konsernlaan, Kontantbevegelse, KontantbevegelseType } from '../types'

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

const BEVEGELSE_ETIKETT: Record<KontantbevegelseType, string> = {
  innskudd: 'Innskudd', laaneopptak: 'Låneopptak', kjop: 'Kjøp', omkostninger: 'Omkostninger',
  oppussing: 'Oppussing', driftskostnad: 'Driftskostnad', renter: 'Renter', avdrag: 'Avdrag',
  leieinntekt: 'Leieinntekt', uttak: 'Uttak', annet: 'Annet',
}
// Typer som gir mening å legge inn manuelt (auto-typene kommer fra seed/cashflow).
const MANUELLE_TYPER: KontantbevegelseType[] = ['innskudd', 'uttak', 'driftskostnad', 'oppussing', 'renter', 'avdrag', 'annet']

export function Kapital() {
  const [selskaper, setSelskaper] = useState<SelskapKapital[]>([])
  const [konsolidert, setKonsolidert] = useState<Konsolidert[]>([])
  const [konsernlaan, setKonsernlaan] = useState<Konsernlaan[]>([])
  const [bevegelser, setBevegelser] = useState<Kontantbevegelse[]>([])
  const [saldo, setSaldo] = useState<Record<string, number>>({})
  const [laanebetjening, setLaanebetjening] = useState<Record<string, number>>({})
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)

  const hent = useCallback(async () => {
    setLaster(true); setFeil(null)
    try {
      const [rk, rb] = await Promise.all([fetch('/api/kapital'), fetch('/api/kontantkonto')])
      const d = await rk.json()
      if (!rk.ok || d.feil) { setFeil(d.feil || 'Kunne ikke hente'); return }
      setSelskaper(d.selskaper || [])
      setKonsolidert(d.konsolidert || [])
      setKonsernlaan(d.konsernlaan || [])
      const db = await rb.json()
      if (rb.ok && !db.feil) { setBevegelser(db.bevegelser || []); setSaldo(db.saldo || {}); setLaanebetjening(db.laanebetjening || {}) }
    } catch { setFeil('Kunne ikke hente kapitaloversikt') } finally { setLaster(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  async function lagreRamme(id: string, laanekapasitet: number) {
    await fetch('/api/selskaper', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, laanekapasitet }),
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
        {selskaper.map(s => <SelskapKort key={s.id} s={s} saldo={saldo[s.id]} onLagreRamme={lagreRamme} />)}
      </div>

      <KontantkontoSeksjon selskaper={selskaper} bevegelser={bevegelser} saldo={saldo} laanebetjening={laanebetjening} onEndret={hent} />

      <KonsernlaanSeksjon selskaper={selskaper} konsernlaan={konsernlaan} onEndret={hent} />
    </div>
  )
}

function SelskapKort({ s, saldo, onLagreRamme }: { s: SelskapKapital; saldo: number | undefined; onLagreRamme: (id: string, ramme: number) => Promise<void> }) {
  const [ramme, setRamme] = useState(String(s.laanekapasitet || 0))
  const [lagrer, setLagrer] = useState(false)
  const endret = Number(ramme) !== s.laanekapasitet
  // Kontantsaldo kommer fra kontantkontoen (beregnet). API-et faller tilbake til
  // fri_likviditet-feltet før seeding, så vis det tallet inntil saldo finnes.
  const kontant = saldo ?? s.fri_likviditet

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
        {tall('Kontantsaldo', kontant, kontant < 0 ? FARGER.feil : FARGER.mork)}
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
          <label style={labelStyle}>Lånekapasitet / ramme ({s.valuta})</label>
          <input type="number" value={ramme} onChange={e => setRamme(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} />
        </div>
        <button
          onClick={async () => { setLagrer(true); await onLagreRamme(s.id, Number(ramme) || 0); setLagrer(false) }}
          disabled={!endret || lagrer}
          style={{
            background: endret ? FARGER.mork : FARGER.flateMid, color: endret ? FARGER.creamLys : FARGER.tekstLys,
            border: 'none', padding: '10px 20px', fontSize: 13, fontWeight: 600, borderRadius: RADIUS.pill,
            cursor: endret && !lagrer ? 'pointer' : 'default',
          }}>
          {lagrer ? 'Lagrer…' : 'Lagre ramme'}
        </button>
        <span style={{ fontSize: 11.5, color: FARGER.tekstLys, alignSelf: 'center' }}>Kontantsaldo styres i kontantkontoen under ↓</span>
      </div>
    </div>
  )
}

// ─── Kontantkonto (B12): beregnet saldo + hovedbok + manuell føring ──────────
function KontantkontoSeksjon({ selskaper, bevegelser, saldo, laanebetjening, onEndret }: {
  selskaper: SelskapKapital[]; bevegelser: Kontantbevegelse[]; saldo: Record<string, number>; laanebetjening: Record<string, number>; onEndret: () => Promise<void>
}) {
  type SeedRad = { selskap_id: string; type: KontantbevegelseType; belop: number; notat: string; dato: string }
  const [forhand, setForhand] = useState<{ rader: SeedRad[]; saldoPerSelskap: Record<string, number> } | null>(null)
  const [startkap, setStartkap] = useState<Record<string, number>>({})
  const [seeder, setSeeder] = useState(false)
  const [apentSkjema, setApentSkjema] = useState<string | null>(null)
  const valutaFor = (id: string) => selskaper.find(s => s.id === id)?.valuta || 'NOK'
  const navnFor = (id: string) => selskaper.find(s => s.id === id)?.navn || '—'

  async function forhandsvis() {
    const r = await fetch('/api/kontantkonto/seed')
    const d = await r.json()
    if (r.ok && !d.feil) {
      const rader: SeedRad[] = d.rader || []
      setForhand({ rader, saldoPerSelskap: d.saldoPerSelskap || {} })
      const sk: Record<string, number> = {}
      for (const rad of rader) if (rad.type === 'innskudd') sk[rad.selskap_id] = rad.belop
      setStartkap(sk)
    }
  }
  async function commitSeed() {
    setSeeder(true)
    await fetch('/api/kontantkonto/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startkapital: startkap }) })
    setSeeder(false); setForhand(null)
    await onEndret()
  }
  async function slett(id: string) {
    if (!confirm('Slette denne bevegelsen?')) return
    await fetch(`/api/kontantkonto?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    await onEndret()
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.2em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Kontantkonto</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 16px', maxWidth: 640, lineHeight: 1.6 }}>
        Kontantsaldoen beregnes fra bevegelsene under + realisert cashflow — den tastes ikke lenger.
        «Forhåndsvis åpningsbalanse» bygger startbevegelser fra kjøp, lån og innskutt kapital.
      </p>

      {/* Seed-forhåndsvisning */}
      <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 18 }}>
        {!forhand ? (
          <button onClick={forhandsvis} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: RADIUS.pill, cursor: 'pointer' }}>
            Forhåndsvis åpningsbalanse
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork, marginBottom: 12 }}>Åpningsbalanse — sett startkapital og bekreft</div>
            {[...new Set(forhand.rader.map(r => r.selskap_id))].map(sid => {
              const val = valutaFor(sid)
              const andre = forhand.rader.filter(r => r.selskap_id === sid && r.type !== 'innskudd')
              const saldo = (startkap[sid] || 0) + andre.reduce((a, r) => a + r.belop, 0)
              const rad = (lbl: string, v: number, sterk?: boolean) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, color: sterk ? FARGER.mork : FARGER.tekstMid, fontWeight: sterk ? 700 : 400 }}>
                  <span>{lbl}</span><span style={{ color: v < 0 ? FARGER.feil : (sterk ? FARGER.mork : FARGER.suksess), whiteSpace: 'nowrap' }}>{fmt(v, val)}</span>
                </div>
              )
              return (
                <div key={sid} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${FARGER.kantUltralys}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork, marginBottom: 8 }}>{navnFor(sid)}</div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Startkapital / innskutt EK ({val})</label>
                    <input type="number" value={startkap[sid] ?? 0} onChange={e => setStartkap(p => ({ ...p, [sid]: Number(e.target.value) || 0 }))} style={{ ...inputStyle, maxWidth: 200 }} />
                  </div>
                  <div style={{ display: 'grid', gap: 3 }}>
                    {rad('Startkapital (innskudd)', startkap[sid] || 0)}
                    {andre.map((r, i) => <div key={i}>{rad(`${BEVEGELSE_ETIKETT[r.type]} · ${r.notat}`, r.belop)}</div>)}
                    <div style={{ borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 4, marginTop: 2 }}>{rad('= Kontantsaldo (før lånebetjening)', saldo, true)}</div>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={commitSeed} disabled={seeder} style={{ background: FARGER.suksess, color: '#fff', border: 'none', padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: RADIUS.pill, cursor: 'pointer', opacity: seeder ? 0.6 : 1 }}>
                {seeder ? 'Skriver…' : 'Bekreft og skriv'}
              </button>
              <button onClick={() => setForhand(null)} style={{ background: 'none', color: FARGER.tekstMid, border: `1px solid ${FARGER.kantLys}`, padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: RADIUS.pill, cursor: 'pointer' }}>Avbryt</button>
            </div>
            <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '10px 0 0' }}>Oppussing tas ikke med (budsjett). Lånebetjening (renter) trekkes automatisk fra saldoen etter lånets startdato. Trygt å kjøre flere ganger — skriver ferskt.</p>
          </div>
        )}
      </div>

      {/* Per selskap: saldo + bevegelser + manuell føring */}
      <div style={{ display: 'grid', gap: 16 }}>
        {selskaper.map(s => {
          const rader = bevegelser.filter(b => b.selskap_id === s.id)
          return (
            <div key={s.id} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.sm, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork }}>{s.land === 'norge' ? '🇳🇴' : '🇪🇸'} {s.navn}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: (saldo[s.id] ?? 0) < 0 ? FARGER.feil : FARGER.mork }}>
                  Saldo {fmt(saldo[s.id] ?? s.fri_likviditet, s.valuta)}
                </span>
              </div>

              {rader.length > 0 && (
                <div style={{ display: 'grid', gap: 2, marginBottom: 12 }}>
                  {rader.slice(0, 12).map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: FARGER.tekstMid, borderBottom: `1px solid ${FARGER.kantUltralys}`, padding: '5px 0' }}>
                      <span style={{ color: FARGER.tekstLys, width: 78, flexShrink: 0 }}>{b.dato}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{BEVEGELSE_ETIKETT[b.type]}{b.notat ? ` · ${b.notat}` : ''}{b.kilde !== 'manuell' ? '' : ' ✎'}</span>
                      <span style={{ color: b.belop < 0 ? FARGER.feil : FARGER.suksess, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(b.belop, s.valuta)}</span>
                      {b.kilde === 'manuell' && <button onClick={() => slett(b.id)} style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 14, padding: '0 2px' }} title="Slett">×</button>}
                    </div>
                  ))}
                  {rader.length > 12 && <div style={{ fontSize: 11, color: FARGER.tekstLys, paddingTop: 4 }}>+ {rader.length - 12} eldre bevegelser</div>}
                </div>
              )}

              {(laanebetjening[s.id] || 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: FARGER.tekstMid, borderBottom: `1px solid ${FARGER.kantUltralys}`, padding: '5px 0', marginBottom: 12 }}>
                  <span style={{ color: FARGER.tekstLys, width: 78, flexShrink: 0 }}>hittil</span>
                  <span style={{ flex: 1, minWidth: 0 }}>Lånebetjening (renter + avdrag) · beregnet automatisk 🔄</span>
                  <span style={{ color: FARGER.feil, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(-(laanebetjening[s.id] || 0), s.valuta)}</span>
                </div>
              )}

              {apentSkjema === s.id
                ? <LeggTilBevegelse selskapId={s.id} valuta={s.valuta} onLagret={async () => { setApentSkjema(null); await onEndret() }} onAvbryt={() => setApentSkjema(null)} />
                : <button onClick={() => setApentSkjema(s.id)} style={{ background: 'none', border: `1px dashed ${FARGER.gullSvak}`, color: FARGER.gull, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, borderRadius: RADIUS.pill, cursor: 'pointer' }}>+ Registrer bevegelse (innskudd / uttak / justering)</button>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeggTilBevegelse({ selskapId, valuta, onLagret, onAvbryt }: {
  selskapId: string; valuta: 'NOK' | 'EUR'; onLagret: () => Promise<void>; onAvbryt: () => void
}) {
  const iDag = new Date().toISOString().slice(0, 10)
  const [type, setType] = useState<KontantbevegelseType>('innskudd')
  const [belop, setBelop] = useState('')
  const [dato, setDato] = useState(iDag)
  const [notat, setNotat] = useState('')
  const [lagrer, setLagrer] = useState(false)

  async function lagre() {
    if (!Number(belop)) return
    setLagrer(true)
    await fetch('/api/kontantkonto', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selskap_id: selskapId, type, belop: Number(belop), dato, valuta, notat }),
    })
    setLagrer(false)
    await onLagret()
  }

  return (
    <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={type} onChange={e => setType(e.target.value as KontantbevegelseType)} style={selectStyle}>
            {MANUELLE_TYPER.map(t => <option key={t} value={t}>{BEVEGELSE_ETIKETT[t]}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Beløp ({valuta})</label>
          <input type="number" value={belop} onChange={e => setBelop(e.target.value)} placeholder="Positivt tall" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Dato</label>
          <input type="date" value={dato} onChange={e => setDato(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Notat</label>
          <input value={notat} onChange={e => setNotat(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={lagre} disabled={lagrer || !Number(belop)} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', padding: '8px 16px', fontSize: 12.5, fontWeight: 600, borderRadius: RADIUS.pill, cursor: Number(belop) && !lagrer ? 'pointer' : 'default', opacity: Number(belop) ? 1 : 0.5 }}>
          {lagrer ? 'Lagrer…' : 'Lagre bevegelse'}
        </button>
        <button onClick={onAvbryt} style={{ background: 'none', border: 'none', color: FARGER.tekstMid, fontSize: 12.5, cursor: 'pointer' }}>Avbryt</button>
        <span style={{ fontSize: 11, color: FARGER.tekstLys }}>Skriv positivt tall — fortegn settes av type (uttak/kostnad trekker fra).</span>
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
