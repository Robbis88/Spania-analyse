'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { tomtProsjekt, type Prosjekt } from '../types'
import { FARGER, RADIUS } from '../lib/styles'
import { visToast } from '../lib/toast'
import { byggNorskFlippePdf } from '../lib/pdfNorsk'

type Analyse = {
  tittel?: string
  pris_antydning_nok?: number
  type?: string
  eierform?: string
  by?: string
  bydel?: string
  adresse?: string
  areal_bra?: number
  areal_p_rom?: number
  soverom?: number
  bad?: number
  byggear?: number
  energimerke?: string
  fellesgjeld_nok?: number
  fellesutgifter_mnd_nok?: number
  kommunale_avg_aar_nok?: number
  tomt_m2?: number
  tomt_type?: string
  markedspris_nasitt_m2_nok?: number
  markedspris_bra_m2_nok?: number
  markedspris_topp_m2_nok?: number
  markedspris_begrunnelse?: string
  oppussing_vurdering?: string
  ai_vurdering?: string
  anbefalt_strategi?: string
  annonse_beskrivelse?: string
  kort_oppsummering?: string
  neste_steg?: string[]
  score?: {
    lokasjon?: number
    lokasjon_begrunnelse?: string
    eiendomsstand?: number
    eiendomsstand_begrunnelse?: string
    pris_vs_marked?: number
    pris_vs_marked_begrunnelse?: string
    oppussingspotensial?: number
    oppussingspotensial_begrunnelse?: string
    risiko?: number
    risiko_begrunnelse?: string
    total?: number
    lys?: string
    lys_tekst?: string
    tips?: string[]
  }
  bud_strategi?: {
    anbefalt_startbud_nok?: number
    startbud_pst_under_prisantydning?: number
    anbefalt_maks_bud_nok?: number
    maks_bud_pst_av_prisantydning?: number
    begrunnelse?: string
  }
  foreslatte_oppussingsposter?: Array<{ navn: string; kostnad_nok: number; begrunnelse?: string }>
}

type Kalk = {
  // Kjøp
  kjopesum: number
  fellesgjeld: number
  dokumentavgift_pst: number
  tinglysing: number
  // Oppussing
  oppussing_kost: number
  mobler_styling: number
  // Hold
  holdetid_mnd: number
  rente_pst: number
  egenkapital_pst: number
  fellesutg_mnd: number
  // Salg
  salgspris: number
  meglerhonorar_pst: number
  marknadsforing: number
  // Skatt
  skattefri: boolean
  skattesats_pst: number
}

const fmtNok = (n: number) => Math.round(n).toLocaleString('nb-NO') + ' kr'
const fmtPct = (n: number) => n.toFixed(1) + ' %'

export function NorskeBoliger({ onTilbake }: { onTilbake: () => void }) {
  const [input, setInput] = useState('')
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  const [laster, setLaster] = useState(false)
  const [feil, setFeil] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [lagretId, setLagretId] = useState<string | null>(null)

  const [kalk, setKalk] = useState<Kalk>({
    kjopesum: 0, fellesgjeld: 0,
    dokumentavgift_pst: 2.5, tinglysing: 1140,
    oppussing_kost: 0, mobler_styling: 25000,
    holdetid_mnd: 6, rente_pst: 5.5, egenkapital_pst: 35,
    fellesutg_mnd: 0,
    salgspris: 0, meglerhonorar_pst: 2.0, marknadsforing: 25000,
    skattefri: false, skattesats_pst: 22,
  })

  const [oppussingsposter, setOppussingsposter] = useState<Array<{ navn: string; kostnad: number; notat: string }>>([])
  const [nyPostNavn, setNyPostNavn] = useState('')
  const [pdfLaster, setPdfLaster] = useState(false)

  function fyllFraAnalyse(a: Analyse) {
    // Pre-utfyll oppussingsposter fra AI-forslag
    const foreslatte = (a.foreslatte_oppussingsposter || []).map(p => ({
      navn: p.navn || '',
      kostnad: p.kostnad_nok || 0,
      notat: p.begrunnelse || '',
    })).filter(p => p.navn)
    setOppussingsposter(foreslatte)
    const sumPoster = foreslatte.reduce((s, p) => s + p.kostnad, 0)

    setKalk(k => ({
      ...k,
      kjopesum: a.pris_antydning_nok || k.kjopesum,
      fellesgjeld: a.fellesgjeld_nok || 0,
      // Selveier har dokumentavgift, andel/aksje har det ikke
      dokumentavgift_pst: (a.eierform === 'Andel' || a.eierform === 'Aksje') ? 0 : 2.5,
      fellesutg_mnd: a.fellesutgifter_mnd_nok || 0,
      oppussing_kost: sumPoster || k.oppussing_kost,
      // Foreslå salgspris basert på bra-standard m²-pris om det finnes
      salgspris: a.markedspris_bra_m2_nok && a.areal_bra
        ? Math.round(a.markedspris_bra_m2_nok * a.areal_bra / 1000) * 1000
        : k.salgspris,
    }))
  }

  // Når oppussingsposter endres, sync sum til kalkulator
  useEffect(() => {
    const sum = oppussingsposter.reduce((s, p) => s + (p.kostnad || 0), 0)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKalk(k => k.oppussing_kost === sum ? k : { ...k, oppussing_kost: sum })
  }, [oppussingsposter])

  function leggTilPost(navn = '', kostnad = 0) {
    setOppussingsposter(p => [...p, { navn: navn || nyPostNavn || 'Ny post', kostnad, notat: '' }])
    setNyPostNavn('')
  }
  function fjernPost(i: number) {
    setOppussingsposter(p => p.filter((_, idx) => idx !== i))
  }
  function oppdaterPost(i: number, felt: 'navn' | 'kostnad' | 'notat', verdi: string | number) {
    setOppussingsposter(p => p.map((post, idx) => idx === i ? { ...post, [felt]: verdi } : post))
  }

  async function analyser() {
    if (!input.trim() || laster) return
    setLaster(true); setFeil(''); setAnalyse(null); setLagretId(null)
    try {
      const res = await fetch('/api/analyse-norge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyText: input }),
      })
      const data = await res.json()
      if (data.error) {
        setFeil(data.error)
      } else {
        setAnalyse(data)
        fyllFraAnalyse(data)
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Ukjent feil')
    }
    setLaster(false)
  }

  // === KALKULATOR ===
  const beregning = useMemo(() => {
    const totalKjopspris = kalk.kjopesum + kalk.fellesgjeld
    const dokavg = (kalk.kjopesum * kalk.dokumentavgift_pst) / 100
    const kjopskostnader = dokavg + kalk.tinglysing
    const totalKjop = kalk.kjopesum + kjopskostnader

    const oppussingTotal = kalk.oppussing_kost + kalk.mobler_styling

    // Lånekostnad i holdetiden
    const lanebelop = totalKjop * (1 - kalk.egenkapital_pst / 100)
    const renterPerMnd = (lanebelop * kalk.rente_pst / 100) / 12
    const renterTotal = renterPerMnd * kalk.holdetid_mnd
    const fellesutgTotal = kalk.fellesutg_mnd * kalk.holdetid_mnd
    const holdekostnad = renterTotal + fellesutgTotal

    const totalInvestering = totalKjop + oppussingTotal + holdekostnad

    // Salg
    const meglerhonorar = (kalk.salgspris * kalk.meglerhonorar_pst) / 100
    const salgskostnader = meglerhonorar + kalk.marknadsforing
    const nettoSalg = kalk.salgspris - salgskostnader

    // Brutto fortjeneste før skatt
    // For norsk skatt: gevinst regnes mot kjøpesum + dokavg + faktiske oppussingskostnader (ikke holdekostnader/renter)
    const skattegrunnlag = nettoSalg - (kalk.kjopesum + kjopskostnader + kalk.oppussing_kost + kalk.mobler_styling)
    const skatt = kalk.skattefri || skattegrunnlag <= 0 ? 0 : (skattegrunnlag * kalk.skattesats_pst) / 100

    const nettoFortjeneste = nettoSalg - totalInvestering - skatt
    const egenkapital = totalInvestering - lanebelop
    const roi = egenkapital > 0 ? (nettoFortjeneste / egenkapital) * 100 : 0

    return {
      totalKjopspris, dokavg, kjopskostnader, totalKjop,
      oppussingTotal, lanebelop, renterTotal, fellesutgTotal, holdekostnad,
      totalInvestering, meglerhonorar, salgskostnader, nettoSalg,
      skattegrunnlag, skatt, nettoFortjeneste, egenkapital, roi,
    }
  }, [kalk])

  async function lagreSomProsjekt() {
    if (!analyse || lagrer) return
    setLagrer(true)
    try {
      const navn = analyse.tittel || analyse.adresse || `${analyse.type} ${analyse.by || ''}`.trim() || 'Norsk bolig'
      const id = Date.now().toString()
      const bruker = hentAktivBruker() || 'ukjent'

      const nytt: Prosjekt = {
        ...tomtProsjekt(),
        id,
        navn,
        kategori: 'flipp',
        status: 'Under vurdering',
        kjøpesum: kalk.kjopesum,
        kjøpskostnader: Math.round(beregning.kjopskostnader),
        oppussingsbudsjett: kalk.oppussing_kost,
        møblering: kalk.mobler_styling,
        forventet_salgsverdi: kalk.salgspris,
        notater:
          `Norsk flippe-prosjekt — lagret ${new Date().toLocaleDateString('nb-NO')}\n\n` +
          `Type: ${analyse.type || '-'}\n` +
          `Eierform: ${analyse.eierform || '-'}\n` +
          `Beliggenhet: ${[analyse.bydel, analyse.by].filter(Boolean).join(', ') || '-'}\n` +
          `BRA: ${analyse.areal_bra || '-'} m²\n` +
          `Byggeår: ${analyse.byggear || '-'}\n\n` +
          `--- Flippe-kalkulator ---\n` +
          `Kjøpesum: ${fmtNok(kalk.kjopesum)}\n` +
          `Total investering: ${fmtNok(beregning.totalInvestering)}\n` +
          `Forventet salgssum: ${fmtNok(kalk.salgspris)}\n` +
          `Netto fortjeneste: ${fmtNok(beregning.nettoFortjeneste)}\n` +
          `ROI på egenkapital: ${fmtPct(beregning.roi)}\n\n` +
          (analyse.ai_vurdering ? `--- AI-vurdering ---\n${analyse.ai_vurdering}` : ''),
        ai_vurdering: analyse.ai_vurdering || null,
      }

      const norskeFelter = {
        marked: 'norge',
        eierform: analyse.eierform || null,
        fellesgjeld_nok: kalk.fellesgjeld || null,
        fellesutgifter_mnd_nok: kalk.fellesutg_mnd || null,
        kommunale_avgifter_aar_nok: analyse.kommunale_avg_aar_nok || null,
        energimerke: analyse.energimerke || null,
        adresse: analyse.adresse || null,
      }

      const { error } = await supabase.from('prosjekter').insert([{ ...nytt, ...norskeFelter, bruker }])
      if (error) {
        visToast('Lagring feilet: ' + error.message, 'feil', 5000)
      } else {
        await loggAktivitet({ handling: 'lagret norsk flippe-prosjekt', tabell: 'prosjekter', rad_id: id, detaljer: { navn } })
        setLagretId(id)
        visToast('Lagret! Finn det under Regnskap', 'suksess', 4000)
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      visToast('Lagring feilet: ' + m, 'feil', 5000)
    }
    setLagrer(false)
  }

  async function lastNedPdf() {
    if (!analyse || pdfLaster) return
    setPdfLaster(true)
    try {
      const pdf = await byggNorskFlippePdf({
        analyse,
        kalk,
        beregning,
        oppussingsposter,
      })
      const bin = atob(pdf.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdf.filnavn
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      visToast('PDF lastet ned: ' + pdf.filnavn, 'suksess', 3500)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      visToast('PDF-bygging feilet: ' + m, 'feil', 5000)
    }
    setPdfLaster(false)
  }

  function nullstill() {
    setInput(''); setAnalyse(null); setFeil(''); setLagretId(null)
    setKalk({
      kjopesum: 0, fellesgjeld: 0,
      dokumentavgift_pst: 2.5, tinglysing: 1140,
      oppussing_kost: 0, mobler_styling: 25000,
      holdetid_mnd: 6, rente_pst: 5.5, egenkapital_pst: 35,
      fellesutg_mnd: 0,
      salgspris: 0, meglerhonorar_pst: 2.0, marknadsforing: 25000,
      skattefri: false, skattesats_pst: 22,
    })
  }

  return (
    <div>
      <button onClick={onTilbake}
        style={{ background: FARGER.flateLys, border: 'none', borderRadius: RADIUS.sm, padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginBottom: 20, color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        ← Tilbake
      </button>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 10 }}>NORGE — FLIPP</div>
        <h2 style={{ fontSize: 28, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.01em' }}>Norske boliger</h2>
        <p style={{ color: FARGER.tekstMid, margin: '6px 0 0', fontSize: 14, fontWeight: 300 }}>Analyser en Finn-annonse og kjør flippe-kalkulator</p>
      </div>

      <div style={{ background: FARGER.creamLys, borderRadius: RADIUS.sm, padding: 20, marginBottom: 24, border: `1px solid ${FARGER.gullSvak}` }}>
        <label style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Lim inn Finn-lenke eller annonsetekst</label>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="https://www.finn.no/realestate/homes/ad.html?finnkode=..."
          style={{ width: '100%', height: 90, padding: 12, fontSize: 14, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, resize: 'vertical', fontFamily: 'sans-serif', boxSizing: 'border-box', background: 'white' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={analyser} disabled={laster || !input}
            style={{ flex: 1, background: laster ? '#888' : FARGER.mork, color: 'white', border: 'none', padding: 14, borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: laster ? 'not-allowed' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {laster ? 'Analyserer...' : 'Kjør analyse'}
          </button>
          {(input || analyse) && <button onClick={nullstill}
            style={{ background: FARGER.flateLys, color: FARGER.tekstMid, border: 'none', padding: '14px 20px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Nullstill
          </button>}
        </div>
        {feil && <div style={{ marginTop: 10, padding: 10, background: FARGER.feilBg, color: FARGER.feil, borderRadius: RADIUS.sm, fontSize: 13 }}>{feil}</div>}
      </div>

      {analyse && (
        <>
          <AnalyseSammendrag a={analyse} />
          {analyse.score && <FlippeScore s={analyse.score} />}
          {analyse.bud_strategi && <BudStrategi b={analyse.bud_strategi} prisantydning={analyse.pris_antydning_nok || 0} />}
          <OppussingsPoster
            poster={oppussingsposter}
            onLeggTil={leggTilPost}
            onFjern={fjernPost}
            onOppdater={oppdaterPost}
            nyPostNavn={nyPostNavn}
            setNyPostNavn={setNyPostNavn}
          />
          <Kalkulator kalk={kalk} setKalk={setKalk} beregning={beregning} oppussingFraPoster={oppussingsposter.length > 0} />
          <Sensitivitet kalk={kalk} basis={beregning} />

          <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <button onClick={lagreSomProsjekt} disabled={lagrer || !!lagretId}
                style={{ background: lagretId ? FARGER.suksess : (lagrer ? '#888' : FARGER.mork), color: 'white', border: 'none', padding: 14, borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: lagrer || lagretId ? 'default' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {lagretId ? '✓ Lagret som prosjekt' : (lagrer ? 'Lagrer...' : '💾 Lagre som prosjekt')}
              </button>
              <button onClick={lastNedPdf} disabled={pdfLaster}
                style={{ background: pdfLaster ? '#888' : 'transparent', color: pdfLaster ? 'white' : FARGER.mork, border: `1px solid ${FARGER.gull}`, padding: 14, borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: pdfLaster ? 'wait' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {pdfLaster ? 'Bygger PDF...' : '📄 Last ned PDF-prospekt'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '10px 0 0' }}>PDF-en inneholder boligfakta, score, kalkulator-resultater, oppussingsposter og bud-strategi — klar til bankmøte.</p>
          </div>
        </>
      )}
    </div>
  )
}

function AnalyseSammendrag({ a }: { a: Analyse }) {
  const fakta: Array<[string, string]> = []
  if (a.type) fakta.push(['Type', a.type])
  if (a.eierform) fakta.push(['Eierform', a.eierform])
  if (a.bydel || a.by) fakta.push(['Beliggenhet', [a.bydel, a.by].filter(Boolean).join(', ')])
  if (a.areal_bra) fakta.push(['BRA', `${a.areal_bra} m²`])
  if (a.soverom) fakta.push(['Soverom', String(a.soverom)])
  if (a.bad) fakta.push(['Bad', String(a.bad)])
  if (a.byggear) fakta.push(['Byggeår', String(a.byggear)])
  if (a.energimerke) fakta.push(['Energimerke', a.energimerke])

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 400, color: FARGER.mork, margin: '0 0 6px', letterSpacing: '-0.005em' }}>{a.tittel || a.adresse || 'Bolig'}</h3>
      {a.adresse && a.tittel && <div style={{ fontSize: 13, color: FARGER.tekstMid, marginBottom: 14 }}>{a.adresse}</div>}

      {fakta.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 16 }}>
          {fakta.map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontSize: 10, color: FARGER.tekstLys, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{lbl}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: FARGER.mork }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {a.markedspris_begrunnelse && (
        <div style={{ background: FARGER.creamLys, padding: 14, borderRadius: RADIUS.sm, marginTop: 12 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Markedspris-vurdering</div>
          <p style={{ fontSize: 13, color: FARGER.tekstMork, lineHeight: 1.6, margin: 0 }}>{a.markedspris_begrunnelse}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
            {[
              ['Som er nå', a.markedspris_nasitt_m2_nok],
              ['Bra standard', a.markedspris_bra_m2_nok],
              ['Toppstand', a.markedspris_topp_m2_nok],
            ].map(([lbl, val]) => (
              <div key={lbl as string} style={{ background: 'white', padding: 10, borderRadius: RADIUS.sm, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{val ? fmtNok(val as number) + '/m²' : '–'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {a.ai_vurdering && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>AI-vurdering</div>
          <p style={{ fontSize: 13, color: FARGER.tekstMork, lineHeight: 1.7, margin: 0, fontWeight: 300 }}>{a.ai_vurdering}</p>
        </div>
      )}

      {a.oppussing_vurdering && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Oppussing</div>
          <p style={{ fontSize: 13, color: FARGER.tekstMork, lineHeight: 1.7, margin: 0, fontWeight: 300 }}>{a.oppussing_vurdering}</p>
        </div>
      )}
    </div>
  )
}

type Beregning = {
  totalKjopspris: number; dokavg: number; kjopskostnader: number; totalKjop: number
  oppussingTotal: number; lanebelop: number; renterTotal: number; fellesutgTotal: number; holdekostnad: number
  totalInvestering: number; meglerhonorar: number; salgskostnader: number; nettoSalg: number
  skattegrunnlag: number; skatt: number; nettoFortjeneste: number; egenkapital: number; roi: number
}

function Kalkulator({ kalk, setKalk, beregning, oppussingFraPoster }: { kalk: Kalk; setKalk: (k: Kalk) => void; beregning: Beregning; oppussingFraPoster: boolean }) {
  const oppdater = (felt: keyof Kalk, verdi: number | boolean) => setKalk({ ...kalk, [felt]: verdi })

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>Flippe-kalkulator</div>

      <Seksjon tittel="Kjøp">
        <KalkFelt lbl="Kjøpesum" val={kalk.kjopesum} onChange={v => oppdater('kjopesum', v)} />
        <KalkFelt lbl="Fellesgjeld" val={kalk.fellesgjeld} onChange={v => oppdater('fellesgjeld', v)} />
        <KalkFelt lbl="Dokumentavgift %" val={kalk.dokumentavgift_pst} onChange={v => oppdater('dokumentavgift_pst', v)} step={0.1} />
        <KalkFelt lbl="Tinglysing" val={kalk.tinglysing} onChange={v => oppdater('tinglysing', v)} />
        <Resultatlinje lbl="Sum kjøpskostnader" val={beregning.kjopskostnader} />
        <Resultatlinje lbl="Total kjøp (inkl. avg.)" val={beregning.totalKjop} bold />
      </Seksjon>

      <Seksjon tittel="Oppussing">
        {oppussingFraPoster ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: FARGER.tekstMid, fontStyle: 'italic' }}>
            <span>Oppussing (sum fra poster ovenfor)</span>
            <span style={{ color: FARGER.mork, fontWeight: 600, fontStyle: 'normal' }}>{fmtNok(kalk.oppussing_kost)}</span>
          </div>
        ) : (
          <KalkFelt lbl="Oppussing" val={kalk.oppussing_kost} onChange={v => oppdater('oppussing_kost', v)} />
        )}
        <KalkFelt lbl="Møblering / styling" val={kalk.mobler_styling} onChange={v => oppdater('mobler_styling', v)} />
      </Seksjon>

      <Seksjon tittel="Holde-kostnader">
        <KalkFelt lbl="Holdetid (mnd)" val={kalk.holdetid_mnd} onChange={v => oppdater('holdetid_mnd', v)} step={1} />
        <KalkFelt lbl="Rente %" val={kalk.rente_pst} onChange={v => oppdater('rente_pst', v)} step={0.1} />
        <KalkFelt lbl="Egenkapital %" val={kalk.egenkapital_pst} onChange={v => oppdater('egenkapital_pst', v)} step={1} />
        <KalkFelt lbl="Fellesutgifter / mnd" val={kalk.fellesutg_mnd} onChange={v => oppdater('fellesutg_mnd', v)} />
        <Resultatlinje lbl={`Renter ${kalk.holdetid_mnd} mnd`} val={beregning.renterTotal} />
        <Resultatlinje lbl={`Fellesutg. ${kalk.holdetid_mnd} mnd`} val={beregning.fellesutgTotal} />
      </Seksjon>

      <Seksjon tittel="Salg">
        <KalkFelt lbl="Forventet salgssum" val={kalk.salgspris} onChange={v => oppdater('salgspris', v)} />
        <KalkFelt lbl="Meglerhonorar %" val={kalk.meglerhonorar_pst} onChange={v => oppdater('meglerhonorar_pst', v)} step={0.1} />
        <KalkFelt lbl="Markedsføring / takst" val={kalk.marknadsforing} onChange={v => oppdater('marknadsforing', v)} />
        <Resultatlinje lbl="Meglerhonorar" val={beregning.meglerhonorar} />
        <Resultatlinje lbl="Netto salg" val={beregning.nettoSalg} bold />
      </Seksjon>

      <Seksjon tittel="Skatt">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', padding: '6px 0' }}>
          <input type="checkbox" checked={kalk.skattefri} onChange={e => oppdater('skattefri', e.target.checked)} style={{ width: 18, height: 18 }} />
          <span>Skattefri (bodd 12 av siste 24 mnd)</span>
        </label>
        {!kalk.skattefri && <KalkFelt lbl="Skattesats %" val={kalk.skattesats_pst} onChange={v => oppdater('skattesats_pst', v)} step={1} />}
        <Resultatlinje lbl="Skattegrunnlag (gevinst)" val={beregning.skattegrunnlag} />
        <Resultatlinje lbl="Skatt" val={beregning.skatt} />
      </Seksjon>

      <div style={{
        background: beregning.nettoFortjeneste >= 0 ? '#1a4d2b' : '#7a0c1e',
        color: 'white', borderRadius: RADIUS.sm, padding: 22, marginTop: 14,
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Resultat</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
          Total investering {fmtNok(beregning.totalInvestering)} · Egenkapital {fmtNok(beregning.egenkapital)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Netto fortjeneste</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{fmtNok(beregning.nettoFortjeneste)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.12em', textTransform: 'uppercase' }}>ROI på egenkapital</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{fmtPct(beregning.roi)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Pure-funksjon som kan kjøres med vilkårlige Kalk-verdier — gjenbrukes
// i sensitivitetsanalysen for å regne ut "hva-hvis"-scenarier.
function regnUt(k: Kalk): Beregning {
  const totalKjopspris = k.kjopesum + k.fellesgjeld
  const dokavg = (k.kjopesum * k.dokumentavgift_pst) / 100
  const kjopskostnader = dokavg + k.tinglysing
  const totalKjop = k.kjopesum + kjopskostnader

  const oppussingTotal = k.oppussing_kost + k.mobler_styling

  const lanebelop = totalKjop * (1 - k.egenkapital_pst / 100)
  const renterPerMnd = (lanebelop * k.rente_pst / 100) / 12
  const renterTotal = renterPerMnd * k.holdetid_mnd
  const fellesutgTotal = k.fellesutg_mnd * k.holdetid_mnd
  const holdekostnad = renterTotal + fellesutgTotal

  const totalInvestering = totalKjop + oppussingTotal + holdekostnad

  const meglerhonorar = (k.salgspris * k.meglerhonorar_pst) / 100
  const salgskostnader = meglerhonorar + k.marknadsforing
  const nettoSalg = k.salgspris - salgskostnader

  const skattegrunnlag = nettoSalg - (k.kjopesum + kjopskostnader + k.oppussing_kost + k.mobler_styling)
  const skatt = k.skattefri || skattegrunnlag <= 0 ? 0 : (skattegrunnlag * k.skattesats_pst) / 100

  const nettoFortjeneste = nettoSalg - totalInvestering - skatt
  const egenkapital = totalInvestering - lanebelop
  const roi = egenkapital > 0 ? (nettoFortjeneste / egenkapital) * 100 : 0

  return {
    totalKjopspris, dokavg, kjopskostnader, totalKjop,
    oppussingTotal, lanebelop, renterTotal, fellesutgTotal, holdekostnad,
    totalInvestering, meglerhonorar, salgskostnader, nettoSalg,
    skattegrunnlag, skatt, nettoFortjeneste, egenkapital, roi,
  }
}

function Sensitivitet({ kalk, basis }: { kalk: Kalk; basis: Beregning }) {
  // Scenarier — hver justerer ett felt
  const scenarier: Array<{ navn: string; emoji: string; resultat: Beregning }> = [
    { navn: 'Salgspris −5 %', emoji: '📉', resultat: regnUt({ ...kalk, salgspris: kalk.salgspris * 0.95 }) },
    { navn: 'Salgspris −10 %', emoji: '📉', resultat: regnUt({ ...kalk, salgspris: kalk.salgspris * 0.9 }) },
    { navn: 'Oppussing +20 %', emoji: '🔨', resultat: regnUt({ ...kalk, oppussing_kost: kalk.oppussing_kost * 1.2 }) },
    { navn: 'Holdetid +3 mnd', emoji: '⏱️', resultat: regnUt({ ...kalk, holdetid_mnd: kalk.holdetid_mnd + 3 }) },
    { navn: 'Rente +1 %', emoji: '💸', resultat: regnUt({ ...kalk, rente_pst: kalk.rente_pst + 1 }) },
  ]

  // Break-even: hvor lavt kan salgsprisen gå før netto = 0?
  // Vi prøver lineær søk fra dagens salgspris og ned
  let breakEven = 0
  if (kalk.salgspris > 0) {
    let lavt = kalk.kjopesum, hoyt = kalk.salgspris
    for (let i = 0; i < 40; i++) {
      const midt = (lavt + hoyt) / 2
      const r = regnUt({ ...kalk, salgspris: midt })
      if (r.nettoFortjeneste >= 0) hoyt = midt
      else lavt = midt
    }
    breakEven = Math.round((lavt + hoyt) / 2)
  }

  const breakEvenDelta = breakEven > 0 ? ((kalk.salgspris - breakEven) / kalk.salgspris) * 100 : 0

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>📊 Sensitivitet</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 18px', fontWeight: 300 }}>
        Hvor robust er kalkulasjonen? Tabellen viser hva som skjer hvis ting går mot deg.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${FARGER.kantLys}` }}>
              <th style={tdStil(true, 'left')}>Scenario</th>
              <th style={tdStil(true, 'right')}>Netto fortjeneste</th>
              <th style={tdStil(true, 'right')}>ROI på EK</th>
              <th style={tdStil(true, 'right')}>Endring</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${FARGER.kantLys}`, background: FARGER.creamLys }}>
              <td style={tdStil(false, 'left', true)}>📍 Som kalkulert (basis)</td>
              <td style={tdStil(false, 'right', true, basis.nettoFortjeneste >= 0 ? '#1a4d2b' : '#7a0c1e')}>{fmtNok(basis.nettoFortjeneste)}</td>
              <td style={tdStil(false, 'right', true)}>{fmtPct(basis.roi)}</td>
              <td style={tdStil(false, 'right')}>—</td>
            </tr>
            {scenarier.map((s, i) => {
              const delta = s.resultat.nettoFortjeneste - basis.nettoFortjeneste
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${FARGER.kantLys}` }}>
                  <td style={tdStil(false, 'left')}>{s.emoji} {s.navn}</td>
                  <td style={tdStil(false, 'right', false, s.resultat.nettoFortjeneste >= 0 ? '#1a4d2b' : '#7a0c1e')}>{fmtNok(s.resultat.nettoFortjeneste)}</td>
                  <td style={tdStil(false, 'right')}>{fmtPct(s.resultat.roi)}</td>
                  <td style={tdStil(false, 'right', false, delta < 0 ? '#7a0c1e' : '#1a4d2b')}>{delta >= 0 ? '+' : ''}{fmtNok(delta)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {breakEven > 0 && (
        <div style={{
          background: breakEvenDelta > 10 ? '#e8f5ed' : breakEvenDelta > 5 ? '#fff8e1' : '#fde8ec',
          border: `1px solid ${breakEvenDelta > 10 ? '#2D7D46' : breakEvenDelta > 5 ? '#B05E0A' : '#C8102E'}`,
          padding: 14, borderRadius: RADIUS.sm, marginTop: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4, color: breakEvenDelta > 10 ? '#1a4d2b' : breakEvenDelta > 5 ? '#6b3a0a' : '#7a0c1e' }}>
              ⚖️ Break-even salgspris
            </div>
            <div style={{ fontSize: 14, color: FARGER.tekstMid, lineHeight: 1.5 }}>
              Salgsprisen kan synke til <strong>{fmtNok(breakEven)}</strong> før du går i null.<br />
              Det er <strong>{breakEvenDelta.toFixed(1)} %</strong> margin under nåværende estimat.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function tdStil(header: boolean, align: 'left' | 'right', bold = false, color?: string): React.CSSProperties {
  return {
    padding: header ? '10px 8px' : '12px 8px',
    textAlign: align,
    fontSize: header ? 11 : 13,
    fontWeight: bold || header ? 600 : 400,
    color: color || (header ? FARGER.tekstMid : FARGER.tekstMork),
    letterSpacing: header ? '0.06em' : 'normal',
    textTransform: header ? 'uppercase' : 'none',
    whiteSpace: 'nowrap',
  }
}

const TYPISKE_POSTER = ['Bad', 'Kjøkken', 'Maling og overflater', 'Gulv', 'Vinduer', 'Elektro', 'Rør', 'Yttervegger', 'Tak', 'Hage', 'Fasade', 'Garderobe']

function OppussingsPoster({ poster, onLeggTil, onFjern, onOppdater, nyPostNavn, setNyPostNavn }: {
  poster: Array<{ navn: string; kostnad: number; notat: string }>
  onLeggTil: (navn?: string, kostnad?: number) => void
  onFjern: (i: number) => void
  onOppdater: (i: number, felt: 'navn' | 'kostnad' | 'notat', verdi: string | number) => void
  nyPostNavn: string
  setNyPostNavn: (v: string) => void
}) {
  const sum = poster.reduce((s, p) => s + (p.kostnad || 0), 0)
  const ubrukteForslagene = TYPISKE_POSTER.filter(t => !poster.some(p => p.navn === t))

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, textTransform: 'uppercase' }}>🔨 Oppussingsbudsjett</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.mork }}>Sum: {fmtNok(sum)}</div>
      </div>

      {poster.length === 0 && (
        <div style={{ background: FARGER.creamLys, padding: 16, borderRadius: RADIUS.sm, fontSize: 13, color: FARGER.tekstMid, marginBottom: 14, fontStyle: 'italic', textAlign: 'center' }}>
          Ingen poster ennå. Bruk forslag eller legg til selv nedenfor.
        </div>
      )}

      {poster.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {poster.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: i < poster.length - 1 ? `1px solid ${FARGER.kantLys}` : 'none' }}>
              <input value={p.navn} onChange={e => onOppdater(i, 'navn', e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white' }} />
              <input type="number" min={0} step={1000} value={p.kostnad || ''}
                onChange={e => onOppdater(i, 'kostnad', Number(e.target.value) || 0)}
                style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
              <button onClick={() => onFjern(i)} title="Fjern post"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '4px 8px' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {ubrukteForslagene.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Hurtig-forslag</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ubrukteForslagene.map(navn => (
              <button key={navn} onClick={() => onLeggTil(navn)}
                style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: '5px 12px', fontSize: 12, color: FARGER.mork, cursor: 'pointer' }}>
                + {navn}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${FARGER.kantLys}` }}>
        <input value={nyPostNavn} onChange={e => setNyPostNavn(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onLeggTil()}
          placeholder="Egendefinert post..."
          style={{ flex: 1, padding: '8px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white' }} />
        <button onClick={() => onLeggTil()} disabled={!nyPostNavn.trim()}
          style={{ background: nyPostNavn.trim() ? FARGER.mork : '#888', color: 'white', border: 'none', borderRadius: RADIUS.sm, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: nyPostNavn.trim() ? 'pointer' : 'not-allowed', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          + Legg til
        </button>
      </div>
    </div>
  )
}

function FlippeScore({ s }: { s: NonNullable<Analyse['score']> }) {
  const lys = s.lys || '🟡'
  const lysBg = lys.includes('🟢') ? '#e8f5ed' : lys.includes('🔴') ? '#fde8ec' : '#fff8e1'
  const lysBorder = lys.includes('🟢') ? '#2D7D46' : lys.includes('🔴') ? '#C8102E' : '#B05E0A'
  const lysText = lys.includes('🟢') ? '#1a4d2b' : lys.includes('🔴') ? '#7a0c1e' : '#6b3a0a'

  const delkar: Array<[string, number | undefined, string | undefined]> = [
    ['Lokasjon', s.lokasjon, s.lokasjon_begrunnelse],
    ['Eiendomsstand', s.eiendomsstand, s.eiendomsstand_begrunnelse],
    ['Pris vs marked', s.pris_vs_marked, s.pris_vs_marked_begrunnelse],
    ['Oppussings-potensial', s.oppussingspotensial, s.oppussingspotensial_begrunnelse],
    ['Risiko', s.risiko, s.risiko_begrunnelse],
  ]

  return (
    <div style={{ background: lysBg, border: `2px solid ${lysBorder}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 48 }}>{lys}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.16em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Flippe-vurdering</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: lysText }}>{s.lys_tekst || ''}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: lysText, lineHeight: 1 }}>{(s.total ?? 0).toFixed(1)}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>/ 10</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        {delkar.map(([lbl, val, beg]) => (
          <div key={lbl} title={beg || ''} style={{ background: 'rgba(255,255,255,0.7)', padding: 12, borderRadius: RADIUS.sm }}>
            <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 4 }}>{lbl}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (val ?? 0) >= 7 ? '#2D7D46' : (val ?? 0) >= 5 ? '#B05E0A' : '#C8102E' }}>{val ?? '–'}</div>
            <div style={{ background: '#e0e0e0', borderRadius: 3, height: 4, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(val ?? 0) * 10}%`, height: 4, background: (val ?? 0) >= 7 ? '#2D7D46' : (val ?? 0) >= 5 ? '#EF9F27' : '#C8102E' }} />
            </div>
          </div>
        ))}
      </div>

      {s.tips && s.tips.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.85)', borderRadius: RADIUS.sm, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: FARGER.tekstMork }}>💡 Hva må til for bedre score?</div>
          {s.tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 13, padding: '5px 0', color: FARGER.tekstMid, borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none', lineHeight: 1.5 }}>
              → {tip}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BudStrategi({ b, prisantydning }: { b: NonNullable<Analyse['bud_strategi']>; prisantydning: number }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}>🎯 Bud-strategi</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
        {prisantydning > 0 && (
          <div style={{ background: FARGER.creamLys, padding: 14, borderRadius: RADIUS.sm }}>
            <div style={{ fontSize: 10, color: FARGER.tekstLys, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Prisantydning</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: FARGER.tekstMid }}>{fmtNok(prisantydning)}</div>
          </div>
        )}
        <div style={{ background: '#fdfcf7', padding: 14, borderRadius: RADIUS.sm, border: `1px solid #b89a6f44` }}>
          <div style={{ fontSize: 10, color: FARGER.tekstLys, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Anbefalt startbud</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: FARGER.mork }}>{fmtNok(b.anbefalt_startbud_nok || 0)}</div>
          {b.startbud_pst_under_prisantydning ? (
            <div style={{ fontSize: 11, color: FARGER.tekstMid, marginTop: 4 }}>{b.startbud_pst_under_prisantydning}% under prisantydning</div>
          ) : null}
        </div>
        <div style={{ background: '#e8f5ed', padding: 14, borderRadius: RADIUS.sm, border: `1px solid #2D7D4644` }}>
          <div style={{ fontSize: 10, color: FARGER.tekstLys, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Maks-bud</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a4d2b' }}>{fmtNok(b.anbefalt_maks_bud_nok || 0)}</div>
          {b.maks_bud_pst_av_prisantydning ? (
            <div style={{ fontSize: 11, color: FARGER.tekstMid, marginTop: 4 }}>{b.maks_bud_pst_av_prisantydning}% av prisantydning</div>
          ) : null}
        </div>
      </div>

      {b.begrunnelse && (
        <p style={{ fontSize: 13, color: FARGER.tekstMork, lineHeight: 1.7, margin: 0, fontWeight: 300 }}>{b.begrunnelse}</p>
      )}
    </div>
  )
}

function Seksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.tekstMid, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>{tittel}</div>
      <div>{children}</div>
    </div>
  )
}

function KalkFelt({ lbl, val, onChange, step = 1000 }: { lbl: string; val: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, padding: '6px 0', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: FARGER.tekstMork, fontWeight: 300 }}>{lbl}</span>
      <input type="number" min={0} step={step} value={val || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
    </div>
  )
}

function Resultatlinje({ lbl, val, bold }: { lbl: string; val: number; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${FARGER.kantLys}`, fontSize: 13 }}>
      <span style={{ color: FARGER.tekstMid, fontWeight: bold ? 600 : 400 }}>{lbl}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: FARGER.mork }}>{fmtNok(val)}</span>
    </div>
  )
}
