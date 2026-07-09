'use client'
import { useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, inputStyle, labelStyle, selectStyle } from '../lib/styles'
import { medDefaults, erNorge, gevinstSatsPst } from '../lib/skatteprofil'
import { SALGSKOST_PST } from '../lib/beslutning'
import { STRATEGI_ETIKETT, type Strategi } from '../lib/strategi'
import { tomtProsjekt, type Prosjekt, type Skatteprofil, type EiendomLaan } from '../types'

type Selskap = { id: string; navn: string; land: 'norge' | 'spania'; skatteprofil?: Partial<Skatteprofil> | null }

const n = (s: string) => { const v = Number(s); return Number.isFinite(v) ? v : 0 }
const fmt = (v: number) => Math.round(v).toLocaleString('nb-NO') + ' kr'

type KontraktFelt = {
  adresse: string | null; kjopesum: number | null; omkostninger: number | null; dokumentavgift: number | null
  fellesgjeld: number | null; eierform: string | null; kjopsdato: string | null; selger: string | null; byggear: number | null
}
type LaanFelt = {
  bank: string | null; laanetype: string | null; hovedstol: number | null; restgjeld: number | null
  rente_pst: number | null; rentetype: string | null; nedbetalingstid_aar: number | null
  termin_belop: number | null; avdragsfritt: boolean; termin_frekvens: string | null; startdato: string | null
}

const STRATEGIER: Strategi[] = ['flipp', 'langtid', 'korttid']

export function NyEiendomVeiviser({ selskaper, onLagret, onAvbryt }: {
  selskaper: Selskap[]
  onLagret: (id?: string) => void
  onAvbryt: () => void
}) {
  const [steg, setSteg] = useState(1)
  const [lagrer, setLagrer] = useState(false)
  const [jobber, setJobber] = useState<'kontrakt' | 'laan' | null>(null)

  // Grunndata
  const [navn, setNavn] = useState('')
  const [selskapId, setSelskapId] = useState(selskaper[0]?.id || '')
  const [kjopesum, setKjopesum] = useState('')
  const [kjopskost, setKjopskost] = useState('')
  const [rortKost, setRortKost] = useState(false)
  const [oppussing, setOppussing] = useState('')
  const [adresse, setAdresse] = useState('')
  const [eierform, setEierform] = useState('')
  const [fellesgjeld, setFellesgjeld] = useState('')

  // Lån (fra lånepapir eller manuelt)
  const [laan, setLaan] = useState<LaanFelt | null>(null)

  // Strategi + plan
  const [strategi, setStrategi] = useState<Strategi>('flipp')
  const [arv, setArv] = useState('')
  const [varighet, setVarighet] = useState('')
  const [forventetLeie, setForventetLeie] = useState('')

  const kontraktInput = useRef<HTMLInputElement>(null)
  const laanInput = useRef<HTMLInputElement>(null)

  const valgtSelskap = selskaper.find(s => s.id === selskapId)
  const prof = valgtSelskap ? medDefaults(valgtSelskap.land, valgtSelskap.skatteprofil) : null
  const dokPst = prof && erNorge(prof) ? prof.dokumentavgift_pst : 0
  const dokForslag = dokPst > 0 && n(kjopesum) > 0 ? Math.round((n(kjopesum) * dokPst) / 100) : 0
  const visKost = rortKost ? kjopskost : (dokForslag ? String(dokForslag) : '')

  // EK-innskudd = alt lånet ikke dekker (Roberts regel).
  const lanBelop = laan?.hovedstol || 0
  const totalKjop = n(kjopesum) + n(visKost) + n(oppussing)
  const ekInnskudd = Math.max(0, totalKjop - lanBelop)

  // Grove motoranslag (full analyse på Beslutning-fanen etter opprettelse)
  const anslag = useMemo(() => {
    const gevinstPst = prof ? gevinstSatsPst(prof) : 22
    const laanMnd = laan?.termin_belop && laan.termin_frekvens === 'mnd' ? laan.termin_belop
      : laan?.hovedstol && laan.rente_pst ? (laan.hovedstol * (laan.rente_pst / 100)) / 12 : 0
    const holdekost = laanMnd * n(varighet)
    // Flipp
    const salgskost = n(arv) * (SALGSKOST_PST / 100)
    const gevinst = Math.max(0, n(arv) - totalKjop - salgskost)
    const gevinstEtterSkatt = gevinst * (1 - gevinstPst / 100)
    const nettoFrigjort = n(arv) - lanBelop - salgskost - gevinst * (gevinstPst / 100) - holdekost
    // Leie
    const cashflowMnd = n(forventetLeie) - laanMnd
    return { gevinstEtterSkatt, nettoFrigjort, holdekost, cashflowMnd, laanMnd, gevinstPst }
  }, [prof, laan, arv, varighet, forventetLeie, totalKjop, lanBelop])

  async function lastKontrakt(fil: File) {
    setJobber('kontrakt')
    try {
      const fd = new FormData(); fd.append('fil', fil)
      const r = await fetch('/api/kjopekontrakt/analyser', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok || !d.suksess) { visToast(d.feil || 'Kunne ikke lese kontrakten', 'feil', 4000); return }
      const f = d.felt as KontraktFelt
      if (f.adresse) { setAdresse(f.adresse); if (!navn.trim()) setNavn(f.adresse) }
      if (f.kjopesum != null) setKjopesum(String(f.kjopesum))
      if (f.omkostninger != null) { setKjopskost(String(f.omkostninger)); setRortKost(true) }
      else if (f.dokumentavgift != null) { setKjopskost(String(f.dokumentavgift)); setRortKost(true) }
      if (f.eierform) setEierform(f.eierform)
      if (f.fellesgjeld != null) setFellesgjeld(String(f.fellesgjeld))
      visToast('Kjøpekontrakt lest — sjekk feltene', 'suksess', 2500)
    } catch { visToast('Kunne ikke lese kontrakten', 'feil', 4000) } finally {
      setJobber(null); if (kontraktInput.current) kontraktInput.current.value = ''
    }
  }

  async function lastLaan(fil: File) {
    setJobber('laan')
    try {
      const fd = new FormData(); fd.append('fil', fil)
      const r = await fetch('/api/laan/analyser', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok || !d.suksess) { visToast(d.feil || 'Kunne ikke lese lånedokumentet', 'feil', 4000); return }
      setLaan(d.felt as LaanFelt)
      visToast('Lånevilkår lest', 'suksess', 2500)
    } catch { visToast('Kunne ikke lese lånedokumentet', 'feil', 4000) } finally {
      setJobber(null); if (laanInput.current) laanInput.current.value = ''
    }
  }

  async function opprett() {
    const selskap = selskaper.find(s => s.id === selskapId)
    if (!navn.trim() || !selskap) return
    setLagrer(true)
    const id = Date.now().toString()
    const bruker = hentAktivBruker() || 'ukjent'
    const nytt: Prosjekt = {
      ...tomtProsjekt(),
      id, bruker, navn: navn.trim(),
      selskap_id: selskap.id, marked: selskap.land,
      kjøpesum: n(kjopesum), kjøpskostnader: n(visKost), oppussingsbudsjett: n(oppussing),
      forventet_salgsverdi: n(arv),
      oppussing_varighet_mnd: n(varighet) || null,
      forventet_leie_mnd: n(forventetLeie) || null,
      adresse: adresse || null,
      eierform: eierform || null,
      fellesgjeld_nok: n(fellesgjeld) || null,
      strategi,
      er_portefolje: true, eieretappe: 'eid',
    }
    const { error } = await supabase.from('prosjekter').insert([nytt])
    if (error) { setLagrer(false); alert('Kunne ikke lagre: ' + error.message); return }

    // Lån → egen rad i eiendom_laan hvis vi har et lånebeløp.
    if (laan && (laan.hovedstol || 0) > 0) {
      const laanRad: Partial<EiendomLaan> = {
        id: id + '-laan', prosjekt_id: id, bruker, opprettet: new Date().toISOString(),
        bank: laan.bank, laanetype: (laan.laanetype as EiendomLaan['laanetype']) || 'annuitet',
        hovedstol: laan.hovedstol, restgjeld: laan.restgjeld ?? laan.hovedstol,
        rente_pst: laan.rente_pst, rentetype: (laan.rentetype as EiendomLaan['rentetype']) || 'flytende',
        termin_belop: laan.termin_belop, avdragsfritt: !!laan.avdragsfritt,
        termin_frekvens: (laan.termin_frekvens as EiendomLaan['termin_frekvens']) || 'mnd',
        nedbetalingstid_aar: laan.nedbetalingstid_aar, startdato: laan.startdato,
        notat: 'Fra veiviser (lånepapir)',
      }
      await supabase.from('eiendom_laan').insert([laanRad])
    }

    await loggAktivitet({ handling: 'la til eiendom via veiviser', tabell: 'prosjekter', rad_id: id, prosjekt_id: id, hendelsestype: 'kjopt', detaljer: { navn: nytt.navn } })
    setLagrer(false)
    onLagret(id)
  }

  const kanNeste = steg === 2 ? (navn.trim() !== '' && selskapId !== '' && n(kjopesum) > 0) : true

  return (
    <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 20, boxShadow: SHADOW.sm }}>
      {/* Stegindikator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['Dokumenter', 'Grunndata', 'Strategi', 'Oppsummering'].map((t, i) => {
          const nr = i + 1, aktiv = nr === steg, ferdig = nr < steg
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: RADIUS.pill, background: aktiv ? FARGER.mork : ferdig ? FARGER.suksess : FARGER.flateMid, color: aktiv || ferdig ? FARGER.creamLys : FARGER.tekstLys, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ferdig ? '✓' : nr}</span>
              <span style={{ fontSize: 12.5, fontWeight: aktiv ? 700 : 500, color: aktiv ? FARGER.mork : FARGER.tekstLys }}>{t}</span>
              {nr < 4 && <span style={{ width: 18, height: 1, background: FARGER.kantLys }} />}
            </div>
          )
        })}
      </div>

      {/* STEG 1 — Dokumenter */}
      {steg === 1 && (
        <div>
          <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 16px', lineHeight: 1.6, maxWidth: 560 }}>
            Last opp kjøpekontrakt og/eller lånepapir, så fyller AI-en ut det den finner. Du bekrefter alt i neste steg. Du kan også hoppe over og taste manuelt.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <OpplastKort ikon="📄" tittel="Kjøpekontrakt" undertekst={adresse ? `✓ ${adresse}` : 'kjøpesum, omkostninger, adresse'}
              jobber={jobber === 'kontrakt'} onClick={() => kontraktInput.current?.click()} ferdig={!!adresse || n(kjopesum) > 0} />
            <OpplastKort ikon="🏦" tittel="Lånepapir" undertekst={laan ? `✓ ${laan.bank || 'lån'} · ${laan.hovedstol ? fmt(laan.hovedstol) : ''}` : 'lånebeløp, rente, løpetid'}
              jobber={jobber === 'laan'} onClick={() => laanInput.current?.click()} ferdig={!!laan} />
          </div>
          <input ref={kontraktInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) void lastKontrakt(f) }} style={{ display: 'none' }} />
          <input ref={laanInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { const f = e.target.files?.[0]; if (f) void lastLaan(f) }} style={{ display: 'none' }} />
        </div>
      )}

      {/* STEG 2 — Grunndata */}
      {steg === 2 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Felt lbl="Navn / adresse"><input value={navn} onChange={e => setNavn(e.target.value)} style={inputStyle} placeholder="Søndre Skogvei 12" /></Felt>
            <Felt lbl="Selskap">
              <select value={selskapId} onChange={e => setSelskapId(e.target.value)} style={selectStyle}>
                {selskaper.length === 0 && <option value="">Kjør B1-migrasjon først</option>}
                {selskaper.map(s => <option key={s.id} value={s.id}>{s.navn}</option>)}
              </select>
            </Felt>
            <Felt lbl="Kjøpesum"><input type="number" value={kjopesum} onChange={e => setKjopesum(e.target.value)} style={inputStyle} /></Felt>
            <Felt lbl="Kjøpskostnader" hint={!rortKost && dokForslag > 0 ? `Dokumentavgift ${String(dokPst).replace('.', ',')} % (auto)` : dokPst > 0 ? 'inkl. dokumentavgift' : 'omkostninger'}>
              <input type="number" value={visKost} onChange={e => { setRortKost(true); setKjopskost(e.target.value) }} style={inputStyle} />
            </Felt>
            <Felt lbl="Oppussingsbudsjett"><input type="number" value={oppussing} onChange={e => setOppussing(e.target.value)} style={inputStyle} /></Felt>
            <Felt lbl="Eierform">
              <select value={eierform} onChange={e => setEierform(e.target.value)} style={selectStyle}>
                <option value="">—</option><option value="selveier">Selveier</option><option value="andel">Andel</option><option value="aksje">Aksje</option><option value="annet">Annet</option>
              </select>
            </Felt>
          </div>

          {/* EK-innskudd — alt lånet ikke dekker */}
          <div style={{ background: FARGER.mork, color: FARGER.creamLys, borderRadius: RADIUS.md, padding: '14px 18px', marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10.5, color: FARGER.gull, letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase' }}>Egenkapital-innskudd</div>
              <div style={{ fontSize: 12, color: 'rgba(253,252,247,0.6)', marginTop: 3 }}>kjøpesum + omkostninger + oppussing − lån ({lanBelop > 0 ? fmt(lanBelop) : 'ikke lastet'})</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: FARGER.creamLys }}>{fmt(ekInnskudd)}</div>
          </div>
        </div>
      )}

      {/* STEG 3 — Strategi */}
      {steg === 3 && (
        <div>
          <div style={{ fontSize: 12.5, color: FARGER.tekstMid, marginBottom: 12 }}>Hva er planen for denne eiendommen?</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            {STRATEGIER.map(s => (
              <button key={s} onClick={() => setStrategi(s)}
                style={{ background: strategi === s ? FARGER.mork : FARGER.hvit, color: strategi === s ? FARGER.creamLys : FARGER.mork, border: `1.5px solid ${strategi === s ? FARGER.mork : FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {STRATEGI_ETIKETT[s]}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <Felt lbl="Oppussing varighet (mnd)"><input type="number" value={varighet} onChange={e => setVarighet(e.target.value)} style={inputStyle} placeholder="0" /></Felt>
            {strategi === 'flipp' ? (
              <Felt lbl="Forventet salgssum (ARV)" hint="etter oppussing"><input type="number" value={arv} onChange={e => setArv(e.target.value)} style={inputStyle} /></Felt>
            ) : (
              <Felt lbl="Forventet leie/mnd"><input type="number" value={forventetLeie} onChange={e => setForventetLeie(e.target.value)} style={inputStyle} /></Felt>
            )}
          </div>
        </div>
      )}

      {/* STEG 4 — Oppsummering */}
      {steg === 4 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <SumRute lbl="Egenkapital-innskudd" verdi={fmt(ekInnskudd)} aksent />
            <SumRute lbl="Total investering" verdi={fmt(totalKjop)} />
            {strategi === 'flipp' ? (
              <>
                <SumRute lbl="Gevinst etter skatt (grovt)" verdi={n(arv) > 0 ? fmt(anslag.gevinstEtterSkatt) : '—'} />
                <SumRute lbl="Frigjort ved salg (grovt)" verdi={n(arv) > 0 ? fmt(anslag.nettoFrigjort) : '—'} />
              </>
            ) : (
              <SumRute lbl="Cashflow/mnd i drift (grovt)" verdi={n(forventetLeie) > 0 ? fmt(anslag.cashflowMnd) : '—'} tone={anslag.cashflowMnd >= 0 ? 'gronn' : 'rod'} />
            )}
          </div>
          <p style={{ fontSize: 11.5, color: FARGER.tekstLys, lineHeight: 1.5, marginBottom: 4 }}>
            Grovt anslag ({anslag.gevinstPst} % skatt{n(varighet) > 0 ? `, ${fmt(anslag.holdekost)} bæring i oppussingsperioden` : ''}). Full firescenario-analyse med selskapets skatteprofil finner du på <strong>Beslutning</strong>-fanen etter opprettelse.
          </p>
        </div>
      )}

      {/* Navigasjon */}
      <div style={{ display: 'flex', gap: 10, marginTop: 22, alignItems: 'center' }}>
        <button onClick={steg === 1 ? onAvbryt : () => setSteg(steg - 1)}
          style={{ background: FARGER.hvit, color: FARGER.mork, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {steg === 1 ? 'Avbryt' : '← Tilbake'}
        </button>
        {steg === 1 && <span style={{ fontSize: 12, color: FARGER.tekstLys }}>{jobber ? 'Leser dokument…' : 'valgfritt — du kan hoppe over'}</span>}
        <div style={{ marginLeft: 'auto' }}>
          {steg < 4 ? (
            <button onClick={() => setSteg(steg + 1)} disabled={!kanNeste}
              style={{ background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.pill, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: kanNeste ? 'pointer' : 'default', opacity: kanNeste ? 1 : 0.5 }}>
              {steg === 1 ? 'Videre →' : 'Neste →'}
            </button>
          ) : (
            <button onClick={opprett} disabled={lagrer}
              style={{ background: FARGER.suksess, color: '#fff', border: 'none', borderRadius: RADIUS.pill, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: lagrer ? 'default' : 'pointer', opacity: lagrer ? 0.6 : 1 }}>
              {lagrer ? 'Oppretter…' : '✓ Opprett eiendom'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Felt({ lbl, hint, children }: { lbl: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{lbl}</label>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: FARGER.tekstLys, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function OpplastKort({ ikon, tittel, undertekst, jobber, ferdig, onClick }: { ikon: string; tittel: string; undertekst: string; jobber: boolean; ferdig: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={jobber}
      style={{ background: ferdig ? FARGER.suksessBg : FARGER.hvit, border: `1.5px dashed ${ferdig ? FARGER.suksess : FARGER.kant}`, borderRadius: RADIUS.md, padding: 18, textAlign: 'left', cursor: jobber ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 22 }}>{jobber ? '⏳' : ikon}</span>
      <span>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: FARGER.mork }}>{jobber ? 'Leser…' : tittel}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: ferdig ? FARGER.suksess : FARGER.tekstLys, marginTop: 2 }}>{undertekst}</span>
      </span>
    </button>
  )
}

function SumRute({ lbl, verdi, aksent, tone }: { lbl: string; verdi: string; aksent?: boolean; tone?: 'gronn' | 'rod' }) {
  const farge = tone === 'gronn' ? FARGER.suksess : tone === 'rod' ? FARGER.feil : aksent ? FARGER.gull : FARGER.mork
  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${aksent ? FARGER.gullSvak : FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 10.5, color: FARGER.tekstLys, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>{lbl}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: farge }}>{verdi}</div>
    </div>
  )
}
