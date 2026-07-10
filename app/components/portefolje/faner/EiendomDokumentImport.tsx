'use client'
// Dokumentdrevet oppdatering på en EKSISTERENDE eid eiendom.
// Last opp kjøpekontrakt + lånedokument → AI trekker ut tallene → egenkapital
// blir differansen (Roberts regel: kjøpesum + kostnader + oppussing − lån).
// Gjenbruker samme API-ruter som NyEiendomVeiviser.
import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { loggAktivitet } from '../../../lib/logg'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import type { Prosjekt, EiendomLaan } from '../../../types'
import type { EiendomData } from '../useEiendomData'

type KontraktFelt = {
  adresse: string | null; kjopesum: number | null; omkostninger: number | null; dokumentavgift: number | null
  fellesgjeld: number | null; eierform: string | null; kjopsdato: string | null; selger: string | null; byggear: number | null
}
type LaanFelt = {
  bank: string | null; laanetype: string | null; hovedstol: number | null; restgjeld: number | null
  rente_pst: number | null; rentetype: string | null; nedbetalingstid_aar: number | null
  termin_belop: number | null; avdragsfritt: boolean; termin_frekvens: string | null; startdato: string | null
}

export function EiendomDokumentImport({ data, onEndret }: { data: EiendomData; onEndret: () => void }) {
  const p = data.prosjekt
  const erSpania = (p?.marked || 'spania') === 'spania'
  const valuta = erSpania ? '€' : 'kr'
  const peng = (n: number) => `${Math.round(n).toLocaleString('nb-NO')} ${valuta}`

  const [kontrakt, setKontrakt] = useState<KontraktFelt | null>(null)
  const [laan, setLaan] = useState<LaanFelt | null>(null)
  const [jobber, setJobber] = useState<'kontrakt' | 'laan' | null>(null)
  const [lagrer, setLagrer] = useState(false)
  const kontraktInput = useRef<HTMLInputElement>(null)
  const laanInput = useRef<HTMLInputElement>(null)

  if (!p) return null

  // Gjeldende verdier: nyinnlest dokument vinner, ellers det som alt ligger lagret.
  const kjopesum = kontrakt?.kjopesum ?? (p.kjøpesum || 0)
  const kostnader = kontrakt?.omkostninger ?? kontrakt?.dokumentavgift ?? (p.kjøpskostnader || 0)
  const oppussing = p.oppussingsbudsjett || 0
  const lanBelop = laan?.hovedstol ?? data.laan.reduce((s, l) => s + (l.hovedstol || 0), 0)
  const totalKjop = kjopesum + kostnader + oppussing
  const ekInnskudd = Math.max(0, totalKjop - lanBelop)
  const harNytt = kontrakt !== null || laan !== null

  async function lastKontrakt(fil: File) {
    setJobber('kontrakt')
    try {
      const fd = new FormData(); fd.append('fil', fil)
      const r = await fetch('/api/kjopekontrakt/analyser', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok || !d.suksess) { visToast(d.feil || 'Kunne ikke lese kontrakten', 'feil', 4000); return }
      setKontrakt(d.felt as KontraktFelt)
      visToast('Kjøpekontrakt lest — sjekk og lagre', 'suksess', 2500)
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
      visToast('Lånevilkår lest — sjekk og lagre', 'suksess', 2500)
    } catch { visToast('Kunne ikke lese lånedokumentet', 'feil', 4000) } finally {
      setJobber(null); if (laanInput.current) laanInput.current.value = ''
    }
  }

  async function lagre() {
    if (!harNytt || !p) return
    setLagrer(true)
    try {
      // 1) Oppdater prosjektfelter fra kjøpekontrakt
      if (kontrakt) {
        const oppd: Partial<Prosjekt> = {}
        if (kontrakt.kjopesum != null) oppd.kjøpesum = kontrakt.kjopesum
        const kost = kontrakt.omkostninger ?? kontrakt.dokumentavgift
        if (kost != null) oppd.kjøpskostnader = kost
        if (kontrakt.adresse) oppd.adresse = kontrakt.adresse
        if (kontrakt.eierform) oppd.eierform = kontrakt.eierform
        if (kontrakt.fellesgjeld != null) oppd.fellesgjeld_nok = kontrakt.fellesgjeld
        if (Object.keys(oppd).length > 0) {
          const { error } = await supabase.from('prosjekter').update(oppd).eq('id', p.id)
          if (error) throw error
        }
      }
      // 2) Oppdater/opprett lånerad fra lånepapir
      if (laan && (laan.hovedstol || 0) > 0) {
        const rad: Partial<EiendomLaan> = {
          bank: laan.bank,
          laanetype: (laan.laanetype as EiendomLaan['laanetype']) || 'annuitet',
          hovedstol: laan.hovedstol,
          restgjeld: laan.restgjeld ?? laan.hovedstol,
          rente_pst: laan.rente_pst,
          rentetype: (laan.rentetype as EiendomLaan['rentetype']) || 'flytende',
          termin_belop: laan.termin_belop,
          avdragsfritt: !!laan.avdragsfritt,
          termin_frekvens: (laan.termin_frekvens as EiendomLaan['termin_frekvens']) || 'mnd',
          nedbetalingstid_aar: laan.nedbetalingstid_aar,
          startdato: laan.startdato,
          notat: 'Fra dokumentimport (lånepapir)',
        }
        const eksisterende = data.laan[0]
        if (eksisterende) {
          const { error } = await supabase.from('eiendom_laan').update(rad).eq('id', eksisterende.id)
          if (error) throw error
        } else {
          const bruker = hentAktivBruker() || 'ukjent'
          const { error } = await supabase.from('eiendom_laan').insert([{
            id: `${p.id}-laan-${Date.now()}`, prosjekt_id: p.id, bruker, opprettet: new Date().toISOString(), ...rad,
          }])
          if (error) throw error
        }
      }
      await loggAktivitet({ handling: 'oppdaterte eiendom fra dokumenter', tabell: 'prosjekter', rad_id: p.id, prosjekt_id: p.id, detaljer: { navn: p.navn } })
      setKontrakt(null); setLaan(null)
      visToast('Oppdatert fra dokumenter', 'suksess', 3000)
      onEndret()
    } catch (e) {
      visToast('Lagring feilet: ' + (e instanceof Error ? e.message : 'ukjent feil'), 'feil', 5000)
    } finally {
      setLagrer(false)
    }
  }

  return (
    <section style={{ background: FARGER.mork, color: FARGER.creamLys, borderRadius: RADIUS.md, padding: 18 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Oppdater fra dokumenter</h3>
      <p style={{ fontSize: 12.5, color: 'rgba(253,252,247,0.65)', margin: '4px 0 14px', lineHeight: 1.55 }}>
        Last opp kjøpekontrakt og lånedokument — AI fyller ut tallene, og egenkapital blir det lånet ikke dekker.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        <OpplastKnapp
          ikon="📄" tittel="Kjøpekontrakt"
          status={kontrakt ? '✓ lest' : 'kjøpesum, omkostninger, adresse'}
          ferdig={!!kontrakt} jobber={jobber === 'kontrakt'}
          onClick={() => kontraktInput.current?.click()} />
        <OpplastKnapp
          ikon="🏦" tittel="Lånedokument"
          status={laan ? `✓ ${laan.bank || 'lån'}${laan.hovedstol ? ' · ' + peng(laan.hovedstol) : ''}` : 'lånebeløp, rente, løpetid'}
          ferdig={!!laan} jobber={jobber === 'laan'}
          onClick={() => laanInput.current?.click()} />
      </div>
      <input ref={kontraktInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void lastKontrakt(f) }} />
      <input ref={laanInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void lastLaan(f) }} />

      {/* Regnestykke — Roberts regel */}
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: RADIUS.sm, padding: 14, marginBottom: 14 }}>
        <RegnRad lbl="Kjøpesum" verdi={peng(kjopesum)} />
        <RegnRad lbl="+ Omkostninger" verdi={peng(kostnader)} />
        {oppussing > 0 && <RegnRad lbl="+ Oppussing" verdi={peng(oppussing)} />}
        <RegnRad lbl="− Lån" verdi={peng(lanBelop)} />
        <RegnRad lbl="= Egenkapital (innskutt)" verdi={peng(ekInnskudd)} uthevet />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={lagre} disabled={!harNytt || lagrer}
          style={{
            background: (!harNytt || lagrer) ? 'rgba(255,255,255,0.15)' : FARGER.gull,
            color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.sm,
            padding: '10px 20px', fontSize: 13, fontWeight: 600,
            cursor: (!harNytt || lagrer) ? 'default' : 'pointer', letterSpacing: '0.02em',
          }}>
          {lagrer ? '⏳ Lagrer…' : '💾 Lagre til eiendommen'}
        </button>
        {jobber && <span style={{ fontSize: 12, color: 'rgba(253,252,247,0.6)' }}>Leser dokument…</span>}
        {!harNytt && !jobber && <span style={{ fontSize: 12, color: 'rgba(253,252,247,0.5)' }}>Last opp et dokument for å oppdatere tallene</span>}
      </div>
    </section>
  )
}

function OpplastKnapp({ ikon, tittel, status, ferdig, jobber, onClick }: {
  ikon: string; tittel: string; status: string; ferdig: boolean; jobber: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} disabled={jobber}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        background: ferdig ? 'rgba(46,125,70,0.22)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${ferdig ? '#2D7D46' : 'rgba(255,255,255,0.18)'}`,
        borderRadius: RADIUS.sm, padding: '12px 14px', cursor: jobber ? 'default' : 'pointer',
        color: FARGER.creamLys, fontFamily: 'inherit',
      }}>
      <span style={{ fontSize: 22 }}>{jobber ? '⏳' : ikon}</span>
      <span>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{tittel}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(253,252,247,0.6)', marginTop: 2 }}>{status}</span>
      </span>
    </button>
  )
}

function RegnRad({ lbl, verdi, uthevet }: { lbl: string; verdi: string; uthevet?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13,
      borderTop: uthevet ? '1px solid rgba(255,255,255,0.18)' : 'none',
      marginTop: uthevet ? 6 : 0, paddingTop: uthevet ? 10 : 5,
      fontWeight: uthevet ? 700 : 400,
      color: uthevet ? FARGER.gull : 'rgba(253,252,247,0.85)',
    }}>
      <span>{lbl}</span><span>{verdi}</span>
    </div>
  )
}
