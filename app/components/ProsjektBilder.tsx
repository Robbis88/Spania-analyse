'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { KATEGORIER, STILER, estimerAnalyseKostnadEUR, resizKlient, type Kategori, type StilId } from '../lib/bilder'
import { visToast } from '../lib/toast'
import type { Prosjektbilde } from '../types'

type LasteState = { filnavn: string; status: 'laster' | 'feilet'; feilmelding?: string }

type GenererStatus = 'idle' | 'starter' | 'jobber' | 'feilet'
type GenererJobb = { prediksjonId: string; status: GenererStatus; feil?: string; type: 'oppussing' | 'tillegg' | 'kombinert' }

export function ProsjektBilder({ prosjektId }: { prosjektId: string }) {
  const [bilder, setBilder] = useState<Prosjektbilde[]>([])
  const [genererte, setGenererte] = useState<Record<string, Prosjektbilde[]>>({})
  const [urler, setUrler] = useState<Record<string, string>>({})
  const [godkjentCount, setGodkjentCount] = useState<Record<string, number>>({})
  const [jobber, setJobber] = useState<Record<string, GenererJobb>>({})
  const [valgtStil, setValgtStil] = useState<Record<string, StilId>>({})
  const [egenPrompt, setEgenPrompt] = useState<Record<string, string>>({})
  const [laster, setLaster] = useState(true)
  const [apen, setApen] = useState(false)
  const [valgtKategori, setValgtKategori] = useState<Kategori>('Bad')
  const [notat, setNotat] = useState('')
  const [pending, setPending] = useState<LasteState[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const filInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [analyserer, setAnalyserer] = useState(false)
  const [analyseFeil, setAnalyseFeil] = useState('')
  const [analyseFremdrift, setAnalyseFremdrift] = useState<{ ferdig: number; total: number }>({ ferdig: 0, total: 0 })
  const pollRef = useRef<Record<string, number>>({})

  useEffect(() => () => {
    for (const id of Object.values(pollRef.current)) window.clearInterval(id)
  }, [])

  const hent = useCallback(async () => {
    const { data } = await supabase.from('prosjekt_bilder').select('*')
      .eq('prosjekt_id', prosjektId)
      .order('opprettet', { ascending: false })
    const alle = (data || []) as Prosjektbilde[]
    const originaler = alle.filter(b => b.type === 'original')
    const generertePerOriginal: Record<string, Prosjektbilde[]> = {}
    for (const b of alle) {
      if (b.type === 'generert' && b.original_bilde_id) {
        (generertePerOriginal[b.original_bilde_id] ||= []).push(b)
      }
    }
    setBilder(originaler)
    setGenererte(generertePerOriginal)

    const alleIds = alle.map(b => b.id)
    if (alleIds.length > 0) {
      const res = await fetch('/api/bilder/signert-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bilde_ids: alleIds }),
      })
      const data = await res.json()
      if (data?.urler) setUrler(data.urler)
    } else {
      setUrler({})
    }

    // Tell godtatte forslag per bilde (oppussing_poster + oppussing_tillegg med kilde_bilde_id)
    const originalIds = originaler.map(b => b.id)
    if (originalIds.length > 0) {
      const [{ data: poster }, { data: tillegg }] = await Promise.all([
        supabase.from('oppussing_poster').select('kilde_bilde_id').in('kilde_bilde_id', originalIds),
        supabase.from('oppussing_tillegg').select('kilde_bilde_id').in('kilde_bilde_id', originalIds),
      ])
      const tell: Record<string, number> = {}
      for (const r of [...(poster || []), ...(tillegg || [])]) {
        const k = (r as { kilde_bilde_id: string | null }).kilde_bilde_id
        if (k) tell[k] = (tell[k] || 0) + 1
      }
      setGodkjentCount(tell)
    }

    setLaster(false)
  }, [prosjektId])

  async function startGenerering(bildeId: string) {
    setJobber(j => ({ ...j, [bildeId]: { prediksjonId: '', status: 'starter', type: 'kombinert' } }))
    const bruker = hentAktivBruker() || 'ukjent'
    const stil = valgtStil[bildeId] || ''
    const egenTekst = (egenPrompt[bildeId] || '').trim()
    if (stil === 'egen' && !egenTekst) {
      setJobber(j => ({ ...j, [bildeId]: { prediksjonId: '', status: 'feilet', feil: 'Skriv inn en stil-beskrivelse', type: 'kombinert' } }))
      return
    }
    try {
      const res = await fetch('/api/bilder/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_bilde_id: bildeId, generert_av: bruker, stil, egen_prompt: egenTekst }),
      })
      const data = await res.json()
      if (!res.ok || data.feil) throw new Error(data.feil || `HTTP ${res.status}`)

      setJobber(j => ({ ...j, [bildeId]: { prediksjonId: data.prediction_id, status: 'jobber', type: data.visualisering_type } }))

      const params = new URLSearchParams({
        original_bilde_id: bildeId,
        visualisering_type: data.visualisering_type,
        generert_av: bruker,
        stil,
      })

      pollRef.current[bildeId] = window.setInterval(async () => {
        try {
          const p = await fetch(`/api/bilder/generer/${data.prediction_id}?${params}`)
          const pd = await p.json()
          if (pd.status === 'ferdig' && pd.bilde_id) {
            window.clearInterval(pollRef.current[bildeId])
            delete pollRef.current[bildeId]
            setJobber(j => { const n = { ...j }; delete n[bildeId]; return n })
            await hent()
          } else if (pd.status === 'failed' || pd.status === 'canceled' || pd.status === 'feilet') {
            window.clearInterval(pollRef.current[bildeId])
            delete pollRef.current[bildeId]
            setJobber(j => ({ ...j, [bildeId]: { ...j[bildeId], status: 'feilet', feil: pd.feil || `Generering ${pd.status}` } }))
          }
        } catch (e) {
          window.clearInterval(pollRef.current[bildeId])
          delete pollRef.current[bildeId]
          setJobber(j => ({ ...j, [bildeId]: { ...j[bildeId], status: 'feilet', feil: e instanceof Error ? e.message : 'Polling feilet' } }))
        }
      }, 3000) as unknown as number
    } catch (e) {
      setJobber(j => ({ ...j, [bildeId]: { prediksjonId: '', status: 'feilet', feil: e instanceof Error ? e.message : 'Ukjent feil', type: 'kombinert' } }))
    }
  }

  useEffect(() => {
    void hent()
  }, [hent])

  async function lastOpp(filer: File[]) {
    const bruker = hentAktivBruker() || 'ukjent'
    const initial = filer.map(f => ({ filnavn: f.name, status: 'laster' as const }))
    setPending(initial)

    for (let i = 0; i < filer.length; i++) {
      const f = filer[i]
      try {
        const resized = f.type.startsWith('image/') ? await resizKlient(f) : f
        const form = new FormData()
        form.append('prosjekt_id', prosjektId)
        form.append('kategori', valgtKategori)
        form.append('notat', notat)
        form.append('opplastet_av', bruker)
        form.append('fil', resized)
        const res = await fetch('/api/bilder/last-opp', { method: 'POST', body: form })
        const tekst = await res.text()
        let data: { suksess?: boolean; feil?: string } = {}
        try { data = JSON.parse(tekst) } catch { data = { feil: `HTTP ${res.status}: ${tekst.slice(0, 200)}` } }
        if (!data.suksess) {
          setPending(p => p.map((x, j) => j === i ? { ...x, status: 'feilet', feilmelding: data.feil || 'Ukjent feil' } : x))
        } else {
          setPending(p => p.filter((_, j) => j !== i).concat([]))
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : 'Ukjent feil'
        setPending(p => p.map((x, j) => j === i ? { ...x, status: 'feilet', feilmelding: m } : x))
      }
    }
    setNotat('')
    await hent()
    setTimeout(() => setPending(p => p.filter(x => x.status === 'feilet')), 500)
  }

  async function analyserBilder() {
    const uanalyserte = bilder.filter(b => !b.ai_analysert)
    if (uanalyserte.length === 0) return
    const kostnad = estimerAnalyseKostnadEUR(uanalyserte)
    const bekreft = confirm(
      `Analyser ${uanalyserte.length} ${uanalyserte.length === 1 ? 'bilde' : 'bilder'} med AI?\n\nEstimert kostnad: ~€${kostnad.toFixed(2)}\n\nAI foreslår oppussingsposter og vurderer potensial-tillegg. Forslagene vises deretter i Oppussingsbudsjett.`
    )
    if (!bekreft) return
    setAnalyserer(true); setAnalyseFeil('')
    setAnalyseFremdrift({ ferdig: 0, total: uanalyserte.length })

    const bruker = hentAktivBruker() || 'ukjent'
    let suksess = 0, feilet = 0
    let idx = 0
    async function worker() {
      while (idx < uanalyserte.length) {
        const i = idx++
        const b = uanalyserte[i]
        try {
          const res = await fetch('/api/bilder/analyser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bilde_ids: [b.id], analysert_av: bruker }),
          })
          const data = await res.json()
          if (data.suksess >= 1) suksess++
          else feilet++
        } catch { feilet++ }
        setAnalyseFremdrift({ ferdig: suksess + feilet, total: uanalyserte.length })
      }
    }
    await Promise.all([worker(), worker(), worker()])

    if (feilet > 0) setAnalyseFeil(`${feilet} av ${suksess + feilet} feilet. Sjekk Aktivitetslogg for detaljer.`)
    if (suksess > 0) visToast(`${suksess} ${suksess === 1 ? 'bilde' : 'bilder'} analysert — se forslag i Oppussing-fanen`)
    setAnalyseFremdrift({ ferdig: 0, total: 0 })
    setAnalyserer(false)
    await hent()
  }

  async function slettBilde(id: string) {
    if (!confirm('Slett bildet? Dette kan ikke angres.')) return
    const bruker = hentAktivBruker() || 'ukjent'
    await fetch('/api/bilder/slett', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bilde_id: id, slettet_av: bruker }),
    })
    await hent()
    visToast('Bilde slettet')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const filer = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (filer.length > 0) void lastOpp(filer)
  }

  function onFilerValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const filer = Array.from(e.target.files || [])
    if (filer.length > 0) void lastOpp(filer)
    e.target.value = ''
  }

  // Grupper per kategori
  const grupper = bilder.reduce<Record<string, Prosjektbilde[]>>((acc, b) => {
    const k = b.kategori || 'Annet'
    if (!acc[k]) acc[k] = []
    acc[k].push(b)
    return acc
  }, {})
  const kategoriRekkefolge = KATEGORIER.filter(k => grupper[k])

  return (
    <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <button onClick={() => setApen(!apen)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, fontSize: 14, fontWeight: 700, color: '#1a2a3e' }}>
        <span>📷 Prosjektbilder {bilder.length > 0 && <span style={{ color: '#888', fontWeight: 500 }}>({bilder.length})</span>}</span>
        <span style={{ color: '#888', fontSize: 12 }}>{apen ? '▲' : '▼'}</span>
      </button>

      {apen && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Kategori</div>
              <select value={valgtKategori} onChange={e => setValgtKategori(e.target.value as Kategori)}
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #ddd' }}>
                {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Notat (valgfritt)</div>
              <input value={notat} onChange={e => setNotat(e.target.value)}
                placeholder="F.eks. 'før oppussing' eller 'østre side'"
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #ddd' }} />
            </div>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => filInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#c9a876' : '#ddd'}`,
              background: dragOver ? '#faf7f0' : '#f8f8f8',
              borderRadius: 10, padding: 20, textAlign: 'center',
              cursor: 'pointer', marginBottom: 14,
            }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📥</div>
            <div style={{ fontSize: 13, color: '#555' }}>Dra filer hit – eller klikk for å velge</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>JPEG, PNG, WebP · maks 10 MB</div>
            <input ref={filInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
              onChange={onFilerValgt} style={{ display: 'none' }} />
          </div>

          {pending.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {pending.map((p, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, marginBottom: 4, background: p.status === 'feilet' ? '#fde8ec' : '#f0f7ff', color: p.status === 'feilet' ? '#7a0c1e' : '#185FA5' }}>
                  {p.status === 'laster' ? '⏳ ' : '❌ '}{p.filnavn}
                  {p.status === 'feilet' && p.feilmelding && <span style={{ marginLeft: 6 }}>– {p.feilmelding}</span>}
                </div>
              ))}
            </div>
          )}

          {bilder.length > 0 && (() => {
            const uanalyserte = bilder.filter(b => !b.ai_analysert)
            const analyserte = bilder.length - uanalyserte.length
            if (uanalyserte.length === 0) {
              return (
                <div style={{ fontSize: 12, color: '#2D7D46', background: '#e8f5ed', border: '1px solid #2D7D4644', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  ✨ Alle {analyserte} bildene er analysert. Forslagene finner du i Oppussing-fanen.
                </div>
              )
            }
            const kostnad = estimerAnalyseKostnadEUR(uanalyserte)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={analyserBilder} disabled={analyserer}
                  style={{ background: analyserer ? '#999' : '#185FA5', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: analyserer ? 'not-allowed' : 'pointer' }}>
                  {analyserer
                    ? (analyseFremdrift.total > 0
                      ? `⏳ Analyserer ${analyseFremdrift.ferdig + 1}/${analyseFremdrift.total}...`
                      : '⏳ Analyserer...')
                    : `🤖 Analyser ${uanalyserte.length} ${uanalyserte.length === 1 ? 'bilde' : 'bilder'} med AI`}
                </button>
                <span style={{ fontSize: 12, color: '#666' }}>~€{kostnad.toFixed(2)}{analyserte > 0 && ` · ${analyserte} allerede analysert`}</span>
              </div>
            )
          })()}

          {analyseFeil && (
            <div style={{ fontSize: 12, background: '#fde8ec', color: '#7a0c1e', padding: 10, borderRadius: 8, marginBottom: 12 }}>
              ⚠️ {analyseFeil}
            </div>
          )}

          {laster && <div style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: 12 }}>⏳ Laster bilder...</div>}

          {!laster && bilder.length === 0 && (
            <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center', padding: 12 }}>
              Ingen bilder lastet opp ennå.
            </div>
          )}

          {kategoriRekkefolge.map(kat => (
            <div key={kat} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, letterSpacing: '0.05em' }}>{kat.toUpperCase()} <span style={{ color: '#aaa', fontWeight: 400 }}>({grupper[kat].length})</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {grupper[kat].map(b => {
                  const url = urler[b.id]
                  const antall = godkjentCount[b.id] || 0
                  const jobb = jobber[b.id]
                  const barn = genererte[b.id] || []
                  return (
                    <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ position: 'relative', background: '#f0f0f0', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3' }}>
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={b.filnavn || ''} onClick={() => setLightbox(url)}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 24, color: '#aaa' }}>📷</div>
                        )}
                        <button onClick={() => slettBilde(b.id)}
                          title="Slett"
                          style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(200, 16, 46, 0.9)', color: 'white', border: 'none', borderRadius: 4, padding: '3px 7px', fontSize: 11, cursor: 'pointer' }}>
                          ✕
                        </button>
                        {b.ai_analysert && (
                          <div title={`AI-analysert ${new Date(b.ai_analysert).toLocaleDateString('nb-NO')} — se forslag i Oppussing-fanen`}
                            style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(24, 95, 165, 0.9)', color: 'white', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>
                            ✨
                          </div>
                        )}
                        {antall > 0 && (
                          <div title={`${antall} godtatte forslag for dette bildet — klikk "Generer før/etter" for visualisering`}
                            style={{ position: 'absolute', top: 4, left: 34, background: 'rgba(45, 125, 70, 0.95)', color: 'white', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>
                            ✓{antall}
                          </div>
                        )}
                        {b.tilleggsnotat && (
                          <div title={b.tilleggsnotat}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, padding: '3px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.tilleggsnotat}
                          </div>
                        )}
                      </div>

                      {b.ai_analysert && antall > 0 && (
                        <>
                          <select value={valgtStil[b.id] || ''}
                            onChange={e => setValgtStil(v => ({ ...v, [b.id]: e.target.value as StilId }))}
                            disabled={jobb?.status === 'starter' || jobb?.status === 'jobber'}
                            style={{ padding: '5px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #ddd', background: 'white' }}>
                            {STILER.map(s => <option key={s.id} value={s.id}>{s.navn}</option>)}
                          </select>
                          {valgtStil[b.id] === 'egen' && (
                            <textarea
                              value={egenPrompt[b.id] || ''}
                              onChange={e => setEgenPrompt(v => ({ ...v, [b.id]: e.target.value }))}
                              placeholder="F.eks. 'Ibiza-villa med kalkede vegger, bambusdetaljer og turkist vann' eller 'art deco-stil med messing og grønn marmor'"
                              rows={3}
                              style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'inherit', resize: 'vertical' }}
                            />
                          )}
                          <button onClick={() => startGenerering(b.id)}
                            disabled={jobb?.status === 'starter' || jobb?.status === 'jobber'}
                            style={{
                              background: jobb?.status === 'jobber' || jobb?.status === 'starter' ? '#999' : '#6a4c93',
                              color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600,
                              cursor: jobb?.status === 'jobber' || jobb?.status === 'starter' ? 'wait' : 'pointer',
                            }}>
                            {jobb?.status === 'starter' && '⏳ Starter...'}
                            {jobb?.status === 'jobber' && '🎨 Genererer (10–30 s)...'}
                            {(!jobb || jobb.status === 'feilet') && `✨ Generer før/etter (${antall} forslag, ~€0.08)`}
                          </button>
                        </>
                      )}

                      {jobb?.status === 'feilet' && (
                        <div style={{ fontSize: 10, color: '#C8102E', background: '#fde8ec', borderRadius: 4, padding: '4px 6px' }}>
                          ⚠️ {jobb.feil}
                        </div>
                      )}

                      {barn.length > 0 && (
                        <div style={{ borderLeft: '3px solid #6a4c93', paddingLeft: 6 }}>
                          <div style={{ fontSize: 9, color: '#6a4c93', fontWeight: 700, marginBottom: 3, letterSpacing: '0.05em' }}>
                            ✨ GENERERT ({barn.length})
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 4 }}>
                            {barn.map(g => {
                              const gUrl = urler[g.id]
                              const stilDef = g.stil ? STILER.find(s => s.id === g.stil) : null
                              return (
                                <div key={g.id} style={{ position: 'relative', background: '#f0f0f0', borderRadius: 6, overflow: 'hidden', aspectRatio: '4/3' }}>
                                  {gUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={gUrl} alt="" onClick={() => setLightbox(gUrl)}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }} />
                                  ) : <div style={{ fontSize: 18, textAlign: 'center', padding: 10 }}>✨</div>}
                                  <button onClick={() => slettBilde(g.id)}
                                    title="Slett"
                                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(200, 16, 46, 0.9)', color: 'white', border: 'none', borderRadius: 3, padding: '1px 5px', fontSize: 9, cursor: 'pointer' }}>
                                    ✕
                                  </button>
                                  {stilDef && (
                                    <div title={stilDef.navn}
                                      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(106, 76, 147, 0.9)', color: 'white', fontSize: 9, padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {stilDef.navn}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
