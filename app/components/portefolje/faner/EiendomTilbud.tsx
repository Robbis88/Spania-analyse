'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle, selectStyle } from '../../../lib/styles'
import { ARBEIDSTYPER, ARBEIDSTYPE_ETIKETT } from '../../../lib/tilbud'
import type { Tilbud } from '../../../types'
import type { EiendomData } from '../useEiendomData'

type TilbudMedUrl = Tilbud & { fil_url?: string | null }

const fmt = (n: number | null, valuta: string | null) => {
  if (n === null || !Number.isFinite(n)) return '–'
  const v = Math.round(n).toLocaleString('nb-NO')
  return valuta === 'EUR' ? `€${v}` : `${v} kr`
}

export function EiendomTilbud({ data }: { data: EiendomData }) {
  const prosjektId = data.prosjekt!.id
  const stdValuta = data.prosjekt!.marked === 'norge' ? 'NOK' : 'EUR'
  const [tilbud, setTilbud] = useState<TilbudMedUrl[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [laster_opp, setLasterOpp] = useState(false)
  const [arbeidstype, setArbeidstype] = useState<string>('totalrenovering')
  const [visInternt, setVisInternt] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const hent = useCallback(async () => {
    setLaster(true); setFeil(null)
    try {
      const r = await fetch(`/api/tilbud?prosjekt_id=${encodeURIComponent(prosjektId)}`)
      const d = await r.json()
      if (!r.ok || d.feil) { setFeil(d.feil || 'Kunne ikke hente'); return }
      setTilbud(d.tilbud || [])
    } catch { setFeil('Kunne ikke hente tilbud') } finally { setLaster(false) }
  }, [prosjektId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  async function lastOpp(fil: File) {
    setLasterOpp(true); setFeil(null)
    try {
      const fd = new FormData()
      fd.append('prosjekt_id', prosjektId)
      fd.append('fil', fil)
      fd.append('arbeidstype', arbeidstype)
      const r = await fetch('/api/tilbud/last-opp', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok || d.feil) { setFeil(d.feil || 'Opplasting feilet'); return }
      await hent()
      // Kjør OCR i bakgrunnen
      await fetch('/api/tilbud/analyser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tilbud_id: d.tilbud_id }) })
      await hent()
    } catch { setFeil('Opplasting feilet') } finally { setLasterOpp(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function aksepter(id: string, akseptert: boolean) {
    await fetch('/api/tilbud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, akseptert }) })
    await hent()
  }
  async function slett(id: string) {
    if (!confirm('Slette dette tilbudet?')) return
    await fetch(`/api/tilbud?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    await hent()
  }
  async function analyserPaaNytt(id: string) {
    await fetch('/api/tilbud/analyser', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tilbud_id: id }) })
    await hent()
  }

  const akseptertT = tilbud.find(t => t.akseptert)

  return (
    <div>
      <p style={{ fontSize: 14, color: FARGER.tekstMid, margin: '0 0 18px', maxWidth: 640, lineHeight: 1.6 }}>
        Last opp pristilbud (PDF/bilde) — AI leser ut aktør, sum og hva som inngår. Marker ett som <strong>akseptert</strong>; summen brukes som renoveringskost i Beslutning-fanen.
      </p>

      {feil && <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}`, padding: 12, color: '#7a0c1e', borderRadius: RADIUS.md, marginBottom: 16 }}>{feil}</div>}

      {/* Opplasting */}
      <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 18, marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Type arbeid</label>
          <select value={arbeidstype} onChange={e => setArbeidstype(e.target.value)} style={{ ...selectStyle, maxWidth: 200 }}>
            {ARBEIDSTYPER.map(a => <option key={a} value={a}>{ARBEIDSTYPE_ETIKETT[a]}</option>)}
          </select>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) void lastOpp(f) }} style={{ fontSize: 13 }} />
        {laster_opp && <span style={{ fontSize: 13, color: FARGER.tekstMid }}>Laster opp og leser…</span>}
        <button onClick={() => setVisInternt(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: FARGER.tekstMid }}>
          + Internt tilbud (Ronny)
        </button>
      </div>

      {visInternt && <InterntSkjema prosjektId={prosjektId} stdValuta={stdValuta} onLagret={() => { setVisInternt(false); void hent() }} />}

      {laster ? (
        <div style={{ padding: 30, color: FARGER.tekstLys }}>Laster tilbud…</div>
      ) : tilbud.length === 0 ? (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys, fontSize: 13 }}>
          Ingen tilbud ennå. Last opp det første over.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {tilbud.map(t => (
            <TilbudKort key={t.id} t={t} onAksepter={aksepter} onSlett={slett} onAnalyser={analyserPaaNytt} />
          ))}
        </div>
      )}

      {akseptertT && (
        <div style={{ marginTop: 18, fontSize: 13, color: FARGER.suksess }}>
          ✓ Akseptert: <strong>{akseptertT.aktor || 'Internt'}</strong> — {fmt(akseptertT.totalsum, akseptertT.valuta || stdValuta)} brukes som renoveringskost.
        </div>
      )}
    </div>
  )
}

function TilbudKort({ t, onAksepter, onSlett, onAnalyser }: {
  t: TilbudMedUrl
  onAksepter: (id: string, a: boolean) => void
  onSlett: (id: string) => void
  onAnalyser: (id: string) => void
}) {
  return (
    <div style={{
      background: FARGER.hvit, borderRadius: RADIUS.lg, padding: 16,
      border: t.akseptert ? `2px solid ${FARGER.suksess}` : `1px solid ${FARGER.kantUltralys}`,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork }}>{t.aktor || (t.er_internt ? 'Internt arbeid' : 'Ukjent aktør')}</div>
        {t.akseptert && <span style={{ fontSize: 10, fontWeight: 700, color: FARGER.suksess, letterSpacing: '0.08em' }}>AKSEPTERT</span>}
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, color: FARGER.mork, marginBottom: 8 }}>{fmt(t.totalsum, t.valuta)}</div>

      {t.arbeidstype && <div style={{ fontSize: 12, color: FARGER.gull, fontWeight: 600, marginBottom: 6 }}>{ARBEIDSTYPE_ETIKETT[t.arbeidstype as keyof typeof ARBEIDSTYPE_ETIKETT] || t.arbeidstype}</div>}

      {t.ocr_status === 'venter' && <div style={{ fontSize: 12, color: FARGER.tekstLys, fontStyle: 'italic' }}>Leser…</div>}
      {t.ocr_status === 'feilet' && <div style={{ fontSize: 12, color: FARGER.feil }}>OCR feilet{t.ocr_feilmelding ? ` (${t.ocr_feilmelding})` : ''}</div>}

      {Array.isArray(t.poster) && t.poster.length > 0 && (
        <div style={{ margin: '8px 0' }}>
          {t.poster.slice(0, 6).map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: FARGER.tekstMid }}>
              <span>{p.navn}</span><span>{fmt(p.sum, t.valuta)}</span>
            </div>
          ))}
        </div>
      )}

      {t.inkluderer && <div style={{ fontSize: 11.5, color: FARGER.tekstMid, marginTop: 4 }}><strong>Inkl:</strong> {t.inkluderer}</div>}
      {t.ekskluderer && <div style={{ fontSize: 11.5, color: FARGER.tekstMid, marginTop: 2 }}><strong>Ekskl:</strong> {t.ekskluderer}</div>}
      {t.gyldig_til && <div style={{ fontSize: 11.5, color: FARGER.tekstLys, marginTop: 4 }}>Gyldig til {t.gyldig_til}</div>}

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', borderTop: `1px solid ${FARGER.kantUltralys}`, paddingTop: 12 }}>
        <button onClick={() => onAksepter(t.id, !t.akseptert)}
          style={{ background: t.akseptert ? FARGER.flateMid : FARGER.mork, color: t.akseptert ? FARGER.tekstMid : FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {t.akseptert ? 'Fjern aksept' : 'Aksepter'}
        </button>
        {t.fil_url && <a href={t.fil_url} target="_blank" rel="noopener noreferrer" style={{ background: FARGER.flateLys, color: FARGER.tekstMid, borderRadius: RADIUS.pill, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Se fil</a>}
        {t.storage_sti && <button onClick={() => onAnalyser(t.id)} style={{ background: 'none', border: 'none', color: FARGER.tekstLys, fontSize: 12, cursor: 'pointer' }}>Les på nytt</button>}
        <button onClick={() => onSlett(t.id)} style={{ background: 'none', border: 'none', color: FARGER.feil, fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>Slett</button>
      </div>
    </div>
  )
}

function InterntSkjema({ prosjektId, stdValuta, onLagret }: { prosjektId: string; stdValuta: string; onLagret: () => void }) {
  const [aktor, setAktor] = useState('Internt (Ronny)')
  const [totalsum, setTotalsum] = useState('')
  const [arbeidstype, setArbeidstype] = useState('totalrenovering')
  const [lagrer, setLagrer] = useState(false)
  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
      <div><label style={labelStyle}>Beskrivelse</label><input value={aktor} onChange={e => setAktor(e.target.value)} style={inputStyle} /></div>
      <div><label style={labelStyle}>Sum ({stdValuta})</label><input type="number" value={totalsum} onChange={e => setTotalsum(e.target.value)} style={inputStyle} /></div>
      <div><label style={labelStyle}>Type arbeid</label>
        <select value={arbeidstype} onChange={e => setArbeidstype(e.target.value)} style={selectStyle}>
          {ARBEIDSTYPER.map(a => <option key={a} value={a}>{ARBEIDSTYPE_ETIKETT[a]}</option>)}
        </select>
      </div>
      <button disabled={lagrer || !Number(totalsum)} onClick={async () => {
        setLagrer(true)
        await fetch('/api/tilbud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prosjekt_id: prosjektId, er_internt: true, aktor, totalsum: Number(totalsum), valuta: stdValuta, arbeidstype }) })
        setLagrer(false); onLagret()
      }} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        {lagrer ? 'Lagrer…' : 'Legg til'}
      </button>
    </div>
  )
}
