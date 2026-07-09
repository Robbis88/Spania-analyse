'use client'
import { useEffect, useState } from 'react'
import { FARGER, RADIUS, SHADOW } from '../lib/styles'
import { DagligBrief } from './DagligBrief'

type KonsRad = {
  valuta: string; samlet_verdi: number; restgjeld: number; egenkapital: number
  resultat_mnd: number; antall: number; bundet_ek: number; kjopekraft: number
}
type RangRad = { id: string; navn: string; valuta: string; marked: string; langtid_yield_pst: number | null; cashflow_mnd: number | null }

const fmtVal = (n: number, valuta: string) => (valuta === 'EUR' ? '€' : '') + Math.round(n || 0).toLocaleString('nb-NO') + (valuta === 'EUR' ? '' : ' kr')

export function HjemDashboard({ onÅpneEiendom, onÅpnePortefolje }: { onÅpneEiendom?: (id: string) => void; onÅpnePortefolje?: () => void }) {
  const [kons, setKons] = useState<KonsRad[]>([])
  const [rang, setRang] = useState<RangRad[]>([])

  useEffect(() => {
    fetch('/api/kapital').then(r => r.json()).then(d => setKons(d.konsolidert || [])).catch(() => {})
    fetch('/api/portefolje-rangering').then(r => r.json()).then(d => setRang(d.rader || [])).catch(() => {})
  }, [])

  const medYield = rang.filter(r => typeof r.langtid_yield_pst === 'number')
  const beste = medYield.length ? medYield.reduce((a, b) => (b.langtid_yield_pst! > a.langtid_yield_pst! ? b : a)) : null
  const svakest = medYield.length ? medYield.reduce((a, b) => (b.langtid_yield_pst! < a.langtid_yield_pst! ? b : a)) : null

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 300, color: FARGER.mork, margin: '0 0 20px', letterSpacing: '-0.02em' }}>Hjem</h1>

      {/* Store tall per valuta */}
      {kons.map(k => (
        <div key={k.valuta} style={{ marginBottom: 22 }}>
          {kons.length > 1 && <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.2em', fontWeight: 700, marginBottom: 10 }}>{k.valuta === 'EUR' ? 'SPANIA (EUR)' : 'NORGE (NOK)'}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <StorTall lbl="Porteføljeverdi" verdi={fmtVal(k.samlet_verdi, k.valuta)} />
            <StorTall lbl="Gjeld" verdi={fmtVal(k.restgjeld, k.valuta)} farge={FARGER.feil} />
            <StorTall lbl="Egenkapital" verdi={fmtVal(k.egenkapital, k.valuta)} farge={FARGER.suksess} />
            <StorTall lbl="Resultat / mnd" verdi={fmtVal(k.resultat_mnd, k.valuta)} farge={k.resultat_mnd >= 0 ? FARGER.suksess : FARGER.feil} />
            <StorTall lbl="Kjøpekraft" verdi={fmtVal(k.kjopekraft, k.valuta)} farge={FARGER.gull} />
            <StorTall lbl="Eiendommer" verdi={String(k.antall)} />
          </div>
        </div>
      ))}

      {/* Beste / svakeste */}
      {beste && svakest && beste.id !== svakest.id && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 22 }}>
          <BestKort emoji="🏆" lbl="Best avkastning" r={beste} onÅpne={onÅpneEiendom} farge={FARGER.suksess} />
          <BestKort emoji="⚠️" lbl="Svakest avkastning" r={svakest} onÅpne={onÅpneEiendom} farge={FARGER.feil} />
        </div>
      )}

      {/* Brief + flagg + mål (gjenbruk) */}
      <DagligBrief onÅpnePortefolje={onÅpnePortefolje} />
    </div>
  )
}

function StorTall({ lbl, verdi, farge }: { lbl: string; verdi: string; farge?: string }) {
  return (
    <div style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.05em' }}>{lbl}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: farge || FARGER.mork }}>{verdi}</div>
    </div>
  )
}

function BestKort({ emoji, lbl, r, onÅpne, farge }: { emoji: string; lbl: string; r: RangRad; onÅpne?: (id: string) => void; farge: string }) {
  return (
    <button onClick={() => onÅpne?.(r.id)} style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxShadow: SHADOW.sm }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{emoji} {lbl}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: FARGER.mork, marginBottom: 2 }}>{r.navn}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: farge }}>{r.langtid_yield_pst!.toFixed(1)} %</div>
      <div style={{ fontSize: 11, color: FARGER.tekstLys }}>yield på bundet EK</div>
    </button>
  )
}
