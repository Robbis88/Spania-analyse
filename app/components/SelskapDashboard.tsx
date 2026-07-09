'use client'
import { useEffect, useMemo, useState } from 'react'
import { FARGER, RADIUS, SHADOW } from '../lib/styles'
import { STRATEGI_ETIKETT, type Strategi } from '../lib/strategi'
import { useEurNokKurs } from '../lib/valuta'
import { KortFortalt } from './KortFortalt'

type SelskRad = {
  id: string; navn: string; valuta: string; antall_eiendommer: number
  samlet_verdi: number; restgjeld: number; egenkapital: number; resultat_mnd: number
  bundet_ek: number; frigjorbar_refi: number; kjopekraft: number
  konsern_fordring: number; konsern_gjeld: number; paalopte_renter_fordring: number
}
type RangRad = {
  id: string; navn: string; selskap_id: string | null; strategi: string; valuta: string
  langtid_yield_pst: number | null; cashflow_mnd: number | null; bundet_ek: number
  flagg: Array<{ farge: 'rod' | 'gul'; tekst: string }>
}

const GRUPPER: Array<{ key: Strategi; lbl: string }> = [
  { key: 'flipp', lbl: STRATEGI_ETIKETT.flipp },
  { key: 'langtid', lbl: STRATEGI_ETIKETT.langtid },
  { key: 'korttid', lbl: STRATEGI_ETIKETT.korttid },
  { key: 'uavklart', lbl: STRATEGI_ETIKETT.uavklart },
]

const fmt = (n: number, valuta: string) => (valuta === 'EUR' ? '€' : '') + Math.round(n || 0).toLocaleString('nb-NO') + (valuta === 'EUR' ? '' : ' kr')

export function SelskapDashboard({ selskapId, navn, land, onÅpne }: { selskapId: string; navn: string; land: 'norge' | 'spania'; onÅpne?: (id: string) => void }) {
  const [selsk, setSelsk] = useState<SelskRad | null>(null)
  const [rang, setRang] = useState<RangRad[]>([])
  const [laster, setLaster] = useState(true)
  const eurNok = useEurNokKurs()

  useEffect(() => {
    Promise.all([
      fetch('/api/kapital').then(r => r.json()).catch(() => ({})),
      fetch('/api/portefolje-rangering').then(r => r.json()).catch(() => ({})),
    ]).then(([k, r]) => {
      setSelsk((k.selskaper || []).find((s: SelskRad) => s.id === selskapId) || null)
      setRang((r.rader || []).filter((x: RangRad) => x.selskap_id === selskapId))
      setLaster(false)
    })
  }, [selskapId])

  const valuta = selsk?.valuta || (land === 'norge' ? 'NOK' : 'EUR')

  const kontekst = useMemo(() => {
    if (laster || !selsk) return ''
    const hoved = `${navn} (${land}). Eiendomsverdi ${fmt(selsk.samlet_verdi, valuta)}, gjeld ${fmt(selsk.restgjeld, valuta)}, egenkapital ${fmt(selsk.egenkapital, valuta)} (bundet ${fmt(selsk.bundet_ek, valuta)}), resultat/mnd ${fmt(selsk.resultat_mnd, valuta)}, kjøpekraft ${fmt(selsk.kjopekraft, valuta)}, refinansieringspotensial ${fmt(selsk.frigjorbar_refi, valuta)}, ${selsk.antall_eiendommer} eiendom(mer).`
    const perStrategi = GRUPPER.map(g => {
      const n = rang.filter(r => r.strategi === g.key).length
      return n > 0 ? `${g.lbl}: ${n}` : ''
    }).filter(Boolean).join(', ')
    const flagg = rang.flatMap(r => r.flagg.map(f => `${f.farge === 'rod' ? 'RØD' : 'GUL'} · ${r.navn}: ${f.tekst}`))
    return [hoved, perStrategi && `Eiendommer per strategi: ${perStrategi}.`, flagg.length ? `Flagg:\n${flagg.join('\n')}` : 'Ingen flagg.'].filter(Boolean).join('\n')
  }, [laster, selsk, rang, navn, land, valuta])

  if (laster) return <div style={{ padding: 40, color: FARGER.tekstLys }}>Laster {navn}…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 24 }}>{land === 'norge' ? '🇳🇴' : '🇪🇸'}</span>
        <h1 style={{ fontSize: 28, fontWeight: 300, color: FARGER.mork, margin: 0, letterSpacing: '-0.02em' }}>{navn}</h1>
      </div>

      <KortFortalt tittel={navn} kontekst={kontekst} />

      {selsk && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 24 }}>
          <Tall lbl="Eiendomsverdi" v={fmt(selsk.samlet_verdi, valuta)} />
          <Tall lbl="Gjeld" v={fmt(selsk.restgjeld, valuta)} farge={FARGER.feil} />
          <Tall lbl="Egenkapital" v={fmt(selsk.egenkapital, valuta)} farge={FARGER.suksess} />
          <Tall lbl="Resultat / mnd" v={fmt(selsk.resultat_mnd, valuta)} farge={selsk.resultat_mnd >= 0 ? FARGER.suksess : FARGER.feil} />
          <Tall lbl="Kjøpekraft" v={fmt(selsk.kjopekraft, valuta)} farge={FARGER.gull} />
          <Tall lbl="Refinansieringspotensial" v={fmt(selsk.frigjorbar_refi, valuta)} />
        </div>
      )}

      {/* Spania-særtrekk (C6): valuta EUR + NOK + valutarisiko */}
      {land === 'spania' && selsk && (
        <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 14, fontSize: 13, color: FARGER.tekstMid }}>
          💱 Kurs 1 € = {eurNok.toFixed(2)} kr · Egenkapital ~{(selsk.egenkapital * eurNok / 1_000_000).toFixed(1).replace('.', ',')} MNOK ·
          valutarisiko ±5 % = ±{Math.round(selsk.egenkapital * eurNok * 0.05).toLocaleString('nb-NO')} kr
        </div>
      )}

      {/* Spania-særtrekk (C6): konsernlån */}
      {land === 'spania' && selsk && selsk.konsern_gjeld > 0 && (
        <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 20, fontSize: 13, color: FARGER.tekstMid }}>
          🏦 Konsernlån fra Loeiendom AS: <strong>{fmt(selsk.konsern_gjeld, valuta)}</strong>
          {selsk.paalopte_renter_fordring > 0 ? ` · påløpte renter ${fmt(selsk.paalopte_renter_fordring, valuta)}` : ''}
        </div>
      )}

      {/* Eiendomskort gruppert på strategi */}
      {GRUPPER.map(g => {
        const iGruppe = rang.filter(r => r.strategi === g.key)
        if (iGruppe.length === 0) return null
        return (
          <div key={g.key} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.2em', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>{g.lbl} ({iGruppe.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {iGruppe.map(r => (
                <button key={r.id} onClick={() => onÅpne?.(r.id)} style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', boxShadow: SHADOW.sm }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, marginBottom: 6 }}>{r.navn}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: FARGER.tekstMid }}>Yield på EK</span>
                    <span style={{ fontWeight: 700, color: r.langtid_yield_pst === null ? FARGER.tekstLys : r.langtid_yield_pst < 6 ? FARGER.feil : FARGER.suksess }}>
                      {r.langtid_yield_pst === null ? '–' : r.langtid_yield_pst.toFixed(1) + ' %'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: FARGER.tekstLys }}>
                    <span>Cashflow/mnd</span><span>{r.cashflow_mnd !== null ? fmt(r.cashflow_mnd, valuta) : '–'}</span>
                  </div>
                  {r.flagg.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.flagg.slice(0, 2).map((f, i) => (
                        <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: RADIUS.pill, background: f.farge === 'rod' ? FARGER.feilBg : FARGER.advarselBg, color: f.farge === 'rod' ? FARGER.feil : FARGER.advarsel }}>{f.tekst}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {rang.length === 0 && (
        <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 30, textAlign: 'center', color: FARGER.tekstLys, fontSize: 13 }}>
          Ingen eiendommer registrert på {navn} ennå.
        </div>
      )}
    </div>
  )
}

function Tall({ lbl, v, farge }: { lbl: string; v: string; farge?: string }) {
  return (
    <div style={{ background: FARGER.hvit, border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.05em' }}>{lbl}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: farge || FARGER.mork }}>{v}</div>
    </div>
  )
}
