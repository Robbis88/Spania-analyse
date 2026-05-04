'use client'
import { FARGER, RADIUS } from '../../../lib/styles'
import {
  belaningsgrad, bruttoYield, cashflowMnd, gjeldendeLeieMnd, sisteVerdi,
  sumKostnaderPerMnd, totalLaanKostnadMnd, totalRestgjeld,
} from '../../../lib/portefolje'
import type { EiendomData } from '../useEiendomData'

const fmtNok = (n: number) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'
const fmtPct = (n: number) => Number.isFinite(n) ? n.toFixed(1) + '%' : '–'

export function EiendomOversikt({ data }: { data: EiendomData }) {
  const p = data.prosjekt
  if (!p) return null

  const verdi = sisteVerdi(data.verdivurderinger) || (typeof p.forventet_salgsverdi === 'number' ? p.forventet_salgsverdi : 0)
  const restgjeld = totalRestgjeld(data.laan)
  const ek = verdi - restgjeld
  const kjopspris = (p.kjøpesum || 0) + (p.kjøpskostnader || 0)
  const verdiokning = verdi - kjopspris
  const verdiokningPct = kjopspris > 0 ? (verdiokning / kjopspris) * 100 : 0
  const ltv = belaningsgrad(restgjeld, verdi)

  const leieMnd = gjeldendeLeieMnd(data.inntekter)
  const kostnaderMnd = sumKostnaderPerMnd(data.kostnader)
  const laanMnd = totalLaanKostnadMnd(data.laan)
  const cf = cashflowMnd({ leieMnd, kostnaderMnd, laanMnd })
  const arsCashflow = cf * 12
  const yieldB = bruttoYield(leieMnd, verdi)
  // ROI: årlig cashflow / egenkapital
  const roi = ek > 0 ? (arsCashflow / ek) * 100 : 0

  return (
    <div>
      {/* Stort nøkkel-grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <KpiKort lbl="Estimert verdi" stor={fmtNok(verdi)} />
        <KpiKort lbl="Restgjeld" stor={fmtNok(restgjeld)} />
        <KpiKort lbl="Egenkapital" stor={fmtNok(ek)} farge={ek >= 0 ? FARGER.suksess : FARGER.feil} />
        <KpiKort lbl="LTV (belåningsgrad)" stor={fmtPct(ltv)} farge={ltv > 85 ? FARGER.feil : ltv > 75 ? FARGER.advarsel : FARGER.suksess} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <KpiKort lbl="Cashflow / mnd" stor={fmtNok(cf)} farge={cf >= 0 ? FARGER.suksess : FARGER.feil} />
        <KpiKort lbl="Cashflow / år" stor={fmtNok(arsCashflow)} farge={arsCashflow >= 0 ? FARGER.suksess : FARGER.feil} />
        <KpiKort lbl="Brutto yield" stor={fmtPct(yieldB)} liten={`${fmtNok(leieMnd * 12)} / år`} />
        <KpiKort lbl="ROI på EK" stor={fmtPct(roi)} farge={roi >= 0 ? FARGER.suksess : FARGER.feil} liten="årlig cashflow / EK" />
      </div>

      {/* Verdiøkning */}
      {kjopspris > 0 && (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            Verdiutvikling
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <Linje lbl="Kjøpspris (inkl. omkostninger)" verdi={fmtNok(kjopspris)} />
            <Linje lbl="Estimert verdi i dag" verdi={fmtNok(verdi)} />
            <Linje lbl="Verdiøkning"
              verdi={fmtNok(verdiokning)}
              farge={verdiokning >= 0 ? FARGER.suksess : FARGER.feil} />
            <Linje lbl="Verdiøkning %"
              verdi={fmtPct(verdiokningPct)}
              farge={verdiokning >= 0 ? FARGER.suksess : FARGER.feil} />
          </div>
        </div>
      )}

      {/* Månedlig oversikt */}
      <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Månedlig oversikt
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 16px', fontSize: 14 }}>
          <span style={{ color: FARGER.tekstMid }}>Leieinntekt</span>
          <span style={{ fontWeight: 600, color: FARGER.suksess, textAlign: 'right' }}>{fmtNok(leieMnd)}</span>
          <span style={{ color: FARGER.tekstMid }}>Driftskostnader</span>
          <span style={{ fontWeight: 600, color: FARGER.feil, textAlign: 'right' }}>−{fmtNok(kostnaderMnd)}</span>
          <span style={{ color: FARGER.tekstMid }}>Lånekostnader</span>
          <span style={{ fontWeight: 600, color: FARGER.feil, textAlign: 'right' }}>−{fmtNok(laanMnd)}</span>
          <span style={{ color: FARGER.mork, fontWeight: 700, paddingTop: 8, borderTop: `1px solid ${FARGER.kantLys}` }}>Cashflow</span>
          <span style={{ fontWeight: 700, color: cf >= 0 ? FARGER.suksess : FARGER.feil, textAlign: 'right', paddingTop: 8, borderTop: `1px solid ${FARGER.kantLys}` }}>{fmtNok(cf)}</span>
        </div>
      </div>

      {/* Datakilder-stripe */}
      <div style={{ fontSize: 11, color: FARGER.tekstLys, fontStyle: 'italic', textAlign: 'center', padding: 8 }}>
        {data.verdivurderinger.length === 0 && '⚠️ Ingen verdivurderinger registrert — bruker «forventet salgsverdi» fra prosjektet · '}
        {data.laan.length === 0 && '⚠️ Ingen lån registrert · '}
        {data.inntekter.length === 0 && '⚠️ Ingen leiekontrakter registrert · '}
        {data.kostnader.length === 0 && '⚠️ Ingen driftskostnader registrert'}
      </div>
    </div>
  )
}

function KpiKort({ lbl, stor, liten, farge }: { lbl: string; stor: string; liten?: string; farge?: string }) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4 }}>{lbl}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: farge || FARGER.mork }}>{stor}</div>
      {liten && <div style={{ fontSize: 11, color: FARGER.tekstMid, marginTop: 4 }}>{liten}</div>}
    </div>
  )
}

function Linje({ lbl, verdi, farge }: { lbl: string; verdi: string; farge?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 2 }}>{lbl}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: farge || FARGER.mork }}>{verdi}</div>
    </div>
  )
}
