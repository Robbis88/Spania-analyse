'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { supabase } from '../lib/supabase'
import { useEurNokKurs } from '../lib/valuta'
import { KortFortalt } from './KortFortalt'
import { MaalSeksjon } from './MaalSeksjon'

type KonsRad = {
  valuta: string; samlet_verdi: number; restgjeld: number; egenkapital: number
  resultat_mnd: number; antall: number; bundet_ek: number; fri_likviditet: number; kjopekraft: number
  ek_innskutt: number; ek_verdiendring: number; ek_omkostninger: number
  ek_oppussing: number; ek_drift: number; ek_renter: number; ek_leie: number
}
type SelskRad = { id: string; navn: string; valuta: string; antall_eiendommer: number; bundet_ek: number }
type RangRad = {
  id: string; navn: string; marked: string; valuta: string; selskap_id: string | null
  samlet_verdi: number; restgjeld: number; egenkapital: number; leie_mnd: number
  langtid_yield_pst: number | null; cashflow_mnd: number | null; stress_cashflow_mnd: number | null
  bundet_ek: number; flagg: Array<{ farge: 'rod' | 'gul'; tekst: string }>
}
type Historikk = {
  resultat_serie: Array<{ maaned: string; inntekt: number; kostnad: number; resultat: number }>
  verdi_serie: Array<{ dato: string; verdi: number }>
}
type Aktivitet = { id: string; tidspunkt: string; handling: string; hendelsestype: string | null; prosjekt_id: string | null; detaljer: Record<string, unknown> | null }

const fmtNok = (n: number) => Math.round(n || 0).toLocaleString('nb-NO') + ' kr'
const fmtMill = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2).replace('.', ',') + ' mill'
  if (a >= 1_000) return Math.round(n / 1_000) + ' k'
  return String(Math.round(n))
}
const fmtVal = (n: number, valuta: string) => (valuta === 'EUR' ? '€' : '') + Math.round(n || 0).toLocaleString('nb-NO') + (valuta === 'EUR' ? '' : ' kr')

const HENDELSE_IKON: Record<string, string> = {
  kjopt: '🏠', bud: '📝', renovering_start: '🔨', renovering_slutt: '🔨', verdivurdering: '📈',
  refinansiert: '🏦', utleid: '🔑', tilbud_akseptert: '📄', anbefaling_gitt: '🤖', solgt: '✅', generell: '•',
}

function hilsen(): string {
  const t = new Date().getHours()
  if (t < 5) return 'God natt'
  if (t < 10) return 'God morgen'
  if (t < 18) return 'God dag'
  return 'God kveld'
}

function forSiden(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const min = d / 60000
  if (!isFinite(min) || min < 0) return ''
  if (min < 60) return `${Math.round(min)} min siden`
  const t = min / 60
  if (t < 24) return `${Math.round(t)} t siden`
  const dg = t / 24
  if (dg < 7) return `${Math.round(dg)} dager siden`
  return new Date(iso).toLocaleDateString('nb-NO')
}

export function HjemDashboard({ bruker, onÅpneEiendom, onÅpneVarsler }: {
  bruker?: string
  onÅpneEiendom?: (id: string) => void
  onÅpnePortefolje?: () => void
  onÅpneVarsler?: () => void
}) {
  const [kons, setKons] = useState<KonsRad[]>([])
  const [selsk, setSelsk] = useState<SelskRad[]>([])
  const [rang, setRang] = useState<RangRad[]>([])
  const [hist, setHist] = useState<Historikk>({ resultat_serie: [], verdi_serie: [] })
  const [aktivitet, setAktivitet] = useState<Aktivitet[]>([])
  const kurs = useEurNokKurs()

  useEffect(() => {
    fetch('/api/kapital').then(r => r.json()).then(d => { setKons(d.konsolidert || []); setSelsk(d.selskaper || []) }).catch(() => {})
    fetch('/api/portefolje-rangering').then(r => r.json()).then(d => setRang(d.rader || [])).catch(() => {})
    fetch('/api/hjem-historikk').then(r => r.json()).then(d => setHist({ resultat_serie: d.resultat_serie || [], verdi_serie: d.verdi_serie || [] })).catch(() => {})
    supabase.from('aktivitetslogg').select('id, tidspunkt, handling, hendelsestype, prosjekt_id, detaljer')
      .order('tidspunkt', { ascending: false }).limit(5)
      .then(({ data }) => setAktivitet((data || []) as Aktivitet[]))
  }, [])

  // Konsolider til NOK (kan ikke summere NOK + EUR uten kurs).
  const k = useMemo(() => {
    const nok = (verdi: number, valuta: string) => (valuta === 'EUR' ? verdi * kurs : verdi)
    const sum = { verdi: 0, gjeld: 0, ek: 0, resultat: 0, fri: 0, kjopekraft: 0, bundet: 0, antNorge: 0, antSpania: 0,
      ekInnskutt: 0, ekVerdiendring: 0, ekOmkost: 0, ekOppussing: 0, ekDrift: 0, ekRenter: 0, ekLeie: 0 }
    for (const r of kons) {
      sum.verdi += nok(r.samlet_verdi, r.valuta)
      sum.gjeld += nok(r.restgjeld, r.valuta)
      sum.ek += nok(r.egenkapital, r.valuta)
      sum.resultat += nok(r.resultat_mnd, r.valuta)
      sum.fri += nok(r.fri_likviditet, r.valuta)
      sum.kjopekraft += nok(r.kjopekraft, r.valuta)
      sum.bundet += nok(r.bundet_ek, r.valuta)
      sum.ekInnskutt += nok(r.ek_innskutt, r.valuta)
      sum.ekVerdiendring += nok(r.ek_verdiendring, r.valuta)
      sum.ekOmkost += nok(r.ek_omkostninger, r.valuta)
      sum.ekOppussing += nok(r.ek_oppussing, r.valuta)
      sum.ekDrift += nok(r.ek_drift, r.valuta)
      sum.ekRenter += nok(r.ek_renter, r.valuta)
      sum.ekLeie += nok(r.ek_leie, r.valuta)
      if (r.valuta === 'EUR') sum.antSpania += r.antall; else sum.antNorge += r.antall
    }
    return sum
  }, [kons, kurs])

  const antall = k.antNorge + k.antSpania
  const rangert = useMemo(() =>
    [...rang].sort((a, b) => (b.langtid_yield_pst ?? -Infinity) - (a.langtid_yield_pst ?? -Infinity)),
  [rang])
  const renteEksponert = rang.filter(r => typeof r.stress_cashflow_mnd === 'number' && r.stress_cashflow_mnd < 0).length

  // Varsler — konkrete flagg + syntetisk rentesjokk-flagg. Røde først.
  const varsler = useMemo(() => {
    const ut: Array<{ navn: string; farge: 'rod' | 'gul'; tekst: string; id: string }> = []
    for (const r of rang) for (const f of r.flagg) ut.push({ navn: r.navn, farge: f.farge, tekst: f.tekst, id: r.id })
    if (renteEksponert > 0) ut.push({ navn: 'Renteeksponering', farge: 'rod', id: '', tekst: `${renteEksponert} eiendom${renteEksponert > 1 ? 'mer' : ''} går negativt ved +3 pp rente` })
    return ut.sort((a, b) => (a.farge === 'rod' ? 0 : 1) - (b.farge === 'rod' ? 0 : 1))
  }, [rang, renteEksponert])

  const redeFlagg = varsler.filter(v => v.farge === 'rod').length

  // Reell kontantstrøm-trend fra faktisk historikk (ALDRI fabrikkert).
  const cashTrend = useMemo(() => {
    const s = hist.resultat_serie
    if (s.length < 2) return null
    const forrige = s[s.length - 2].resultat, siste = s[s.length - 1].resultat
    if (!forrige) return null
    return ((siste - forrige) / Math.abs(forrige)) * 100
  }, [hist.resultat_serie])

  // "Hva skjer?" — statusoverskrift utledet av tallene.
  const status = useMemo(() => {
    if (kons.length === 0) return { tittel: 'Bygger oversikt…', tone: 'noytral' as const, sub: '' }
    if (k.resultat < 0) return { tittel: 'Kontantstrømmen krever handling', tone: 'rod' as const, sub: 'Negativ drift — se anbefaling til høyre' }
    if (redeFlagg > 0) return { tittel: 'Stabilt — men noe krever handling', tone: 'gul' as const, sub: `${redeFlagg} eiendom${redeFlagg > 1 ? 'mer' : ''} flagget rødt` }
    return { tittel: 'Porteføljen går bra', tone: 'gronn' as const, sub: 'Positiv drift, ingen kritiske flagg' }
  }, [kons.length, k.resultat, redeFlagg])

  const statusFarge = status.tone === 'rod' ? FARGER.feil : status.tone === 'gul' ? FARGER.advarsel : status.tone === 'gronn' ? '#4ea373' : FARGER.gull

  const kontekst = useMemo(() => {
    if (kons.length === 0) return ''
    const flaggTekst = varsler.length ? varsler.map(f => `${f.farge === 'rod' ? 'RØD' : 'GUL'} ${f.navn}: ${f.tekst}`).join('; ') : 'ingen flagg'
    return [
      `Konsern (omregnet til NOK, kurs 1 € = ${kurs.toFixed(2)} kr):`,
      `Porteføljeverdi ${fmtNok(k.verdi)}, gjeld ${fmtNok(k.gjeld)}, egenkapital ${fmtNok(k.ek + k.fri)} (i eiendom ${fmtNok(k.ek)}, fri likviditet ${fmtNok(k.fri)}), frigjørbar ved salg ${fmtNok(k.bundet)}, resultat/mnd ${fmtNok(k.resultat)}, kjøpekraft ${fmtNok(k.kjopekraft)}.`,
      `${antall} eiendommer (${k.antNorge} Norge / ${k.antSpania} Spania).`,
      `Flagg: ${flaggTekst}.`,
      'Skriv en kort investeringsbrief (3-4 setninger): hva er status, hva bør følges, og hva er neste beste handling. Ingen sikkerhetsprosenter.',
    ].filter(Boolean).join(' ')
  }, [kons, k, kurs, antall, varsler])

  return (
    <div>
      {/* Slank hilsen-eyebrow */}
      <div style={{ fontSize: 12.5, color: FARGER.tekstMid, marginBottom: 12 }}>
        {hilsen()}{bruker ? `, ${bruker.charAt(0).toUpperCase() + bruker.slice(1)}` : ''} 👋
      </div>

      {/* ═══ 1. HERO — HVA SKJER + HVA BØR DU GJØRE ═══ */}
      <section style={{ background: FARGER.mork, borderRadius: RADIUS.xl, padding: 'clamp(22px, 3.2vw, 36px)', marginBottom: 26, boxShadow: SHADOW.lg, display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 48px)' }}>
        {/* Venstre: status + kontantstrøm */}
        <div style={{ flex: '1.5 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10.5, color: FARGER.gull, letterSpacing: '0.24em', fontWeight: 700, marginBottom: 16 }}>KONSERN · PORTEFØLJE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'clamp(20px, 3vw, 34px)' }}>
            <span style={{ width: 12, height: 12, borderRadius: RADIUS.pill, background: statusFarge, boxShadow: `0 0 0 5px ${statusFarge}22`, flexShrink: 0 }} />
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 600, color: FARGER.creamLys, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.05 }}>{status.tittel}</h1>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 11, color: 'rgba(253,252,247,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Kontantstrøm</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: k.resultat >= 0 ? '#5cc98c' : '#ff8a8a', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {fmtNok(k.resultat)}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(253,252,247,0.55)' }}>/ mnd</span>
              {cashTrend !== null && (
                <span style={{ fontSize: 13.5, fontWeight: 700, color: cashTrend >= 0 ? '#5cc98c' : '#ff8a8a' }}>
                  {cashTrend >= 0 ? '↑' : '↓'} {Math.abs(cashTrend).toFixed(0)} % <span style={{ fontWeight: 400, color: 'rgba(253,252,247,0.45)' }}>vs forrige mnd</span>
                </span>
              )}
            </div>
            {/* Sekundære tall — dempet */}
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 20, fontSize: 12.5, color: 'rgba(253,252,247,0.6)' }}>
              <span>Verdi <strong style={{ color: 'rgba(253,252,247,0.9)', fontWeight: 600 }}>{fmtMill(k.verdi)}</strong></span>
              <span>Gjeld <strong style={{ color: 'rgba(253,252,247,0.9)', fontWeight: 600 }}>{fmtMill(k.gjeld)}</strong></span>
              <span><strong style={{ color: 'rgba(253,252,247,0.9)', fontWeight: 600 }}>{antall}</strong> eiendommer · {k.antNorge}🇳🇴 {k.antSpania}🇪🇸</span>
            </div>
          </div>
        </div>

        {/* Skille */}
        <div style={{ width: 1, background: 'rgba(253,252,247,0.12)', alignSelf: 'stretch' }} className="hero-skille" />

        {/* Høyre: AI-brief */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <KortFortalt tittel="Dagens investeringsbrief" overskrift="Dagens brief" kontekst={kontekst} mork />
        </div>
      </section>

      {/* ═══ 2. TRE PRIMÆRE KPI-ER ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
        <StorKpi lbl="Egenkapital" verdi={fmtMill(k.ek + k.fri)} sub={`i eiendom ${fmtMill(k.ek)} · fri ${fmtMill(k.fri)}`} />
        <StorKpi lbl="Fri kapital" verdi={fmtMill(k.fri)} sub="klar til bruk nå" />
        <StorKpi lbl="Kjøpekraft" verdi={fmtMill(k.kjopekraft)} sub="fri + refi + ramme" aksent />
      </div>

      {/* Egenkapital-bro — hva løfter/tærer EK */}
      <EgenkapitalBro
        innskutt={k.ekInnskutt} verdiendring={k.ekVerdiendring} omkost={k.ekOmkost}
        oppussing={k.ekOppussing} drift={k.ekDrift} renter={k.ekRenter} leie={k.ekLeie}
        total={k.ek + k.fri}
      />

      {/* ═══ 3. STOR KONTANTSTRØM-GRAF ═══ */}
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 26, boxShadow: SHADOW.xs }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: FARGER.mork }}>Kontantstrøm <span style={{ fontSize: 12, color: FARGER.tekstLys, fontWeight: 400 }}>siste 12 mnd</span></span>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: FARGER.tekstMid }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: FARGER.suksess }} />Inntekter</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: FARGER.feil }} />Kostnader</span>
          </div>
        </div>
        <ResultatGraf serie={hist.resultat_serie} />
      </div>

      {/* ═══ 4. EIENDOMMER — KORT ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: FARGER.mork, fontWeight: 600, letterSpacing: '-0.01em' }}>Eiendommer</span>
        {onÅpneEiendom && <button onClick={() => onÅpneEiendom('')} style={{ background: 'none', border: 'none', color: FARGER.gull, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Vis alle →</button>}
      </div>
      {rangert.length === 0 ? (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys, fontSize: 13, marginBottom: 26 }}>
          Ingen eiendommer i porteføljen ennå.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 30 }}>
          {rangert.map(r => <EiendomKort key={r.id} r={r} onÅpne={onÅpneEiendom} />)}
        </div>
      )}

      {/* ═══ 5. SEKUNDÆRT — varsler + aktivitet (dempet) ═══ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26, marginBottom: 26, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: FARGER.tekstLys, letterSpacing: '0.16em', fontWeight: 700, textTransform: 'uppercase' }}>Varsler</span>
            {varsler.length > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: redeFlagg > 0 ? FARGER.feil : FARGER.advarsel, background: redeFlagg > 0 ? FARGER.feilBg : FARGER.advarselBg, borderRadius: RADIUS.pill, padding: '1px 8px' }}>{varsler.length}</span>}
            {onÅpneVarsler && <button onClick={() => onÅpneVarsler()} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: FARGER.gull, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Alle →</button>}
          </div>
          {varsler.length === 0 ? (
            <div style={{ fontSize: 13, color: FARGER.tekstLys, padding: '8px 0' }}>Ingen aktive varsler ✓</div>
          ) : (
            <div style={{ display: 'grid', gap: 2 }}>
              {varsler.slice(0, 4).map((v, i) => (
                <button key={i} onClick={() => onÅpneVarsler?.()}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', background: 'none', border: 'none', borderBottom: `1px solid ${FARGER.kantUltralys}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                  <span style={{ width: 7, height: 7, borderRadius: RADIUS.pill, background: v.farge === 'rod' ? FARGER.feil : FARGER.advarsel, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.navn}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: FARGER.tekstMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.tekst}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstLys, letterSpacing: '0.16em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Siste aktivitet</div>
          {aktivitet.length === 0 ? (
            <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic' }}>Ingen registrert aktivitet ennå.</div>
          ) : (
            <div style={{ display: 'grid', gap: 2 }}>
              {aktivitet.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderBottom: `1px solid ${FARGER.kantUltralys}` }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{HENDELSE_IKON[a.hendelsestype || 'generell'] || '•'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: FARGER.tekstMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.handling}{typeof a.detaljer?.navn === 'string' && <span> — {a.detaljer.navn as string}</span>}
                  </span>
                  <span style={{ fontSize: 10.5, color: FARGER.tekstLys, whiteSpace: 'nowrap' }}>{forSiden(a.tidspunkt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mål (B11) */}
      <MaalSeksjon selsk={selsk} rang={rang} />
    </div>
  )
}

// ─── Stor primær-KPI ─────────────────────────────────────────────────────────
function StorKpi({ lbl, verdi, sub, aksent }: { lbl: string; verdi: string; sub: string; aksent?: boolean }) {
  return (
    <div style={{
      background: aksent ? FARGER.creamLys : FARGER.hvit,
      border: `1px solid ${aksent ? FARGER.gullSvak : FARGER.kantLys}`,
      borderRadius: RADIUS.lg, padding: '22px 24px', boxShadow: SHADOW.xs,
    }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>{lbl}</div>
      <div style={{ fontSize: 'clamp(28px, 3.4vw, 38px)', fontWeight: 700, color: aksent ? FARGER.gull : FARGER.mork, letterSpacing: '-0.025em', lineHeight: 1 }}>{verdi}</div>
      <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 8 }}>{sub}</div>
    </div>
  )
}

// ─── Egenkapital-bro (hva løfter/tærer EK, fra startkapital til i dag) ────────
function EgenkapitalBro({ innskutt, verdiendring, omkost, oppussing, drift, renter, leie, total }: {
  innskutt: number; verdiendring: number; omkost: number; oppussing: number; drift: number; renter: number; leie: number; total: number
}) {
  const [åpen, setÅpen] = useState(true)
  const nok = (n: number) => (n >= 0 ? '+' : '−') + Math.round(Math.abs(n)).toLocaleString('nb-NO') + ' kr'
  const linjer: Array<{ lbl: string; v: number; grunn?: boolean }> = [
    { lbl: 'Startkapital (innskutt EK)', v: innskutt, grunn: true },
    { lbl: 'Verdiendring på eiendom', v: verdiendring },
    { lbl: 'Leieinntekt hittil', v: leie },
    { lbl: 'Kjøpsomkostninger', v: -omkost },
    { lbl: 'Oppussing betalt', v: -oppussing },
    { lbl: 'Driftskostnader hittil', v: -drift },
    { lbl: 'Lånerenter hittil', v: -renter },
  ]
  const annet = total - linjer.reduce((a, l) => a + l.v, 0)
  // Stor «Annet» tyder på utdatert restgjeld eller uklassifiserte føringer — flagg det.
  const annetStor = Math.abs(annet) > Math.max(25000, Math.abs(total) * 0.02)
  if (Math.abs(annet) > 1) linjer.push({ lbl: annetStor ? '⚠️ Annet — sjekk restgjeld/føringer' : 'Annet / avrunding', v: annet })
  const vis = linjer.filter(l => l.grunn || Math.abs(l.v) >= 1)
  // Ingenting å vise før porteføljen har tall
  if (total === 0 && innskutt === 0) return null

  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.xs, marginBottom: 26, overflow: 'hidden' }}>
      <button onClick={() => setÅpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>Hva påvirker egenkapitalen?</span>
        <span style={{ fontSize: 12, color: FARGER.tekstLys }}>{åpen ? 'skjul ▲' : 'vis ▾'}</span>
      </button>
      {åpen && (
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ display: 'grid', gap: 1 }}>
            {vis.map((l, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: `1px solid ${FARGER.kantUltralys}`, fontSize: 13 }}>
                <span style={{ color: l.grunn ? FARGER.mork : FARGER.tekstMid, fontWeight: l.grunn ? 600 : 400 }}>{l.lbl}</span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: l.grunn ? FARGER.mork : l.v >= 0 ? '#4ea373' : FARGER.feil }}>{nok(l.v)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0 2px', fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: FARGER.mork }}>= Egenkapital i dag</span>
              <span style={{ fontWeight: 700, color: FARGER.mork, whiteSpace: 'nowrap' }}>{Math.round(total).toLocaleString('nb-NO')} kr</span>
            </div>
          </div>
          {annetStor && (
            <p style={{ fontSize: 11.5, color: FARGER.feil, margin: '12px 0 0', lineHeight: 1.5, fontWeight: 600 }}>
              ⚠️ «Annet» er stor — sjekk at restgjeld er oppdatert mot betalte avdrag, og at ingen føringer mangler klassifisering.
            </p>
          )}
          <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '12px 0 0', lineHeight: 1.5 }}>
            Kjøp og lån endrer ikke egenkapitalen (bytte kontanter ↔ eiendom/gjeld). Bare ekte utgifter — omkostninger, renter, drift — tærer den. Verdiøkning og leie løfter den.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Eiendomskort (klikkbart, med hover-løft) ────────────────────────────────
function EiendomKort({ r, onÅpne }: { r: RangRad; onÅpne?: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  const harRod = r.flagg.some(f => f.farge === 'rod')
  const harGul = !harRod && r.flagg.some(f => f.farge === 'gul')
  const status = harRod ? FARGER.feil : harGul ? FARGER.advarsel : FARGER.suksess
  const negativ = (r.cashflow_mnd ?? 0) < 0
  const tag = harRod && negativ ? 'Binder kapital' : harRod ? 'Krever handling' : harGul ? 'Bør vurderes' : 'Sunn drift'
  const ltv = r.samlet_verdi > 0 ? (r.restgjeld / r.samlet_verdi) * 100 : null
  return (
    <button onClick={() => onÅpne?.(r.id)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: FARGER.hvit, border: `1px solid ${hover ? FARGER.gull : FARGER.kantLys}`,
        borderTop: `3px solid ${status}`, borderRadius: RADIUS.lg, padding: 18, textAlign: 'left',
        cursor: 'pointer', fontFamily: 'inherit', boxShadow: hover ? SHADOW.md : SHADOW.xs,
        transform: hover ? 'translateY(-2px)' : 'none', transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}, border-color ${MOTION.rask}`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: RADIUS.pill, background: status, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.navn}</span>
        <span style={{ fontSize: 13 }}>{r.marked === 'norge' ? '🇳🇴' : '🇪🇸'}</span>
      </div>
      <div>
        <span style={{ fontSize: 24, fontWeight: 700, color: negativ ? FARGER.feil : FARGER.suksess, letterSpacing: '-0.02em' }}>
          {r.cashflow_mnd !== null ? fmtVal(r.cashflow_mnd, r.valuta) : '–'}
        </span>
        <span style={{ fontSize: 11.5, color: FARGER.tekstLys, marginLeft: 6 }}>/ mnd</span>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: FARGER.tekstMid }}>
        <span>Yield <strong style={{ color: FARGER.mork }}>{r.langtid_yield_pst !== null ? r.langtid_yield_pst.toFixed(1) + ' %' : '–'}</strong></span>
        {ltv !== null && <span>LTV <strong style={{ color: ltv > 85 ? FARGER.feil : FARGER.mork }}>{ltv.toFixed(0)} %</strong></span>}
      </div>
      <span style={{ alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: RADIUS.pill, background: harRod ? FARGER.feilBg : harGul ? FARGER.advarselBg : FARGER.suksessBg, color: status, letterSpacing: '0.02em' }}>{tag}</span>
    </button>
  )
}

// ─── Stor kontantstrøm-graf (inntekt grønn vs kostnad rød) ───────────────────
function ResultatGraf({ serie }: { serie: Array<{ maaned: string; inntekt: number; kostnad: number; resultat: number }> }) {
  if (serie.length === 0) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: FARGER.tekstLys, fontSize: 12.5, lineHeight: 1.5, padding: '0 20px' }}>
        Historikk bygges opp fra nå — logg månedlig cashflow per eiendom, så tegnes grafen automatisk.
      </div>
    )
  }
  const H = 180, maks = Math.max(1, ...serie.map(s => Math.max(s.inntekt, s.kostnad)))
  const gruppe = 100 / serie.length
  const bw = Math.min(gruppe * 0.3, 3.4)
  const mndKort = (m: string) => { const d = new Date(m + '-01'); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('nb-NO', { month: 'short' }).replace('.', '') }
  return (
    <div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, overflow: 'visible' }}>
        <line x1={0} y1={H - 16} x2={100} y2={H - 16} stroke={FARGER.kantLys} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        {serie.map((s, i) => {
          const cx = i * gruppe + gruppe / 2
          const hi = (s.inntekt / maks) * (H - 30)
          const hk = (s.kostnad / maks) * (H - 30)
          return (
            <g key={s.maaned}>
              <rect x={cx - bw - 0.5} y={H - 16 - hi} width={bw} height={hi} fill={FARGER.suksess} rx={0.5} />
              <rect x={cx + 0.5} y={H - 16 - hk} width={bw} height={hk} fill={FARGER.feil} rx={0.5} />
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9.5, color: FARGER.tekstSvak }}>
        {serie.map((s, i) => <span key={i} style={{ flex: 1, textAlign: 'center' }}>{mndKort(s.maaned)}</span>)}
      </div>
    </div>
  )
}
