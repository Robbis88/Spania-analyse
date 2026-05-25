'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loggAktivitet } from '../lib/logg'
import { visToast } from '../lib/toast'
import { hentAktivBruker } from '../lib/aktivBruker'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { ProsjektBilder } from './ProsjektBilder'
import { Oppussingsbudsjett } from './Oppussingsbudsjett'
import type { Prosjekt } from '../types'
import type { GeonorgeAdresse, OffmarketLenker } from '../lib/offmarket'

type SelgerInfo = {
  navn?: string; telefon?: string; epost?: string
  prisindikasjon_nok?: number; bakgrunn?: string
}

type KjenteFakta = {
  boligtype?: string; eierform?: string
  bra_m2?: number; p_rom_m2?: number
  byggear?: number; soverom?: number; bad?: number
  etasje?: string; energimerke?: string
  fellesgjeld_nok?: number; fellesutg_mnd_nok?: number; kommunale_avg_aar_nok?: number
  tomt_m2?: number; tomt_type?: string
  oppussingsgrad?: string; notater?: string
}

type SammenlignbarData = {
  url: string
  tekst: string
  lagt_til: string
  beskrivelse?: string          // f.eks. "Storgata 17, samme bygg, 2. etg"
  prisantydning_nok?: number
  faktisk_salgspris_nok?: number
  bra_m2?: number               // areal — gir AI grunnlag for å regne m²-pris
  notat?: string                // fritekst — "samme oppussingsnivå", "totalrenovert 2023"
}

type RodtFlagg = { alvorlighet: 'kritisk' | 'advarsel' | 'info'; tittel: string; beskrivelse: string }
type AldersRisiko = { risiko: string; hvordan_sjekke: string; estimat_om_funnet_nok?: number }
type AiAnalyse = {
  ai_oppsummering?: string
  kjop_anbefaling?: 'avstå' | 'forhandle_hardt' | 'ja_med_forbehold' | 'klart_ja'
  verdivurdering?: { lav_nok?: number; sannsynlig_nok?: number; hoy_nok?: number; begrunnelse?: string }
  bilde_vurdering?: { tilstand_samlet?: string; byggear_estimat?: string; kommentar?: string; observerte_risikoer?: string[] }
  rode_flagg?: RodtFlagg[]
  sporsmal_til_selger?: string[]
  sporsmal_til_megler_eller_kommune?: string[]
  aldersrelaterte_risikoer?: AldersRisiko[]
  mangler_i_grunnlag?: string[]
  sammenlignbare_vurdering?: { antall?: number; gjennomsnitt_m2_pris_nok?: number; typisk_avvik_antydning_pst?: number; kommentar?: string }
  forhandlingsposisjon?: { anbefalt_maksbud_nok?: number; anbefalt_startbud_nok?: number; begrunnelse?: string; spaker?: string[] }
  neste_steg?: string[]
}

type OffmarketData = {
  adresse_input?: string
  selger?: SelgerInfo
  kjente_fakta?: KjenteFakta
  innhenting?: { treff?: GeonorgeAdresse[]; valgt?: GeonorgeAdresse | null; lenker?: OffmarketLenker; hentet?: string }
  valgt_treff_idx?: number
  sammenlignbare_lenker?: string[]
  sammenlignbare_data?: SammenlignbarData[]
  ai_analyse?: AiAnalyse
  ai_generert?: string
  ai_modell?: string
  ai_bilde_antall?: number
  opprettet?: string
}

const ANBEFALING_FARGE: Record<NonNullable<AiAnalyse['kjop_anbefaling']>, { bg: string; tekst: string; emoji: string; lbl: string }> = {
  avstå:              { bg: '#fde8ec', tekst: '#7a0c1e', emoji: '🛑', lbl: 'Avstå' },
  forhandle_hardt:    { bg: '#fff8e1', tekst: '#7a4a08', emoji: '⚠️', lbl: 'Forhandle hardt' },
  ja_med_forbehold:   { bg: '#faf7ee', tekst: '#7a4a08', emoji: '🤝', lbl: 'Ja med forbehold' },
  klart_ja:           { bg: '#e8f5ed', tekst: '#1a4d2b', emoji: '✅', lbl: 'Klart ja' },
}

const FLAGG_FARGE: Record<RodtFlagg['alvorlighet'], { bg: string; tekst: string; ramme: string }> = {
  kritisk: { bg: '#fde8ec', tekst: '#7a0c1e', ramme: '#C8102E44' },
  advarsel: { bg: '#fff8e1', tekst: '#7a4a08', ramme: '#B05E0A44' },
  info: { bg: '#faf7ee', tekst: '#5a6171', ramme: '#b89a6f33' },
}

const fmtNok = (n: number | undefined | null) => n ? Math.round(n).toLocaleString('nb-NO') + ' kr' : '–'

type Props = { prosjektId: string; onTilbake: () => void }

export function OffmarketDetalj({ prosjektId, onTilbake }: Props) {
  const [navn, setNavn] = useState('')
  const [prosjekt, setProsjekt] = useState<Prosjekt | null>(null)
  const [data, setData] = useState<OffmarketData>({})
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)
  const [selger, setSelger] = useState<SelgerInfo>({})
  const [fakta, setFakta] = useState<KjenteFakta>({})
  const [sammLenke, setSammLenke] = useState('')
  const [sammBeskrivelse, setSammBeskrivelse] = useState('')
  const [sammAntydning, setSammAntydning] = useState(0)
  const [sammFaktisk, setSammFaktisk] = useState(0)
  const [sammBra, setSammBra] = useState(0)
  const [sammNotat, setSammNotat] = useState('')
  const [henterSamm, setHenterSamm] = useState(false)
  const [analyserer, setAnalyserer] = useState(false)
  const [analyseFeil, setAnalyseFeil] = useState<string | null>(null)
  const [sletter, setSletter] = useState(false)
  const [pdfLaster, setPdfLaster] = useState(false)
  const [epostApen, setEpostApen] = useState(false)

  const hent = useCallback(async () => {
    setLaster(true); setFeil(null)
    const { data: p, error } = await supabase
      .from('prosjekter').select('*').eq('id', prosjektId).maybeSingle()
    if (error || !p) { setFeil(error?.message || 'Prosjekt ikke funnet'); setLaster(false); return }
    const pr = p as Prosjekt
    setProsjekt(pr)
    setNavn(pr.navn)
    const omd = (pr.off_market_data || {}) as OffmarketData
    setData(omd)
    setSelger(omd.selger || {})
    setFakta(omd.kjente_fakta || {})
    setLaster(false)
  }, [prosjektId])

  useEffect(() => { void hent() }, [hent])

  async function lagreSelger() {
    const oppdatert = { ...data, selger }
    const { error } = await supabase.from('prosjekter').update({ off_market_data: oppdatert }).eq('id', prosjektId)
    if (error) { visToast('Lagring feilet: ' + error.message, 'feil', 4000); return }
    setData(oppdatert)
    visToast('Selger-info lagret', 'suksess', 1800)
  }

  async function lagreFakta() {
    const oppdatert = { ...data, kjente_fakta: fakta }
    const oppdateringer: Record<string, unknown> = { off_market_data: oppdatert }
    // Synk fellesutgifter til hovedraden så Min portefølje/Dashboard ser tallet
    if (typeof fakta.fellesutg_mnd_nok === 'number') {
      oppdateringer.fellesutgifter_mnd = fakta.fellesutg_mnd_nok
    }
    const { error } = await supabase.from('prosjekter').update(oppdateringer).eq('id', prosjektId)
    if (error) { visToast('Lagring feilet: ' + error.message, 'feil', 4000); return }
    setData(oppdatert)
    visToast('Fakta lagret', 'suksess', 1800)
  }

  async function leggTilSammenlignbar() {
    const url = sammLenke.trim()
    const beskrivelse = sammBeskrivelse.trim()
    // Minst én av URL eller beskrivelse må finnes — ellers har vi ingenting å gå på
    if (!url && !beskrivelse && !sammFaktisk && !sammAntydning) {
      setAnalyseFeil('Legg inn enten URL, beskrivelse eller en pris')
      return
    }
    if (url && !/^https?:\/\//.test(url)) {
      setAnalyseFeil('Ugyldig URL — fjern den hvis du ikke har en')
      return
    }
    setHenterSamm(true); setAnalyseFeil(null)
    try {
      let scraped = ''
      if (url) {
        const res = await fetch('/api/offmarket/sammenlignbar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const json = await res.json()
        if (!res.ok || json.feil) {
          // URL-scraping kan feile (Finn blokkerer) — la oss likevel lagre raden hvis vi har manuelle data
          if (!beskrivelse && !sammFaktisk && !sammAntydning) {
            setAnalyseFeil(json.feil || 'Henting feilet')
            setHenterSamm(false)
            return
          }
          visToast('Henting av URL feilet — lagrer manuelle data', 'info', 3000)
        } else {
          scraped = json.tekst || ''
        }
      }
      const ny: SammenlignbarData = {
        url, tekst: scraped, lagt_til: new Date().toISOString(),
        beskrivelse: beskrivelse || undefined,
        prisantydning_nok: sammAntydning || undefined,
        faktisk_salgspris_nok: sammFaktisk || undefined,
        bra_m2: sammBra || undefined,
        notat: sammNotat.trim() || undefined,
      }
      const eksisterende = data.sammenlignbare_data || []
      const oppdatert = { ...data, sammenlignbare_data: [...eksisterende, ny] }
      const { error } = await supabase.from('prosjekter').update({ off_market_data: oppdatert }).eq('id', prosjektId)
      if (error) { setAnalyseFeil('Lagring feilet: ' + error.message); setHenterSamm(false); return }
      setData(oppdatert)
      setSammLenke(''); setSammBeskrivelse(''); setSammAntydning(0); setSammFaktisk(0); setSammBra(0); setSammNotat('')
      visToast('Sammenligning lagt til', 'suksess', 1800)
    } catch (e) {
      setAnalyseFeil(e instanceof Error ? e.message : String(e))
    }
    setHenterSamm(false)
  }

  async function slettSammenlignbar(idx: number) {
    const eksisterende = data.sammenlignbare_data || []
    const oppdatert = { ...data, sammenlignbare_data: eksisterende.filter((_, i) => i !== idx) }
    const { error } = await supabase.from('prosjekter').update({ off_market_data: oppdatert }).eq('id', prosjektId)
    if (error) { visToast('Sletting feilet: ' + error.message, 'feil', 4000); return }
    setData(oppdatert)
  }

  async function kjorAiAnalyse() {
    setAnalyserer(true); setAnalyseFeil(null)
    try {
      const res = await fetch('/api/offmarket/analyse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prosjektId }),
      })
      if (!res.body) { setAnalyseFeil('Ingen respons'); setAnalyserer(false); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let sluttData: { data?: AiAnalyse; generert?: string; modell?: string; feil?: string } | null = null
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl = buffer.indexOf('\n')
        while (nl !== -1) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (line) {
            try {
              const obj = JSON.parse(line)
              if (obj.ping) { /* keep-alive */ }
              else sluttData = obj
            } catch { /* hopp over delvis JSON */ }
          }
          nl = buffer.indexOf('\n')
        }
      }
      if (!sluttData) { setAnalyseFeil('Tom respons fra AI'); setAnalyserer(false); return }
      if (sluttData.feil) { setAnalyseFeil(sluttData.feil); setAnalyserer(false); return }
      if (sluttData.data) {
        const oppdatert = { ...data, ai_analyse: sluttData.data, ai_generert: sluttData.generert, ai_modell: sluttData.modell }
        setData(oppdatert)
        await loggAktivitet({ handling: 'kjørte AI-vurdering off-market', tabell: 'prosjekter', rad_id: prosjektId })
        visToast('AI-vurdering ferdig', 'suksess', 2500)
      }
    } catch (e) {
      setAnalyseFeil(e instanceof Error ? e.message : String(e))
    }
    setAnalyserer(false)
  }

  async function slettProsjekt() {
    if (!confirm(`Slett «${navn}»? Sletter også alle bilder og kvitteringer knyttet til prosjektet. Kan ikke angres.`)) return
    setSletter(true)
    const { error } = await supabase.from('prosjekter').delete().eq('id', prosjektId)
    if (error) { visToast('Sletting feilet: ' + error.message, 'feil', 5000); setSletter(false); return }
    await loggAktivitet({ handling: 'slettet off-market prosjekt', tabell: 'prosjekter', rad_id: prosjektId, detaljer: { navn } })
    visToast('Slettet', 'suksess', 2000)
    onTilbake()
  }

  async function lastNedPdf() {
    if (pdfLaster) return
    setPdfLaster(true)
    try {
      const res = await fetch('/api/offmarket/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prosjektId }),
      })
      const resp = await res.json().catch(() => ({}))
      if (!res.ok || !resp.base64) { visToast(resp?.feil || 'PDF feilet', 'feil', 4000); return }
      const bin = atob(resp.base64)
      const u8 = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
      const blob = new Blob([u8], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = resp.filnavn || 'offmarket.pdf'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      visToast('PDF lastet ned', 'suksess', 2000)
    } finally {
      setPdfLaster(false)
    }
  }

  if (laster) return <div style={{ textAlign: 'center', padding: 60, color: FARGER.tekstLys }}>⏳ Laster off-market prosjekt…</div>
  if (feil) return (
    <div>
      <button onClick={onTilbake} style={tilbakeStil}>← Tilbake</button>
      <div style={{ background: FARGER.feilBg, padding: 14, borderRadius: RADIUS.md, color: '#7a0c1e' }}>{feil}</div>
    </div>
  )

  const valgt: GeonorgeAdresse | null = (data.innhenting?.treff || [])[data.valgt_treff_idx ?? 0] || data.innhenting?.valgt || null
  const lenker = data.innhenting?.lenker
  const samm = data.sammenlignbare_data || []
  const ai = data.ai_analyse

  return (
    <div>
      <button onClick={onTilbake} style={tilbakeStil}>← Tilbake til Norske boliger</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 8 }}>
            🔍 OFF-MARKET VURDERING
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.01em' }}>{navn}</h2>
          {valgt?.adressetekst && <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14 }}>{valgt.adressetekst}</p>}
        </div>
        <button onClick={slettProsjekt} disabled={sletter}
          style={{
            background: 'transparent', border: `1px solid ${FARGER.feil}55`,
            color: FARGER.feil, borderRadius: RADIUS.sm, padding: '8px 14px',
            fontSize: 12, fontWeight: 600, cursor: sletter ? 'not-allowed' : 'pointer',
            letterSpacing: '0.06em', textTransform: 'uppercase', opacity: sletter ? 0.6 : 1,
          }}>
          {sletter ? '⏳ Sletter…' : '🗑 Slett'}
        </button>
      </div>

      {/* Offentlige data */}
      {valgt && (
        <Seksjon tittel="📍 Offentlige data (Geonorge)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
            <Fakta lbl="Adresse" val={valgt.adressetekst} />
            <Fakta lbl="Postnr" val={`${valgt.postnummer || '–'} ${valgt.poststed || ''}`} />
            <Fakta lbl="Kommune" val={valgt.kommunenavn || '–'} />
            <Fakta lbl="Matrikkel" val={valgt.gardsnummer != null ? `gnr ${valgt.gardsnummer}/bnr ${valgt.bruksnummer}` : '–'} />
            <Fakta lbl="Koordinater" val={valgt.lat != null ? `${valgt.lat.toFixed(5)}, ${valgt.lon?.toFixed(5)}` : '–'} />
          </div>
          {lenker && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {lenker.seeiendom && <LenkeChip url={lenker.seeiendom} lbl="🗺️ SeEiendom" />}
              {lenker.nve_faresoner && <LenkeChip url={lenker.nve_faresoner} lbl="⚠️ NVE faresoner" />}
              {lenker.enova_sok && <LenkeChip url={lenker.enova_sok} lbl="⚡ Enova" />}
              {lenker.bergen_planinnsyn && <LenkeChip url={lenker.bergen_planinnsyn} lbl="📐 Planinnsyn" />}
              {lenker.bergen_byggesak && <LenkeChip url={lenker.bergen_byggesak} lbl="🏗️ Byggesaker" />}
              {lenker.finn_sold_sok && <LenkeChip url={lenker.finn_sold_sok} lbl="💰 Finn-søk" />}
            </div>
          )}
        </Seksjon>
      )}

      {/* Selger */}
      <Seksjon tittel="👤 Selger / tilbud">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
          <Input lbl="Navn" val={selger.navn || ''} onChange={v => setSelger({ ...selger, navn: v })} />
          <Input lbl="Telefon" val={selger.telefon || ''} onChange={v => setSelger({ ...selger, telefon: v })} />
          <Input lbl="E-post" val={selger.epost || ''} onChange={v => setSelger({ ...selger, epost: v })} />
          <InputTall lbl="Prisindikasjon (NOK)" val={selger.prisindikasjon_nok || 0} onChange={v => setSelger({ ...selger, prisindikasjon_nok: v })} />
        </div>
        <label style={lblStil}>Bakgrunn</label>
        <textarea value={selger.bakgrunn || ''} onChange={e => setSelger({ ...selger, bakgrunn: e.target.value })}
          rows={3} style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />
        <button onClick={lagreSelger} style={primKnapp}>💾 Lagre selger-info</button>
      </Seksjon>

      {/* Kjente fakta */}
      <Seksjon tittel="📋 Kjente fakta om boligen">
        <p style={{ fontSize: 12, color: FARGER.tekstMid, margin: '0 0 12px' }}>
          Fyll inn alt selger har fortalt. AI hopper over å spørre om dette i spørsmålslisten.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <Velg lbl="Boligtype" val={fakta.boligtype || ''} onChange={v => setFakta({ ...fakta, boligtype: v })}
            valg={['', 'Leilighet', 'Enebolig', 'Tomannsbolig', 'Rekkehus', 'Hytte', 'Annet']} />
          <Velg lbl="Eierform" val={fakta.eierform || ''} onChange={v => setFakta({ ...fakta, eierform: v })}
            valg={['', 'Selveier', 'Andel', 'Aksje', 'Obligasjon']} />
          <InputTall lbl="BRA (m²)" val={fakta.bra_m2 || 0} onChange={v => setFakta({ ...fakta, bra_m2: v })} />
          <InputTall lbl="P-rom (m²)" val={fakta.p_rom_m2 || 0} onChange={v => setFakta({ ...fakta, p_rom_m2: v })} />
          <InputTall lbl="Byggeår" val={fakta.byggear || 0} onChange={v => setFakta({ ...fakta, byggear: v })} />
          <InputTall lbl="Soverom" val={fakta.soverom || 0} onChange={v => setFakta({ ...fakta, soverom: v })} />
          <InputTall lbl="Bad" val={fakta.bad || 0} onChange={v => setFakta({ ...fakta, bad: v })} />
          <Input lbl="Etasje" val={fakta.etasje || ''} onChange={v => setFakta({ ...fakta, etasje: v })} />
          <Velg lbl="Energimerke" val={fakta.energimerke || ''} onChange={v => setFakta({ ...fakta, energimerke: v })}
            valg={['', 'A', 'B', 'C', 'D', 'E', 'F', 'G']} />
          <InputTall lbl="Fellesgjeld (NOK)" val={fakta.fellesgjeld_nok || 0} onChange={v => setFakta({ ...fakta, fellesgjeld_nok: v })} />
          <InputTall lbl="Fellesutg/mnd" val={fakta.fellesutg_mnd_nok || 0} onChange={v => setFakta({ ...fakta, fellesutg_mnd_nok: v })} />
          <InputTall lbl="Komm. avg/år" val={fakta.kommunale_avg_aar_nok || 0} onChange={v => setFakta({ ...fakta, kommunale_avg_aar_nok: v })} />
          <InputTall lbl="Tomt (m²)" val={fakta.tomt_m2 || 0} onChange={v => setFakta({ ...fakta, tomt_m2: v })} />
          <Velg lbl="Tomt-type" val={fakta.tomt_type || ''} onChange={v => setFakta({ ...fakta, tomt_type: v })}
            valg={['', 'Eier', 'Festet']} />
          <Velg lbl="Oppussingsgrad" val={fakta.oppussingsgrad || ''} onChange={v => setFakta({ ...fakta, oppussingsgrad: v })}
            valg={['', 'Original', 'Delvis pusset', 'Helt renovert', 'Trenger total renovering']} />
        </div>
        <label style={{ ...lblStil, marginTop: 10 }}>Andre opplysninger fra selger</label>
        <textarea value={fakta.notater || ''} onChange={e => setFakta({ ...fakta, notater: e.target.value })}
          rows={3}
          placeholder="f.eks. bad rehabilitert 2018, nytt tak 2020, FDV-dokumentasjon foreligger"
          style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />
        <button onClick={lagreFakta} style={primKnapp}>💾 Lagre fakta</button>
      </Seksjon>

      {/* Bilder */}
      <Seksjon tittel="📸 Bilder">
        <ProsjektBilder prosjektId={prosjektId} />
      </Seksjon>

      {/* Oppussingsbudsjett */}
      {prosjekt && (
        <Seksjon tittel="🔨 Oppussingsbudsjett">
          <p style={{ fontSize: 12, color: FARGER.tekstMid, margin: '0 0 12px' }}>
            Bygg opp et budsjett (rom for rom + løpende kostnader) før budgivning. AI-vurderingen
            kan trekke inn estimerte oppussingsposter — eller du kan legge til manuelt.
          </p>
          <Oppussingsbudsjett prosjekt={prosjekt} onProsjektOppdatert={() => { void hent() }} />
        </Seksjon>
      )}

      {/* Sammenlignbare */}
      <Seksjon tittel="💰 Sammenlignbare salg">
        <p style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 0 }}>
          Legg inn tilsvarende boliger i området. Jo mer konkret jo bedre — særlig <strong>faktisk salgspris</strong> hvis du kjenner den (selv om Finn-annonsen viser bare prisantydning).
        </p>
        <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Input lbl="Adresse / kort beskrivelse" val={sammBeskrivelse} onChange={setSammBeskrivelse} />
            <Input lbl="Finn-URL (valgfri)" val={sammLenke} onChange={setSammLenke} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <InputTall lbl="Prisantydning (NOK)" val={sammAntydning} onChange={setSammAntydning} />
            <InputTall lbl="Faktisk salgspris (NOK)" val={sammFaktisk} onChange={setSammFaktisk} />
            <InputTall lbl="BRA (m²)" val={sammBra} onChange={setSammBra} />
          </div>
          <Input lbl="Notat (likhet/forskjell, oppussingsnivå)" val={sammNotat} onChange={setSammNotat} />
          {sammAntydning > 0 && sammFaktisk > 0 && (
            <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 600, marginTop: 6 }}>
              {((sammFaktisk - sammAntydning) / sammAntydning * 100).toFixed(1)} % {sammFaktisk > sammAntydning ? 'over' : 'under'} antydning
              {sammBra > 0 && ` · ${Math.round(sammFaktisk / sammBra).toLocaleString('nb-NO')} kr/m²`}
            </div>
          )}
          <button onClick={leggTilSammenlignbar} disabled={henterSamm}
            style={{ ...primKnapp, opacity: henterSamm ? 0.6 : 1, marginTop: 10 }}>
            {henterSamm ? '⏳ Lagrer…' : '+ Legg til sammenligning'}
          </button>
        </div>
        {samm.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {samm.map((s, i) => {
              const tittel = s.beskrivelse || s.url || 'Uten lenke'
              const avvik = s.prisantydning_nok && s.faktisk_salgspris_nok
                ? ((s.faktisk_salgspris_nok - s.prisantydning_nok) / s.prisantydning_nok * 100)
                : null
              const m2pris = s.faktisk_salgspris_nok && s.bra_m2 ? Math.round(s.faktisk_salgspris_nok / s.bra_m2) : null
              return (
                <div key={i} style={{
                  padding: 10, background: FARGER.creamLys,
                  border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.sm,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 13, color: FARGER.mork, fontWeight: 600, textDecoration: 'none' }}>
                          {tittel} ↗
                        </a>
                      ) : (
                        <div style={{ fontSize: 13, color: FARGER.mork, fontWeight: 600 }}>{tittel}</div>
                      )}
                      <div style={{ fontSize: 11, color: FARGER.tekstMid, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {s.prisantydning_nok != null && <span>Antydning: <strong>{fmtNok(s.prisantydning_nok)}</strong></span>}
                        {s.faktisk_salgspris_nok != null && <span>Solgt: <strong style={{ color: FARGER.gull }}>{fmtNok(s.faktisk_salgspris_nok)}</strong></span>}
                        {avvik != null && <span style={{ color: avvik > 0 ? FARGER.advarsel : FARGER.tekstMid }}>{avvik > 0 ? '+' : ''}{avvik.toFixed(1)} %</span>}
                        {s.bra_m2 && <span>{s.bra_m2} m²</span>}
                        {m2pris && <span>{m2pris.toLocaleString('nb-NO')} kr/m²</span>}
                      </div>
                      {s.notat && <div style={{ fontSize: 11, color: FARGER.tekstMid, marginTop: 4, fontStyle: 'italic' }}>{s.notat}</div>}
                    </div>
                    <button onClick={() => slettSammenlignbar(i)} style={{ background: 'transparent', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 14 }}>🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Seksjon>

      {/* AI-vurdering */}
      <Seksjon tittel="✨ AI-kjøpervurdering">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={kjorAiAnalyse} disabled={analyserer}
            style={{
              background: analyserer ? FARGER.tekstLys : FARGER.mork,
              color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.sm,
              padding: '12px 22px', fontSize: 13, fontWeight: 600, cursor: analyserer ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
            {analyserer ? '⏳ Analyserer (kan ta 30-60s)…' : ai ? '🔄 Kjør på nytt' : '✨ Kjør AI-vurdering'}
          </button>
          {data.ai_generert && (
            <span style={{ fontSize: 11, color: FARGER.tekstLys }}>
              Sist generert: {new Date(data.ai_generert).toLocaleString('nb-NO')}
              {data.ai_modell && ` · ${data.ai_modell}`}
            </span>
          )}
          {ai && (
            <>
              <button onClick={lastNedPdf} disabled={pdfLaster}
                style={{
                  background: FARGER.hvit, color: FARGER.mork,
                  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm,
                  padding: '10px 16px', fontSize: 12, fontWeight: 600,
                  cursor: pdfLaster ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                {pdfLaster ? '⏳ Lager…' : '📄 Last ned PDF'}
              </button>
              {ai.sporsmal_til_selger && ai.sporsmal_til_selger.length > 0 && (
                <button onClick={() => setEpostApen(true)}
                  style={{
                    background: FARGER.gull, color: '#fff', border: 'none',
                    borderRadius: RADIUS.sm, padding: '10px 16px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                  ✉️ Send til selger
                </button>
              )}
            </>
          )}
        </div>
        {analyseFeil && (
          <div style={{ background: FARGER.feilBg, padding: 10, borderRadius: RADIUS.sm, color: '#7a0c1e', fontSize: 12, marginBottom: 14 }}>
            {analyseFeil}
          </div>
        )}
        {ai && <AiVisning ai={ai} />}
      </Seksjon>

      {epostApen && ai && (
        <EpostModal
          prosjektId={prosjektId}
          adresse={valgt?.adressetekst || (data.adresse_input || '')}
          mottakerEpost={data.selger?.epost || ''}
          mottakerNavn={data.selger?.navn || ''}
          sporsmal={ai.sporsmal_til_selger || []}
          onLukk={() => setEpostApen(false)}
        />
      )}
    </div>
  )
}

function EpostModal({ prosjektId, adresse, mottakerEpost, mottakerNavn, sporsmal, onLukk }: {
  prosjektId: string
  adresse: string
  mottakerEpost: string
  mottakerNavn: string
  sporsmal: string[]
  onLukk: () => void
}) {
  const [til, setTil] = useState(mottakerEpost)
  const [navn, setNavn] = useState(mottakerNavn)
  const [emne, setEmne] = useState(adresse ? `Spørsmål om ${adresse}` : 'Spørsmål om eiendommen')
  const [innhold, setInnhold] = useState(() => byggInnhold(sporsmal, adresse, mottakerNavn))
  const [sender, setSender] = useState(false)
  const [feilmelding, setFeilmelding] = useState<string | null>(null)

  async function send() {
    if (!til.trim() || !innhold.trim()) { setFeilmelding('E-post og innhold må fylles ut'); return }
    setSender(true); setFeilmelding(null)
    try {
      const res = await fetch('/api/epost/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          til, emne, innhold,
          formaal: 'selger_kontakt',
          mottaker_navn: navn || null,
          mottaker_type: 'selger',
          sprak: 'nb',
          relatert_prosjekt_id: prosjektId,
          sendt_av: hentAktivBruker() || 'ukjent',
          bruker_endret: innhold !== byggInnhold(sporsmal, adresse, mottakerNavn),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.suksess) { setFeilmelding(json?.feil || 'Sending feilet'); setSender(false); return }
      visToast('E-post sendt til selger', 'suksess', 2500)
      onLukk()
    } catch (e) {
      setFeilmelding(e instanceof Error ? e.message : String(e))
    }
    setSender(false)
  }

  return (
    <div onClick={onLukk} style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: RADIUS.lg, width: '100%', maxWidth: 720,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 24,
      }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 6 }}>
          ✉️ SEND SPØRSMÅLSLISTE
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: FARGER.mork }}>E-post til selger</h2>
        <p style={{ fontSize: 12, color: FARGER.tekstMid, margin: '6px 0 18px' }}>
          Spørsmålene fra AI-vurderingen er allerede satt inn. Rediger fritt før sending.
        </p>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <ModalInput lbl="Mottakers navn" val={navn} onChange={setNavn} />
            <ModalInput lbl="E-post" val={til} onChange={setTil} />
          </div>
          <ModalInput lbl="Emne" val={emne} onChange={setEmne} />
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
              Innhold
            </label>
            <textarea value={innhold} onChange={e => setInnhold(e.target.value)} rows={18}
              style={{
                width: '100%', padding: 12, fontSize: 13, fontFamily: 'inherit',
                border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm,
                background: '#fff', boxSizing: 'border-box', resize: 'vertical',
                lineHeight: 1.5,
              }} />
          </div>
          <p style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 8, fontStyle: 'italic' }}>
            Signaturen din legges på automatisk når e-posten sendes.
          </p>
        </div>
        {feilmelding && (
          <div style={{ background: FARGER.feilBg, padding: 10, borderRadius: RADIUS.sm, color: '#7a0c1e', fontSize: 12, marginTop: 10 }}>
            {feilmelding}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={send} disabled={sender || !til.trim()}
            style={{
              flex: 1, background: sender ? FARGER.tekstLys : FARGER.mork,
              color: '#fff', border: 'none', borderRadius: RADIUS.sm,
              padding: 12, fontSize: 13, fontWeight: 600,
              cursor: sender || !til.trim() ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
            {sender ? '⏳ Sender…' : '✉️ Send nå'}
          </button>
          <button onClick={onLukk} disabled={sender}
            style={{
              background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none',
              borderRadius: RADIUS.sm, padding: '12px 18px', fontSize: 13, fontWeight: 600,
              cursor: sender ? 'not-allowed' : 'pointer',
            }}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalInput({ lbl, val, onChange }: { lbl: string; val: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
        {lbl}
      </label>
      <input value={val} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 13,
          border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm,
          background: '#fff', boxSizing: 'border-box',
        }} />
    </div>
  )
}

function byggInnhold(sporsmal: string[], adresse: string, mottakerNavn: string): string {
  const hilsen = mottakerNavn ? `Hei ${mottakerNavn},` : 'Hei,'
  const adresseLinje = adresse ? `eiendommen ${adresse}` : 'eiendommen'
  const linjer = [
    hilsen,
    '',
    `Takk for tilbudet om ${adresseLinje}. Før vi går videre med en konkret budgivning trenger vi noen avklaringer:`,
    '',
    ...sporsmal.map((s, i) => `${i + 1}. ${s}`),
    '',
    'Vi setter pris på et raskt svar, og er åpne for befaring eller telefonmøte hvis det er enklere.',
    '',
    'Mvh,',
  ]
  return linjer.join('\n')
}

function AiVisning({ ai }: { ai: AiAnalyse }) {
  const anb = ai.kjop_anbefaling ? ANBEFALING_FARGE[ai.kjop_anbefaling] : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {anb && (
        <div style={{ background: anb.bg, color: anb.tekst, padding: '14px 18px', borderRadius: RADIUS.md, fontWeight: 700, fontSize: 14, letterSpacing: '-0.005em' }}>
          {anb.emoji} {anb.lbl}
        </div>
      )}
      {ai.ai_oppsummering && (
        <div style={{ background: FARGER.creamLys, padding: 14, borderRadius: RADIUS.md, fontSize: 13, lineHeight: 1.6, color: FARGER.mork }}>
          {ai.ai_oppsummering}
        </div>
      )}

      {ai.verdivurdering && (
        <Underseksjon tittel="📊 Verdivurdering">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <KpiMini lbl="Lav" val={fmtNok(ai.verdivurdering.lav_nok)} />
            <KpiMini lbl="Sannsynlig" val={fmtNok(ai.verdivurdering.sannsynlig_nok)} farge={FARGER.mork} />
            <KpiMini lbl="Høy" val={fmtNok(ai.verdivurdering.hoy_nok)} />
          </div>
          {ai.verdivurdering.begrunnelse && <p style={tekstStil}>{ai.verdivurdering.begrunnelse}</p>}
        </Underseksjon>
      )}

      {ai.bilde_vurdering && (
        <Underseksjon tittel="📸 Bilde-vurdering">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            {ai.bilde_vurdering.tilstand_samlet && <Tag lbl={`Tilstand: ${ai.bilde_vurdering.tilstand_samlet.replace('_', ' ')}`} />}
            {ai.bilde_vurdering.byggear_estimat && <Tag lbl={`Byggeår: ${ai.bilde_vurdering.byggear_estimat}`} />}
          </div>
          {ai.bilde_vurdering.kommentar && <p style={tekstStil}>{ai.bilde_vurdering.kommentar}</p>}
          {ai.bilde_vurdering.observerte_risikoer && ai.bilde_vurdering.observerte_risikoer.length > 0 && (
            <ul style={listeStil}>{ai.bilde_vurdering.observerte_risikoer.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
        </Underseksjon>
      )}

      {ai.rode_flagg && ai.rode_flagg.length > 0 && (
        <Underseksjon tittel="🚩 Røde flagg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ai.rode_flagg.map((f, i) => {
              const farge = FLAGG_FARGE[f.alvorlighet]
              return (
                <div key={i} style={{ background: farge.bg, border: `1px solid ${farge.ramme}`, color: farge.tekst, padding: '10px 12px', borderRadius: RADIUS.sm }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{f.tittel}</div>
                  <div style={{ fontSize: 12, marginTop: 3 }}>{f.beskrivelse}</div>
                </div>
              )
            })}
          </div>
        </Underseksjon>
      )}

      {ai.sporsmal_til_selger && ai.sporsmal_til_selger.length > 0 && (
        <Underseksjon tittel={`❓ Spørsmål til selger (${ai.sporsmal_til_selger.length})`}>
          <ol style={{ ...listeStil, paddingLeft: 22 }}>
            {ai.sporsmal_til_selger.map((s, i) => <li key={i} style={{ marginBottom: 5 }}>{s}</li>)}
          </ol>
        </Underseksjon>
      )}

      {ai.sporsmal_til_megler_eller_kommune && ai.sporsmal_til_megler_eller_kommune.length > 0 && (
        <Underseksjon tittel="🏛️ Spørsmål til megler/kommune">
          <ul style={listeStil}>
            {ai.sporsmal_til_megler_eller_kommune.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </Underseksjon>
      )}

      {ai.aldersrelaterte_risikoer && ai.aldersrelaterte_risikoer.length > 0 && (
        <Underseksjon tittel="⏳ Aldersrelaterte risikoer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ai.aldersrelaterte_risikoer.map((r, i) => (
              <div key={i} style={{ background: FARGER.creamLys, padding: '10px 12px', borderRadius: RADIUS.sm, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: FARGER.mork }}>{r.risiko}</div>
                <div style={{ color: FARGER.tekstMid, marginTop: 3 }}>Sjekk: {r.hvordan_sjekke}</div>
                {r.estimat_om_funnet_nok != null && r.estimat_om_funnet_nok > 0 && (
                  <div style={{ color: FARGER.advarsel, marginTop: 3, fontWeight: 600 }}>Estimat hvis funnet: {fmtNok(r.estimat_om_funnet_nok)}</div>
                )}
              </div>
            ))}
          </div>
        </Underseksjon>
      )}

      {ai.mangler_i_grunnlag && ai.mangler_i_grunnlag.length > 0 && (
        <Underseksjon tittel="🕳️ Mangler i grunnlaget">
          <ul style={listeStil}>{ai.mangler_i_grunnlag.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </Underseksjon>
      )}

      {ai.sammenlignbare_vurdering && (ai.sammenlignbare_vurdering.kommentar || ai.sammenlignbare_vurdering.gjennomsnitt_m2_pris_nok || ai.sammenlignbare_vurdering.typisk_avvik_antydning_pst != null) && (
        <Underseksjon tittel="💰 Sammenlignbare salg">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            {ai.sammenlignbare_vurdering.antall != null && <Tag lbl={`${ai.sammenlignbare_vurdering.antall} salg`} />}
            {ai.sammenlignbare_vurdering.gjennomsnitt_m2_pris_nok != null && (
              <Tag lbl={`Gj.snitt: ${fmtNok(ai.sammenlignbare_vurdering.gjennomsnitt_m2_pris_nok)}/m²`} />
            )}
            {ai.sammenlignbare_vurdering.typisk_avvik_antydning_pst != null && (
              <Tag lbl={`Typisk ${ai.sammenlignbare_vurdering.typisk_avvik_antydning_pst > 0 ? '+' : ''}${ai.sammenlignbare_vurdering.typisk_avvik_antydning_pst.toFixed(1)} % vs antydning`} />
            )}
          </div>
          {ai.sammenlignbare_vurdering.kommentar && <p style={tekstStil}>{ai.sammenlignbare_vurdering.kommentar}</p>}
        </Underseksjon>
      )}

      {ai.forhandlingsposisjon && (
        <Underseksjon tittel="🤝 Forhandlingsposisjon">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
            <KpiMini lbl="Anbefalt startbud" val={fmtNok(ai.forhandlingsposisjon.anbefalt_startbud_nok)} />
            <KpiMini lbl="Anbefalt maksbud" val={fmtNok(ai.forhandlingsposisjon.anbefalt_maksbud_nok)} farge={FARGER.mork} />
          </div>
          {ai.forhandlingsposisjon.begrunnelse && <p style={tekstStil}>{ai.forhandlingsposisjon.begrunnelse}</p>}
          {ai.forhandlingsposisjon.spaker && ai.forhandlingsposisjon.spaker.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>Forhandlingsspaker:</div>
              <ul style={listeStil}>{ai.forhandlingsposisjon.spaker.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
        </Underseksjon>
      )}

      {ai.neste_steg && ai.neste_steg.length > 0 && (
        <Underseksjon tittel="🧭 Neste steg">
          <ol style={{ ...listeStil, paddingLeft: 22 }}>
            {ai.neste_steg.map((s, i) => <li key={i} style={{ marginBottom: 5 }}>{s}</li>)}
          </ol>
        </Underseksjon>
      )}
    </div>
  )
}

function Seksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 20, marginBottom: 16, boxShadow: SHADOW.sm }}>
      <div style={{ fontSize: 12, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>
        {tittel}
      </div>
      {children}
    </div>
  )
}

function Underseksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.md, padding: 14 }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
        {tittel}
      </div>
      {children}
    </div>
  )
}

function Fakta({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 13, color: FARGER.mork, fontWeight: 500, marginTop: 2 }}>{val}</div>
    </div>
  )
}

function KpiMini({ lbl, val, farge }: { lbl: string; val: string; farge?: string }) {
  return (
    <div style={{ background: FARGER.flateLys, padding: 10, borderRadius: RADIUS.sm }}>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: farge || FARGER.mork }}>{val}</div>
    </div>
  )
}

function LenkeChip({ url, lbl }: { url: string; lbl: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-block', background: FARGER.hvit,
        border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill,
        padding: '6px 12px', fontSize: 12, color: FARGER.mork,
        textDecoration: 'none', fontWeight: 500,
        transition: `border-color ${MOTION.rask}`,
      }}>
      {lbl} ↗
    </a>
  )
}

function Tag({ lbl }: { lbl: string }) {
  return (
    <span style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, color: FARGER.mork, padding: '4px 10px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 600 }}>
      {lbl}
    </span>
  )
}

function Input({ lbl, val, onChange }: { lbl: string; val: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={lblStil}>{lbl}</label>
      <input value={val} onChange={e => onChange(e.target.value)} style={inputStil} />
    </div>
  )
}

function InputTall({ lbl, val, onChange }: { lbl: string; val: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={lblStil}>{lbl}</label>
      <input type="number" value={val || ''} onChange={e => onChange(Number(e.target.value) || 0)} style={inputStil} />
    </div>
  )
}

function Velg({ lbl, val, onChange, valg }: { lbl: string; val: string; onChange: (v: string) => void; valg: string[] }) {
  return (
    <div>
      <label style={lblStil}>{lbl}</label>
      <select value={val} onChange={e => onChange(e.target.value)} style={{ ...inputStil, fontFamily: 'inherit' }}>
        {valg.map(v => <option key={v} value={v}>{v || '— velg —'}</option>)}
      </select>
    </div>
  )
}

const tilbakeStil: React.CSSProperties = {
  background: FARGER.flateLys, border: 'none', borderRadius: RADIUS.sm,
  padding: '8px 16px', fontSize: 12, cursor: 'pointer', marginBottom: 20,
  color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
}

const lblStil: React.CSSProperties = {
  fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box',
}

const primKnapp: React.CSSProperties = {
  background: FARGER.mork, color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.sm,
  padding: '10px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 10,
}

const tekstStil: React.CSSProperties = {
  fontSize: 13, color: FARGER.mork, lineHeight: 1.55, margin: '6px 0 0',
}

const listeStil: React.CSSProperties = {
  margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: FARGER.mork, lineHeight: 1.6,
}
