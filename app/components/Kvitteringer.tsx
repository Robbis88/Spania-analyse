'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resizKlient } from '../lib/bilder'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import {
  KVITTERING_KATEGORIER, KVITTERING_KATEGORI_ETIKETT,
  KVITTERING_ROM, KVITTERING_ROM_ETIKETT,
  KVITTERING_TILLATTE_MIME, KVITTERING_MAKS_STORRELSE_BYTES,
  type KvitteringKategori, type KvitteringRom,
} from '../lib/kvittering'
import type { Kvittering, OppussingPost } from '../types'

type Props = { prosjektId: string; valuta?: 'NOK' | 'EUR' }

const fmtBelop = (n: number | null, valuta: string | null): string => {
  if (n === null || !Number.isFinite(n)) return '–'
  const tegn = valuta === 'EUR' ? '€' : valuta === 'NOK' ? 'kr ' : ''
  return `${tegn}${Math.round(n).toLocaleString('nb-NO')}`
}

export function Kvitteringer({ prosjektId, valuta: defaultValuta = 'EUR' }: Props) {
  const [rader, setRader] = useState<Kvittering[]>([])
  const [poster, setPoster] = useState<OppussingPost[]>([])
  const [urler, setUrler] = useState<Record<string, string>>({})
  const [laster, setLaster] = useState(true)
  const [filterKategori, setFilterKategori] = useState<'alle' | KvitteringKategori>('alle')
  const [pending, setPending] = useState<Array<{ filnavn: string; status: 'laster' | 'feilet'; feil?: string }>>([])
  const [analyserer, setAnalyserer] = useState<Record<string, boolean>>({})
  const [utvidet, setUtvidet] = useState<string | null>(null)
  const filInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const hentRader = useCallback(async () => {
    setLaster(true)
    const { data } = await supabase
      .from('kvitteringer')
      .select('id, prosjekt_id, bruker, opprettet, storage_sti, filnavn, mime_type, ocr_status, ocr_kjort, ocr_radata, ocr_feilmelding, dato, belop_eks_mva, mva, belop_inkl_mva, valuta, leverandor, leverandor_orgnr, dokument_nr, kategori, rom, oppussing_post_id, tagger, notat')
      .eq('prosjekt_id', prosjektId)
      .order('dato', { ascending: false, nullsFirst: false })
      .order('opprettet', { ascending: false })
    const liste = (data || []) as Kvittering[]
    setRader(liste)
    setLaster(false)

    if (liste.length > 0) {
      const res = await fetch('/api/kvittering/signert-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: liste.map(r => r.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.urler) setUrler(data.urler)
    }
  }, [prosjektId])

  // Hent oppussingsposter slik at brukeren kan koble en kvittering til en post
  const hentPoster = useCallback(async () => {
    const { data: budsjett } = await supabase
      .from('oppussing_budsjett').select('id').eq('bolig_id', prosjektId).maybeSingle()
    if (!budsjett) { setPoster([]); return }
    const { data } = await supabase
      .from('oppussing_poster')
      .select('id, budsjett_id, navn, kostnad, notat, rekkefolge, status, faktisk_kostnad')
      .eq('budsjett_id', budsjett.id)
      .order('rekkefolge')
    setPoster((data || []) as OppussingPost[])
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hentRader()
    void hentPoster()
  }, [hentRader, hentPoster])

  async function lastOppFil(fil: File): Promise<string | null> {
    let endelig = fil
    if (fil.type.startsWith('image/')) {
      try { endelig = await resizKlient(fil, 2048, 0.85) } catch { /* fall back til original */ }
    }
    if (!(KVITTERING_TILLATTE_MIME as readonly string[]).includes(endelig.type)) {
      return 'Filtype ikke støttet (JPEG, PNG, WebP eller PDF)'
    }
    if (endelig.size > KVITTERING_MAKS_STORRELSE_BYTES) {
      return 'Filen er for stor (maks 15 MB)'
    }
    const form = new FormData()
    form.append('prosjekt_id', prosjektId)
    form.append('fil', endelig)
    const res = await fetch('/api/kvittering/last-opp', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.kvittering_id) return data?.feil || 'Opplasting feilet'

    // Trigger OCR i bakgrunnen — feiler stille (kvittering kan reanalyseres senere)
    void fetch('/api/kvittering/analyser', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kvittering_id: data.kvittering_id }),
    }).then(() => hentRader()).catch(() => { /* ignorer */ })

    return null
  }

  async function lastOpp(filer: File[]) {
    const initial = filer.map(f => ({ filnavn: f.name, status: 'laster' as const }))
    setPending(initial)
    let suksess = 0
    for (let i = 0; i < filer.length; i++) {
      const feil = await lastOppFil(filer[i])
      if (feil) {
        setPending(p => p.map((x, idx) => idx === i ? { ...x, status: 'feilet' as const, feil } : x))
      } else {
        suksess++
      }
    }
    if (suksess > 0) visToast(`${suksess} kvittering${suksess !== 1 ? 'er' : ''} lastet opp — OCR kjører`, 'suksess', 4000)
    // Fjern alle 'laster'-rader (suksess); behold 'feilet' så bruker ser hva som gikk galt
    setPending(p => p.filter(x => x.status === 'feilet'))
    await hentRader()
  }

  async function reanalyser(id: string) {
    setAnalyserer(a => ({ ...a, [id]: true }))
    try {
      const res = await fetch('/api/kvittering/analyser', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kvittering_id: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) visToast(data?.feil || 'OCR feilet', 'feil', 4000)
      else visToast('OCR ferdig', 'suksess', 2500)
      await hentRader()
    } finally {
      setAnalyserer(a => { const ny = { ...a }; delete ny[id]; return ny })
    }
  }

  async function slettKvittering(id: string) {
    if (!confirm('Slett kvitteringen? Filen og dataene fjernes permanent.')) return
    const res = await fetch('/api/kvittering/slett', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      visToast('Kvittering slettet', 'suksess', 2500)
      await hentRader()
    } else {
      visToast('Kunne ikke slette', 'feil', 3500)
    }
  }

  async function oppdaterFelt(id: string, endringer: Partial<Kvittering>) {
    // Optimistisk oppdatering
    setRader(r => r.map(x => x.id === id ? { ...x, ...endringer } : x))
    const res = await fetch('/api/kvittering/oppdater', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, endringer }),
    })
    if (!res.ok) {
      visToast('Kunne ikke lagre', 'feil', 3500)
      void hentRader()  // synk fra server
    }
  }

  const filtrerte = useMemo(
    () => filterKategori === 'alle' ? rader : rader.filter(r => r.kategori === filterKategori),
    [rader, filterKategori],
  )

  const sumPerValuta = useMemo(() => {
    const sum: Record<string, number> = {}
    for (const r of filtrerte) {
      if (r.belop_inkl_mva && r.valuta) {
        sum[r.valuta] = (sum[r.valuta] || 0) + r.belop_inkl_mva
      }
    }
    return sum
  }, [filtrerte])

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const filer = Array.from(e.dataTransfer.files)
    if (filer.length > 0) void lastOpp(filer)
  }

  return (
    <div>
      {/* Opplastings-sone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => filInputRef.current?.click()}
        style={{
          background: dragOver ? '#fff8e1' : FARGER.hvit,
          border: `1.5px dashed ${dragOver ? FARGER.advarsel : FARGER.gull + '66'}`,
          borderRadius: RADIUS.lg, padding: 30, marginBottom: 16,
          textAlign: 'center', cursor: 'pointer',
          boxShadow: SHADOW.xs,
          transition: `background ${MOTION.rask}, border-color ${MOTION.rask}`,
        }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: FARGER.mork, marginBottom: 6, letterSpacing: '-0.005em' }}>
          Dra-og-slipp kvitteringer eller fakturaer her
        </div>
        <div style={{ fontSize: 12, color: FARGER.tekstLys }}>
          PDF, JPG, PNG eller WebP — opp til 15 MB. OCR leser dato, beløp, leverandør og kategori automatisk.
        </div>
        <input
          ref={filInputRef} type="file" multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e => {
            const filer = Array.from(e.target.files || [])
            if (filer.length > 0) void lastOpp(filer)
            if (filInputRef.current) filInputRef.current.value = ''
          }}
          style={{ display: 'none' }}
        />
      </div>

      {pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
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

      {/* Filter + sum-stripe */}
      {rader.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={filterKategori} onChange={e => setFilterKategori(e.target.value as 'alle' | KvitteringKategori)}
            style={{ padding: '6px 10px', borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kantLys}`, fontSize: 13 }}>
            <option value="alle">Alle kategorier ({rader.length})</option>
            {KVITTERING_KATEGORIER.map(k => {
              const antall = rader.filter(r => r.kategori === k).length
              return antall > 0 ? <option key={k} value={k}>{KVITTERING_KATEGORI_ETIKETT[k]} ({antall})</option> : null
            })}
          </select>
          {Object.entries(sumPerValuta).map(([v, sum]) => (
            <span key={v} style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>
              Sum: {fmtBelop(sum, v)}
            </span>
          ))}
        </div>
      )}

      {laster && <div style={{ textAlign: 'center', padding: 30, color: FARGER.tekstLys }}>⏳ Laster…</div>}
      {!laster && rader.length === 0 && (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 36, textAlign: 'center', color: FARGER.tekstMid, fontSize: 13.5 }}>
          Ingen kvitteringer ennå. Last opp fra mobil eller skanner — OCR fyller inn feltene automatisk.
        </div>
      )}

      {filtrerte.map(r => {
        const url = urler[r.id]
        const erBilde = r.mime_type?.startsWith('image/')
        const erUtvidet = utvidet === r.id
        const ocr = r.ocr_status === 'analysert' ? '✓ Lest' : r.ocr_status === 'venter' ? '⏳ Venter på OCR' : '❌ OCR feilet'
        const ocrFarge = r.ocr_status === 'analysert' ? FARGER.suksess : r.ocr_status === 'venter' ? FARGER.tekstLys : FARGER.feil
        return (
          <div key={r.id} style={{
            background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.lg, marginBottom: 10, overflow: 'hidden',
            boxShadow: SHADOW.xs,
          }}>
            <div onClick={() => setUtvidet(erUtvidet ? null : r.id)}
              style={{ display: 'flex', gap: 12, padding: 12, cursor: 'pointer', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: 50, height: 50, background: FARGER.flateMid, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {erBilde && url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 22 }}>📄</span>}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork }}>
                  {r.leverandor || r.filnavn || 'Uten navn'}
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {r.dato && <span>{r.dato}</span>}
                  {r.kategori && <span>· {KVITTERING_KATEGORI_ETIKETT[r.kategori as KvitteringKategori] || r.kategori}</span>}
                  {r.rom && <span>· {KVITTERING_ROM_ETIKETT[r.rom as KvitteringRom] || r.rom}</span>}
                  <span style={{ color: ocrFarge, fontWeight: 600 }}>· {ocr}</span>
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: FARGER.mork, textAlign: 'right' }}>
                {fmtBelop(r.belop_inkl_mva, r.valuta)}
              </div>
              <span style={{ fontSize: 11, color: FARGER.tekstLys }}>{erUtvidet ? '▲' : '▼'}</span>
            </div>

            {erUtvidet && (
              <div style={{ borderTop: `1px solid ${FARGER.kantLys}`, padding: 16, background: FARGER.creamLys }}>
                <div style={{ display: 'grid', gridTemplateColumns: erBilde && url ? '1fr 1fr' : '1fr', gap: 16 }}>
                  {/* Filvisning */}
                  {url && (
                    <div>
                      {erBilde
                        /* eslint-disable-next-line @next/next/no-img-element */
                        ? <img src={url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm }} />
                        : (
                          <div>
                            <iframe src={url} style={{ width: '100%', height: 400, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff' }} />
                            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: FARGER.gull, marginTop: 6, display: 'inline-block' }}>↗ Åpne i ny fane</a>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Felt-redigering */}
                  <div>
                    <FeltRad lbl="Dato" type="date" verdi={r.dato || ''} onLagre={v => oppdaterFelt(r.id, { dato: v || null })} />
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                      <FeltRad lbl="Beløp inkl. mva" type="number" verdi={r.belop_inkl_mva ?? ''} onLagre={v => oppdaterFelt(r.id, { belop_inkl_mva: v === '' ? null : Number(v) })} />
                      <FeltSelect lbl="Valuta" verdi={r.valuta || ''} valg={[['', '–'], ['NOK', 'NOK'], ['EUR', 'EUR']]} onLagre={v => oppdaterFelt(r.id, { valuta: v ? (v as 'NOK' | 'EUR') : null })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <FeltRad lbl="MVA" type="number" verdi={r.mva ?? ''} onLagre={v => oppdaterFelt(r.id, { mva: v === '' ? null : Number(v) })} />
                      <FeltRad lbl="Beløp eks. mva" type="number" verdi={r.belop_eks_mva ?? ''} onLagre={v => oppdaterFelt(r.id, { belop_eks_mva: v === '' ? null : Number(v) })} />
                    </div>
                    <FeltRad lbl="Leverandør" verdi={r.leverandor || ''} onLagre={v => oppdaterFelt(r.id, { leverandor: v || null })} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <FeltRad lbl="Org.nr / CIF" verdi={r.leverandor_orgnr || ''} onLagre={v => oppdaterFelt(r.id, { leverandor_orgnr: v || null })} />
                      <FeltRad lbl="Dok.nr" verdi={r.dokument_nr || ''} onLagre={v => oppdaterFelt(r.id, { dokument_nr: v || null })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <FeltSelect lbl="Kategori" verdi={r.kategori || ''}
                        valg={[['', 'Velg…'], ...KVITTERING_KATEGORIER.map(k => [k, KVITTERING_KATEGORI_ETIKETT[k]] as [string, string])]}
                        onLagre={v => oppdaterFelt(r.id, { kategori: v || null })} />
                      <FeltSelect lbl="Rom" verdi={r.rom || ''}
                        valg={[['', 'Velg…'], ...KVITTERING_ROM.map(k => [k, KVITTERING_ROM_ETIKETT[k]] as [string, string])]}
                        onLagre={v => oppdaterFelt(r.id, { rom: v || null })} />
                    </div>
                    {poster.length > 0 && (
                      <FeltSelect lbl="Knytt til oppussingspost" verdi={r.oppussing_post_id || ''}
                        valg={[['', '— Ingen —'], ...poster.map(p => [p.id, p.navn] as [string, string])]}
                        onLagre={v => oppdaterFelt(r.id, { oppussing_post_id: v || null })} />
                    )}
                    <div style={{ marginTop: 6 }}>
                      <label style={lblStil}>Notat</label>
                      <textarea defaultValue={r.notat || ''}
                        onBlur={e => oppdaterFelt(r.id, { notat: e.target.value || null })}
                        rows={2}
                        style={{ width: '100%', padding: 8, fontSize: 13, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />
                    </div>

                    {r.ocr_feilmelding && (
                      <div style={{ marginTop: 8, fontSize: 11, color: FARGER.feil, background: FARGER.feilBg, padding: 8, borderRadius: RADIUS.sm }}>
                        OCR-feil: {r.ocr_feilmelding}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => reanalyser(r.id)} disabled={!!analyserer[r.id]}
                        style={{ background: analyserer[r.id] ? FARGER.tekstLys : FARGER.flateMid, color: FARGER.mork, border: 'none', padding: '8px 14px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: analyserer[r.id] ? 'wait' : 'pointer' }}>
                        {analyserer[r.id] ? '⏳ Leser…' : '🔄 Kjør OCR på nytt'}
                      </button>
                      <button onClick={() => slettKvittering(r.id)}
                        style={{ background: FARGER.feilBg, color: FARGER.feil, border: 'none', padding: '8px 14px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        🗑️ Slett
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
  )
  void defaultValuta
}

const lblStil: React.CSSProperties = {
  fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

function FeltRad({ lbl, type = 'text', verdi, onLagre }: {
  lbl: string; type?: string; verdi: string | number; onLagre: (v: string) => void
}) {
  // Bruker key på input slik at React resetter når verdi (fra parent) endres,
  // i stedet for å speile via useEffect.
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={lblStil}>{lbl}</label>
      <input
        key={String(verdi)}
        type={type} defaultValue={String(verdi)}
        onBlur={e => { if (e.target.value !== String(verdi)) onLagre(e.target.value) }}
        style={inputStil} />
    </div>
  )
}

function FeltSelect({ lbl, verdi, valg, onLagre }: {
  lbl: string; verdi: string; valg: Array<[string, string]>; onLagre: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={lblStil}>{lbl}</label>
      <select value={verdi} onChange={e => onLagre(e.target.value)} style={inputStil}>
        {valg.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  )
}
