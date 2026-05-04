'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { hentAktivBruker } from '../../lib/aktivBruker'
import { visToast } from '../../lib/toast'
import { FARGER, RADIUS } from '../../lib/styles'
import {
  bruttoYield, cashflowMnd, gjeldendeLeieMnd, sisteVerdi, sumKostnaderPerMnd,
  totalLaanKostnadMnd, totalRestgjeld,
} from '../../lib/portefolje'
import type {
  Prosjekt, EiendomLaan, EiendomInntekt, EiendomKostnad, EiendomVerdivurdering,
} from '../../types'
import { EiendomKort, type EiendomKortData } from './EiendomKort'
import { EiendomDetalj } from './EiendomDetalj'
import { PortefoljeDashboard } from './PortefoljeDashboard'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

type Props = { onTilbake: () => void }

export function Portefolje({ onTilbake }: Props) {
  const [eiendommer, setEiendommer] = useState<EiendomKortData[]>([])
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [valgt, setValgt] = useState<string | null>(null)
  const [visNyDialog, setVisNyDialog] = useState(false)
  const [nyttNavn, setNyttNavn] = useState('')
  const [nyAdresse, setNyAdresse] = useState('')
  const [oppretter, setOppretter] = useState(false)

  const hent = useCallback(async () => {
    setLaster(true); setFeil(null)
    // 1) Hent alle norske portefølje-prosjekter
    const { data: prosjekter, error } = await supabase
      .from('prosjekter')
      .select('*')
      .eq('marked', 'norge')
      .eq('er_portefolje', true)
      .order('opprettet', { ascending: false })
    if (error) { setFeil(error.message); setLaster(false); return }
    const liste = (prosjekter || []) as Prosjekt[]
    if (liste.length === 0) { setEiendommer([]); setLaster(false); return }

    const ids = liste.map(p => p.id)

    // 2) Hent støttetabeller i parallell (én batch-query per tabell)
    const [
      { data: laan },
      { data: inntekter },
      { data: kostnader },
      { data: vurderinger },
    ] = await Promise.all([
      supabase.from('eiendom_laan').select('*').in('prosjekt_id', ids),
      supabase.from('eiendom_inntekter').select('*').in('prosjekt_id', ids),
      supabase.from('eiendom_kostnader').select('*').in('prosjekt_id', ids),
      supabase.from('eiendom_verdivurderinger').select('*').in('prosjekt_id', ids),
    ])

    const laanMap = grupperPaaProsjekt((laan || []) as EiendomLaan[])
    const inntekterMap = grupperPaaProsjekt((inntekter || []) as EiendomInntekt[])
    const kostnaderMap = grupperPaaProsjekt((kostnader || []) as EiendomKostnad[])
    const vurderingerMap = grupperPaaProsjekt((vurderinger || []) as EiendomVerdivurdering[])

    // 3) Bygg EiendomKortData per eiendom
    const data: EiendomKortData[] = liste.map(p => {
      const pLaan = laanMap[p.id] || []
      const pInnt = inntekterMap[p.id] || []
      const pKost = kostnaderMap[p.id] || []
      const pVurd = vurderingerMap[p.id] || []
      const verdi = sisteVerdi(pVurd) || (typeof p.forventet_salgsverdi === 'number' ? p.forventet_salgsverdi : 0)
      const restgjeld = totalRestgjeld(pLaan)
      const leieMnd = gjeldendeLeieMnd(pInnt) || (p.leieinntekt_mnd || 0)
      const kostnaderM = sumKostnaderPerMnd(pKost)
      const laanM = totalLaanKostnadMnd(pLaan)

      // Verdiøkning basert på vurderingshistorikk (krever min. 2 vurderinger)
      let verdiokningKr: number | null = null
      let verdiokningPct: number | null = null
      if (pVurd.length >= 2) {
        const sortert = [...pVurd].sort((a, b) => (a.dato || '').localeCompare(b.dato || ''))
        const eldst = sortert[0]
        const nyest = sortert[sortert.length - 1]
        verdiokningKr = nyest.verdi - eldst.verdi
        verdiokningPct = eldst.verdi > 0 ? (verdiokningKr / eldst.verdi) * 100 : 0
      }

      return {
        ...p,
        total_verdi: verdi,
        total_restgjeld: restgjeld,
        leie_mnd: leieMnd,
        kostnader_mnd: kostnaderM,
        laan_mnd: laanM,
        cashflow_mnd: cashflowMnd({ leieMnd, kostnaderMnd: kostnaderM, laanMnd: laanM }),
        verdiokning_kr: verdiokningKr,
        verdiokning_pct: verdiokningPct,
        yield_pct: bruttoYield(leieMnd, verdi),
      }
    })
    setEiendommer(data)
    setLaster(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  async function opprettNy() {
    if (!nyttNavn.trim() || oppretter) return
    setOppretter(true)
    const bruker = hentAktivBruker() || 'ukjent'
    const id = nyId()
    const ny: Partial<Prosjekt> = {
      id,
      bruker,
      navn: nyttNavn.trim(),
      status: 'Eid',
      kategori: 'utleie',
      dato_kjopt: new Date().toISOString().slice(0, 10),
      kjøpesum: 0,
      kjøpskostnader: 0,
      oppussingsbudsjett: 0,
      oppussing_faktisk: 0,
      møblering: 0,
      forventet_salgsverdi: 0,
      leieinntekt_mnd: 0,
      lån_mnd: 0,
      fellesutgifter_mnd: 0,
      strøm_mnd: 0,
      forsikring_mnd: 0,
      forvaltning_mnd: 0,
      notater: '',
      måneder: [],
      bolig_data: nyAdresse.trim() ? { beliggenhet: nyAdresse.trim() } : null,
    }
    const { error } = await supabase.from('prosjekter').insert([{
      ...ny,
      marked: 'norge',
      er_portefolje: true,
      eieretappe: 'eid',
    }])
    setOppretter(false)
    if (error) {
      visToast('Opprettelse feilet: ' + error.message, 'feil', 4000)
      return
    }
    setVisNyDialog(false); setNyttNavn(''); setNyAdresse('')
    visToast('Eiendom opprettet', 'suksess', 2500)
    setValgt(id)
    await hent()
  }

  if (valgt) {
    return (
      <EiendomDetalj
        prosjektId={valgt}
        onTilbake={() => { setValgt(null); void hent() }}
      />
    )
  }

  return (
    <div>
      <button onClick={onTilbake}
        style={{ background: FARGER.flateLys, border: 'none', borderRadius: RADIUS.sm, padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginBottom: 20, color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        ← Tilbake
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 10 }}>NORGE — EIDE EIENDOMMER</div>
          <h2 style={{ fontSize: 28, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.01em' }}>Min portefølje</h2>
          <p style={{ color: FARGER.tekstMid, margin: '6px 0 0', fontSize: 14, fontWeight: 300 }}>
            Verdi, lån, leie og cashflow per eiendom — for boliger du allerede eier
          </p>
        </div>
        <button onClick={() => setVisNyDialog(true)}
          style={{ background: FARGER.mork, color: 'white', border: 'none', padding: '10px 20px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          + Ny eiendom
        </button>
      </div>

      {visNyDialog && (
        <div onClick={() => !oppretter && setVisNyDialog(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: RADIUS.lg, maxWidth: 460, width: '100%', padding: 28 }}>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 6 }}>NY EIENDOM</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: FARGER.mork }}>Legg til i portefølje</h2>
            <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '8px 0 16px' }}>
              Du kan fylle inn detaljer (kjøpspris, lån, leie, dokumenter osv.) på detaljsiden etterpå.
            </p>
            <label style={lblStil}>Navn / kort beskrivelse</label>
            <input value={nyttNavn} onChange={e => setNyttNavn(e.target.value)}
              placeholder="f.eks. Storgata 15, 2. etg"
              autoFocus
              style={inputStil} />
            <label style={{ ...lblStil, marginTop: 12 }}>Adresse / område (valgfri)</label>
            <input value={nyAdresse} onChange={e => setNyAdresse(e.target.value)}
              placeholder="f.eks. Bergenhus, Bergen"
              style={inputStil} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={opprettNy} disabled={!nyttNavn.trim() || oppretter}
                style={{ flex: 1, background: nyttNavn.trim() && !oppretter ? FARGER.mork : FARGER.tekstLys, color: '#fff', border: 'none', padding: 12, borderRadius: RADIUS.sm, fontSize: 13, fontWeight: 600, cursor: nyttNavn.trim() && !oppretter ? 'pointer' : 'not-allowed' }}>
                {oppretter ? '⏳ Oppretter…' : 'Opprett eiendom'}
              </button>
              <button onClick={() => setVisNyDialog(false)} disabled={oppretter}
                style={{ background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none', padding: '12px 18px', borderRadius: RADIUS.sm, fontSize: 13, fontWeight: 600, cursor: oppretter ? 'not-allowed' : 'pointer' }}>
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {laster && <div style={{ textAlign: 'center', padding: 60, color: FARGER.tekstLys }}>⏳ Henter portefølje…</div>}
      {feil && <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}`, padding: 14, borderRadius: RADIUS.md, color: '#7a0c1e', fontSize: 13 }}>{feil}</div>}

      {!laster && !feil && eiendommer.length === 0 && (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork }}>Ingen eiendommer i porteføljen ennå</div>
          <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 4 }}>
            Trykk «+ Ny eiendom» — eller marker et eksisterende norsk flippeprosjekt som «kjøpt» fra Norske boliger-fanen.
          </div>
        </div>
      )}

      {!laster && eiendommer.length > 0 && (
        <>
          <PortefoljeDashboard eiendommer={eiendommer} onApne={id => setValgt(id)} />
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 12 }}>
            EIENDOMMER
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {eiendommer.map(e => (
              <EiendomKort key={e.id} e={e} onApne={() => setValgt(e.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function grupperPaaProsjekt<T extends { prosjekt_id: string }>(rader: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  for (const r of rader) (map[r.prosjekt_id] ||= []).push(r)
  return map
}

const lblStil: React.CSSProperties = {
  fontSize: 10, color: FARGER.tekstMid, marginBottom: 6, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
