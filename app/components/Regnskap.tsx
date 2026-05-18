'use client'
import { useState } from 'react'
import { useProsjekter } from '../lib/useProsjekter'
import { type Prosjekt, tomtProsjekt } from '../types'
import { totalInvestering, månedligKostnad, månedligCashflow, yield_pst, roi } from '../lib/beregninger'
import { fmt, statusFarge, FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { ProsjektFelter } from './ProsjektFelter'
import { Oppussingsbudsjett } from './Oppussingsbudsjett'
import { Utleieanalyse } from './Utleieanalyse'
import { SendteEposter } from './SendteEposter'
import { ProsjektBilder } from './ProsjektBilder'
import { UtleiePortalAdmin } from './UtleiePortalAdmin'
import { Kvitteringer } from './Kvitteringer'
import { Dokumenter } from './Dokumenter'
import { Salgspakke } from './Salgspakke'
import { TilbudHistorikk } from './TilbudHistorikk'
import { ProsjektDialog } from './ProsjektDialog'
import { NesteSteg } from './NesteSteg'
import { lastNedPDF, byggProsjektPdf } from '../lib/pdf'
import { visToast } from '../lib/toast'
import { supabase } from '../lib/supabase'

const tilbakeStil: React.CSSProperties = {
  background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
  borderRadius: RADIUS.pill, padding: '8px 16px 8px 12px',
  fontSize: 13, cursor: 'pointer', marginBottom: 22,
  color: FARGER.tekstMid, fontWeight: 500,
  boxShadow: SHADOW.xs,
  display: 'inline-flex', alignItems: 'center', gap: 6,
  letterSpacing: '-0.005em',
}

const handlingsKnapp = (variant: 'primer' | 'gull' | 'suksess' | 'graa', disabled = false): React.CSSProperties => {
  const palett = {
    primer: { bg: FARGER.mork, color: FARGER.creamLys },
    gull: { bg: FARGER.gull, color: FARGER.creamLys },
    suksess: { bg: '#2D7D46', color: FARGER.creamLys },
    graa: { bg: FARGER.hvit, color: FARGER.tekstMid },
  }[variant]
  return {
    background: disabled ? FARGER.tekstLys : palett.bg,
    color: palett.color,
    border: variant === 'graa' ? `1px solid ${FARGER.kantUltralys}` : 'none',
    borderRadius: RADIUS.pill, padding: '9px 18px',
    fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: '-0.005em',
    boxShadow: disabled ? 'none' : SHADOW.sm,
    transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
  }
}

export function Regnskap({
  onTilbake, visProsjektId, onSettVisProsjekt,
}: {
  onTilbake: () => void
  visProsjektId: string | null
  onSettVisProsjekt: (id: string | null) => void
}) {
  const { prosjekter, laster, leggTil, oppdater, slett, hent } = useProsjekter()
  const [nyttProsjekt, setNyttProsjekt] = useState<Prosjekt>(tomtProsjekt())
  const [visNyttSkjema, setVisNyttSkjema] = useState(false)
  const [redigerProsjekt, setRedigerProsjekt] = useState<Prosjekt | null>(null)
  const [aktivTab, setAktivTab] = useState<'oversikt' | 'arsrapport' | 'oppussing' | 'utleie' | 'portal' | 'kvitteringer' | 'dokumenter' | 'forespørsler' | 'dialog'>('oversikt')
  const [valgtAr, setValgtAr] = useState(new Date().getFullYear())
  const [pdfFremdrift, setPdfFremdrift] = useState('')
  const [salgspakkeApen, setSalgspakkeApen] = useState(false)

  async function leggTilProsjekt() {
    if (!nyttProsjekt.navn) return
    await leggTil(nyttProsjekt)
    setNyttProsjekt(tomtProsjekt())
    setVisNyttSkjema(false)
    visToast('Prosjekt opprettet')
  }

  async function lagreRedigering() {
    if (!redigerProsjekt) return
    await oppdater(redigerProsjekt)
    setRedigerProsjekt(null)
    visToast('Endringer lagret')
  }

  async function lastNedProsjektPdf(prosjektId: string, prosjektNavn: string) {
    setPdfFremdrift('Starter…')
    try {
      const pdf = await byggProsjektPdf(prosjektId, supabase, (fase, steg, totalt) => {
        setPdfFremdrift(totalt && steg ? `${fase} (${steg}/${totalt})` : fase)
      })
      if (!pdf) {
        visToast('PDF-bygging feilet — prosjektdata ikke funnet', 'feil')
        return
      }
      const byter = atob(pdf.base64)
      const u8 = new Uint8Array(byter.length)
      for (let i = 0; i < byter.length; i++) u8[i] = byter.charCodeAt(i)
      const blob = new Blob([u8], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdf.filnavn
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      visToast(`PDF lastet ned: ${pdf.filnavn}`)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      visToast('PDF-bygging feilet: ' + m, 'feil', 5000)
    } finally {
      setPdfFremdrift('')
    }
    void prosjektNavn
  }

  async function slettProsjekt(id: string) {
    if (!confirm('Slett prosjektet? Dette kan ikke angres.')) return
    await slett(id)
    if (visProsjektId === id) onSettVisProsjekt(null)
    visToast('Prosjekt slettet')
  }

  return (
    <div>
      <button onClick={() => { onTilbake(); onSettVisProsjekt(null); setVisNyttSkjema(false); setRedigerProsjekt(null) }} className="nav-lenke" style={tilbakeStil}>
        <span aria-hidden>←</span> Tilbake
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 40 }}>📊</div>
          <div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>Regnskap</h2>
            <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14 }}>Alle eiendomsprosjekter</p>
          </div>
        </div>
        {!visProsjektId && <button onClick={() => setVisNyttSkjema(!visNyttSkjema)} className="knapp-hover-loft" style={handlingsKnapp('primer')}>+ Nytt prosjekt</button>}
      </div>

      {laster && (
        <div>
          {[0, 1].map(i => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 14, boxShadow: SHADOW.sm }}>
              <div className="skimmer" style={{ height: 18, width: '40%', marginBottom: 14, borderRadius: 4 }} />
              <div className="skimmer" style={{ height: 50, borderRadius: RADIUS.md }} />
            </div>
          ))}
        </div>
      )}

      {prosjekter.length > 0 && !visProsjektId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { lbl: '🏠 Prosjekter', val: prosjekter.length.toString() },
            { lbl: '💰 Total investert', val: fmt(prosjekter.reduce((s, p) => s + totalInvestering(p), 0)) },
            { lbl: '📈 Cashflow/mnd', val: fmt(prosjekter.reduce((s, p) => s + månedligCashflow(p), 0)) },
            { lbl: '✅ Aktive utleier', val: prosjekter.filter(p => p.status === 'Utleie').length.toString() },
          ].map((item, i) => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 16, boxShadow: SHADOW.sm }}>
              <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{item.lbl}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.02em' }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {visNyttSkjema && !visProsjektId && (
        <div className="anim-fade-up" style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gull}33`, borderRadius: RADIUS.lg, padding: 26, marginBottom: 24, boxShadow: SHADOW.sm }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 18, color: FARGER.mork, letterSpacing: '-0.015em' }}>Nytt prosjekt</h3>
          <ProsjektFelter data={nyttProsjekt} onChange={setNyttProsjekt} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={leggTilProsjekt} className="knapp-hover-loft" style={{ ...handlingsKnapp('primer'), flex: 1, padding: 14, fontSize: 14 }}>✅ Lagre prosjekt</button>
            <button onClick={() => setVisNyttSkjema(false)} style={{ ...handlingsKnapp('graa'), padding: '14px 22px', fontSize: 14 }}>Avbryt</button>
          </div>
        </div>
      )}

      {!visProsjektId && prosjekter.map((p, i) => {
        const sf = statusFarge(p.status)
        const cf = månedligCashflow(p)
        return (
          <div key={p.id} className="kort-loft anim-fade-up" style={{
            background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.lg, padding: 22, marginBottom: 14,
            boxShadow: SHADOW.sm,
            animationDelay: `${Math.min(i, 8) * 40}ms`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: FARGER.mork, letterSpacing: '-0.015em' }}>{p.navn}</div>
                <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: RADIUS.pill }}>{p.status}</span>
                <span style={{ fontSize: 12, color: FARGER.tekstLys, marginLeft: 10 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
                {p.dato_kjopt && <span style={{ fontSize: 12, color: FARGER.tekstLys, marginLeft: 8 }}>Kjøpt: {p.dato_kjopt}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onSettVisProsjekt(p.id)} className="knapp-hover-loft" style={{ ...handlingsKnapp('primer'), padding: '8px 16px' }}>Åpne</button>
                <button onClick={() => slettProsjekt(p.id)} style={{
                  background: FARGER.feilBg, color: FARGER.feil,
                  border: 'none', borderRadius: RADIUS.pill,
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '-0.005em',
                }}>Slett</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {[
                { lbl: 'Total investert', val: fmt(totalInvestering(p)) },
                { lbl: 'Cashflow/mnd', val: fmt(cf), farge: cf >= 0 ? '#2D7D46' : '#C8102E' },
                { lbl: 'Yield', val: yield_pst(p).toFixed(1) + '%' },
                { lbl: 'ROI ved salg', val: roi(p).toFixed(1) + '%' },
              ].map((item, i) => (
                <div key={i} style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 12 }}>
                  <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{item.lbl}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: ('farge' in item) ? item.farge : FARGER.mork, letterSpacing: '-0.01em' }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {!visProsjektId && prosjekter.length === 0 && !visNyttSkjema && !laster && (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 56, textAlign: 'center', color: FARGER.tekstMid }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: FARGER.mork, letterSpacing: '-0.005em' }}>Ingen prosjekter ennå</div>
          <div style={{ fontSize: 13.5 }}>Trykk «Nytt prosjekt» for å komme i gang.</div>
        </div>
      )}

      {visProsjektId && (() => {
        const p = prosjekter.find(pr => pr.id === visProsjektId)
        if (!p) return null
        const sf = statusFarge(p.status)
        const cf = månedligCashflow(p)
        const redigerer = redigerProsjekt?.id === p.id

        const arsinntekt = p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).reduce((s, m) => s + m.inntekt, 0)
        const arskostnadLogg = p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).reduce((s, m) => s + m.kostnad, 0)
        const fastKostAr = månedligKostnad(p) * 12
        const totalKostAr = arskostnadLogg + fastKostAr
        const nettoresultat = arsinntekt - totalKostAr

        return (
          <div>
            <button onClick={() => { onSettVisProsjekt(null); setRedigerProsjekt(null); setAktivTab('oversikt') }} className="nav-lenke" style={tilbakeStil}>
              <span aria-hidden>←</span> Tilbake
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>{p.navn}</h2>
                <div style={{ marginTop: 8 }}>
                  <span style={{ background: sf.bg, color: sf.color, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: RADIUS.pill }}>{p.status}</span>
                  <span style={{ fontSize: 12, color: FARGER.tekstLys, marginLeft: 10 }}>{p.kategori === 'flipp' ? '🔨 Flipp' : '🏖️ Utleie'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => lastNedProsjektPdf(p.id, p.navn)}
                  disabled={!!pdfFremdrift}
                  title="Lag komplett analyse-PDF med før/etter-bilder, oppussingsbudsjett og ROI — klar til banken"
                  className="knapp-hover-loft"
                  style={handlingsKnapp('primer', !!pdfFremdrift)}>
                  {pdfFremdrift ? `⏳ ${pdfFremdrift}` : '📄 Last ned PDF-analyse'}
                </button>
                <button
                  onClick={() => setSalgspakkeApen(true)}
                  title="Bygg salgspakke — oppgraderinger, kostnader, før/etter-bilder og dokumenter samlet i én PDF"
                  className="knapp-hover-loft"
                  style={handlingsKnapp('gull')}>
                  📦 Salgspakke
                </button>
                <button onClick={() => setRedigerProsjekt(redigerer ? null : { ...p })} className="knapp-hover-loft" style={redigerer ? handlingsKnapp('graa') : handlingsKnapp('primer')}>
                  {redigerer ? 'Avbryt' : '✏️ Rediger'}
                </button>
                {redigerer && <button onClick={lagreRedigering} className="knapp-hover-loft" style={handlingsKnapp('suksess')}>💾 Lagre</button>}
              </div>
            </div>

            {redigerer && redigerProsjekt && (
              <div className="anim-fade-up" style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gull}33`, borderRadius: RADIUS.lg, padding: 26, marginBottom: 24, boxShadow: SHADOW.sm }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: FARGER.mork, letterSpacing: '-0.015em' }}>✏️ Rediger prosjekt</h3>
                <ProsjektFelter data={redigerProsjekt} onChange={setRedigerProsjekt} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={lagreRedigering} className="knapp-hover-loft" style={{ ...handlingsKnapp('suksess'), flex: 1, padding: 14, fontSize: 14 }}>💾 Lagre endringer</button>
                  <button onClick={() => setRedigerProsjekt(null)} style={{ ...handlingsKnapp('graa'), padding: '14px 22px', fontSize: 14 }}>Avbryt</button>
                </div>
              </div>
            )}

            <NesteSteg prosjekt={p} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
              {[
                { lbl: '💰 Total investert', val: fmt(totalInvestering(p)), farge: FARGER.mork },
                { lbl: '📈 Cashflow/mnd', val: fmt(cf), farge: cf >= 0 ? '#2D7D46' : '#C8102E' },
                { lbl: '📊 Yield', val: yield_pst(p).toFixed(1) + '%', farge: FARGER.gull },
                { lbl: '🏷️ ROI ved salg', val: roi(p).toFixed(1) + '%', farge: '#B05E0A' },
              ].map((item, i) => (
                <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 16, boxShadow: SHADOW.sm }}>
                  <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{item.lbl}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: item.farge, letterSpacing: '-0.02em' }}>{item.val}</div>
                </div>
              ))}
            </div>

            <div style={{
              display: 'inline-flex', gap: 4, flexWrap: 'wrap',
              background: FARGER.hvit,
              padding: 5, marginBottom: 18,
              borderRadius: RADIUS.pill,
              boxShadow: SHADOW.sm,
              border: `1px solid ${FARGER.kantUltralys}`,
              maxWidth: '100%',
            }}>
              {([
                { id: 'oversikt' as const, lbl: '📊 Oversikt' },
                { id: 'dialog' as const, lbl: '💬 Dialog' },
                { id: 'arsrapport' as const, lbl: '📋 Årsrapport' },
                { id: 'kvitteringer' as const, lbl: '💳 Kvitteringer' },
                { id: 'dokumenter' as const, lbl: '📁 Dokumenter' },
                { id: 'forespørsler' as const, lbl: '📤 Forespørsler' },
                { id: 'oppussing' as const, lbl: '🔨 Oppussing' },
                ...(p.kategori === 'utleie' ? [{ id: 'utleie' as const, lbl: '🏖️ Utleie' }] : []),
                { id: 'portal' as const, lbl: '🌐 Portal' },
              ]).map(t => (
                <button key={t.id} onClick={() => setAktivTab(t.id)}
                  style={{
                    padding: '8px 16px', borderRadius: RADIUS.pill,
                    border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 600,
                    background: aktivTab === t.id ? FARGER.mork : 'transparent',
                    color: aktivTab === t.id ? FARGER.creamLys : FARGER.tekstMid,
                    letterSpacing: '-0.005em',
                    transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
                  }}>
                  {t.lbl}
                </button>
              ))}
            </div>

            {aktivTab === 'dialog' && (
              <ProsjektDialog prosjektId={p.id} />
            )}

            {aktivTab === 'kvitteringer' && (
              <Kvitteringer prosjektId={p.id} valuta="EUR" />
            )}

            {aktivTab === 'dokumenter' && (
              <Dokumenter prosjektId={p.id} />
            )}

            {aktivTab === 'forespørsler' && (
              <TilbudHistorikk prosjektId={p.id} />
            )}

            {aktivTab === 'oppussing' && (
              <Oppussingsbudsjett prosjekt={p} onProsjektOppdatert={hent} />
            )}

            {aktivTab === 'utleie' && p.kategori === 'utleie' && (
              <Utleieanalyse prosjekt={p} />
            )}

            {aktivTab === 'portal' && (
              <UtleiePortalAdmin prosjekt={p} onOppdatert={hent} />
            )}

            {aktivTab === 'oversikt' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14, marginBottom: 22 }}>
                <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 20, boxShadow: SHADOW.sm }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.005em' }}>💸 Investeringer</div>
                  {[
                    { lbl: 'Kjøpesum', val: fmt(p.kjøpesum) },
                    { lbl: 'Kjøpskostnader', val: fmt(p.kjøpskostnader) },
                    { lbl: 'Oppussing budsjett', val: fmt(p.oppussingsbudsjett) },
                    { lbl: 'Oppussing faktisk', val: fmt(p.oppussing_faktisk) },
                    { lbl: 'Møblering', val: fmt(p.møblering) },
                    { lbl: 'Forventet salgsverdi', val: fmt(p.forventet_salgsverdi) },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', fontSize: 13 }}>
                      <span style={{ color: FARGER.tekstMid }}>{r.lbl}</span><span style={{ fontWeight: 600, color: FARGER.mork }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 20, boxShadow: SHADOW.sm }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.005em' }}>📅 Månedlig</div>
                  {[
                    { lbl: 'Leieinntekt', val: fmt(p.leieinntekt_mnd), farge: '#2D7D46' },
                    { lbl: 'Lånebetaling', val: fmt(p.lån_mnd), farge: '#C8102E' },
                    { lbl: 'Fellesutgifter', val: fmt(p.fellesutgifter_mnd), farge: '#C8102E' },
                    { lbl: 'Strøm', val: fmt(p.strøm_mnd), farge: '#C8102E' },
                    { lbl: 'Forsikring', val: fmt(p.forsikring_mnd), farge: '#C8102E' },
                    { lbl: 'Forvaltning', val: fmt(p.forvaltning_mnd), farge: '#C8102E' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', fontSize: 13 }}>
                      <span style={{ color: FARGER.tekstMid }}>{r.lbl}</span><span style={{ fontWeight: 600, color: r.farge }}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: `1px solid rgba(14,23,38,0.12)`, fontSize: 14, marginTop: 6 }}>
                    <span style={{ fontWeight: 600, letterSpacing: '-0.005em' }}>Cashflow</span>
                    <span style={{ fontWeight: 700, color: cf >= 0 ? '#2D7D46' : '#C8102E' }}>{fmt(cf)}</span>
                  </div>
                </div>
              </div>
            )}

            {aktivTab === 'oversikt' && <ProsjektBilder prosjektId={p.id} />}
            {aktivTab === 'oversikt' && <SendteEposter prosjektId={p.id} />}

            {aktivTab === 'arsrapport' && (
              <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 24, marginBottom: 22, boxShadow: SHADOW.sm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: FARGER.mork, letterSpacing: '-0.015em' }}>📋 Årsrapport</h3>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select value={valgtAr} onChange={e => setValgtAr(Number(e.target.value))}
                      style={{
                        padding: '9px 14px', borderRadius: RADIUS.pill,
                        border: `1px solid ${FARGER.kantUltralys}`,
                        background: FARGER.hvit, fontSize: 13,
                        color: FARGER.mork, outline: 'none',
                        boxShadow: SHADOW.xs,
                      }}>
                      {[2024, 2025, 2026, 2027].map(ar => <option key={ar} value={ar}>{ar}</option>)}
                    </select>
                    <button onClick={() => lastNedPDF(p, valgtAr)} className="knapp-hover-loft" style={handlingsKnapp('primer')}>
                      📥 Last ned PDF
                    </button>
                  </div>
                </div>

                <div style={{ background: '#f0faf4', border: '1px solid #2D7D4622', borderRadius: RADIUS.md, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#1a4d2b', letterSpacing: '-0.005em' }}>💰 Inntekter {valgtAr}</div>
                  {p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).length === 0 && (
                    <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic' }}>Ingen inntekter registrert for {valgtAr} — legg til i månedlig logg under</div>
                  )}
                  {p.måneder.filter(m => m.måned.startsWith(valgtAr.toString())).map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid #d0ead8' : 'none', fontSize: 13 }}>
                      <span style={{ color: FARGER.tekstMid }}>{m.måned}{m.notat ? ' – ' + m.notat : ''}</span>
                      <span style={{ fontWeight: 600, color: '#2D7D46' }}>{fmt(m.inntekt)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid #2D7D4644', fontSize: 14, marginTop: 6 }}>
                    <span style={{ fontWeight: 600, letterSpacing: '-0.005em' }}>Sum inntekter</span>
                    <span style={{ fontWeight: 700, color: '#2D7D46' }}>{fmt(arsinntekt)}</span>
                  </div>
                </div>

                <div style={{ background: '#fde8ec', border: '1px solid #C8102E22', borderRadius: RADIUS.md, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#7a0c1e', letterSpacing: '-0.005em' }}>📉 Kostnader {valgtAr}</div>
                  {[
                    { lbl: 'Lånebetaling (12 mnd)', val: p.lån_mnd * 12 },
                    { lbl: 'Fellesutgifter (12 mnd)', val: p.fellesutgifter_mnd * 12 },
                    { lbl: 'Strøm (12 mnd)', val: p.strøm_mnd * 12 },
                    { lbl: 'Forsikring (12 mnd)', val: p.forsikring_mnd * 12 },
                    { lbl: 'Forvaltning (12 mnd)', val: p.forvaltning_mnd * 12 },
                    { lbl: 'Variable kostnader (logg)', val: arskostnadLogg },
                  ].filter(r => r.val > 0).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid #f5a3b033' : 'none', fontSize: 13 }}>
                      <span style={{ color: FARGER.tekstMid }}>{r.lbl}</span>
                      <span style={{ fontWeight: 600, color: '#C8102E' }}>{fmt(r.val)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid #C8102E44', fontSize: 14, marginTop: 6 }}>
                    <span style={{ fontWeight: 600, letterSpacing: '-0.005em' }}>Sum kostnader</span>
                    <span style={{ fontWeight: 700, color: '#C8102E' }}>{fmt(totalKostAr)}</span>
                  </div>
                </div>

                <div style={{
                  background: nettoresultat >= 0 ? '#e8f5ed' : '#fde8ec',
                  border: `1px solid ${nettoresultat >= 0 ? '#2D7D4633' : '#C8102E33'}`,
                  borderRadius: RADIUS.md, padding: 18,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: FARGER.mork, letterSpacing: '-0.005em' }}>📊 Resultat {valgtAr}</div>
                  {([
                    { lbl: 'Sum inntekter', val: fmt(arsinntekt), farge: '#2D7D46' },
                    { lbl: 'Sum kostnader', val: fmt(totalKostAr), farge: '#C8102E' },
                    { lbl: 'Netto resultat', val: fmt(nettoresultat), farge: nettoresultat >= 0 ? '#2D7D46' : '#C8102E', bold: true },
                    { lbl: 'Yield (faktisk)', val: totalInvestering(p) > 0 ? ((arsinntekt / totalInvestering(p)) * 100).toFixed(1) + '%' : '–', farge: FARGER.gull },
                    { lbl: 'Total investering', val: fmt(totalInvestering(p)), farge: FARGER.mork },
                  ] as const).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: i > 0 ? `1px solid ${FARGER.kantUltralys}` : 'none', fontSize: 13 }}>
                      <span style={{ color: FARGER.tekstMid, fontWeight: ('bold' in r && r.bold) ? 600 : 400 }}>{r.lbl}</span>
                      <span style={{ fontWeight: 700, color: r.farge, fontSize: ('bold' in r && r.bold) ? 15 : 13 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {p.notater && (
              <div style={{ background: '#fff8e1', border: '1px solid #EF9F2733', borderRadius: RADIUS.md, padding: 18, marginBottom: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: FARGER.mork, letterSpacing: '-0.005em' }}>📝 Notater</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: FARGER.tekstMid }}>{p.notater}</div>
              </div>
            )}

            <Salgspakke
              prosjektId={p.id}
              prosjektNavn={p.navn}
              apen={salgspakkeApen}
              onLukk={() => setSalgspakkeApen(false)}
            />
          </div>
        )
      })()}
    </div>
  )
}
