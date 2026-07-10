'use client'
// Regnskap-fane per hus — bank-dossier. Samler de fire delene banken vil se:
//   1) Verdi og belåning (LTV)  2) Cashflow/likviditet
//   3) Årsregnskap (oppstilling per år)  4) Dokumentasjon/vedlegg
// Bygger utelukkende på data som allerede er lastet i useEiendomData + tellinger
// av kvitteringer/dokumenter/bilder. PDF-eksport kobles på i neste steg.
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { FARGER, RADIUS, SHADOW } from '../../../lib/styles'
import {
  sisteVerdi, totalRestgjeld, belaningsgrad,
  gjeldendeLeieMnd, sumKostnaderPerMnd,
  totalRenterMnd, totalAvdragMnd, totalLaanKostnadMnd, cashflowMnd,
  VURDERING_KILDE_ETIKETT,
} from '../../../lib/portefolje'
import { SALGSKOST_PST } from '../../../lib/beslutning'
import type { EiendomData } from '../useEiendomData'
import { SumKort, fmtDato, TomTilstand } from './faneUi'
import { EiendomDokumentImport } from './EiendomDokumentImport'

type Vedlegg = {
  kvitteringer: number
  kvitteringSum: Record<string, number>
  dokumenter: number
  bilder: number
}

export function EiendomRegnskap({ data, onEndret }: { data: EiendomData; onEndret: () => void }) {
  const p = data.prosjekt
  const erSpania = (p?.marked || 'spania') === 'spania'
  const valuta = erSpania ? '€' : 'kr'
  const peng = (n: number | null | undefined) =>
    (n === null || n === undefined || !Number.isFinite(n) || n === 0)
      ? '–'
      : `${Math.round(n).toLocaleString('nb-NO')} ${valuta}`

  const [vedlegg, setVedlegg] = useState<Vedlegg | null>(null)

  useEffect(() => {
    if (!p) return
    let avbrutt = false
    const pid = p.id
    ;(async () => {
      const [k, d, b] = await Promise.all([
        supabase.from('kvitteringer').select('belop_inkl_mva, valuta').eq('prosjekt_id', pid),
        supabase.from('dokumenter').select('id').eq('prosjekt_id', pid),
        supabase.from('prosjekt_bilder').select('id').eq('prosjekt_id', pid),
      ])
      if (avbrutt) return
      const sum: Record<string, number> = {}
      for (const r of (k.data || []) as Array<{ belop_inkl_mva: number | null; valuta: string | null }>) {
        if (r.belop_inkl_mva && r.valuta) sum[r.valuta] = (sum[r.valuta] || 0) + r.belop_inkl_mva
      }
      setVedlegg({
        kvitteringer: (k.data || []).length,
        kvitteringSum: sum,
        dokumenter: (d.data || []).length,
        bilder: (b.data || []).length,
      })
    })()
    return () => { avbrutt = true }
  }, [p])

  // === Kapital nå (ekte) vs forventet ved salg (urealisert) ===
  const kjopesum = p?.kjøpesum || 0
  const kjopskost = p?.kjøpskostnader || 0
  const oppussing = p?.oppussingsbudsjett || 0
  const totalInvestert = kjopesum + kjopskost + oppussing
  const restgjeld = totalRestgjeld(data.laan)
  const innskuttEK = totalInvestert - restgjeld

  // Markedsverdi = ekte verdivurdering hvis lagt inn, ellers kjøpsverdi. ALDRI ARV:
  // forventet salgssum er en prognose og skal ikke blåse opp egenkapital/LTV.
  const ekteVurdering = sisteVerdi(data.verdivurderinger)
  const harVurdering = data.verdivurderinger.length > 0 && ekteVurdering > 0
  const markedsverdi = harVurdering ? ekteVurdering : kjopesum
  const ltv = belaningsgrad(restgjeld, markedsverdi)

  // Forventet ved salg (urealisert) — holdes helt adskilt fra egenkapitalen.
  const arv = p?.forventet_salgsverdi || 0
  const salgskostForventet = arv * (SALGSKOST_PST / 100)
  const forventetGevinst = arv > 0 ? arv - salgskostForventet - totalInvestert : 0

  const leieMnd = gjeldendeLeieMnd(data.inntekter)
  const kostMnd = sumKostnaderPerMnd(data.kostnader)
  const renterMnd = totalRenterMnd(data.laan)
  const avdragMnd = totalAvdragMnd(data.laan)
  const laanMnd = totalLaanKostnadMnd(data.laan)
  const cfMnd = cashflowMnd({ leieMnd, kostnaderMnd: kostMnd, laanMnd })

  // === Årsregnskap fra loggede cashflow-rader (maaned = YYYY-MM) ===
  const aarsregnskap = useMemo(() => {
    const perAar = new Map<string, { inntekt: number; kostnad: number }>()
    for (const rad of data.cashflow) {
      const aar = (rad.maaned || '').slice(0, 4)
      if (!aar) continue
      const eksisterende = perAar.get(aar) || { inntekt: 0, kostnad: 0 }
      eksisterende.inntekt += rad.inntekt || 0
      eksisterende.kostnad += rad.kostnad || 0
      perAar.set(aar, eksisterende)
    }
    return [...perAar.entries()]
      .map(([aar, v]) => ({ aar, ...v, resultat: v.inntekt - v.kostnad }))
      .sort((a, b) => b.aar.localeCompare(a.aar))
  }, [data.cashflow])

  const sisteVurdering = useMemo(() => {
    if (data.verdivurderinger.length === 0) return null
    return [...data.verdivurderinger].sort((a, b) => (b.dato || '').localeCompare(a.dato || ''))[0]
  }, [data.verdivurderinger])

  if (!p) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* 0) DOKUMENTDREVET OPPDATERING */}
      <EiendomDokumentImport data={data} onEndret={onEndret} />

      {/* 1) KAPITAL NÅ (ekte) */}
      <Seksjon tittel="Kapital nå" undertittel="Din egen kapital bundet i boligen i dag — uavhengig av forventet salgsgevinst">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <SumKort lbl="Total investert" verdi={peng(totalInvestert)} />
          <SumKort lbl="Lån (restgjeld)" verdi={peng(restgjeld)} farge={FARGER.feil} />
          <SumKort lbl="Innskutt egenkapital" verdi={peng(innskuttEK)} farge={innskuttEK >= 0 ? '#2D7D46' : FARGER.feil} />
          <SumKort lbl={harVurdering ? 'Belåningsgrad (LTV)' : 'Belåning av kjøpsverdi'} verdi={markedsverdi > 0 ? `${ltv.toFixed(0)} %` : '–'} farge={ltv > 85 ? FARGER.feil : ltv > 70 ? '#B05E0A' : '#2D7D46'} />
        </div>
        <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 10, lineHeight: 1.55 }}>
          Markedsverdi lagt til grunn: <strong>{peng(markedsverdi)}</strong>{' '}
          {harVurdering
            ? `(siste verdivurdering ${fmtDato(sisteVurdering?.dato)}${sisteVurdering?.kilde ? ` · ${VURDERING_KILDE_ETIKETT[sisteVurdering.kilde] || sisteVurdering.kilde}` : ''})`
            : '(kjøpsverdi — legg inn e-takst/verdivurdering under Verdi-fanen for oppdatert markedsverdi)'}
        </div>
      </Seksjon>

      {/* 2) FORVENTET VED SALG (urealisert) */}
      {arv > 0 && (
        <Seksjon tittel="Forventet ved salg" undertittel="Prognose — urealisert til boligen faktisk er solgt">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <SumKort lbl="Forventet salgssum" verdi={peng(arv)} />
            <SumKort lbl="− Salgskostnader" verdi={peng(salgskostForventet)} farge={FARGER.feil} />
            <SumKort lbl="− Total investert" verdi={peng(totalInvestert)} farge={FARGER.feil} />
            <SumKort lbl="Forventet gevinst (før skatt)" verdi={peng(forventetGevinst)} farge={forventetGevinst >= 0 ? '#2D7D46' : FARGER.feil} />
          </div>
          <div style={{ fontSize: 12, color: '#B05E0A', marginTop: 10, lineHeight: 1.55 }}>
            ⚠️ Urealisert — realiseres først ved salg, og teller ikke som egenkapital nå.
          </div>
        </Seksjon>
      )}

      {/* 2) CASHFLOW / LIKVIDITET */}
      <Seksjon tittel="Cashflow / likviditet" undertittel="Løpende, basert på registrert leie, kostnader og lån">
        <div style={{ overflowX: 'auto' }}>
          <table style={tabellStil}>
            <thead>
              <tr>
                <th style={thStil}></th>
                <th style={{ ...thStil, textAlign: 'right' }}>Per måned</th>
                <th style={{ ...thStil, textAlign: 'right' }}>Per år</th>
              </tr>
            </thead>
            <tbody>
              <Rad lbl="Leieinntekter" mnd={leieMnd} peng={peng} />
              <Rad lbl="− Driftskostnader" mnd={-kostMnd} peng={peng} />
              <Rad lbl="− Renter" mnd={-renterMnd} peng={peng} />
              <Rad lbl="− Avdrag (bygger egenkapital)" mnd={-avdragMnd} peng={peng} dempet />
              <Rad lbl="Netto kontantstrøm" mnd={cfMnd} peng={peng} utheving />
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 10, lineHeight: 1.55 }}>
          Netto kontantstrøm = leie − driftskostnader − samlet lånebetaling ({peng(laanMnd)}/mnd). Avdrag er penger ut, men bygger egenkapital.
        </div>
      </Seksjon>

      {/* 3) ÅRSREGNSKAP */}
      <Seksjon tittel="Årsregnskap" undertittel="Oppstilling per år fra registrert månedlig cashflow">
        {aarsregnskap.length === 0 ? (
          <TomTilstand tekst="Ingen årsdata ennå — føres opp etter hvert som du registrerer månedlig cashflow under Cashflow-fanen." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tabellStil}>
              <thead>
                <tr>
                  <th style={thStil}>År</th>
                  <th style={{ ...thStil, textAlign: 'right' }}>Leieinntekter</th>
                  <th style={{ ...thStil, textAlign: 'right' }}>Kostnader</th>
                  <th style={{ ...thStil, textAlign: 'right' }}>Resultat</th>
                </tr>
              </thead>
              <tbody>
                {aarsregnskap.map(r => (
                  <tr key={r.aar}>
                    <td style={tdStil}>{r.aar}</td>
                    <td style={{ ...tdStil, textAlign: 'right' }}>{peng(r.inntekt)}</td>
                    <td style={{ ...tdStil, textAlign: 'right' }}>{peng(r.kostnad)}</td>
                    <td style={{ ...tdStil, textAlign: 'right', fontWeight: 700, color: r.resultat >= 0 ? '#2D7D46' : FARGER.feil }}>{peng(r.resultat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seksjon>

      {/* 4) DOKUMENTASJON / VEDLEGG */}
      <Seksjon tittel="Dokumentasjon / vedlegg" undertittel="Underlag som følger med til banken">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          <SumKort lbl="Kvitteringer" verdi={vedlegg ? String(vedlegg.kvitteringer) : '…'} />
          <SumKort lbl="Dokumenter" verdi={vedlegg ? String(vedlegg.dokumenter) : '…'} />
          <SumKort lbl="Bilder" verdi={vedlegg ? String(vedlegg.bilder) : '…'} />
          <SumKort lbl="Verdivurderinger" verdi={String(data.verdivurderinger.length)} />
        </div>
        {vedlegg && Object.keys(vedlegg.kvitteringSum).length > 0 && (
          <div style={{ fontSize: 13, color: FARGER.tekstMid, marginBottom: 16 }}>
            Sum dokumenterte kvitteringer:{' '}
            <strong>
              {Object.entries(vedlegg.kvitteringSum)
                .map(([v, s]) => `${Math.round(s).toLocaleString('nb-NO')} ${v}`)
                .join(' · ')}
            </strong>
          </div>
        )}
        {data.verdivurderinger.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...data.verdivurderinger]
              .sort((a, b) => (b.dato || '').localeCompare(a.dato || ''))
              .map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, background: FARGER.creamLys, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: '8px 12px' }}>
                  <span style={{ fontWeight: 600, color: FARGER.mork }}>{peng(v.verdi)}</span>
                  <span style={{ color: FARGER.tekstMid }}>{fmtDato(v.dato)}</span>
                  {v.kilde && <span style={{ color: FARGER.tekstLys }}>· {VURDERING_KILDE_ETIKETT[v.kilde] || v.kilde}</span>}
                  {v.filnavn && <span style={{ color: FARGER.gull }}>📎 {v.filnavn}</span>}
                </div>
              ))}
          </div>
        )}
      </Seksjon>

      <div style={{ background: FARGER.creamLys, border: `1px dashed ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 16, fontSize: 13, color: FARGER.tekstMid, lineHeight: 1.55 }}>
        📄 <strong>Bankrapport (PDF)</strong> med alle fire delene samlet kobles på når visningen er godkjent.
      </div>
    </div>
  )
}

function Seksjon({ tittel, undertittel, children }: { tittel: string; undertittel?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 18, boxShadow: SHADOW.xs }}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, margin: 0, letterSpacing: '-0.01em' }}>{tittel}</h3>
        {undertittel && <p style={{ fontSize: 12, color: FARGER.tekstLys, margin: '3px 0 0' }}>{undertittel}</p>}
      </div>
      {children}
    </section>
  )
}

function Rad({ lbl, mnd, peng, utheving, dempet }: { lbl: string; mnd: number; peng: (n: number) => string; utheving?: boolean; dempet?: boolean }) {
  const farge = utheving ? (mnd >= 0 ? '#2D7D46' : FARGER.feil) : dempet ? FARGER.tekstLys : FARGER.mork
  return (
    <tr style={utheving ? { borderTop: `2px solid ${FARGER.kantLys}` } : undefined}>
      <td style={{ ...tdStil, fontWeight: utheving ? 700 : 400, color: dempet ? FARGER.tekstLys : FARGER.tekstMid }}>{lbl}</td>
      <td style={{ ...tdStil, textAlign: 'right', fontWeight: utheving ? 700 : 500, color: farge }}>{peng(mnd)}</td>
      <td style={{ ...tdStil, textAlign: 'right', fontWeight: utheving ? 700 : 500, color: farge }}>{peng(mnd * 12)}</td>
    </tr>
  )
}

const tabellStil: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 360 }
const thStil: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', fontSize: 11, color: FARGER.tekstLys, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, borderBottom: `1px solid ${FARGER.kantLys}` }
const tdStil: React.CSSProperties = { padding: '8px 10px', color: FARGER.mork, borderBottom: `1px solid ${FARGER.flateMid}` }
