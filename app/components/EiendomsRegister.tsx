'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle, selectStyle } from '../lib/styles'
import { EIERETAPPE_ETIKETT } from '../lib/portefolje'
import { STRATEGI_ETIKETT, type Strategi } from '../lib/strategi'
import { tomtProsjekt, type Prosjekt } from '../types'
import { EiendomDetalj } from './portefolje/EiendomDetalj'

type Rad = Pick<Prosjekt, 'id' | 'navn' | 'marked' | 'selskap_id' | 'eieretappe' | 'strategi'>
type Selskap = { id: string; navn: string; land: 'norge' | 'spania' }

export function EiendomsRegister() {
  const [rader, setRader] = useState<Rad[]>([])
  const [selskaper, setSelskaper] = useState<Selskap[]>([])
  const [valgt, setValgt] = useState<string | null>(null)
  const [laster, setLaster] = useState(true)
  const [land, setLand] = useState<'alle' | 'norge' | 'spania'>('alle')
  const [strategi, setStrategi] = useState<'alle' | Strategi>('alle')
  const [visNy, setVisNy] = useState(false)

  const hent = useCallback(async () => {
    setLaster(true)
    const [{ data: p }, s] = await Promise.all([
      supabase.from('prosjekter').select('id, navn, marked, selskap_id, eieretappe, strategi').eq('er_portefolje', true).order('opprettet', { ascending: false }),
      fetch('/api/selskaper').then(r => r.json()).catch(() => ({ selskaper: [] })),
    ])
    setRader((p || []) as Rad[])
    setSelskaper(s.selskaper || [])
    setLaster(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hent() }, [hent])

  const filtrert = useMemo(() => rader.filter(r =>
    (land === 'alle' || (r.marked || 'spania') === land) &&
    (strategi === 'alle' || (r.strategi || 'uavklart') === strategi)
  ), [rader, land, strategi])

  if (valgt) {
    return <EiendomDetalj prosjektId={valgt} onTilbake={() => { setValgt(null); void hent() }} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: FARGER.mork, margin: 0, letterSpacing: '-0.02em' }}>Eiendommer</h1>
        <button onClick={() => setVisNy(v => !v)} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {visNy ? 'Lukk' : '+ Legg til eiendom'}
        </button>
      </div>

      {visNy && <NyEiendom selskaper={selskaper} onLagret={() => { setVisNy(false); void hent() }} />}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <Filter lbl="Land" verdi={land} sett={v => setLand(v as typeof land)} valg={[['alle', 'Alle'], ['norge', '🇳🇴 Norge'], ['spania', '🇪🇸 Spania']]} />
        <Filter lbl="Strategi" verdi={strategi} sett={v => setStrategi(v as typeof strategi)} valg={[['alle', 'Alle'], ['flipp', STRATEGI_ETIKETT.flipp], ['langtid', STRATEGI_ETIKETT.langtid], ['korttid', STRATEGI_ETIKETT.korttid], ['uavklart', STRATEGI_ETIKETT.uavklart]]} />
      </div>

      {laster ? (
        <div style={{ padding: 30, color: FARGER.tekstLys }}>Laster eiendommer…</div>
      ) : filtrert.length === 0 ? (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys, fontSize: 13 }}>
          Ingen eiendommer{rader.length > 0 ? ' med dette filteret' : ' ennå — legg til den første over'}.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtrert.map(r => (
            <button key={r.id} onClick={() => setValgt(r.id)}
              style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: SHADOW.xs }}>
              <span style={{ fontSize: 18 }}>{(r.marked || 'spania') === 'norge' ? '🇳🇴' : '🇪🇸'}</span>
              <span style={{ flex: 1, minWidth: 160, fontSize: 15, fontWeight: 600, color: FARGER.mork }}>{r.navn}</span>
              <Badge tekst={EIERETAPPE_ETIKETT[r.eieretappe || 'eid'] || 'Eid'} />
              <Badge tekst={STRATEGI_ETIKETT[(r.strategi || 'uavklart') as Strategi]} gull />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Badge({ tekst, gull }: { tekst: string; gull?: boolean }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: RADIUS.pill, background: gull ? FARGER.gullSvak : FARGER.flateMid, color: gull ? '#7a5c2e' : FARGER.tekstMid }}>{tekst}</span>
}

function Filter({ lbl, verdi, sett, valg }: { lbl: string; verdi: string; sett: (v: string) => void; valg: Array<[string, string]> }) {
  return (
    <div>
      <label style={labelStyle}>{lbl}</label>
      <select value={verdi} onChange={e => sett(e.target.value)} style={{ ...selectStyle, minWidth: 150 }}>
        {valg.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function NyEiendom({ selskaper, onLagret }: { selskaper: Selskap[]; onLagret: () => void }) {
  const [navn, setNavn] = useState('')
  const [selskapId, setSelskapId] = useState(selskaper[0]?.id || '')
  const [kjopesum, setKjopesum] = useState('')
  const [lagrer, setLagrer] = useState(false)

  async function lagre() {
    const selskap = selskaper.find(s => s.id === selskapId)
    if (!navn.trim() || !selskap) return
    setLagrer(true)
    const id = Date.now().toString()
    const bruker = hentAktivBruker() || 'ukjent'
    const nytt: Prosjekt = {
      ...tomtProsjekt(),
      id, bruker, navn: navn.trim(),
      selskap_id: selskap.id,
      marked: selskap.land,
      kjøpesum: Number(kjopesum) || 0,
      er_portefolje: true,
      eieretappe: 'eid',
      strategi: 'uavklart',
    }
    const { error } = await supabase.from('prosjekter').insert([nytt])
    setLagrer(false)
    if (error) { alert('Kunne ikke lagre: ' + error.message); return }
    await loggAktivitet({ handling: 'la til eiendom i register', tabell: 'prosjekter', rad_id: id, prosjekt_id: id, hendelsestype: 'kjopt', detaljer: { navn: nytt.navn } })
    setNavn(''); setKjopesum('')
    onLagret()
  }

  return (
    <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 18, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
      <div><label style={labelStyle}>Navn / adresse</label><input value={navn} onChange={e => setNavn(e.target.value)} style={inputStyle} placeholder="Søndre Skogvei 12" /></div>
      <div><label style={labelStyle}>Selskap</label>
        <select value={selskapId} onChange={e => setSelskapId(e.target.value)} style={selectStyle}>
          {selskaper.length === 0 && <option value="">Kjør B1-migrasjon først</option>}
          {selskaper.map(s => <option key={s.id} value={s.id}>{s.navn}</option>)}
        </select>
      </div>
      <div><label style={labelStyle}>Kjøpesum</label><input type="number" value={kjopesum} onChange={e => setKjopesum(e.target.value)} style={inputStyle} /></div>
      <button onClick={lagre} disabled={lagrer || !navn.trim() || !selskapId} style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (lagrer || !navn.trim() || !selskapId) ? 0.6 : 1 }}>
        {lagrer ? 'Lagrer…' : 'Legg til'}
      </button>
    </div>
  )
}
