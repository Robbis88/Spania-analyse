'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW } from '../lib/styles'
import { supabase } from '../lib/supabase'
import { useEurNokKurs } from '../lib/valuta'
import { KortFortalt } from './KortFortalt'
import { MaalSeksjon } from './MaalSeksjon'

type KonsRad = {
  valuta: string; samlet_verdi: number; restgjeld: number; egenkapital: number
  resultat_mnd: number; antall: number; bundet_ek: number; fri_likviditet: number; kjopekraft: number
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
const fmtKort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace('.', ',') + ' M'
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
      .order('tidspunkt', { ascending: false }).limit(6)
      .then(({ data }) => setAktivitet((data || []) as Aktivitet[]))
  }, [])

  // Konsolider til NOK (kan ikke summere NOK + EUR uten kurs). Konsernet styres
  // fra Loeiendom AS (NOK), så EUR omregnes med live-kurs.
  const k = useMemo(() => {
    const nok = (verdi: number, valuta: string) => (valuta === 'EUR' ? verdi * kurs : verdi)
    const sum = { verdi: 0, gjeld: 0, ek: 0, resultat: 0, fri: 0, kjopekraft: 0, bundet: 0, antNorge: 0, antSpania: 0 }
    for (const r of kons) {
      sum.verdi += nok(r.samlet_verdi, r.valuta)
      sum.gjeld += nok(r.restgjeld, r.valuta)
      sum.ek += nok(r.egenkapital, r.valuta)
      sum.resultat += nok(r.resultat_mnd, r.valuta)
      sum.fri += nok(r.fri_likviditet, r.valuta)
      sum.kjopekraft += nok(r.kjopekraft, r.valuta)
      sum.bundet += nok(r.bundet_ek, r.valuta)
      if (r.valuta === 'EUR') sum.antSpania += r.antall; else sum.antNorge += r.antall
    }
    return sum
  }, [kons, kurs])

  const antall = k.antNorge + k.antSpania
  const medYield = rang.filter(r => typeof r.langtid_yield_pst === 'number')
  const beste = medYield.length ? medYield.reduce((a, b) => (b.langtid_yield_pst! > a.langtid_yield_pst! ? b : a)) : null
  const svakest = medYield.length ? medYield.reduce((a, b) => (b.langtid_yield_pst! < a.langtid_yield_pst! ? b : a)) : null
  const renteEksponert = rang.filter(r => typeof r.stress_cashflow_mnd === 'number' && r.stress_cashflow_mnd < 0).length

  // Reell verditrend fra faktiske verdivurderinger (ALDRI fabrikkert — vises kun
  // når to eller flere vurderinger finnes). Se designprinsipp C0.
  const verdiTrend = useMemo(() => {
    const s = hist.verdi_serie
    if (s.length < 2) return null
    const f = s[0].verdi, l = s[s.length - 1].verdi
    if (!f) return null
    return ((l - f) / f) * 100
  }, [hist.verdi_serie])

  // Varsler-panel: konkrete flagg per eiendom + syntetisk rentesjokk-flagg.
  const varsler = useMemo(() => {
    const ut: Array<{ navn: string; farge: 'rod' | 'gul'; tekst: string; id: string }> = []
    for (const r of rang) for (const f of r.flagg) ut.push({ navn: r.navn, farge: f.farge, tekst: f.tekst, id: r.id })
    if (renteEksponert > 0) ut.push({ navn: 'Renteeksponering', farge: 'rod', id: '', tekst: `${renteEksponert} eiendom${renteEksponert > 1 ? 'mer' : ''} går negativt ved +3 pp rente` })
    // Røde først.
    return ut.sort((a, b) => (a.farge === 'rod' ? 0 : 1) - (b.farge === 'rod' ? 0 : 1))
  }, [rang, renteEksponert])

  const toppHandling = varsler.find(v => v.farge === 'rod') || varsler[0] || null

  const kontekst = useMemo(() => {
    if (kons.length === 0) return ''
    const flaggTekst = varsler.length ? varsler.map(f => `${f.farge === 'rod' ? 'RØD' : 'GUL'} ${f.navn}: ${f.tekst}`).join('; ') : 'ingen flagg'
    return [
      `Konsern (omregnet til NOK, kurs 1 € = ${kurs.toFixed(2)} kr):`,
      `Porteføljeverdi ${fmtNok(k.verdi)}, gjeld ${fmtNok(k.gjeld)}, egenkapital ${fmtNok(k.ek)} (låst ${fmtNok(k.bundet)}, fri likviditet ${fmtNok(k.fri)}), resultat/mnd ${fmtNok(k.resultat)}, kjøpekraft ${fmtNok(k.kjopekraft)}.`,
      `${antall} eiendommer (${k.antNorge} Norge / ${k.antSpania} Spania).`,
      beste ? `Beste: ${beste.navn} ${beste.langtid_yield_pst!.toFixed(1)} % yield på bundet EK.` : '',
      svakest && svakest.id !== beste?.id ? `Svakeste: ${svakest.navn} ${svakest.langtid_yield_pst!.toFixed(1)} %.` : '',
      `Flagg: ${flaggTekst}.`,
    ].filter(Boolean).join(' ')
  }, [kons, k, kurs, antall, beste, svakest, varsler])

  return (
    <div>
      {/* Hilsen */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 'clamp(24px, 3.4vw, 30px)', fontWeight: 300, color: FARGER.mork, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          {hilsen()}{bruker ? `, ${bruker.charAt(0).toUpperCase() + bruker.slice(1)}` : ''} <span style={{ fontWeight: 400 }}>👋</span>
        </h1>
        <p style={{ fontSize: 13.5, color: FARGER.tekstMid, margin: 0 }}>Her er oversikten for hele porteføljen din i dag.</p>
      </div>

      {/* 1. KORT FORTALT — AI-brief fra sidens egne tall (C0) */}
      <KortFortalt tittel="Hjem — konsern" kontekst={kontekst} />

      {/* 2. NØKKELTALL — 6 store tall (C0: maks 5–6) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Kpi lbl="Porteføljeverdi" ikon="🏢" verdi={fmtNok(k.verdi)} trend={verdiTrend} />
        <Kpi lbl="Total gjeld" ikon="🏦" verdi={fmtNok(k.gjeld)} />
        <Kpi lbl="Egenkapital" ikon="💎" verdi={fmtNok(k.ek)} aksent={FARGER.suksess} sub={`låst ${fmtKort(k.bundet)} · fri ${fmtKort(k.fri)}`} />
        <Kpi lbl="Resultat / mnd" ikon="📈" verdi={fmtNok(k.resultat)} aksent={k.resultat >= 0 ? FARGER.suksess : FARGER.feil} />
        <Kpi lbl="Kjøpekraft" ikon="💰" verdi={fmtNok(k.kjopekraft)} aksent={FARGER.gull} sub="klar til bruk" />
        <Kpi lbl="Antall eiendommer" ikon="🗂" verdi={String(antall)} sub={`${k.antNorge} Norge · ${k.antSpania} Spania`} />
      </div>

      {/* 3. GRAFER + VIKTIGE VARSLER */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 22, alignItems: 'stretch' }}>
        <Kort>
          <KortHode tittel="Kontantstrøm" undertittel="siste 12 mnd">
            <span style={{ fontSize: 20, fontWeight: 700, color: k.resultat >= 0 ? FARGER.suksess : FARGER.feil }}>{fmtNok(k.resultat)}</span>
            <span style={{ fontSize: 12, color: FARGER.tekstLys, marginLeft: 4 }}>/ mnd</span>
          </KortHode>
          <div style={{ display: 'flex', gap: 14, margin: '2px 0 12px', fontSize: 11, color: FARGER.tekstMid }}>
            <Legende farge={FARGER.suksess} tekst="Inntekter" />
            <Legende farge={FARGER.feil} tekst="Kostnader" />
          </div>
          <ResultatGraf serie={hist.resultat_serie} />
        </Kort>

        <Kort>
          <KortHode tittel="Porteføljeverdi">
            <span style={{ fontSize: 20, fontWeight: 700, color: FARGER.mork }}>{fmtKort(k.verdi)}</span>
            {verdiTrend !== null && (
              <span style={{ fontSize: 12, fontWeight: 700, color: verdiTrend >= 0 ? FARGER.suksess : FARGER.feil, marginLeft: 8 }}>
                {verdiTrend >= 0 ? '↑' : '↓'} {Math.abs(verdiTrend).toFixed(1).replace('.', ',')} %
              </span>
            )}
          </KortHode>
          <VerdiGraf serie={hist.verdi_serie} />
        </Kort>

        <Kort>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>Viktige varsler</span>
            {varsler.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: FARGER.feil, background: FARGER.feilBg, borderRadius: RADIUS.pill, padding: '2px 8px' }}>{varsler.length}</span>}
          </div>
          {varsler.length === 0 ? (
            <div style={{ fontSize: 13, color: FARGER.tekstLys, padding: '18px 0', textAlign: 'center' }}>Ingen aktive varsler ✓</div>
          ) : (
            <div style={{ display: 'grid', gap: 2 }}>
              {varsler.slice(0, 5).map((v, i) => (
                <button key={i} onClick={() => onÅpneVarsler?.()}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', background: 'none', border: 'none', borderBottom: i < Math.min(varsler.length, 5) - 1 ? `1px solid ${FARGER.kantUltralys}` : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%' }}>
                  <span style={{ width: 8, height: 8, borderRadius: RADIUS.pill, background: v.farge === 'rod' ? FARGER.feil : FARGER.advarsel, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.navn}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: FARGER.tekstMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.tekst}</span>
                  </span>
                  <span style={{ color: FARGER.tekstSvak, fontSize: 14 }}>›</span>
                </button>
              ))}
            </div>
          )}
          {onÅpneVarsler && (
            <button onClick={() => onÅpneVarsler()} style={{ marginTop: 10, background: 'none', border: 'none', color: FARGER.gull, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Se alle varsler →</button>
          )}
        </Kort>
      </div>

      {/* 4. PORTEFØLJETABELL + SISTE AKTIVITET */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 22, alignItems: 'stretch' }}>
        <div style={{ flex: '2 1 360px', minWidth: 0 }}>
          <Kort>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>Eiendomsportefølje</span>
              {onÅpneEiendom && <button onClick={() => onÅpneEiendom('')} style={{ background: 'none', border: 'none', color: FARGER.gull, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Vis alle →</button>}
            </div>
            {rang.length === 0
              ? <div style={{ fontSize: 13, color: FARGER.tekstLys, padding: '18px 0' }}>Ingen eiendommer i porteføljen ennå.</div>
              : <PortefoljeTabell rader={rang} onÅpne={onÅpneEiendom} />}
          </Kort>
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <Kort>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Siste aktivitet</div>
            {aktivitet.length === 0 ? (
              <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic' }}>Ingen registrert aktivitet ennå.</div>
            ) : (
              <div style={{ display: 'grid', gap: 2 }}>
                {aktivitet.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px', borderBottom: `1px solid ${FARGER.kantUltralys}` }}>
                    <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{HENDELSE_IKON[a.hendelsestype || 'generell'] || '•'}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.handling}
                      {typeof a.detaljer?.navn === 'string' && <span style={{ color: FARGER.tekstMid }}> — {a.detaljer.navn as string}</span>}
                    </span>
                    <span style={{ fontSize: 11, color: FARGER.tekstLys, whiteSpace: 'nowrap' }}>{forSiden(a.tidspunkt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Kort>
        </div>
      </div>

      {/* 5. BESTE / SVAKESTE / AI-ANBEFALING */}
      {(beste || toppHandling) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 22 }}>
          {beste && <EiendomKort r={beste} tone="gronn" merke="Beste investering akkurat nå" tag="Sterk avkastning" onÅpne={onÅpneEiendom} />}
          {svakest && beste && svakest.id !== beste.id && (
            <EiendomKort r={svakest} tone="rod" merke="Svakeste investering" tag={svakest.egenkapital > 0 && (svakest.cashflow_mnd ?? 0) < 0 ? 'Binder kapital' : 'Svak avkastning'} onÅpne={onÅpneEiendom} />
          )}
          <AiAnbefaling handling={toppHandling} onÅpne={onÅpneVarsler} />
        </div>
      )}

      {/* Mål (B11) */}
      <MaalSeksjon selsk={selsk} rang={rang} />
    </div>
  )
}

// ─── Nøkkeltall-kort (lyst) ──────────────────────────────────────────────────
function Kpi({ lbl, ikon, verdi, aksent, sub, trend }: { lbl: string; ikon: string; verdi: string; aksent?: string; sub?: string; trend?: number | null }) {
  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 16, boxShadow: SHADOW.xs }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: FARGER.tekstLys, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</span>
        <span style={{ width: 28, height: 28, borderRadius: RADIUS.pill, background: FARGER.flateLys, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{ikon}</span>
      </div>
      <div style={{ fontSize: 'clamp(17px, 2vw, 21px)', fontWeight: 700, color: aksent || FARGER.mork, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{verdi}</div>
      {trend != null ? (
        <div style={{ fontSize: 11, fontWeight: 600, color: trend >= 0 ? FARGER.suksess : FARGER.feil, marginTop: 4 }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1).replace('.', ',')} % siden forrige vurdering
        </div>
      ) : sub ? (
        <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 4 }}>{sub}</div>
      ) : null}
    </div>
  )
}

// ─── Kort-primitiver ─────────────────────────────────────────────────────────
function Kort({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.lg, padding: 18, boxShadow: SHADOW.xs, height: '100%', boxSizing: 'border-box' }}>
      {children}
    </div>
  )
}

function KortHode({ tittel, undertittel, children }: { tittel: string; undertittel?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork }}>
        {tittel}{undertittel && <span style={{ fontSize: 11, color: FARGER.tekstLys, fontWeight: 400, marginLeft: 6 }}>{undertittel}</span>}
      </span>
      <span>{children}</span>
    </div>
  )
}

function Legende({ farge, tekst }: { farge: string; tekst: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: farge }} />{tekst}</span>
}

function TomGraf({ tekst }: { tekst: string }) {
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: FARGER.tekstLys, fontSize: 11.5, lineHeight: 1.5, padding: '0 8px' }}>
      {tekst}
    </div>
  )
}

// Inntekt (grønn) vs kostnad (rød) per måned. Kun ekte data fra eiendom_cashflow.
function ResultatGraf({ serie }: { serie: Array<{ maaned: string; inntekt: number; kostnad: number; resultat: number }> }) {
  if (serie.length === 0) return <TomGraf tekst="Historikk bygges opp fra nå — logg månedlig cashflow per eiendom." />
  const H = 120, maks = Math.max(1, ...serie.map(s => Math.max(s.inntekt, s.kostnad)))
  const gruppe = 100 / serie.length
  const bw = Math.min(gruppe * 0.32, 6)
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, overflow: 'visible' }}>
      {serie.map((s, i) => {
        const cx = i * gruppe + gruppe / 2
        const hi = (s.inntekt / maks) * (H - 20)
        const hk = (s.kostnad / maks) * (H - 20)
        return (
          <g key={s.maaned}>
            <rect x={cx - bw - 0.6} y={H - hi} width={bw} height={hi} fill={FARGER.suksess} rx={0.6} />
            <rect x={cx + 0.6} y={H - hk} width={bw} height={hk} fill={FARGER.feil} rx={0.6} />
          </g>
        )
      })}
    </svg>
  )
}

// Porteføljeverdi over faktiske verdivurderingsdatoer.
function VerdiGraf({ serie }: { serie: Array<{ dato: string; verdi: number }> }) {
  if (serie.length < 2) return <TomGraf tekst="Historikk bygges opp fra nå — kurven tegnes fra to eller flere verdivurderinger." />
  const H = 120, W = 100
  const min = Math.min(...serie.map(s => s.verdi)), maks = Math.max(...serie.map(s => s.verdi))
  const spenn = maks - min || 1
  const punkt = (s: { verdi: number }, i: number) => ({ x: (i / (serie.length - 1)) * W, y: H - 10 - ((s.verdi - min) / spenn) * (H - 20) })
  const pts = serie.map(punkt)
  const linje = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areal = `0,${H} ${linje} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H }}>
      <polygon points={areal} fill={FARGER.gull} opacity={0.16} />
      <polyline points={linje} fill="none" stroke={FARGER.gullVarm} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const TONER: Record<string, { bg: string; kant: string }> = {
  gronn: { bg: FARGER.suksessBg, kant: FARGER.suksess },
  rod: { bg: FARGER.feilBg, kant: FARGER.feil },
}

function EiendomKort({ r, tone, merke, tag, onÅpne }: { r: RangRad; tone: 'gronn' | 'rod'; merke: string; tag: string; onÅpne?: (id: string) => void }) {
  const t = TONER[tone]
  const ltv = r.samlet_verdi > 0 ? (r.restgjeld / r.samlet_verdi) * 100 : null
  return (
    <button onClick={() => onÅpne?.(r.id)} style={{ background: t.bg, border: `1.5px solid ${t.kant}44`, borderRadius: RADIUS.lg, padding: 18, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxShadow: SHADOW.xs }}>
      <div style={{ fontSize: 10.5, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>{merke}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: FARGER.mork, marginBottom: 10 }}>{r.navn}</div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 12 }}>
        <span><span style={{ color: FARGER.tekstMid }}>Netto/mnd </span><strong style={{ color: (r.cashflow_mnd ?? 0) >= 0 ? FARGER.suksess : FARGER.feil }}>{r.cashflow_mnd !== null ? fmtVal(r.cashflow_mnd, r.valuta) : '–'}</strong></span>
        <span><span style={{ color: FARGER.tekstMid }}>Yield </span><strong style={{ color: FARGER.mork }}>{r.langtid_yield_pst !== null ? r.langtid_yield_pst.toFixed(1) + ' %' : '–'}</strong></span>
        {ltv !== null && <span><span style={{ color: FARGER.tekstMid }}>LTV </span><strong style={{ color: ltv > 85 ? FARGER.feil : FARGER.mork }}>{ltv.toFixed(0)} %</strong></span>}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: RADIUS.pill, background: t.kant, color: FARGER.hvit }}>{tag}</span>
    </button>
  )
}

// Mørkt AI-kort: løfter den viktigste handlingen akkurat nå (fra flaggene, ingen
// egen AI-kall — deterministisk «neste beste handling»).
function AiAnbefaling({ handling, onÅpne }: { handling: { navn: string; farge: 'rod' | 'gul'; tekst: string } | null; onÅpne?: () => void }) {
  return (
    <div style={{ background: FARGER.mork, borderRadius: RADIUS.lg, padding: 18, boxShadow: SHADOW.sm, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>AI-anbefaling for deg</span>
        <span style={{ marginLeft: 'auto', fontSize: 16 }}>🤖</span>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: 'rgba(253,252,247,0.9)', flex: 1 }}>
        {handling
          ? <>{handling.farge === 'rod' ? '🔴' : '🟡'} <strong style={{ color: FARGER.creamLys }}>{handling.navn}:</strong> {handling.tekst}. Se tallgrunnlaget og anbefalt handling.</>
          : 'Ingen kritiske flagg akkurat nå — porteføljen ser sunn ut. Åpne en eiendom for å se beslutningsmotorens anbefaling.'}
      </p>
      {onÅpne && (
        <button onClick={onÅpne} style={{ alignSelf: 'flex-start', background: FARGER.gull, color: FARGER.mork, border: 'none', borderRadius: RADIUS.pill, padding: '9px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          Se anbefalinger →
        </button>
      )}
    </div>
  )
}

function Th({ children, h }: { children: React.ReactNode; h?: boolean }) {
  return <th style={{ textAlign: h ? 'right' : 'left', padding: '8px 10px', fontSize: 10, color: FARGER.tekstLys, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: `1px solid ${FARGER.kantLys}`, whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, h, farge, fet }: { children: React.ReactNode; h?: boolean; farge?: string; fet?: boolean }) {
  return <td style={{ textAlign: h ? 'right' : 'left', padding: '10px', fontSize: 13, color: farge || FARGER.mork, fontWeight: fet ? 700 : 400, whiteSpace: 'nowrap' }}>{children}</td>
}

function PortefoljeTabell({ rader, onÅpne }: { rader: RangRad[]; onÅpne?: (id: string) => void }) {
  const status = (r: RangRad) => r.flagg.some(f => f.farge === 'rod') ? FARGER.feil : r.flagg.some(f => f.farge === 'gul') ? FARGER.advarsel : FARGER.suksess
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            <Th>Eiendom</Th><Th>Land</Th><Th h>Verdi</Th><Th h>Gjeld</Th><Th h>EK</Th><Th h>Leie/mnd</Th><Th h>Netto/mnd</Th><Th h>Yield</Th><Th h>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rader.map(r => (
            <tr key={r.id} onClick={() => onÅpne?.(r.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${FARGER.kantUltralys}` }}>
              <Td fet>{r.navn}</Td>
              <Td>{r.marked === 'norge' ? '🇳🇴' : '🇪🇸'}</Td>
              <Td h>{fmtVal(r.samlet_verdi, r.valuta)}</Td>
              <Td h farge={FARGER.tekstMid}>{fmtVal(r.restgjeld, r.valuta)}</Td>
              <Td h>{fmtVal(r.egenkapital, r.valuta)}</Td>
              <Td h farge={FARGER.tekstMid}>{r.leie_mnd > 0 ? fmtVal(r.leie_mnd, r.valuta) : '–'}</Td>
              <Td h farge={(r.cashflow_mnd ?? 0) >= 0 ? FARGER.suksess : FARGER.feil} fet>{r.cashflow_mnd !== null ? fmtVal(r.cashflow_mnd, r.valuta) : '–'}</Td>
              <Td h>{r.langtid_yield_pst !== null ? r.langtid_yield_pst.toFixed(1) + ' %' : '–'}</Td>
              <Td h><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: RADIUS.pill, background: status(r) }} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
