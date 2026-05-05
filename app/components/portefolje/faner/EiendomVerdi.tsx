'use client'
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import { VURDERING_KILDER, VURDERING_KILDE_ETIKETT } from '../../../lib/portefolje'
import type { EiendomVerdivurdering } from '../../../types'
import type { EiendomData } from '../useEiendomData'
import {
  Felt, SumKort, TomTilstand, fmtNok, fmtDato, numOrNull, inputStil,
  knappStilPrimaer, knappStilSekundaer, knappStilSlett, knappStilNyttElement,
} from './faneUi'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

type Props = { data: EiendomData; onEndret: () => void | Promise<void> }

export function EiendomVerdi({ data, onEndret }: Props) {
  const [aapen, setAapen] = useState<string | null>(null)
  const [redigert, setRedigert] = useState<Partial<EiendomVerdivurdering>>({})

  // Sortér eldst først for graf, nyest først for liste
  const sortertKronologisk = useMemo(() =>
    [...data.verdivurderinger].sort((a, b) => (a.dato || '').localeCompare(b.dato || ''))
  , [data.verdivurderinger])

  const sortertNyestForst = useMemo(() =>
    [...data.verdivurderinger].sort((a, b) => (b.dato || '').localeCompare(a.dato || ''))
  , [data.verdivurderinger])

  const siste = sortertNyestForst[0]
  const eldste = sortertKronologisk[0]
  const endring = siste && eldste && siste.id !== eldste.id ? siste.verdi - eldste.verdi : 0
  const endringPct = eldste && eldste.verdi > 0 ? (endring / eldste.verdi) * 100 : 0

  function startNytt() {
    setRedigert({ dato: new Date().toISOString().slice(0, 10), kilde: 'egen_vurdering' })
    setAapen('nytt')
  }
  function startRediger(v: EiendomVerdivurdering) { setRedigert({ ...v }); setAapen(v.id) }
  function lukk() { setAapen(null); setRedigert({}) }

  async function lagre() {
    const r = redigert
    const verdi = numOrNull(r.verdi)
    if (verdi === null || !r.dato) {
      visToast('Dato og verdi må fylles inn', 'feil', 3000); return
    }
    if (aapen === 'nytt') {
      const id = nyId()
      const bruker = hentAktivBruker() || 'ukjent'
      const { error } = await supabase.from('eiendom_verdivurderinger').insert([{
        id, prosjekt_id: data.prosjekt!.id, bruker,
        dato: r.dato, verdi,
        kilde: r.kilde || null,
        utstedt_av: r.utstedt_av || null,
        notat: r.notat || null,
      }])
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Verdivurdering lagt til', 'suksess', 2500)
    } else if (aapen) {
      const { error } = await supabase.from('eiendom_verdivurderinger').update({
        dato: r.dato, verdi,
        kilde: r.kilde || null, utstedt_av: r.utstedt_av || null, notat: r.notat || null,
      }).eq('id', aapen)
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Oppdatert', 'suksess', 2000)
    }
    lukk(); await onEndret()
  }

  async function slett(id: string) {
    const harFil = data.verdivurderinger.find(v => v.id === id)?.storage_sti
    const tekst = harFil
      ? 'Slette denne verdivurderingen? Vedlagt fil fjernes også permanent.'
      : 'Slette denne verdivurderingen?'
    if (!confirm(tekst)) return
    // Rydd storage først (best-effort), så DB
    if (harFil) {
      await fetch('/api/portefolje/verdivurdering-fil', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vurdering_id: id }),
      }).catch(() => { /* ignorer — sletter raden uansett */ })
    }
    const { error } = await supabase.from('eiendom_verdivurderinger').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await onEndret()
  }

  async function lastOppFil(vurderingId: string, fil: File) {
    const form = new FormData()
    form.append('vurdering_id', vurderingId)
    form.append('fil', fil)
    const res = await fetch('/api/portefolje/verdivurdering-fil', { method: 'POST', body: form })
    const resp = await res.json().catch(() => ({}))
    if (!res.ok) {
      visToast(resp?.feil || 'Opplasting feilet', 'feil', 4000); return
    }
    visToast('Fil lastet opp', 'suksess', 2500)
    await onEndret()
  }

  async function fjernFil(vurderingId: string) {
    if (!confirm('Fjerne vedlagt fil? Vurderingsraden beholdes.')) return
    const res = await fetch('/api/portefolje/verdivurdering-fil', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vurdering_id: vurderingId }),
    })
    if (!res.ok) {
      const resp = await res.json().catch(() => ({}))
      visToast(resp?.feil || 'Sletting feilet', 'feil', 4000); return
    }
    visToast('Fil fjernet', 'suksess', 2000)
    await onEndret()
  }

  async function apneFil(vurderingId: string) {
    const res = await fetch(`/api/portefolje/verdivurdering-fil?vurdering_id=${vurderingId}`)
    const resp = await res.json().catch(() => ({}))
    if (!res.ok || !resp.url) {
      visToast(resp?.feil || 'Kunne ikke åpne fil', 'feil', 3500); return
    }
    window.open(resp.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      {data.verdivurderinger.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <SumKort lbl="Siste vurdering" verdi={fmtNok(siste?.verdi || 0)} />
          {eldste && siste && siste.id !== eldste.id && (
            <>
              <SumKort lbl={`Endring siden ${eldste.dato}`} verdi={(endring >= 0 ? '+' : '') + fmtNok(endring)} farge={endring >= 0 ? FARGER.suksess : FARGER.feil} />
              <SumKort lbl="Endring %" verdi={(endringPct >= 0 ? '+' : '') + endringPct.toFixed(1) + '%'} farge={endring >= 0 ? FARGER.suksess : FARGER.feil} />
            </>
          )}
          <SumKort lbl="Antall vurderinger" verdi={String(data.verdivurderinger.length)} />
        </div>
      )}

      {/* Graf */}
      {sortertKronologisk.length >= 2 && <VerdiGraf vurderinger={sortertKronologisk} />}

      {data.verdivurderinger.length === 0 && aapen !== 'nytt' && (
        <TomTilstand tekst="Ingen verdivurderinger registrert. Legg inn e-takst, megler-vurdering eller egen vurdering for å bygge historikk." />
      )}

      {sortertNyestForst.map(v => {
        const erAapen = aapen === v.id
        return (
          <div key={v.id} style={{
            background: '#fff', border: `1.5px solid ${erAapen ? FARGER.gull : FARGER.kantLys}`,
            borderRadius: RADIUS.md, padding: 16, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: erAapen ? 14 : 0 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork }}>
                  {fmtDato(v.dato)}
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {v.kilde && <span>{VURDERING_KILDE_ETIKETT[v.kilde]}</span>}
                  {v.utstedt_av && <span>· {v.utstedt_av}</span>}
                </div>
                {v.notat && <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 6, fontStyle: 'italic' }}>{v.notat}</div>}
                <FilRad
                  vurderingId={v.id}
                  filnavn={v.filnavn}
                  mimeType={v.mime_type}
                  onLastOpp={f => lastOppFil(v.id, f)}
                  onApne={() => apneFil(v.id)}
                  onFjern={() => fjernFil(v.id)} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: FARGER.mork }}>{fmtNok(v.verdi)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => erAapen ? lukk() : startRediger(v)} style={knappStilSekundaer}>
                  {erAapen ? 'Lukk' : 'Rediger'}
                </button>
                <button onClick={() => slett(v.id)} style={knappStilSlett}>🗑</button>
              </div>
            </div>
            {erAapen && <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />}
          </div>
        )
      })}

      {aapen === 'nytt' ? (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.gull}`, borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, marginBottom: 12 }}>Ny verdivurdering</div>
          <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />
        </div>
      ) : (
        <button onClick={startNytt} style={knappStilNyttElement}>+ Ny verdivurdering</button>
      )}
    </div>
  )
}

function Skjema({ redigert, setRedigert, onLagre, onAvbryt }: {
  redigert: Partial<EiendomVerdivurdering>
  setRedigert: (r: Partial<EiendomVerdivurdering>) => void
  onLagre: () => Promise<void>
  onAvbryt: () => void
}) {
  const upd = <K extends keyof EiendomVerdivurdering>(felt: K, v: EiendomVerdivurdering[K]) => setRedigert({ ...redigert, [felt]: v })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      <Felt lbl="Dato">
        <input type="date" value={redigert.dato || ''} onChange={e => upd('dato', e.target.value)} style={inputStil} />
      </Felt>
      <Felt lbl="Verdi (kr)">
        <input type="number" value={redigert.verdi ?? ''} onChange={e => upd('verdi', e.target.value === '' ? 0 : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Kilde">
        <select value={redigert.kilde || ''} onChange={e => upd('kilde', (e.target.value || null) as EiendomVerdivurdering['kilde'])} style={inputStil}>
          <option value="">— Velg —</option>
          {VURDERING_KILDER.map(k => <option key={k} value={k}>{VURDERING_KILDE_ETIKETT[k]}</option>)}
        </select>
      </Felt>
      <Felt lbl="Utstedt av">
        <input value={redigert.utstedt_av || ''} onChange={e => upd('utstedt_av', e.target.value || null)} style={inputStil} placeholder="F.eks. takstmann, meglerfirma" />
      </Felt>
      <Felt lbl="Notat" full>
        <input value={redigert.notat || ''} onChange={e => upd('notat', e.target.value || null)} style={inputStil} placeholder="Valgfritt — markedssituasjon, forutsetninger osv." />
      </Felt>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onLagre} style={knappStilPrimaer}>💾 Lagre</button>
        <button onClick={onAvbryt} style={knappStilSekundaer}>Avbryt</button>
      </div>
    </div>
  )
}

// Liten rad som viser vedlagt fil (PDF/bilde) eller en opplast-knapp
function FilRad({ vurderingId, filnavn, mimeType, onLastOpp, onApne, onFjern }: {
  vurderingId: string
  filnavn: string | null
  mimeType: string | null
  onLastOpp: (fil: File) => Promise<void>
  onApne: () => void
  onFjern: () => void
}) {
  const ikon = mimeType === 'application/pdf' ? '📄' : mimeType?.startsWith('image/') ? '🖼️' : '📎'
  if (filnavn) {
    return (
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onApne}
          style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: 4, padding: '4px 10px', fontSize: 12, color: FARGER.mork, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {ikon} {filnavn} <span style={{ color: FARGER.gull, fontSize: 10 }}>↗</span>
        </button>
        <button onClick={onFjern} title="Fjern fil"
          style={{ background: 'none', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 11, padding: '4px 6px' }}>
          fjern
        </button>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 8 }}>
      <label htmlFor={`fil-${vurderingId}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11, color: FARGER.tekstMid, background: FARGER.flateMid, borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
        📎 Last opp PDF / bilde
      </label>
      <input id={`fil-${vurderingId}`} type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) void onLastOpp(f)
          if (e.target) e.target.value = ''
        }}
        style={{ display: 'none' }} />
    </div>
  )
}

// SVG-graf — viser verdiutvikling over tid uten ekstra dependencies
function VerdiGraf({ vurderinger }: { vurderinger: EiendomVerdivurdering[] }) {
  const W = 800, H = 200, PAD_L = 70, PAD_R = 20, PAD_T = 20, PAD_B = 36
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const verdier = vurderinger.map(v => v.verdi)
  const minV = Math.min(...verdier)
  const maxV = Math.max(...verdier)
  const range = Math.max(1, maxV - minV)

  // Konverter datoer til relativ x-posisjon (basert på antall dager fra første)
  const tider = vurderinger.map(v => new Date(v.dato).getTime())
  const minT = Math.min(...tider)
  const maxT = Math.max(...tider)
  const rangeT = Math.max(1, maxT - minT)

  const punkter = vurderinger.map(v => {
    const x = PAD_L + ((new Date(v.dato).getTime() - minT) / rangeT) * innerW
    const y = PAD_T + (1 - (v.verdi - minV) / range) * innerH
    return { x, y, v }
  })
  const path = punkter.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')

  // Y-akse: 4 ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = minV + f * range
    const y = PAD_T + (1 - f) * innerH
    return { v, y }
  })

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 18, overflow: 'auto' }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        Verdiutvikling over tid
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxWidth: W, fontFamily: 'sans-serif' }}>
        {/* Y-akse-linjer + tall */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke={FARGER.kantLys} strokeWidth="1" strokeDasharray={i === 0 || i === yTicks.length - 1 ? '0' : '2,4'} />
            <text x={PAD_L - 8} y={t.y + 3} fontSize="10" fill={FARGER.tekstLys} textAnchor="end">
              {Math.round(t.v / 1000).toLocaleString('nb-NO')}k
            </text>
          </g>
        ))}
        {/* Linje */}
        <path d={path} fill="none" stroke={FARGER.gull} strokeWidth="2" />
        {/* Punkter + tooltip-tekst (bare første og siste for ikke å overbelaste) */}
        {punkter.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={FARGER.mork} />
            {(i === 0 || i === punkter.length - 1) && (
              <text x={p.x} y={H - 12} fontSize="10" fill={FARGER.tekstMid} textAnchor="middle">
                {p.v.dato.slice(0, 7)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
