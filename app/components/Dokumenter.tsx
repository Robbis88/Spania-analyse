'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import {
  DOKUMENT_ETIKETT, DOKUMENT_TYPER,
  DOKUMENT_TILLATTE_MIME, DOKUMENT_MAKS_STORRELSE_BYTES,
  SJEKKPUNKT_STATUS_FARGE, SJEKKPUNKT_STATUS_LBL,
  type DokumentType, type SjekkpunktStatus,
} from '../lib/dokument'
import type { Dokument, DokumentSjekkpunkt } from '../types'

type Props = { prosjektId: string }

export function Dokumenter({ prosjektId }: Props) {
  const [dokumenter, setDokumenter] = useState<Dokument[]>([])
  const [sjekkpunkter, setSjekkpunkter] = useState<DokumentSjekkpunkt[]>([])
  const [urler, setUrler] = useState<Record<string, string>>({})
  const [laster, setLaster] = useState(true)
  const [filter, setFilter] = useState<'alle' | DokumentType>('alle')
  const [sok, setSok] = useState('')
  const [opplastingType, setOpplastingType] = useState<DokumentType>('annet')
  const [opplastingTittel, setOpplastingTittel] = useState('')
  const [pending, setPending] = useState<Array<{ filnavn: string; status: 'laster' | 'feilet'; feil?: string }>>([])
  const [utvidet, setUtvidet] = useState<string | null>(null)
  const [leggTilSjekkpunkt, setLeggTilSjekkpunkt] = useState<DokumentType | ''>('')
  const filInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const hentDokumenter = useCallback(async () => {
    setLaster(true)
    const { data } = await supabase
      .from('dokumenter')
      .select('id, prosjekt_id, bruker, opprettet, tittel, type, storage_sti, filnavn, mime_type, utstedt_dato, gyldig_til, notat, tagger')
      .eq('prosjekt_id', prosjektId)
      .order('opprettet', { ascending: false })
    const liste = (data || []) as Dokument[]
    setDokumenter(liste)
    setLaster(false)

    if (liste.length > 0) {
      const res = await fetch('/api/dokument/signert-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: liste.map(d => d.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.urler) setUrler(data.urler)
    }
  }, [prosjektId])

  const hentSjekkpunkter = useCallback(async () => {
    const { data } = await supabase
      .from('dokument_sjekkpunkter')
      .select('id, prosjekt_id, dokument_type, status, ansvarlig, frist, notat, oppdatert')
      .eq('prosjekt_id', prosjektId)
    setSjekkpunkter(((data || []) as DokumentSjekkpunkt[]).sort((a, b) =>
      DOKUMENT_TYPER.indexOf(a.dokument_type as DokumentType) - DOKUMENT_TYPER.indexOf(b.dokument_type as DokumentType)
    ))
  }, [prosjektId])

  // Seed standardsett ved første åpning hvis prosjektet ikke har sjekkpunkter ennå.
  // Idempotent — backend hopper over typer som allerede finnes.
  const seedHvisTomt = useCallback(async () => {
    const { count } = await supabase
      .from('dokument_sjekkpunkter')
      .select('id', { count: 'exact', head: true })
      .eq('prosjekt_id', prosjektId)
    if (count === 0) {
      await fetch('/api/dokument-sjekkpunkt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed', prosjekt_id: prosjektId }),
      })
      await hentSjekkpunkter()
    }
  }, [prosjektId, hentSjekkpunkter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hentDokumenter()
    void hentSjekkpunkter()
    void seedHvisTomt()
  }, [hentDokumenter, hentSjekkpunkter, seedHvisTomt])

  async function lastOppFil(fil: File, typeForFil: DokumentType, tittelForFil: string): Promise<string | null> {
    if (!(DOKUMENT_TILLATTE_MIME as readonly string[]).includes(fil.type)) {
      return 'Filtype ikke støttet'
    }
    if (fil.size > DOKUMENT_MAKS_STORRELSE_BYTES) {
      return 'Filen er for stor (maks 25 MB)'
    }
    const form = new FormData()
    form.append('prosjekt_id', prosjektId)
    form.append('tittel', tittelForFil || fil.name.replace(/\.[^.]+$/, ''))
    form.append('type', typeForFil)
    form.append('fil', fil)
    const res = await fetch('/api/dokument/last-opp', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return data?.feil || 'Opplasting feilet'
    return null
  }

  async function lastOpp(filer: File[]) {
    const initial = filer.map(f => ({ filnavn: f.name, status: 'laster' as const }))
    setPending(initial)
    let suksess = 0
    for (let i = 0; i < filer.length; i++) {
      const tittel = filer.length === 1 && opplastingTittel ? opplastingTittel : filer[i].name.replace(/\.[^.]+$/, '')
      const feil = await lastOppFil(filer[i], opplastingType, tittel)
      if (feil) {
        setPending(p => p.map((x, idx) => idx === i ? { ...x, status: 'feilet' as const, feil } : x))
      } else {
        suksess++
      }
    }
    if (suksess > 0) {
      visToast(`${suksess} dokument${suksess !== 1 ? 'er' : ''} lastet opp`, 'suksess', 3000)
      setOpplastingTittel('')
    }
    setPending(p => p.filter(x => x.status === 'feilet'))
    await hentDokumenter()
    await hentSjekkpunkter()
  }

  async function slettDokument(id: string) {
    if (!confirm('Slett dokumentet? Filen og dataene fjernes permanent.')) return
    const res = await fetch('/api/dokument/slett', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      visToast('Dokument slettet', 'suksess', 2500)
      await hentDokumenter()
      await hentSjekkpunkter()
    } else {
      visToast('Kunne ikke slette', 'feil', 3500)
    }
  }

  async function oppdaterDokument(id: string, endringer: Partial<Dokument>) {
    setDokumenter(d => d.map(x => x.id === id ? { ...x, ...endringer } : x))
    const res = await fetch('/api/dokument/oppdater', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, endringer }),
    })
    if (!res.ok) {
      visToast('Kunne ikke lagre', 'feil', 3500)
      void hentDokumenter()
    }
  }

  async function oppdaterSjekkpunkt(id: string, endringer: Partial<DokumentSjekkpunkt>) {
    setSjekkpunkter(s => s.map(x => x.id === id ? { ...x, ...endringer } : x))
    const res = await fetch('/api/dokument-sjekkpunkt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'oppdater', id, endringer }),
    })
    if (!res.ok) void hentSjekkpunkter()
  }

  async function leggTilSjekkpunktAction() {
    if (!leggTilSjekkpunkt) return
    const res = await fetch('/api/dokument-sjekkpunkt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'legg-til', prosjekt_id: prosjektId, dokument_type: leggTilSjekkpunkt }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      visToast(data?.feil || 'Kunne ikke legge til', 'feil', 3000)
    } else {
      setLeggTilSjekkpunkt('')
      await hentSjekkpunkter()
    }
  }

  async function slettSjekkpunkt(id: string) {
    if (!confirm('Fjern sjekkpunktet fra listen?')) return
    const res = await fetch('/api/dokument-sjekkpunkt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'slett', id }),
    })
    if (res.ok) await hentSjekkpunkter()
  }

  const filtrerte = useMemo(() => {
    const sokLcase = sok.trim().toLowerCase()
    return dokumenter.filter(d => {
      if (filter !== 'alle' && d.type !== filter) return false
      if (sokLcase) {
        const matched = d.tittel.toLowerCase().includes(sokLcase)
          || (d.notat || '').toLowerCase().includes(sokLcase)
          || (d.filnavn || '').toLowerCase().includes(sokLcase)
          || d.tagger.some(t => t.toLowerCase().includes(sokLcase))
        if (!matched) return false
      }
      return true
    })
  }, [dokumenter, filter, sok])

  const sjekkpunktSammendrag = useMemo(() => {
    const ok = sjekkpunkter.filter(s => s.status === 'ok').length
    const totalt = sjekkpunkter.filter(s => s.status !== 'ikke_relevant').length
    return { ok, totalt }
  }, [sjekkpunkter])

  const ikkeIBruktSjekkpunkt = useMemo(() => {
    const brukt = new Set(sjekkpunkter.map(s => s.dokument_type))
    return DOKUMENT_TYPER.filter(t => !brukt.has(t))
  }, [sjekkpunkter])

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const filer = Array.from(e.dataTransfer.files)
    if (filer.length > 0) void lastOpp(filer)
  }

  return (
    <div>
      {/* SJEKKLISTE */}
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.015em' }}>📋 Dokumentsjekkliste</div>
          {sjekkpunktSammendrag.totalt > 0 && (
            <span style={{ background: '#e8f5ed', color: '#1a4d2b', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS.pill }}>
              {sjekkpunktSammendrag.ok}/{sjekkpunktSammendrag.totalt} på plass
            </span>
          )}
        </div>

        {sjekkpunkter.length === 0 && (
          <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', padding: 8 }}>
            Ingen sjekkpunkter ennå — laster standardsett basert på marked…
          </div>
        )}

        {sjekkpunkter.map(s => {
          const status = s.status as SjekkpunktStatus
          const farge = SJEKKPUNKT_STATUS_FARGE[status]
          return (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr auto 1fr 1fr 2fr auto', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${FARGER.flateLys}` }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: FARGER.mork }}>
                {DOKUMENT_ETIKETT[s.dokument_type as DokumentType] || s.dokument_type}
              </div>
              <select value={status}
                onChange={e => oppdaterSjekkpunkt(s.id, { status: e.target.value as SjekkpunktStatus })}
                style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, borderRadius: RADIUS.sm, border: 'none', background: farge.bg, color: farge.tekst, cursor: 'pointer' }}>
                {(['mangler', 'i_prosess', 'ok', 'ikke_relevant'] as SjekkpunktStatus[]).map(st => (
                  <option key={st} value={st}>{SJEKKPUNKT_STATUS_LBL[st]}</option>
                ))}
              </select>
              <input type="date" defaultValue={s.frist || ''} key={`f-${s.id}-${s.frist || ''}`}
                onBlur={e => oppdaterSjekkpunkt(s.id, { frist: e.target.value || null })}
                style={inputStilSmall} />
              <input placeholder="Ansvarlig" defaultValue={s.ansvarlig || ''} key={`a-${s.id}-${s.ansvarlig || ''}`}
                onBlur={e => oppdaterSjekkpunkt(s.id, { ansvarlig: e.target.value || null })}
                style={inputStilSmall} />
              <input placeholder="Notat" defaultValue={s.notat || ''} key={`n-${s.id}-${s.notat || ''}`}
                onBlur={e => oppdaterSjekkpunkt(s.id, { notat: e.target.value || null })}
                style={inputStilSmall} />
              <button onClick={() => slettSjekkpunkt(s.id)} title="Fjern fra sjekklisten"
                style={{ background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none', borderRadius: RADIUS.sm, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          )
        })}

        {/* Legg til sjekkpunkt */}
        {ikkeIBruktSjekkpunkt.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <select value={leggTilSjekkpunkt} onChange={e => setLeggTilSjekkpunkt(e.target.value as DokumentType | '')}
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff' }}>
              <option value="">+ Legg til sjekkpunkt…</option>
              {ikkeIBruktSjekkpunkt.map(t => <option key={t} value={t}>{DOKUMENT_ETIKETT[t]}</option>)}
            </select>
            <button onClick={leggTilSjekkpunktAction} disabled={!leggTilSjekkpunkt}
              style={{
                background: leggTilSjekkpunkt ? FARGER.mork : FARGER.tekstLys,
                color: FARGER.creamLys, border: 'none',
                padding: '8px 18px', borderRadius: RADIUS.pill,
                fontSize: 12, fontWeight: 600,
                cursor: leggTilSjekkpunkt ? 'pointer' : 'not-allowed',
                letterSpacing: '-0.005em',
                boxShadow: leggTilSjekkpunkt ? SHADOW.sm : 'none',
              }}>
              Legg til
            </button>
          </div>
        )}
      </div>

      {/* OPPLASTING */}
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.015em' }}>📁 Last opp dokument</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 12 }}>
          <select value={opplastingType} onChange={e => setOpplastingType(e.target.value as DokumentType)}
            style={{ padding: '8px 10px', fontSize: 13, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff' }}>
            {DOKUMENT_TYPER.map(t => <option key={t} value={t}>{DOKUMENT_ETIKETT[t]}</option>)}
          </select>
          <input value={opplastingTittel} onChange={e => setOpplastingTittel(e.target.value)}
            placeholder="Tittel (valgfritt — bruker filnavn hvis tomt)"
            style={{ padding: '8px 10px', fontSize: 13, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm }} />
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => filInputRef.current?.click()}
          style={{
            background: dragOver ? '#fff8e1' : FARGER.creamLys,
            border: `2px dashed ${dragOver ? FARGER.advarsel : FARGER.gullSvak}`,
            borderRadius: RADIUS.md, padding: 24, textAlign: 'center', cursor: 'pointer',
          }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>📎</div>
          <div style={{ fontSize: 13, color: FARGER.tekstMid }}>
            Dra-og-slipp eller klikk — PDF, JPG, PNG, WebP, DOC eller DOCX (maks 25 MB)
          </div>
          <input ref={filInputRef} type="file" multiple
            accept="application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={e => {
              const filer = Array.from(e.target.files || [])
              if (filer.length > 0) void lastOpp(filer)
              if (filInputRef.current) filInputRef.current.value = ''
            }}
            style={{ display: 'none' }} />
        </div>
        {pending.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {pending.map((p, i) => (
              <div key={i} style={{
                fontSize: 12, padding: '6px 10px', marginBottom: 4,
                background: p.status === 'feilet' ? FARGER.feilBg : FARGER.flateLys,
                color: p.status === 'feilet' ? '#7a0c1e' : FARGER.tekstMid,
                borderRadius: RADIUS.sm,
              }}>
                {p.status === 'feilet' ? '❌' : '⏳'} {p.filnavn}{p.feil ? ` — ${p.feil}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DOKUMENTLISTE */}
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, boxShadow: SHADOW.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🗂️ Dokumenter ({dokumenter.length})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="🔍 Søk i tittel/notat/tagger" value={sok} onChange={e => setSok(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, minWidth: 200 }} />
            <select value={filter} onChange={e => setFilter(e.target.value as 'alle' | DokumentType)}
              style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff' }}>
              <option value="alle">Alle typer</option>
              {DOKUMENT_TYPER.map(t => {
                const antall = dokumenter.filter(d => d.type === t).length
                return antall > 0 ? <option key={t} value={t}>{DOKUMENT_ETIKETT[t]} ({antall})</option> : null
              })}
            </select>
          </div>
        </div>

        {laster && <div style={{ textAlign: 'center', padding: 30, color: FARGER.tekstLys }}>⏳ Laster…</div>}
        {!laster && dokumenter.length === 0 && (
          <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 36, textAlign: 'center', color: FARGER.tekstMid, fontSize: 13.5 }}>
            Ingen dokumenter ennå. Last opp escritura, IBI, kjøpekontrakt osv. fra panelet over.
          </div>
        )}
        {!laster && dokumenter.length > 0 && filtrerte.length === 0 && (
          <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
            Ingen treff i søket / filteret.
          </div>
        )}

        {filtrerte.map(d => {
          const url = urler[d.id]
          const erUtvidet = utvidet === d.id
          const erBilde = d.mime_type?.startsWith('image/')
          const erPdf = d.mime_type === 'application/pdf'
          const utgaaer = d.gyldig_til && new Date(d.gyldig_til) < new Date()
          return (
            <div key={d.id} style={{
              background: FARGER.hvit, border: `1px solid ${utgaaer ? '#C8102E44' : FARGER.kantUltralys}`,
              borderRadius: RADIUS.lg, marginBottom: 10, overflow: 'hidden',
              boxShadow: SHADOW.xs,
            }}>
              <div onClick={() => setUtvidet(erUtvidet ? null : d.id)}
                style={{ display: 'flex', gap: 12, padding: 12, cursor: 'pointer', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 40, height: 40, background: FARGER.flateMid, borderRadius: RADIUS.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 18 }}>{erPdf ? '📄' : erBilde ? '🖼️' : '📎'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork }}>{d.tittel}</div>
                  <div style={{ fontSize: 11, color: FARGER.tekstLys, display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                    <span>{DOKUMENT_ETIKETT[d.type as DokumentType] || d.type}</span>
                    {d.utstedt_dato && <span>· Utstedt: {d.utstedt_dato}</span>}
                    {d.gyldig_til && <span style={{ color: utgaaer ? '#7a0c1e' : 'inherit' }}>· Gyldig til: {d.gyldig_til}{utgaaer && ' ⚠️'}</span>}
                    {d.tagger.length > 0 && <span>· #{d.tagger.join(' #')}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: FARGER.tekstLys }}>{erUtvidet ? '▲' : '▼'}</span>
              </div>

              {erUtvidet && (
                <div style={{ borderTop: `1px solid ${FARGER.kantLys}`, padding: 16, background: FARGER.creamLys }}>
                  <div style={{ display: 'grid', gridTemplateColumns: url ? '1fr 1fr' : '1fr', gap: 16 }}>
                    {url && (
                      <div>
                        {erBilde
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm }} />
                          : (
                            <div>
                              {erPdf
                                ? <iframe src={url} style={{ width: '100%', height: 400, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff' }} />
                                : <div style={{ padding: 30, textAlign: 'center', background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
                                    <div style={{ fontSize: 12, color: FARGER.tekstLys }}>{d.filnavn}</div>
                                  </div>}
                              <a href={url} target="_blank" rel="noreferrer" download={d.filnavn || undefined}
                                style={{ fontSize: 12, color: FARGER.gull, marginTop: 6, display: 'inline-block' }}>
                                ↓ Last ned / åpne
                              </a>
                            </div>
                          )}
                      </div>
                    )}

                    <div>
                      <FeltRad lbl="Tittel" defaultVerdi={d.tittel} onLagre={v => oppdaterDokument(d.id, { tittel: v })} />
                      <FeltSelect lbl="Type" verdi={d.type}
                        valg={DOKUMENT_TYPER.map(t => [t, DOKUMENT_ETIKETT[t]] as [string, string])}
                        onLagre={v => oppdaterDokument(d.id, { type: v })} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <FeltRad lbl="Utstedt dato" type="date" defaultVerdi={d.utstedt_dato || ''}
                          onLagre={v => oppdaterDokument(d.id, { utstedt_dato: v || null })} />
                        <FeltRad lbl="Gyldig til" type="date" defaultVerdi={d.gyldig_til || ''}
                          onLagre={v => oppdaterDokument(d.id, { gyldig_til: v || null })} />
                      </div>
                      <FeltRad lbl="Tagger (kommaseparert)" defaultVerdi={d.tagger.join(', ')}
                        onLagre={v => oppdaterDokument(d.id, { tagger: v.split(',').map(s => s.trim()).filter(Boolean) })} />
                      <div style={{ marginTop: 6 }}>
                        <label style={lblStil}>Notat</label>
                        <textarea defaultValue={d.notat || ''}
                          onBlur={e => oppdaterDokument(d.id, { notat: e.target.value || null })} rows={2}
                          style={{ width: '100%', padding: 8, fontSize: 13, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => slettDokument(d.id)}
                          style={{ background: FARGER.feilBg, color: FARGER.feil, border: 'none', padding: '8px 14px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          🗑️ Slett dokument
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const lblStil: React.CSSProperties = {
  fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}

const inputStilSmall: React.CSSProperties = {
  padding: '4px 8px', fontSize: 12, border: `1px solid ${FARGER.kantLys}`,
  borderRadius: RADIUS.sm, background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
}

const inputStilStor: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

function FeltRad({ lbl, type = 'text', defaultVerdi, onLagre }: {
  lbl: string; type?: string; defaultVerdi: string; onLagre: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={lblStil}>{lbl}</label>
      <input key={defaultVerdi} type={type} defaultValue={defaultVerdi}
        onBlur={e => { if (e.target.value !== defaultVerdi) onLagre(e.target.value) }}
        style={inputStilStor} />
    </div>
  )
}

function FeltSelect({ lbl, verdi, valg, onLagre }: {
  lbl: string; verdi: string; valg: Array<[string, string]>; onLagre: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={lblStil}>{lbl}</label>
      <select value={verdi} onChange={e => onLagre(e.target.value)} style={inputStilStor}>
        {valg.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  )
}
