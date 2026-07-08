'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { type AirbnbData, type Bolig, type BoligData, tomBolig, tomtProsjekt, type Prosjekt } from '../types'
import { inputStyle, selectStyle, labelStyle, fieldStyle, fmt, fmtPct, FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { ScoreKort, type Score } from './ScoreKort'
import { byggProsjektPdf } from '../lib/pdf'
import { visToast } from '../lib/toast'

function lastNedBase64Pdf(base64: string, filnavn: string) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filnavn
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type AnalyseResultat = {
  tittel?: string
  type?: string
  beliggenhet?: string
  soverom?: number
  bad?: number
  areal?: number
  byggear?: number
  tomt_m2?: number
  avstand_strand_m?: number
  basseng?: string
  parkering?: string
  havutsikt?: string
  bolig_standard?: string
  pris?: number
  markedspris_standard_m2?: number
  markedspris_bra_m2?: number
  markedspris_luksus_m2?: number
  markedspris_begrunnelse?: string
  oppussing_vurdering?: string
  anbefalt_strategi?: string
  ek_krav?: number
  mnd_betaling?: number
  yield_estimat?: number
  vft_score?: number
  ai_vurdering?: string
  annonse_beskrivelse?: string
  kort_oppsummering?: string
  fasiliteter?: string[]
}

export function Boliganalyse({ onTilbake }: { onTilbake: () => void }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AnalyseResultat | null>(null)
  const [loading, setLoading] = useState(false)
  const [airbnbLoading, setAirbnbLoading] = useState(false)
  const [steg, setSteg] = useState<'idle' | 'analyserer' | 'utleie' | 'ferdig'>('idle')
  const [airbnbAnalyse, setAirbnbAnalyse] = useState('')
  const [airbnbScore, setAirbnbScore] = useState<Score | null>(null)
  const [airbnbData, setAirbnbData] = useState<AirbnbData | null>(null)
  const [visSkjema, setVisSkjema] = useState(false)
  const [lagreMelding, setLagreMelding] = useState('')
  const [bolig, setBolig] = useState<Bolig>(tomBolig())
  const [lagretId, setLagretId] = useState<string | null>(null)
  const [pdfLaster, setPdfLaster] = useState(false)
  const [refcat, setRefcat] = useState('')
  const [catastroLaster, setCatastroLaster] = useState(false)
  const [catastroFeil, setCatastroFeil] = useState('')
  const [catastro, setCatastro] = useState<{
    refcat: string; areal_m2: number | null; byggear: number | null
    brukstype: string | null; adresse: string | null; postnummer: string | null
    kommune: string | null; provins: string | null
  } | null>(null)

  async function hentCatastro() {
    if (!refcat.trim() || catastroLaster) return
    setCatastroLaster(true); setCatastroFeil('')
    try {
      const res = await fetch('/api/catastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refcat }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setCatastroFeil(data.feil || 'Fant ikke eiendommen i Catastro')
        setCatastro(null)
      } else {
        setCatastro(data.eiendom)
        // Pre-fyll skjemaet med autoritative verdier fra Catastro
        setBolig(b => ({
          ...b,
          areal: data.eiendom.areal_m2 ? String(data.eiendom.areal_m2) : b.areal,
          beliggenhet: b.beliggenhet || [data.eiendom.kommune, data.eiendom.provins].filter(Boolean).join(', '),
        }))
      }
    } catch (e) {
      setCatastroFeil(e instanceof Error ? e.message : 'Noe gikk galt')
    }
    setCatastroLaster(false)
  }

  function nullstill() {
    setInput(''); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null); setVisSkjema(false); setLagreMelding(''); setSteg('idle')
    setLagretId(null); setPdfLaster(false)
    setRefcat(''); setCatastro(null); setCatastroFeil('')
  }

  async function lastNedPdf(id: string) {
    setPdfLaster(true)
    try {
      const data = await byggProsjektPdf(id, supabase)
      if (!data) {
        visToast('Klarte ikke å bygge PDF', 'feil')
      } else {
        lastNedBase64Pdf(data.base64, data.filnavn)
        visToast('PDF lastet ned: ' + data.filnavn, 'suksess', 3500)
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Ukjent feil'
      visToast('PDF-bygging feilet: ' + m, 'feil', 4000)
    }
    setPdfLaster(false)
  }

  function apneChatMedProsjekt(id: string) {
    window.dispatchEvent(new CustomEvent<{ prosjektId: string }>('app-open-chat', {
      detail: { prosjektId: id },
    }))
  }

  async function kjørAirbnbAnalyse(boligForAnalyse: Bolig) {
    setAirbnbLoading(true); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null)
    try {
      const res = await fetch('/api/airbnb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bolig: boligForAnalyse }) })
      const data = await res.json()
      setAirbnbAnalyse(data.analyse || ''); setAirbnbScore(data.score || null); setAirbnbData(data.data || null)
    } catch {
      setAirbnbAnalyse('Noe gikk galt, prøv igjen.')
    }
    setAirbnbLoading(false)
  }

  async function analyser() {
    setLoading(true); setResult(null); setAirbnbAnalyse(''); setAirbnbScore(null); setAirbnbData(null); setVisSkjema(false); setLagreMelding('')
    setSteg('analyserer')
    try {
      const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyText: input }) })
      const data: AnalyseResultat = await res.json()
      setResult(data)
      const nyBolig: Bolig = {
        type: data.type || '',
        beliggenhet: data.beliggenhet || '',
        soverom: data.soverom?.toString() || '',
        bad: '',
        areal: data.areal?.toString() || '',
        avstand_strand: data.avstand_strand_m?.toString() || '',
        basseng: 'felles', parkering: 'privat', havutsikt: 'nei',
        standard: data.bolig_standard || 'moderne',
        pris: data.pris?.toString() || '',
        ekstra: '',
        markedspris_bra_m2: data.markedspris_bra_m2?.toString() || '',
        oppbudsjett: '',
      }
      setBolig(nyBolig)
      setVisSkjema(true)
      setLoading(false)

      // Kjør utleieanalyse umiddelbart i samme flyt
      setSteg('utleie')
      await kjørAirbnbAnalyse(nyBolig)
      setSteg('ferdig')
    } catch {
      setResult({ ai_vurdering: 'Noe gikk galt, prøv igjen.' })
      setLoading(false)
      setSteg('idle')
    }
  }

  async function lagreAnalyseSomProsjekt(kategori: 'flipp' | 'utleie') {
    if (!result) return
    const navn = result.tittel || result.beliggenhet || 'Analysert bolig'
    const bolig_data: BoligData = {
      type: bolig.type || result.type,
      beliggenhet: bolig.beliggenhet || result.beliggenhet,
      soverom: bolig.soverom || result.soverom,
      bad: bolig.bad,
      areal: bolig.areal || result.areal,
      avstand_strand: bolig.avstand_strand || result.avstand_strand_m,
      basseng: bolig.basseng,
      parkering: bolig.parkering,
      havutsikt: bolig.havutsikt,
      standard: bolig.standard || result.bolig_standard,
      pris: bolig.pris || result.pris,
      ekstra: bolig.ekstra,
      markedspris_standard_m2: result.markedspris_standard_m2,
      markedspris_bra_m2: Number(bolig.markedspris_bra_m2) || result.markedspris_bra_m2,
      markedspris_luksus_m2: result.markedspris_luksus_m2,
      markedspris_begrunnelse: result.markedspris_begrunnelse,
      oppussing_vurdering: result.oppussing_vurdering,
      anbefalt_strategi: result.anbefalt_strategi,
      vft_score: result.vft_score,
    }
    const nytt: Prosjekt = {
      ...tomtProsjekt(),
      id: Date.now().toString(),
      navn,
      kategori,
      status: 'Under vurdering',
      kjøpesum: Number(bolig.pris) || result.pris || 0,
      oppussingsbudsjett: Number(bolig.oppbudsjett) || 0,
      lån_mnd: result.mnd_betaling || 0,
      notater:
        `Lagret fra Boliganalyse ${new Date().toLocaleDateString('nb-NO')}\n\n` +
        `Type: ${bolig.type || result.type || '-'}\n` +
        `Beliggenhet: ${bolig.beliggenhet || result.beliggenhet || '-'}\n` +
        `Soverom: ${bolig.soverom || result.soverom || '-'}\n` +
        `Areal: ${bolig.areal || result.areal || '-'} m²\n` +
        (airbnbScore ? `\nScore: ${airbnbScore.total}/10 ${airbnbScore.lys}\n` : '') +
        (result.ai_vurdering ? `\nAI-vurdering: ${result.ai_vurdering}` : ''),
      bolig_data,
      ai_vurdering: result.ai_vurdering || null,
      airbnb_analyse: airbnbAnalyse || null,
      airbnb_score: airbnbScore,
      airbnb_data: airbnbData,
    }
    const bruker = hentAktivBruker() || 'ukjent'
    const { error } = await supabase.from('prosjekter').insert([{ ...nytt, bruker }])
    if (error) {
      setLagreMelding('❌ Feil ved lagring: ' + error.message)
      setTimeout(() => setLagreMelding(''), 5000)
      return
    }
    await loggAktivitet({ handling: 'lagret ny bolig fra Boliganalyse', tabell: 'prosjekter', rad_id: nytt.id, detaljer: { navn, kategori } })
    setLagretId(nytt.id)
    setLagreMelding(`✅ Lagret som ${kategori === 'flipp' ? 'flipp-prosjekt' : 'utleieprosjekt'} med status «Under vurdering». Henter PDF...`)
    // Auto-last ned PDF i samme flyt slik brukeren har en fysisk fil
    void lastNedPdf(nytt.id)
  }

  // Lagre + auto-fyll portal-feltene fra analysen, slik at admin bare må
  // gjennomgå og publisere i Portal-fanen. Setter ikke publisert-flaggene —
  // det skal være et bevisst valg.
  async function lagreTilPortal() {
    if (!result) return
    const navn = result.tittel || result.beliggenhet || 'Analysert bolig'
    const bolig_data: BoligData = {
      type: bolig.type || result.type,
      beliggenhet: bolig.beliggenhet || result.beliggenhet,
      soverom: bolig.soverom || result.soverom,
      bad: bolig.bad || result.bad,
      areal: bolig.areal || result.areal,
      avstand_strand: bolig.avstand_strand || result.avstand_strand_m,
      basseng: bolig.basseng || result.basseng,
      parkering: bolig.parkering || result.parkering,
      havutsikt: bolig.havutsikt || result.havutsikt,
      standard: bolig.standard || result.bolig_standard,
      pris: bolig.pris || result.pris,
      ekstra: bolig.ekstra,
      markedspris_standard_m2: result.markedspris_standard_m2,
      markedspris_bra_m2: Number(bolig.markedspris_bra_m2) || result.markedspris_bra_m2,
      markedspris_luksus_m2: result.markedspris_luksus_m2,
      markedspris_begrunnelse: result.markedspris_begrunnelse,
      oppussing_vurdering: result.oppussing_vurdering,
      anbefalt_strategi: result.anbefalt_strategi,
      vft_score: result.vft_score,
    }

    // Portalen er fjernet (Fase A) — pre-fyller ikke lenger publiseringsfelt.
    // Beholder ekte bolig-fakta som brukes i analyse/PDF.
    const boligFakta = {
      byggear: result.byggear || null,
      tomt_m2: result.tomt_m2 || null,
    }

    const nytt: Prosjekt = {
      ...tomtProsjekt(),
      id: Date.now().toString(),
      navn,
      kategori: 'utleie',
      status: 'Under vurdering',
      kjøpesum: Number(bolig.pris) || result.pris || 0,
      oppussingsbudsjett: Number(bolig.oppbudsjett) || 0,
      lån_mnd: result.mnd_betaling || 0,
      notater:
        `Lagret til vurdering ${new Date().toLocaleDateString('nb-NO')}\n\n` +
        `Type: ${bolig_data.type || '-'}\n` +
        `Beliggenhet: ${bolig_data.beliggenhet || '-'}\n` +
        `Pris: €${(Number(bolig.pris) || result.pris || 0).toLocaleString('nb-NO')}\n` +
        (airbnbScore ? `\nScore: ${airbnbScore.total}/10 ${airbnbScore.lys}\n` : '') +
        (result.ai_vurdering ? `\nAI-vurdering: ${result.ai_vurdering}` : ''),
      bolig_data,
      ai_vurdering: result.ai_vurdering || null,
      airbnb_analyse: airbnbAnalyse || null,
      airbnb_score: airbnbScore,
      airbnb_data: airbnbData,
    }

    const bruker = hentAktivBruker() || 'ukjent'
    const { error } = await supabase
      .from('prosjekter')
      .insert([{ ...nytt, ...boligFakta, bruker }])
    if (error) {
      setLagreMelding('❌ Feil ved lagring: ' + error.message)
      setTimeout(() => setLagreMelding(''), 5000)
      return
    }
    await loggAktivitet({ handling: 'lagret ny bolig til vurdering', tabell: 'prosjekter', rad_id: nytt.id, detaljer: { navn } })
    setLagretId(nytt.id)
    setLagreMelding('✅ Lagret. Åpne prosjektet i Regnskap for å følge opp. Henter PDF...')
    void lastNedPdf(nytt.id)
  }

  return (
    <div>
      <button onClick={() => { onTilbake(); nullstill() }} className="nav-lenke" style={{
        background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
        borderRadius: RADIUS.pill, padding: '8px 16px 8px 12px',
        fontSize: 13, cursor: 'pointer', marginBottom: 22,
        color: FARGER.tekstMid, fontWeight: 500,
        boxShadow: SHADOW.xs,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        letterSpacing: '-0.005em',
      }}><span aria-hidden>←</span> Tilbake</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ fontSize: 40 }}>🔍</div>
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>Boliganalyse</h2>
          <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14 }}>Analyser en ny eiendom og vurder potensial</p>
        </div>
      </div>
      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 24, marginBottom: 24, boxShadow: SHADOW.sm }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Lim inn bolig-info</div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Lim inn Finn.no-lenke eller beskriv eiendommen&#10;&#10;Eks: Villa 4 soverom, 180m², privat pool, 500m fra strand, €650 000, Marbella Golden Mile"
          style={{
            width: '100%', height: 130, padding: 14, fontSize: 14,
            borderRadius: RADIUS.md, border: `1px solid ${FARGER.kant}`,
            resize: 'vertical', fontFamily: 'inherit',
            background: FARGER.creamLys,
            transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={analyser} disabled={loading || airbnbLoading || !input} className="knapp-hover-loft" style={{
            flex: 1, background: (loading || airbnbLoading) ? FARGER.tekstLys : FARGER.mork,
            color: FARGER.creamLys, border: 'none', padding: 14, borderRadius: RADIUS.pill,
            fontSize: 14, fontWeight: 600, cursor: (loading || airbnbLoading) ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.005em',
            boxShadow: (loading || airbnbLoading) ? 'none' : SHADOW.sm,
            transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
          }}>
            {steg === 'analyserer' && '⏳ Analyserer bolig…'}
            {steg === 'utleie' && '⏳ Kjører utleieanalyse (20–30 s)…'}
            {(steg === 'idle' || steg === 'ferdig') && '🚀 Kjør full analyse'}
          </button>
          {(input || result) && <button onClick={nullstill} style={{
            background: FARGER.hvit, color: FARGER.tekstMid,
            border: `1px solid ${FARGER.kantUltralys}`,
            padding: '14px 22px', borderRadius: RADIUS.pill,
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            letterSpacing: '-0.005em',
          }}>🗑️ Nullstill</button>}
        </div>

        {/* CATASTRO — autoritative eiendomsfakta fra spansk matrikkel */}
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${FARGER.kantUltralys}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.18em' }}>🏛️ Catastro — offisielle data (valgfritt)</div>
          <p style={{ fontSize: 12.5, color: FARGER.tekstMid, margin: '0 0 12px', lineHeight: 1.55 }}>
            Lim inn <strong>referencia catastral</strong> (20 tegn — finnes ofte på Idealista, i nota simple eller escritura) for å hente autoritativt areal og byggeår fra det spanske matrikkelverket. Mye mer pålitelig enn annonsens m².
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={refcat} onChange={e => setRefcat(e.target.value)}
              placeholder="F.eks. 6447903UF6564N0043HO"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void hentCatastro() } }}
              style={{
                flex: 1, minWidth: 220, padding: '12px 14px', fontSize: 14,
                borderRadius: RADIUS.md, border: `1px solid ${FARGER.kant}`,
                background: FARGER.creamLys, fontFamily: 'monospace',
                letterSpacing: '0.02em', textTransform: 'uppercase',
                outline: 'none', transition: `border-color ${MOTION.rask}`,
              }} />
            <button onClick={hentCatastro} disabled={catastroLaster || !refcat.trim()} className="knapp-hover-loft" style={{
              background: catastroLaster || !refcat.trim() ? FARGER.tekstLys : FARGER.gull,
              color: FARGER.creamLys, border: 'none',
              padding: '12px 20px', borderRadius: RADIUS.pill,
              fontSize: 13, fontWeight: 600,
              cursor: catastroLaster || !refcat.trim() ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: catastroLaster || !refcat.trim() ? 'none' : SHADOW.sm,
            }}>
              {catastroLaster ? '⏳ Henter…' : '🏛️ Hent fra Catastro'}
            </button>
          </div>

          {catastroFeil && (
            <div className="anim-fade-up" style={{ marginTop: 12, background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, color: '#7a0c1e', padding: 12, borderRadius: RADIUS.md, fontSize: 13 }}>
              {catastroFeil}
            </div>
          )}

          {catastro && (
            <div className="anim-fade-up" style={{ marginTop: 12, background: '#e8f5ed', border: '1px solid #2D7D4633', borderRadius: RADIUS.md, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#1a4d2b', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                ✓ Verifisert fra Catastro
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
                {catastro.areal_m2 != null && <CatFakta lbl="Areal" val={`${catastro.areal_m2} m²`} />}
                {catastro.byggear != null && <CatFakta lbl="Byggeår" val={String(catastro.byggear)} />}
                {catastro.brukstype && <CatFakta lbl="Type" val={catastro.brukstype} />}
                {(catastro.kommune || catastro.provins) && <CatFakta lbl="Område" val={[catastro.kommune, catastro.provins].filter(Boolean).join(', ')} />}
              </div>
              {catastro.adresse && (
                <div style={{ fontSize: 12.5, color: FARGER.tekstMid, marginTop: 10 }}>
                  📍 {catastro.adresse}{catastro.postnummer ? ` · ${catastro.postnummer}` : ''}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#1a4d2b', marginTop: 10, fontStyle: 'italic' }}>
                Areal er fylt inn i skjemaet under. Klikk «Oppdater analyse» etter at du har kjørt full analyse for å regne på de offisielle tallene.
              </div>
            </div>
          )}
        </div>
      </div>
      {result && (
        <div>
          <div className="anim-fade-up" style={{
            background: FARGER.mork, color: FARGER.creamLys,
            borderRadius: RADIUS.xl, padding: 28, marginBottom: 16,
            boxShadow: SHADOW.md,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{result.type} · {result.beliggenhet}</div>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 26px)', margin: '0 0 22px', fontWeight: 500, letterSpacing: '-0.02em' }}>{result.tittel}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {[{ lbl: 'Pris', val: fmt(result.pris ?? 0) }, { lbl: 'Egenkapital', val: fmt(result.ek_krav ?? 0) }, { lbl: 'Mnd. betaling', val: fmt(result.mnd_betaling ?? 0) }, { lbl: 'Yield', val: fmtPct(result.yield_estimat ?? 0) }].map((item, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: RADIUS.md, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{item.lbl}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.18em' }}>🤖 AI-vurdering</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.75, color: FARGER.tekstMid, margin: 0 }}>{result.ai_vurdering}</p>
          </div>
          {result.vft_score !== undefined && (
            <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 24, boxShadow: SHADOW.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, textTransform: 'uppercase', letterSpacing: '0.18em' }}>🏛️ VFT-turistlisens</div>
                <div style={{ background: result.vft_score >= 60 ? '#e8f5ed' : result.vft_score >= 35 ? '#fff8e1' : '#fde8ec', color: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#B05E0A' : '#C8102E', padding: '4px 12px', borderRadius: RADIUS.pill, fontSize: 13, fontWeight: 700 }}>{result.vft_score}/100</div>
              </div>
              <div style={{ background: FARGER.flateMid, borderRadius: RADIUS.pill, height: 8, overflow: 'hidden' }}>
                <div style={{ width: result.vft_score + '%', height: 8, background: result.vft_score >= 60 ? '#2D7D46' : result.vft_score >= 35 ? '#EF9F27' : '#C8102E', borderRadius: RADIUS.pill, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
          {visSkjema && (
            <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Sjekk og korriger detaljer (valgfritt)</div>
              <p style={{ fontSize: 13.5, color: FARGER.tekstMid, marginBottom: 18, lineHeight: 1.6 }}>Vi har fylt inn det vi fant. Hvis du korrigerer noe under, klikk «Oppdater analyse» nederst for å kjøre utleieanalysen på nytt med de nye verdiene.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                {[
                  { key: 'type', lbl: 'Type bolig', placeholder: 'Villa / Leilighet', type: 'text' },
                  { key: 'beliggenhet', lbl: 'By og område', placeholder: 'Marbella', type: 'text' },
                  { key: 'soverom', lbl: 'Soverom', placeholder: '4', type: 'number' },
                  { key: 'bad', lbl: 'Bad', placeholder: '3', type: 'number' },
                  { key: 'areal', lbl: 'Areal (m²)', placeholder: '180', type: 'number' },
                  { key: 'avstand_strand', lbl: 'Avstand strand (m)', placeholder: '300', type: 'number' },
                  { key: 'pris', lbl: 'Kjøpspris (€)', placeholder: '650000', type: 'number' },
                  { key: 'markedspris_bra_m2', lbl: 'Markedspris bra std (€/m²)', placeholder: '3000', type: 'number' },
                  { key: 'ekstra', lbl: 'Ekstra info', placeholder: 'Pool, terrasse, golf...', type: 'text' },
                ].map((f, i) => (
                  <div key={i} style={fieldStyle}>
                    <label style={labelStyle}>{f.lbl}</label>
                    <input
                      style={inputStyle}
                      type={f.type}
                      value={(bolig as unknown as Record<string, string>)[f.key]}
                      onChange={e => setBolig(b => ({ ...b, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
                {[
                  { key: 'basseng', lbl: 'Basseng', opts: [['privat', 'Privat basseng'], ['felles', 'Felles basseng'], ['ingen', 'Ingen basseng']] },
                  { key: 'parkering', lbl: 'Parkering', opts: [['garasje', 'Garasje'], ['privat', 'Privat'], ['felles', 'Felles'], ['ingen', 'Ingen']] },
                  { key: 'havutsikt', lbl: 'Havutsikt', opts: [['ja', 'Full havutsikt'], ['delvis', 'Delvis'], ['nei', 'Nei']] },
                  { key: 'standard', lbl: 'Standard', opts: [['luksus', 'Luksus'], ['moderne', 'Moderne'], ['standard', 'Standard'], ['oppussing', 'Trenger oppussing']] },
                ].map((f, i) => (
                  <div key={i} style={fieldStyle}>
                    <label style={labelStyle}>{f.lbl}</label>
                    <select
                      style={selectStyle}
                      value={(bolig as unknown as Record<string, string>)[f.key]}
                      onChange={e => setBolig(b => ({ ...b, [f.key]: e.target.value }))}
                    >
                      {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={() => kjørAirbnbAnalyse(bolig)} disabled={airbnbLoading} className="knapp-hover-loft"
                style={{
                  width: '100%', background: airbnbLoading ? FARGER.tekstLys : FARGER.mork,
                  color: FARGER.creamLys, border: 'none', padding: 13,
                  borderRadius: RADIUS.pill, fontSize: 13, fontWeight: 600,
                  cursor: airbnbLoading ? 'not-allowed' : 'pointer', marginTop: 6,
                  letterSpacing: '-0.005em',
                  boxShadow: airbnbLoading ? 'none' : SHADOW.sm,
                }}>
                {airbnbLoading ? '⏳ Oppdaterer…' : '🔄 Oppdater analyse med korrigerte verdier'}
              </button>
            </div>
          )}
          {airbnbScore && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Score og trafikklys</div>
              <ScoreKort s={airbnbScore} />
            </div>
          )}
          {airbnbAnalyse && (
            <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 26, marginBottom: 16, boxShadow: SHADOW.sm }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.18em' }}>📊 Fullstendig analyse</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: FARGER.tekstMid }}>{airbnbAnalyse}</div>
            </div>
          )}
          <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gull}33`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Legg til som bolig til vurdering</div>
            <p style={{ fontSize: 13.5, color: FARGER.tekstMid, marginBottom: 16, marginTop: 6, lineHeight: 1.6 }}>Boligen lagres med status «Under vurdering» og en fullverdig PDF-analyse lastes ned automatisk. PDF-en kan sendes til megler/bank fra chat-roboten.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
              <button onClick={() => lagreAnalyseSomProsjekt('utleie')} disabled={!!lagretId} className="knapp-hover-loft" style={{
                background: lagretId ? FARGER.tekstLys : FARGER.mork, color: FARGER.creamLys,
                border: 'none', borderRadius: RADIUS.pill, padding: 14,
                fontSize: 13, fontWeight: 600, cursor: lagretId ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: lagretId ? 'none' : SHADOW.sm,
              }}>Til vurdering — utleie</button>
              <button onClick={() => lagreAnalyseSomProsjekt('flipp')} disabled={!!lagretId} style={{
                background: lagretId ? FARGER.tekstLys : FARGER.hvit,
                color: lagretId ? FARGER.creamLys : FARGER.mork,
                border: `1px solid ${lagretId ? FARGER.tekstLys : FARGER.kantUltralys}`,
                borderRadius: RADIUS.pill, padding: 14,
                fontSize: 13, fontWeight: 600, cursor: lagretId ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.005em',
              }}>Til vurdering — flipp</button>
            </div>
            <div style={{ borderTop: `1px solid ${FARGER.gull}22`, paddingTop: 14 }}>
              <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '0 0 10px', letterSpacing: '0.04em' }}>
                ELLER — auto-fyll alle portal-feltene fra Finn-annonsen i tillegg
              </p>
              <button onClick={lagreTilPortal} disabled={!!lagretId} className="knapp-hover-loft"
                style={{
                  width: '100%',
                  background: lagretId ? FARGER.tekstLys : FARGER.gull,
                  color: FARGER.creamLys, border: 'none',
                  borderRadius: RADIUS.pill, padding: 14,
                  fontSize: 13, fontWeight: 600, cursor: lagretId ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.005em',
                  boxShadow: lagretId ? 'none' : SHADOW.sm,
                }}>
                🌐 Til portal — auto-fyll fra annonsen
              </button>
              <p style={{ fontSize: 12, color: FARGER.tekstLys, margin: '10px 0 0', lineHeight: 1.55 }}>
                Lagrer + setter pris/uke/natt, beskrivelser, fasiliteter, byggeår og tomt fra annonsen. Du gjennomgår og publiserer i Portal-fanen i Regnskap.
              </p>
            </div>
            {lagreMelding && (
              <div className="anim-fade-up" style={{
                marginTop: 14, padding: 14,
                background: lagreMelding.startsWith('✅') ? FARGER.suksessBg : FARGER.feilBg,
                border: `1px solid ${lagreMelding.startsWith('✅') ? '#2D7D4633' : '#C8102E33'}`,
                borderRadius: RADIUS.md, fontSize: 13.5,
                color: lagreMelding.startsWith('✅') ? '#1a4d2b' : '#7a0c1e', fontWeight: 500, lineHeight: 1.55,
              }}>
                {lagreMelding}
              </div>
            )}
            {lagretId && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${FARGER.gull}22` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Send analysen videre</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <button onClick={() => lastNedPdf(lagretId)} disabled={pdfLaster} className="knapp-hover-loft"
                    style={{
                      background: pdfLaster ? FARGER.tekstLys : FARGER.mork,
                      color: FARGER.creamLys, border: 'none',
                      borderRadius: RADIUS.pill, padding: 12,
                      fontSize: 13, fontWeight: 600,
                      cursor: pdfLaster ? 'not-allowed' : 'pointer',
                      letterSpacing: '-0.005em',
                      boxShadow: pdfLaster ? 'none' : SHADOW.sm,
                    }}>
                    {pdfLaster ? '⏳ Bygger PDF…' : '📄 Last ned PDF igjen'}
                  </button>
                  <button onClick={() => apneChatMedProsjekt(lagretId)} className="knapp-hover-loft"
                    style={{
                      background: FARGER.gull, color: FARGER.creamLys, border: 'none',
                      borderRadius: RADIUS.pill, padding: 12,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      letterSpacing: '-0.005em',
                      boxShadow: SHADOW.sm,
                    }}>
                    📧 Send til megler / bank
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: FARGER.tekstMid, marginTop: 12, lineHeight: 1.55 }}>Chat-roboten åpnes med boligen pre-valgt. Be den om å lage e-postutkast til megler eller bank — du får godkjenne før det sendes, og PDF-en blir lagt ved automatisk.</div>
              </div>
            )}
          </div>
          <button onClick={nullstill} style={{
            width: '100%', background: FARGER.hvit, color: FARGER.tekstMid,
            border: `1px solid ${FARGER.kantUltralys}`, padding: 14,
            borderRadius: RADIUS.pill, fontSize: 14, fontWeight: 500,
            cursor: 'pointer', marginTop: 8, marginBottom: 32,
            letterSpacing: '-0.005em',
          }}>🗑️ Nullstill og analyser ny eiendom</button>
        </div>
      )}
    </div>
  )
}

function CatFakta({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#1a4d2b', opacity: 0.7, marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1a4d2b', letterSpacing: '-0.01em' }}>{val}</div>
    </div>
  )
}
