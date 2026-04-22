'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { KATEGORIER, estimerAnalyseKostnadEUR, type Kategori } from '../lib/bilder'
import type { Prosjektbilde } from '../types'

type LasteState = { filnavn: string; status: 'laster' | 'feilet'; feilmelding?: string }

export function ProsjektBilder({ prosjektId }: { prosjektId: string }) {
  const [bilder, setBilder] = useState<Prosjektbilde[]>([])
  const [urler, setUrler] = useState<Record<string, string>>({})
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

  const hent = useCallback(async () => {
    const { data } = await supabase.from('prosjekt_bilder').select('*')
      .eq('prosjekt_id', prosjektId)
      .eq('type', 'original')
      .order('opprettet', { ascending: false })
    const liste = (data || []) as Prosjektbilde[]
    setBilder(liste)
    if (liste.length > 0) {
      const res = await fetch('/api/bilder/signert-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bilde_ids: liste.map(b => b.id) }),
      })
      const data = await res.json()
      if (data?.urler) setUrler(data.urler)
    } else {
      setUrler({})
    }
    setLaster(false)
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  async function lastOpp(filer: File[]) {
    const bruker = hentAktivBruker() || 'ukjent'
    const initial = filer.map(f => ({ filnavn: f.name, status: 'laster' as const }))
    setPending(initial)

    for (let i = 0; i < filer.length; i++) {
      const f = filer[i]
      try {
        const form = new FormData()
        form.append('prosjekt_id', prosjektId)
        form.append('kategori', valgtKategori)
        form.append('notat', notat)
        form.append('opplastet_av', bruker)
        form.append('fil', f)
        const res = await fetch('/api/bilder/last-opp', { method: 'POST', body: form })
        const data = await res.json()
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
    try {
      const bruker = hentAktivBruker() || 'ukjent'
      const res = await fetch('/api/bilder/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bilde_ids: uanalyserte.map(b => b.id), analysert_av: bruker }),
      })
      const data = await res.json()
      if (data.feilet > 0) {
        setAnalyseFeil(`${data.feilet} av ${data.feilet + data.suksess} feilet. Sjekk Aktivitetslogg for detaljer.`)
      }
      await hent()
    } catch (e) {
      setAnalyseFeil(e instanceof Error ? e.message : 'Ukjent feil')
    }
    setAnalyserer(false)
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
                  {analyserer ? '⏳ Analyserer...' : `🤖 Analyser ${uanalyserte.length} ${uanalyserte.length === 1 ? 'bilde' : 'bilder'} med AI`}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {grupper[kat].map(b => {
                  const url = urler[b.id]
                  return (
                    <div key={b.id} style={{ position: 'relative', background: '#f0f0f0', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3' }}>
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
                        <div title={`Analysert ${new Date(b.ai_analysert).toLocaleDateString('nb-NO')}`}
                          style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(24, 95, 165, 0.9)', color: 'white', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>
                          ✨
                        </div>
                      )}
                      {b.tilleggsnotat && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 10, padding: '3px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.tilleggsnotat}
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
