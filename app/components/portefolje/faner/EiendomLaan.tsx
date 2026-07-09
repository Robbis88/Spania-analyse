'use client'
import { useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import {
  LAANETYPER, LAANETYPE_ETIKETT,
  totalLaanKostnadMnd, totalRestgjeld, rentesjokk,
  totalRenterMnd, totalAvdragMnd, renterMndEn, avdragMndEn, annuitetMnd,
} from '../../../lib/portefolje'
import type { EiendomLaan } from '../../../types'
import type { EiendomData } from '../useEiendomData'
import {
  Felt, SumKort, fmtNok, numOrNull, inputStil,
  knappStilPrimaer, knappStilSekundaer, knappStilSlett,
} from './faneUi'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const fmtPct = (n: number | null | undefined) =>
  (n === null || n === undefined || !Number.isFinite(n)) ? '–' : n.toFixed(2) + '%'

type Props = { data: EiendomData; onEndret: () => void | Promise<void> }

export function EiendomLaan({ data, onEndret }: Props) {
  const [aapenForm, setAapenForm] = useState<string | null>(null)  // lån-id eller 'nytt'
  const [redigert, setRedigert] = useState<Partial<EiendomLaan>>({})
  const [analyserer, setAnalyserer] = useState(false)
  const filInput = useRef<HTMLInputElement>(null)

  // Last opp lånedokument (PDF/bilde) → Claude vision trekker ut vilkårene og
  // forhåndsutfyller Nytt lån-skjemaet. Dine tall vinner: alt kan endres før lagring.
  async function analyserDokument(fil: File) {
    setAnalyserer(true)
    try {
      const fd = new FormData()
      fd.append('fil', fil)
      const r = await fetch('/api/laan/analyser', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok || !d.suksess) { visToast(d.feil || 'Kunne ikke lese dokumentet', 'feil', 4000); return }
      const f = d.felt as Record<string, unknown>
      const antall = Object.values(f).filter(v => v !== null && v !== undefined).length
      if (antall === 0) { visToast('Fant ingen lånevilkår i dokumentet — fyll inn manuelt', 'feil', 4000); return }
      setRedigert({
        bank: (f.bank as string) || undefined,
        laanetype: (f.laanetype as EiendomLaan['laanetype']) || 'annuitet',
        hovedstol: (f.hovedstol as number) ?? null,
        restgjeld: (f.restgjeld as number) ?? null,
        rente_pst: (f.rente_pst as number) ?? null,
        rentetype: (f.rentetype as EiendomLaan['rentetype']) || 'flytende',
        bindingstid_aar: (f.bindingstid_aar as number) ?? null,
        nedbetalingstid_aar: (f.nedbetalingstid_aar as number) ?? null,
        termin_belop: (f.termin_belop as number) ?? null,
        rente_belop: (f.rente_belop as number) ?? null,
        avdrag_belop: (f.avdrag_belop as number) ?? null,
        avdragsfritt: !!f.avdragsfritt,
        termin_frekvens: (f.termin_frekvens as EiendomLaan['termin_frekvens']) || 'mnd',
        startdato: (f.startdato as string) || null,
      })
      setAapenForm('nytt')
      visToast(`Leste ${antall} felt fra dokumentet — sjekk og lagre`, 'suksess', 3500)
    } catch { visToast('Analyse feilet', 'feil', 4000) } finally {
      setAnalyserer(false)
      if (filInput.current) filInput.current.value = ''
    }
  }

  const totalRest = useMemo(() => totalRestgjeld(data.laan), [data.laan])
  const totalMnd = useMemo(() => totalLaanKostnadMnd(data.laan), [data.laan])
  const totalRenter = useMemo(() => totalRenterMnd(data.laan), [data.laan])
  const totalAvdrag = useMemo(() => totalAvdragMnd(data.laan), [data.laan])
  const stress1 = useMemo(() => rentesjokk(data.laan, 1), [data.laan])
  const stress2 = useMemo(() => rentesjokk(data.laan, 2), [data.laan])
  const stress3 = useMemo(() => rentesjokk(data.laan, 3), [data.laan])

  function startNytt() {
    setRedigert({ termin_frekvens: 'mnd', laanetype: 'annuitet', rentetype: 'flytende', avdragsfritt: false })
    setAapenForm('nytt')
  }
  function startRediger(l: EiendomLaan) {
    setRedigert({ ...l })
    setAapenForm(l.id)
  }

  async function lagre() {
    const r = redigert
    // Renter + avdrag er kilden. Terminbeløp lagres som summen (total per termin)
    // for visning og bakoverkompatibilitet. Avdragsfritt ⇒ avdrag = 0.
    const rb = numOrNull(r.rente_belop)
    const ab = r.avdragsfritt ? 0 : numOrNull(r.avdrag_belop)
    const terminTotal = (rb != null || ab != null) ? (rb || 0) + (ab || 0) : numOrNull(r.termin_belop)
    const felt = {
      bank: r.bank || null,
      laanetype: r.laanetype || 'annuitet',
      hovedstol: numOrNull(r.hovedstol),
      restgjeld: numOrNull(r.restgjeld),
      rente_pst: numOrNull(r.rente_pst),
      rentetype: r.rentetype || 'flytende',
      bindingstid_aar: numOrNull(r.bindingstid_aar),
      rente_belop: rb,
      avdrag_belop: ab,
      avdragsfritt: !!r.avdragsfritt,
      termin_belop: terminTotal,
      termin_frekvens: r.termin_frekvens || 'mnd',
      nedbetalingstid_aar: numOrNull(r.nedbetalingstid_aar),
      startdato: r.startdato || null,
      notat: r.notat || null,
    }
    if (aapenForm === 'nytt') {
      const { error } = await supabase.from('eiendom_laan').insert([{
        id: nyId(), prosjekt_id: data.prosjekt!.id, bruker: hentAktivBruker() || 'ukjent', ...felt,
      }])
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Lån lagt til', 'suksess', 2500)
    } else if (aapenForm) {
      const { error } = await supabase.from('eiendom_laan').update(felt).eq('id', aapenForm)
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Lån oppdatert', 'suksess', 2000)
    }
    setAapenForm(null); setRedigert({})
    await onEndret()
  }

  async function slett(id: string, bank: string | null) {
    if (!confirm(`Slette lånet${bank ? ` hos ${bank}` : ''}?`)) return
    const { error } = await supabase.from('eiendom_laan').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Lån slettet', 'suksess', 2000)
    await onEndret()
  }

  return (
    <div>
      {/* Sammendrag-stripe */}
      {data.laan.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <SumKort lbl="Total restgjeld" verdi={fmtNok(totalRest)} />
          <SumKort lbl="Renter / mnd (kostnad)" verdi={fmtNok(totalRenter)} />
          <SumKort lbl="Avdrag / mnd (egenkapital)" verdi={fmtNok(totalAvdrag)} />
          <SumKort lbl="Sum termin / mnd" verdi={fmtNok(totalMnd)} />
          <SumKort lbl="Antall lån" verdi={String(data.laan.length)} />
        </div>
      )}

      {/* Lån-liste */}
      {data.laan.map(l => {
        const aapen = aapenForm === l.id
        return (
          <div key={l.id} style={{
            background: '#fff', border: `1.5px solid ${aapen ? FARGER.gull : FARGER.kantLys}`,
            borderRadius: RADIUS.md, padding: 16, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: aapen ? 14 : 0 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork }}>
                  {l.bank || 'Ukjent bank'}
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span>{LAANETYPE_ETIKETT[l.laanetype || 'annet']}</span>
                  {l.rente_pst !== null && <span>· {fmtPct(l.rente_pst)} {l.rentetype || ''}</span>}
                  {l.nedbetalingstid_aar && <span>· {l.nedbetalingstid_aar} år</span>}
                  {l.bindingstid_aar && <span>· {l.bindingstid_aar} år binding</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.mork }}>{fmtNok(l.restgjeld)}</div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys }}>{fmtNok(l.termin_belop)}/{l.termin_frekvens}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => aapen ? setAapenForm(null) : startRediger(l)}
                  style={knappStilSekundaer}>
                  {aapen ? 'Lukk' : 'Rediger'}
                </button>
                <button onClick={() => slett(l.id, l.bank)} style={knappStilSlett}>🗑</button>
              </div>
            </div>
            {aapen && <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={() => { setAapenForm(null); setRedigert({}) }} />}
          </div>
        )
      })}

      {/* Nytt lån */}
      {aapenForm === 'nytt' ? (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.gull}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, marginBottom: 12 }}>Nytt lån</div>
          <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={() => { setAapenForm(null); setRedigert({}) }} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          <button onClick={startNytt}
            style={{ background: FARGER.mork, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            + Nytt lån
          </button>
          <button onClick={() => filInput.current?.click()} disabled={analyserer}
            style={{ background: '#fff', color: FARGER.mork, border: `1.5px solid ${FARGER.gull}`, padding: '10px 18px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: analyserer ? 'default' : 'pointer', letterSpacing: '0.02em', opacity: analyserer ? 0.6 : 1 }}>
            {analyserer ? '⏳ Leser dokument…' : '✨ Last opp lånedokument'}
          </button>
          <input ref={filInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={e => { const f = e.target.files?.[0]; if (f) void analyserDokument(f) }}
            style={{ display: 'none' }} />
        </div>
      )}

      {/* Stresstest */}
      {data.laan.length > 0 && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            🧪 Stresstest — terminbeløp ved rentesjokk
          </div>
          <p style={{ fontSize: 12, color: FARGER.tekstLys, margin: '0 0 12px' }}>
            Forutsetter at lån har annuitet, restgjeld, rente og nedbetalingstid satt — andre lån faller tilbake til registrert terminbeløp.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <Stress lbl="Nåværende rente" mnd={totalMnd} />
            <Stress lbl="+1 prosentpoeng" mnd={stress1} basis={totalMnd} />
            <Stress lbl="+2 prosentpoeng" mnd={stress2} basis={totalMnd} />
            <Stress lbl="+3 prosentpoeng" mnd={stress3} basis={totalMnd} />
          </div>
        </div>
      )}
    </div>
  )
}

function Skjema({ redigert, setRedigert, onLagre, onAvbryt }: {
  redigert: Partial<EiendomLaan>
  setRedigert: (r: Partial<EiendomLaan>) => void
  onLagre: () => Promise<void>
  onAvbryt: () => void
}) {
  const upd = <K extends keyof EiendomLaan>(felt: K, v: EiendomLaan[K]) => setRedigert({ ...redigert, [felt]: v })
  const preview = { ...redigert, termin_frekvens: redigert.termin_frekvens || 'mnd', avdragsfritt: !!redigert.avdragsfritt } as EiendomLaan
  const rMnd = renterMndEn(preview)
  const aMnd = avdragMndEn(preview)
  function beregnAnnuitet() {
    const rest = Number(redigert.restgjeld), rente = Number(redigert.rente_pst), ned = Number(redigert.nedbetalingstid_aar)
    if (!rest || !rente || !ned) { visToast('Trenger restgjeld, rente og nedbetalingstid', 'feil', 3000); return }
    const annu = annuitetMnd(rest, rente, ned)
    const renterM = (rest * (rente / 100)) / 12
    setRedigert({ ...redigert, termin_frekvens: 'mnd', avdragsfritt: false, rente_belop: Math.round(renterM), avdrag_belop: Math.round(annu - renterM) })
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      <Felt lbl="Bank">
        <input value={redigert.bank || ''} onChange={e => upd('bank', e.target.value)} style={inputStil} placeholder="DNB, Nordea, Sparebank…" />
      </Felt>
      <Felt lbl="Lånetype">
        <select value={redigert.laanetype || 'annuitet'} onChange={e => upd('laanetype', e.target.value as EiendomLaan['laanetype'])} style={inputStil}>
          {LAANETYPER.map(t => <option key={t} value={t}>{LAANETYPE_ETIKETT[t]}</option>)}
        </select>
      </Felt>
      <Felt lbl="Hovedstol (kr)">
        <input type="number" value={redigert.hovedstol ?? ''} onChange={e => upd('hovedstol', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Restgjeld (kr)">
        <input type="number" value={redigert.restgjeld ?? ''} onChange={e => upd('restgjeld', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Rente (%)">
        <input type="number" step="0.01" value={redigert.rente_pst ?? ''} onChange={e => upd('rente_pst', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Rentetype">
        <select value={redigert.rentetype || 'flytende'} onChange={e => upd('rentetype', e.target.value as EiendomLaan['rentetype'])} style={inputStil}>
          <option value="flytende">Flytende</option>
          <option value="fast">Fast</option>
        </select>
      </Felt>
      <Felt lbl="Bindingstid (år)">
        <input type="number" step="0.5" value={redigert.bindingstid_aar ?? ''} onChange={e => upd('bindingstid_aar', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Nedbetalingstid (år)">
        <input type="number" step="0.5" value={redigert.nedbetalingstid_aar ?? ''} onChange={e => upd('nedbetalingstid_aar', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Avdragsfritt?">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: FARGER.tekstMid, padding: '11px 0' }}>
          <input type="checkbox" checked={!!redigert.avdragsfritt} onChange={e => upd('avdragsfritt', e.target.checked)} />
          Rent rentelån (ingen avdrag)
        </label>
      </Felt>
      <Felt lbl="Renter (per termin)">
        <input type="number" value={redigert.rente_belop ?? ''} onChange={e => upd('rente_belop', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} placeholder="rentedel" />
      </Felt>
      <Felt lbl="Avdrag (per termin)">
        <input type="number" disabled={!!redigert.avdragsfritt} value={redigert.avdragsfritt ? 0 : (redigert.avdrag_belop ?? '')} onChange={e => upd('avdrag_belop', e.target.value === '' ? null : Number(e.target.value))} style={{ ...inputStil, opacity: redigert.avdragsfritt ? 0.5 : 1 }} placeholder="avdragsdel" />
      </Felt>
      <Felt lbl="Termin">
        <select value={redigert.termin_frekvens || 'mnd'} onChange={e => upd('termin_frekvens', e.target.value as EiendomLaan['termin_frekvens'])} style={inputStil}>
          <option value="mnd">Månedlig</option>
          <option value="kvartal">Kvartalsvis</option>
          <option value="aar">Årlig</option>
        </select>
      </Felt>
      <Felt lbl="Startdato">
        <input type="date" value={redigert.startdato || ''} onChange={e => upd('startdato', e.target.value || null)} style={inputStil} />
      </Felt>
      <Felt lbl="Notat" full>
        <input value={redigert.notat || ''} onChange={e => upd('notat', e.target.value || null)} style={inputStil} placeholder="Valgfritt" />
      </Felt>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 12, color: FARGER.tekstMid, background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: '10px 12px' }}>
        <span>≈ <strong style={{ color: FARGER.feil }}>Renter {fmtNok(rMnd)}/mnd</strong> · <strong style={{ color: FARGER.suksess }}>Avdrag {fmtNok(aMnd)}/mnd</strong> · Sum {fmtNok(rMnd + aMnd)}/mnd</span>
        <span style={{ color: FARGER.tekstLys }}>Renter teller i resultat; avdrag bygger egenkapital.</span>
        {redigert.laanetype === 'annuitet' && !redigert.avdragsfritt && (
          <button type="button" onClick={beregnAnnuitet} style={{ ...knappStilSekundaer, marginLeft: 'auto' }}>↻ Beregn fra rente + nedbetalingstid</button>
        )}
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onLagre} style={knappStilPrimaer}>💾 Lagre</button>
        <button onClick={onAvbryt} style={knappStilSekundaer}>Avbryt</button>
      </div>
    </div>
  )
}

function Stress({ lbl, mnd, basis }: { lbl: string; mnd: number; basis?: number }) {
  const diff = basis !== undefined ? mnd - basis : 0
  return (
    <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 10 }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys }}>{lbl}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: FARGER.mork, marginTop: 2 }}>{fmtNok(mnd)}</div>
      {basis !== undefined && diff > 0 && (
        <div style={{ fontSize: 10, color: FARGER.feil, marginTop: 2 }}>+{fmtNok(diff)} / mnd</div>
      )}
    </div>
  )
}

