'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { visToast } from '../lib/toast'
import type { Prosjekt, Prosjektbilde } from '../types'

type BildeRad = Prosjektbilde & { url?: string | null }

const inputStil: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1.5px solid #ddd',
  fontFamily: 'sans-serif', boxSizing: 'border-box', background: 'white',
}
const lblStil: React.CSSProperties = { display: 'block', fontSize: 11, color: '#777', marginBottom: 4, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }

export function UtleiePortalAdmin({ prosjekt, onOppdatert }: { prosjekt: Prosjekt; onOppdatert: () => void }) {
  const [redigert, setRedigert] = useState<Prosjekt>(prosjekt)
  const [bilder, setBilder] = useState<BildeRad[]>([])
  const [lasterBilder, setLasterBilder] = useState(true)
  const [lagrer, setLagrer] = useState(false)
  const [fasilitetInput, setFasilitetInput] = useState('')

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setRedigert(prosjekt) }, [prosjekt])

  const hentBilder = useCallback(async () => {
    setLasterBilder(true)
    const { data } = await supabase.from('prosjekt_bilder').select('*')
      .eq('prosjekt_id', prosjekt.id)
      .eq('type', 'original')
      .order('opprettet', { ascending: false })
    const rader = (data || []) as Prosjektbilde[]

    if (rader.length > 0) {
      const res = await fetch('/api/bilder/signert-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bilde_ids: rader.map(r => r.id) }),
      })
      const sd = await res.json()
      const urler: Record<string, string> = sd?.urler || {}
      setBilder(rader.map(r => ({ ...r, url: urler[r.id] || null })))
    } else {
      setBilder([])
    }
    setLasterBilder(false)
  }, [prosjekt.id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hentBilder() }, [hentBilder])

  async function lagre() {
    setLagrer(true)
    const oppdatering = {
      publisert_utleie: !!redigert.publisert_utleie,
      utleie_pris_natt: redigert.utleie_pris_natt ?? null,
      utleie_pris_uke: redigert.utleie_pris_uke ?? null,
      utleie_min_netter: redigert.utleie_min_netter ?? null,
      utleie_maks_gjester: redigert.utleie_maks_gjester ?? null,
      utleie_beskrivelse: redigert.utleie_beskrivelse ?? null,
      utleie_kort_beskrivelse: redigert.utleie_kort_beskrivelse ?? null,
      utleie_fasiliteter: redigert.utleie_fasiliteter ?? null,
    }
    const { error } = await supabase.from('prosjekter').update(oppdatering).eq('id', prosjekt.id)
    setLagrer(false)
    if (error) {
      visToast('Lagring feilet: ' + error.message, 'feil', 4000)
    } else {
      visToast('Utleie-portal oppdatert', 'suksess')
      onOppdatert()
    }
  }

  async function toggleMarketing(bildeId: string, naerverdi: boolean) {
    const ny = !naerverdi
    setBilder(b => b.map(x => x.id === bildeId ? { ...x, er_marketing: ny } : x))
    const { error } = await supabase.from('prosjekt_bilder').update({ er_marketing: ny }).eq('id', bildeId)
    if (error) {
      visToast('Klarte ikke oppdatere bilde: ' + error.message, 'feil')
      void hentBilder()
    }
  }

  async function settRekkefolge(bildeId: string, rekkefolge: number | null) {
    setBilder(b => b.map(x => x.id === bildeId ? { ...x, marketing_rekkefolge: rekkefolge } : x))
    const { error } = await supabase.from('prosjekt_bilder').update({ marketing_rekkefolge: rekkefolge }).eq('id', bildeId)
    if (error) visToast('Rekkefølge feilet: ' + error.message, 'feil')
  }

  function leggTilFasilitet() {
    const v = fasilitetInput.trim()
    if (!v) return
    const liste = [...(redigert.utleie_fasiliteter || []), v]
    setRedigert({ ...redigert, utleie_fasiliteter: liste })
    setFasilitetInput('')
  }

  function fjernFasilitet(i: number) {
    const liste = (redigert.utleie_fasiliteter || []).filter((_, idx) => idx !== i)
    setRedigert({ ...redigert, utleie_fasiliteter: liste })
  }

  const markedsBilder = bilder.filter(b => b.er_marketing)
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/bolig/${prosjekt.id}` : ''

  return (
    <div>
      <div style={{ background: redigert.publisert_utleie ? '#e8f5ed' : '#fff8e1', border: `2px solid ${redigert.publisert_utleie ? '#2D7D46' : '#B05E0A'}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: redigert.publisert_utleie ? '#1a4d2b' : '#6b3a0a', marginBottom: 4 }}>
              {redigert.publisert_utleie ? '🟢 Boligen er publisert i utleie-portalen' : '🟡 Boligen er IKKE publisert ennå'}
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {redigert.publisert_utleie
                ? <>Synlig på offentlig forside og <a href={portalUrl} target="_blank" rel="noreferrer" style={{ color: '#185FA5' }}>direktelink</a>.</>
                : 'Hak av nedenfor og lagre for å publisere.'}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!redigert.publisert_utleie}
              onChange={e => setRedigert({ ...redigert, publisert_utleie: e.target.checked })}
              style={{ width: 20, height: 20, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Publiser i utleie-portal</span>
          </label>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pris og kapasitet</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div><label style={lblStil}>Pris per natt (€)</label>
            <input type="number" min={0} style={inputStil} value={redigert.utleie_pris_natt ?? ''}
              onChange={e => setRedigert({ ...redigert, utleie_pris_natt: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div><label style={lblStil}>Pris per uke (€)</label>
            <input type="number" min={0} style={inputStil} value={redigert.utleie_pris_uke ?? ''}
              onChange={e => setRedigert({ ...redigert, utleie_pris_uke: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div><label style={lblStil}>Min. antall netter</label>
            <input type="number" min={1} style={inputStil} value={redigert.utleie_min_netter ?? ''}
              onChange={e => setRedigert({ ...redigert, utleie_min_netter: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div><label style={lblStil}>Maks gjester</label>
            <input type="number" min={1} style={inputStil} value={redigert.utleie_maks_gjester ?? ''}
              onChange={e => setRedigert({ ...redigert, utleie_maks_gjester: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lblStil}>Kort beskrivelse (vises på listekort)</label>
          <input style={inputStil} maxLength={140} value={redigert.utleie_kort_beskrivelse ?? ''}
            onChange={e => setRedigert({ ...redigert, utleie_kort_beskrivelse: e.target.value })}
            placeholder="F.eks. Solrik villa med privat basseng, 300 m fra strand" />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Maks 140 tegn — {(redigert.utleie_kort_beskrivelse || '').length}/140</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lblStil}>Full beskrivelse (vises på detaljsiden)</label>
          <textarea style={{ ...inputStil, minHeight: 140, resize: 'vertical' }} value={redigert.utleie_beskrivelse ?? ''}
            onChange={e => setRedigert({ ...redigert, utleie_beskrivelse: e.target.value })}
            placeholder="Beskriv boligen, beliggenhet, hva som gjør den spesiell..." />
        </div>

        <div>
          <label style={lblStil}>Fasiliteter</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input style={{ ...inputStil, flex: 1 }} value={fasilitetInput}
              onChange={e => setFasilitetInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); leggTilFasilitet() } }}
              placeholder="F.eks. Klimaanlegg, Wifi, Oppvaskmaskin" />
            <button onClick={leggTilFasilitet}
              style={{ background: '#185FA5', color: 'white', border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Legg til
            </button>
          </div>
          {(redigert.utleie_fasiliteter || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(redigert.utleie_fasiliteter || []).map((f, i) => (
                <span key={i} style={{ background: '#f0f0f0', borderRadius: 16, padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {f}
                  <button onClick={() => fjernFasilitet(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Marketing-bilder ({markedsBilder.length} valgt)</div>
          <div style={{ fontSize: 11, color: '#888' }}>Lavere rekkefølge vises først</div>
        </div>
        {lasterBilder && <div style={{ color: '#888', fontSize: 13, padding: 20, textAlign: 'center' }}>⏳ Henter bilder...</div>}
        {!lasterBilder && bilder.length === 0 && (
          <div style={{ color: '#888', fontSize: 13, padding: 20, textAlign: 'center', fontStyle: 'italic' }}>
            Ingen bilder lastet opp ennå. Gå til «Oversikt»-fanen for å legge til bilder.
          </div>
        )}
        {!lasterBilder && bilder.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {bilder.map(b => (
              <div key={b.id} style={{ border: b.er_marketing ? '2px solid #2D7D46' : '1.5px solid #eee', borderRadius: 8, padding: 8, background: b.er_marketing ? '#f6fbf7' : 'white' }}>
                <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 6, overflow: 'hidden', background: '#f0f0f0', marginBottom: 8 }}>
                  {b.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!b.er_marketing}
                    onChange={() => toggleMarketing(b.id, !!b.er_marketing)} />
                  <span>Vis i utleie-portal</span>
                </label>
                {b.er_marketing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#666' }}>Sortering:</span>
                    <input type="number" value={b.marketing_rekkefolge ?? ''}
                      onChange={e => settRekkefolge(b.id, e.target.value ? Number(e.target.value) : null)}
                      style={{ width: 50, padding: '3px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #ddd' }} />
                  </div>
                )}
                {b.kategori && <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>{b.kategori}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={lagre} disabled={lagrer}
          style={{ flex: 1, background: lagrer ? '#999' : '#2D7D46', color: 'white', border: 'none', padding: 14, borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: lagrer ? 'not-allowed' : 'pointer' }}>
          {lagrer ? '⏳ Lagrer...' : '💾 Lagre publiseringsinnstillinger'}
        </button>
      </div>
    </div>
  )
}
