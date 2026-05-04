'use client'
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import type { EiendomCashflow } from '../../../types'
import type { EiendomData } from '../useEiendomData'
import {
  Felt, SumKort, TomTilstand, fmtNok, inputStil,
  knappStilPrimaer, knappStilSekundaer, knappStilSlett, knappStilNyttElement,
} from './faneUi'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const MND_NAVN = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

type Props = { data: EiendomData; onEndret: () => void | Promise<void> }

export function EiendomCashflow({ data, onEndret }: Props) {
  const [aapen, setAapen] = useState<string | null>(null)
  const [redigert, setRedigert] = useState<Partial<EiendomCashflow>>({})
  const [valgtAr, setValgtAr] = useState<number>(new Date().getFullYear())

  // Aggregér per år
  const aar = useMemo(() => {
    const set = new Set<number>()
    for (const c of data.cashflow) {
      if (c.maaned && c.maaned.length >= 4) set.add(Number(c.maaned.slice(0, 4)))
    }
    return [...set].sort((a, b) => b - a)
  }, [data.cashflow])

  const radenForValgtAr = useMemo(() => {
    return data.cashflow
      .filter(c => c.maaned && c.maaned.startsWith(String(valgtAr)))
      .sort((a, b) => b.maaned.localeCompare(a.maaned))
  }, [data.cashflow, valgtAr])

  const sumInntekt = radenForValgtAr.reduce((s, c) => s + (c.inntekt || 0), 0)
  const sumKostnad = radenForValgtAr.reduce((s, c) => s + (c.kostnad || 0), 0)
  const sumNetto = sumInntekt - sumKostnad
  const snittNetto = radenForValgtAr.length > 0 ? sumNetto / radenForValgtAr.length : 0

  function startNytt() {
    const naa = new Date()
    const yyyymm = String(naa.getFullYear()) + '-' + String(naa.getMonth() + 1).padStart(2, '0')
    setRedigert({ maaned: yyyymm, inntekt: 0, kostnad: 0 })
    setAapen('nytt')
  }
  function startRediger(c: EiendomCashflow) { setRedigert({ ...c }); setAapen(c.id) }
  function lukk() { setAapen(null); setRedigert({}) }

  async function lagre() {
    const r = redigert
    if (!r.maaned || !/^\d{4}-\d{2}$/.test(r.maaned)) {
      visToast('Måned må være på formatet ÅÅÅÅ-MM', 'feil', 3000); return
    }
    if (aapen === 'nytt') {
      const id = nyId()
      const bruker = hentAktivBruker() || 'ukjent'
      const { error } = await supabase.from('eiendom_cashflow').insert([{
        id, prosjekt_id: data.prosjekt!.id, bruker,
        maaned: r.maaned, inntekt: r.inntekt || 0, kostnad: r.kostnad || 0,
        notat: r.notat || null,
      }])
      if (error) {
        if (error.code === '23505') {
          visToast('Det finnes allerede en linje for denne måneden — rediger den i stedet', 'feil', 4000)
        } else {
          visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000)
        }
        return
      }
      visToast('Måned lagt til', 'suksess', 2000)
    } else if (aapen) {
      const { error } = await supabase.from('eiendom_cashflow').update({
        maaned: r.maaned, inntekt: r.inntekt || 0, kostnad: r.kostnad || 0,
        notat: r.notat || null,
      }).eq('id', aapen)
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Oppdatert', 'suksess', 2000)
    }
    lukk(); await onEndret()
  }

  async function slett(id: string, maaned: string) {
    if (!confirm(`Slette ${maaned}?`)) return
    const { error } = await supabase.from('eiendom_cashflow').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await onEndret()
  }

  function eksporterCsv() {
    const navn = data.prosjekt!.navn.replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_').slice(0, 50)
    const linjer: string[] = ['maaned;inntekt;kostnad;netto;notat']
    const sortert = [...data.cashflow].sort((a, b) => a.maaned.localeCompare(b.maaned))
    for (const c of sortert) {
      const netto = (c.inntekt || 0) - (c.kostnad || 0)
      const notat = (c.notat || '').replace(/[\r\n;]+/g, ' ')
      linjer.push(`${c.maaned};${c.inntekt || 0};${c.kostnad || 0};${netto};${notat}`)
    }
    // Legg til BOM så Excel åpner UTF-8 riktig
    const csv = '﻿' + linjer.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cashflow_${navn}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    visToast('CSV lastet ned', 'suksess', 2500)
  }

  const [pdfLaster, setPdfLaster] = useState(false)
  async function eksporterPdf() {
    if (pdfLaster) return
    setPdfLaster(true)
    try {
      const res = await fetch('/api/portefolje/cashflow-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prosjekt_id: data.prosjekt!.id, ar: valgtAr }),
      })
      const resp = await res.json().catch(() => ({}))
      if (!res.ok || !resp.base64) {
        visToast(resp?.feil || 'PDF feilet', 'feil', 4000); return
      }
      const bin = atob(resp.base64)
      const u8 = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      const blob = new Blob([u8], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resp.filnavn || `cashflow_${valgtAr}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      visToast('PDF lastet ned', 'suksess', 2500)
    } finally {
      setPdfLaster(false)
    }
  }

  // Fyll ut alle 12 måneder for valgt år (de uten data vises tomme)
  const visningsRader = useMemo(() => {
    const map = new Map(radenForValgtAr.map(r => [r.maaned, r]))
    const result: Array<{ maaned: string; rad?: EiendomCashflow }> = []
    for (let m = 12; m >= 1; m--) {
      const key = `${valgtAr}-${String(m).padStart(2, '0')}`
      result.push({ maaned: key, rad: map.get(key) })
    }
    return result
  }, [radenForValgtAr, valgtAr])

  return (
    <div>
      {data.cashflow.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <select value={valgtAr} onChange={e => setValgtAr(Number(e.target.value))}
              style={{ padding: '8px 12px', fontSize: 13, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff', fontWeight: 600 }}>
              {(aar.length > 0 ? aar : [valgtAr]).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={eksporterPdf} disabled={pdfLaster} style={{ ...knappStilSekundaer, background: pdfLaster ? FARGER.tekstLys : FARGER.mork, color: '#fff' }}>
                {pdfLaster ? '⏳ Bygger…' : `📄 Årsrapport ${valgtAr} (PDF)`}
              </button>
              <button onClick={eksporterCsv} style={knappStilSekundaer}>📥 CSV (alle år)</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
            <SumKort lbl={`Inntekt ${valgtAr}`} verdi={fmtNok(sumInntekt)} farge={FARGER.suksess} />
            <SumKort lbl={`Kostnad ${valgtAr}`} verdi={fmtNok(sumKostnad)} farge={FARGER.feil} />
            <SumKort lbl="Netto" verdi={fmtNok(sumNetto)} farge={sumNetto >= 0 ? FARGER.suksess : FARGER.feil} />
            <SumKort lbl="Snitt / mnd" verdi={fmtNok(snittNetto)} farge={snittNetto >= 0 ? FARGER.suksess : FARGER.feil} />
          </div>
        </>
      )}

      {data.cashflow.length === 0 && aapen !== 'nytt' && (
        <TomTilstand tekst="Ingen cashflow-logg ennå. Registrer faktiske inntekter og kostnader per måned for regnskapsfører-vennlig oversikt." />
      )}

      {data.cashflow.length > 0 && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr auto', gap: 8, padding: '10px 14px', background: FARGER.creamLys, fontSize: 10, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span>Måned</span>
            <span style={{ textAlign: 'right' }}>Inntekt</span>
            <span style={{ textAlign: 'right' }}>Kostnad</span>
            <span style={{ textAlign: 'right' }}>Netto</span>
            <span>Notat</span>
            <span></span>
          </div>
          {visningsRader.map(({ maaned, rad }) => {
            const erAapen = rad && aapen === rad.id
            const mndNum = Number(maaned.slice(5, 7))
            const mndLbl = `${MND_NAVN[mndNum - 1]} ${maaned.slice(0, 4)}`
            const netto = rad ? (rad.inntekt || 0) - (rad.kostnad || 0) : 0
            return (
              <div key={maaned}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr auto', gap: 8,
                  padding: '10px 14px', borderTop: `1px solid ${FARGER.flateLys}`,
                  alignItems: 'center', fontSize: 13,
                  background: erAapen ? FARGER.creamLys : 'transparent',
                  opacity: rad ? 1 : 0.5,
                }}>
                  <span style={{ fontWeight: rad ? 600 : 400, color: FARGER.mork }}>{mndLbl}</span>
                  <span style={{ textAlign: 'right', color: rad ? FARGER.suksess : FARGER.tekstLys, fontWeight: rad ? 600 : 400 }}>
                    {rad ? fmtNok(rad.inntekt) : '–'}
                  </span>
                  <span style={{ textAlign: 'right', color: rad ? FARGER.feil : FARGER.tekstLys, fontWeight: rad ? 600 : 400 }}>
                    {rad ? fmtNok(rad.kostnad) : '–'}
                  </span>
                  <span style={{ textAlign: 'right', color: rad ? (netto >= 0 ? FARGER.suksess : FARGER.feil) : FARGER.tekstLys, fontWeight: rad ? 700 : 400 }}>
                    {rad ? fmtNok(netto) : '–'}
                  </span>
                  <span style={{ color: FARGER.tekstMid, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rad?.notat || ''}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {rad ? (
                      <>
                        <button onClick={() => erAapen ? lukk() : startRediger(rad)} style={{ ...knappStilSekundaer, padding: '4px 8px', fontSize: 10 }}>
                          {erAapen ? 'Lukk' : '✏️'}
                        </button>
                        <button onClick={() => slett(rad.id, maaned)} style={{ ...knappStilSlett, padding: '4px 8px', fontSize: 11 }}>🗑</button>
                      </>
                    ) : (
                      <button onClick={() => { setRedigert({ maaned, inntekt: 0, kostnad: 0 }); setAapen('nytt') }}
                        style={{ background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none', padding: '4px 8px', fontSize: 10, borderRadius: RADIUS.sm, cursor: 'pointer' }}>
                        + Legg til
                      </button>
                    )}
                  </div>
                </div>
                {erAapen && rad && (
                  <div style={{ padding: '0 14px 14px', background: FARGER.creamLys }}>
                    <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {aapen === 'nytt' ? (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.gull}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, marginBottom: 12 }}>Ny måned</div>
          <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />
        </div>
      ) : (
        <button onClick={startNytt} style={knappStilNyttElement}>+ Ny måned</button>
      )}
    </div>
  )
}

function Skjema({ redigert, setRedigert, onLagre, onAvbryt }: {
  redigert: Partial<EiendomCashflow>
  setRedigert: (r: Partial<EiendomCashflow>) => void
  onLagre: () => Promise<void>
  onAvbryt: () => void
}) {
  const upd = <K extends keyof EiendomCashflow>(felt: K, v: EiendomCashflow[K]) => setRedigert({ ...redigert, [felt]: v })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      <Felt lbl="Måned (ÅÅÅÅ-MM)">
        <input value={redigert.maaned || ''} onChange={e => upd('maaned', e.target.value)} placeholder="2026-01" style={inputStil} />
      </Felt>
      <Felt lbl="Inntekt (kr)">
        <input type="number" value={redigert.inntekt ?? ''} onChange={e => upd('inntekt', e.target.value === '' ? 0 : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Kostnad (kr)">
        <input type="number" value={redigert.kostnad ?? ''} onChange={e => upd('kostnad', e.target.value === '' ? 0 : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Notat" full>
        <input value={redigert.notat || ''} onChange={e => upd('notat', e.target.value || null)} style={inputStil} placeholder="Valgfritt — vedlikehold, leieøkning, tomgang osv." />
      </Felt>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onLagre} style={knappStilPrimaer}>💾 Lagre</button>
        <button onClick={onAvbryt} style={knappStilSekundaer}>Avbryt</button>
      </div>
    </div>
  )
}
