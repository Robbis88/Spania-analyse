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

export function HjemDashboard({ onÅpneEiendom }: { onÅpneEiendom?: (id: string) => void; onÅpnePortefolje?: () => void }) {
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
  const alleFlagg = rang.flatMap(r => r.flagg.map(f => ({ navn: r.navn, ...f })))

  const kontekst = useMemo(() => {
    if (kons.length === 0) return ''
    const flaggTekst = alleFlagg.length ? alleFlagg.map(f => `${f.farge === 'rod' ? 'RØD' : 'GUL'} ${f.navn}: ${f.tekst}`).join('; ') : 'ingen flagg'
    return [
      `Konsern (omregnet til NOK, kurs 1 € = ${kurs.toFixed(2)} kr):`,
      `Porteføljeverdi ${fmtNok(k.verdi)}, gjeld ${fmtNok(k.gjeld)}, egenkapital ${fmtNok(k.ek)} (låst ${fmtNok(k.bundet)}, fri likviditet ${fmtNok(k.fri)}), resultat/mnd ${fmtNok(k.resultat)}, kjøpekraft ${fmtNok(k.kjopekraft)}.`,
      `${antall} eiendommer (${k.antNorge} Norge / ${k.antSpania} Spania).`,
      beste ? `Beste: ${beste.navn} ${beste.langtid_yield_pst!.toFixed(1)} % yield på bundet EK.` : '',
      svakest && svakest.id !== beste?.id ? `Svakeste: ${svakest.navn} ${svakest.langtid_yield_pst!.toFixed(1)} %.` : '',
      `Flagg: ${flaggTekst}.`,
    ].filter(Boolean).join(' ')
  }, [kons, k, kurs, antall, beste, svakest, alleFlagg])

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 300, color: FARGER.mork, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Hjem</h1>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 22px' }}>Investorkontrollrom — hele konsernet i ett blikk.</p>

      {/* 1. KONSERN-KONTROLLROM */}
      <div style={{ background: FARGER.mork, borderRadius: RADIUS.xl, padding: 'clamp(18px, 3vw, 28px)', marginBottom: 22, boxShadow: SHADOW.lg }}>
        <div style={{ fontSize: 10, color: FARGER.gull, letterSpacing: '0.24em', fontWeight: 700, marginBottom: 16 }}>KONSERN · ALLE SELSKAP</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
          <Kpi lbl="Porteføljeverdi" verdi={fmtNok(k.verdi)} />
          <Kpi lbl="Total gjeld" verdi={fmtNok(k.gjeld)} farge={FARGER.feil} />
          <Kpi lbl="Egenkapital" verdi={fmtNok(k.ek)} farge={FARGER.suksess} sub={`låst ${fmtKort(k.bundet)} · fri ${fmtKort(k.fri)}`} />
          <Kpi lbl="Resultat / mnd" verdi={fmtNok(k.resultat)} farge={k.resultat >= 0 ? FARGER.suksess : FARGER.feil} />
          <Kpi lbl="Fri kapital" verdi={fmtNok(k.fri)} sub="klar til bruk" />
          <Kpi lbl="Kjøpekraft" verdi={fmtNok(k.kjopekraft)} farge={FARGER.gull} sub="potensial" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <GrafPanel tittel="Resultat siste 12 mnd">
            <ResultatGraf serie={hist.resultat_serie} />
          </GrafPanel>
          <GrafPanel tittel="Porteføljeverdi">
            <VerdiGraf serie={hist.verdi_serie} />
          </GrafPanel>
          <GrafPanel tittel="Fordeling eiendommer">
            <Donut norge={k.antNorge} spania={k.antSpania} />
          </GrafPanel>
        </div>
      </div>

      {/* 2. KORT FORTALT */}
      <KortFortalt tittel="Hjem — konsern" kontekst={kontekst} />

      {/* 3. RASKE INNSIKTER */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Innsikt ikon={k.resultat >= 0 ? '✓' : '⚠'} tone={k.resultat >= 0 ? 'gronn' : 'rod'} lbl="Kontantstrøm"
          verdi={k.resultat >= 0 ? 'Positiv' : 'Negativ'} sub={`${fmtNok(k.resultat)} / mnd`} />
        <Innsikt ikon="🔒" tone="gul" lbl="Låst egenkapital" verdi={fmtNok(k.bundet)} sub="bundet i eiendom" />
        <Innsikt ikon={renteEksponert > 0 ? '⚠' : '✓'} tone={renteEksponert > 0 ? 'rod' : 'gronn'} lbl="Renteeksponering"
          verdi={renteEksponert > 0 ? `${renteEksponert} eiendom${renteEksponert > 1 ? 'mer' : ''}` : 'Robust'}
          sub={renteEksponert > 0 ? 'negativ ved +3pp rente' : 'tåler rentesjokk'} />
        <Innsikt ikon="◆" tone="noytral" lbl="Kjøpekraft" verdi={fmtNok(k.kjopekraft)} sub="klar til bruk" />
      </div>

      {/* 4. BESTE / SVAKESTE */}
      {beste && svakest && beste.id !== svakest.id && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 22 }}>
          <EiendomKort r={beste} tone="gronn" merke="Beste eiendom" tag="Sterk avkastning" onÅpne={onÅpneEiendom} />
          <EiendomKort r={svakest} tone="rod" merke="Svakeste eiendom" tag={svakest.egenkapital > 0 && (svakest.cashflow_mnd ?? 0) < 0 ? 'Binder kapital' : 'Svak avkastning'} onÅpne={onÅpneEiendom} />
        </div>
      )}

      {/* 5. + 6. Aktivitet + tabell */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22, marginBottom: 22, alignItems: 'start' }}>
        <div style={{ gridColumn: rang.length > 0 ? 'auto' : '1 / -1' }}>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Siste aktivitet</div>
          {aktivitet.length === 0 ? (
            <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic' }}>Ingen registrert aktivitet ennå.</div>
          ) : (
            <div style={{ display: 'grid', gap: 2 }}>
              {aktivitet.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: `1px solid ${FARGER.kantUltralys}` }}>
                  <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{HENDELSE_IKON[a.hendelsestype || 'generell'] || '•'}</span>
                  <span style={{ flex: 1, fontSize: 13, color: FARGER.mork }}>
                    {a.handling}
                    {typeof a.detaljer?.navn === 'string' && <span style={{ color: FARGER.tekstMid }}> — {a.detaljer.navn as string}</span>}
                  </span>
                  <span style={{ fontSize: 11, color: FARGER.tekstLys, whiteSpace: 'nowrap' }}>{forSiden(a.tidspunkt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {rang.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Eiendomsportefølje</div>
            <PortefoljeTabell rader={rang} onÅpne={onÅpneEiendom} />
          </div>
        )}
      </div>

      {/* Mål (B11) */}
      <MaalSeksjon selsk={selsk} rang={rang} />
    </div>
  )
}

function Kpi({ lbl, verdi, farge, sub }: { lbl: string; verdi: string; farge?: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(253,252,247,0.55)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 'clamp(18px, 2.2vw, 23px)', fontWeight: 700, color: farge || FARGER.creamLys, letterSpacing: '-0.01em', lineHeight: 1.1 }}>{verdi}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(253,252,247,0.5)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function GrafPanel({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(253,252,247,0.04)', border: '1px solid rgba(253,252,247,0.08)', borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 10, color: 'rgba(253,252,247,0.6)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>{tittel}</div>
      {children}
    </div>
  )
}

function TomGraf({ tekst }: { tekst: string }) {
  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(253,252,247,0.4)', fontSize: 11.5, lineHeight: 1.5, padding: '0 8px' }}>
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
      <polygon points={areal} fill={FARGER.gull} opacity={0.18} />
      <polyline points={linje} fill="none" stroke={FARGER.gullVarm} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Donut({ norge, spania }: { norge: number; spania: number }) {
  const total = norge + spania
  if (total === 0) return <TomGraf tekst="Ingen eiendommer registrert ennå." />
  const r = 34, C = 2 * Math.PI * r
  const nAndel = norge / total
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, justifyContent: 'center' }}>
      <svg viewBox="0 0 90 90" style={{ width: 100, height: 100 }}>
        <circle cx={45} cy={45} r={r} fill="none" stroke={FARGER.gull} strokeWidth={11} strokeDasharray={`${C * nAndel} ${C}`} transform="rotate(-90 45 45)" />
        <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(253,252,247,0.22)" strokeWidth={11} strokeDasharray={`${C * (1 - nAndel)} ${C}`} strokeDashoffset={-C * nAndel} transform="rotate(-90 45 45)" />
        <text x={45} y={44} textAnchor="middle" fontSize={17} fontWeight={700} fill={FARGER.creamLys}>{total}</text>
        <text x={45} y={57} textAnchor="middle" fontSize={7} fill="rgba(253,252,247,0.6)">totalt</text>
      </svg>
      <div style={{ fontSize: 11.5, color: 'rgba(253,252,247,0.85)', display: 'grid', gap: 6 }}>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: FARGER.gull, marginRight: 7 }} />Norge · {norge}</span>
        <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'rgba(253,252,247,0.22)', marginRight: 7 }} />Spania · {spania}</span>
      </div>
    </div>
  )
}

const TONER: Record<string, { bg: string; kant: string; ikon: string }> = {
  gronn: { bg: FARGER.suksessBg, kant: FARGER.suksess, ikon: FARGER.suksess },
  rod: { bg: FARGER.feilBg, kant: FARGER.feil, ikon: FARGER.feil },
  gul: { bg: FARGER.advarselBg, kant: FARGER.advarsel, ikon: FARGER.advarsel },
  noytral: { bg: FARGER.hvit, kant: FARGER.gull, ikon: FARGER.gull },
}

function Innsikt({ ikon, tone, lbl, verdi, sub }: { ikon: string; tone: string; lbl: string; verdi: string; sub: string }) {
  const t = TONER[tone] || TONER.noytral
  return (
    <div style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderTop: `3px solid ${t.kant}`, borderRadius: RADIUS.md, padding: 16, boxShadow: SHADOW.xs }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: RADIUS.pill, background: t.bg, color: t.ikon, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{ikon}</span>
        <span style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.02em' }}>{lbl}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: FARGER.mork, marginBottom: 2 }}>{verdi}</div>
      <div style={{ fontSize: 11, color: FARGER.tekstLys }}>{sub}</div>
    </div>
  )
}

function EiendomKort({ r, tone, merke, tag, onÅpne }: { r: RangRad; tone: 'gronn' | 'rod'; merke: string; tag: string; onÅpne?: (id: string) => void }) {
  const t = TONER[tone]
  const ltv = r.samlet_verdi > 0 ? (r.restgjeld / r.samlet_verdi) * 100 : null
  return (
    <button onClick={() => onÅpne?.(r.id)} style={{ background: t.bg, border: `1.5px solid ${t.kant}44`, borderRadius: RADIUS.lg, padding: 18, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxShadow: SHADOW.sm }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>{merke}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: FARGER.mork, marginBottom: 10 }}>{r.navn}</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, marginBottom: 12 }}>
        <span><span style={{ color: FARGER.tekstMid }}>Netto/mnd </span><strong style={{ color: (r.cashflow_mnd ?? 0) >= 0 ? FARGER.suksess : FARGER.feil }}>{r.cashflow_mnd !== null ? fmtVal(r.cashflow_mnd, r.valuta) : '–'}</strong></span>
        <span><span style={{ color: FARGER.tekstMid }}>Yield </span><strong style={{ color: FARGER.mork }}>{r.langtid_yield_pst !== null ? r.langtid_yield_pst.toFixed(1) + ' %' : '–'}</strong></span>
        {ltv !== null && <span><span style={{ color: FARGER.tekstMid }}>LTV </span><strong style={{ color: ltv > 85 ? FARGER.feil : FARGER.mork }}>{ltv.toFixed(0)} %</strong></span>}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: RADIUS.pill, background: t.kant, color: FARGER.hvit }}>{tag}</span>
    </button>
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
    <div style={{ overflowX: 'auto', background: FARGER.hvit, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, boxShadow: SHADOW.xs }}>
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
