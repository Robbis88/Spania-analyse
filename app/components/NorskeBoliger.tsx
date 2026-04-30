'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { tomtProsjekt, type Prosjekt } from '../types'
import { FARGER, RADIUS } from '../lib/styles'
import { visToast } from '../lib/toast'
import { byggNorskFlippePdf } from '../lib/pdfNorsk'
import { ProsjektBilder } from './ProsjektBilder'
import { regnBankScore, regnLivsopphold } from '../lib/norskBankScore'

// Cache analyser per Finn-URL/tekst i localStorage så samme bolig
// alltid gir samme analyse (Claude er ikke 100% deterministisk selv på temp 0).
// Bruker enkel hash av input som nøkkel.
const CACHE_PREFIX = 'norsk-analyse-cache-'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30  // 30 dager

function lagCacheNoekkel(input: string): string {
  // Enkel hash — vi trenger ikke kryptografisk styrke, bare å skille forskjellige inputs
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  return CACHE_PREFIX + Math.abs(hash).toString(36)
}

function lesCache(input: string): { analyse: unknown; tidspunkt: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const noekkel = lagCacheNoekkel(input.trim())
    const lagret = window.localStorage.getItem(noekkel)
    if (!lagret) return null
    const data = JSON.parse(lagret)
    if (Date.now() - data.tidspunkt > CACHE_TTL_MS) {
      window.localStorage.removeItem(noekkel)
      return null
    }
    return data
  } catch { return null }
}

function lagreCache(input: string, analyse: unknown) {
  if (typeof window === 'undefined') return
  try {
    const noekkel = lagCacheNoekkel(input.trim())
    window.localStorage.setItem(noekkel, JSON.stringify({ analyse, tidspunkt: Date.now() }))
  } catch { /* localStorage kan være full / blokkert */ }
}

function fjernCache(input: string) {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(lagCacheNoekkel(input.trim())) } catch { /* ignore */ }
}

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
  arlig_prisvekst_pst?: number
  prisvekst_begrunnelse?: string
  utleiedel?: {
    mulig?: boolean
    type_egnet?: string
    estimert_leie_mnd_nok?: number
    etableringskost_nok?: number
    begrunnelse?: string
  }
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

type Modus = 'ren' | 'bo'

type EksisterendeBolig = {
  salgssum: number
  restgjeld: number
  meglerhonorar_pst: number
  marknadsforing: number
  skattefri: boolean
}

type BoPlan = {
  bo_tid_mnd: number
  arlig_prisvekst_pst: number
}

type UtleieDel = {
  aktiv: boolean
  leie_mnd: number
  belegg_pst: number       // 90-95% typisk
  drift_pst: number        // % av leie til vedlikehold/strøm/etc
  etableringskost: number
  skattefri: boolean       // primærbolig + utleiedel mindre enn halve verdien
}

type Inntektskilde = {
  beskrivelse: string      // f.eks. "Person 1 - Lønn", "Leieinntekt annen bolig"
  belop_mnd: number
}

type AnnetLan = {
  beskrivelse: string      // f.eks. "Billån VW Golf", "Studielån (Lånekassen)"
  type: 'billan' | 'studielan' | 'kreditt' | 'annet_boliglan' | 'annet'
  saldo: number            // gjenstående saldo
  mnd_betaling: number     // månedlig betjening (renter + avdrag)
}

type MeglerVurdering = {
  navn: string             // megleren som har gitt vurderingen
  firma: string            // f.eks. "Krogsveen Bergen", "DNB Eiendom"
  telefon: string
  epost: string
  verdi_nok: number        // verdivurdering i NOK
  dato: string             // ISO-date YYYY-MM-DD
  notat: string            // valgfri kommentar fra megleren
}

type Husholdning = {
  antall_voksne: number    // 1 eller 2 typisk
  antall_barn: number      // antall barn under 18
  inntekter: Inntektskilde[]
  skattesats_pst: number   // for å regne netto av brutto-inntekt
  andre_lan: AnnetLan[]
  annen_sikkerhet_aktiv: boolean
  annen_bolig_verdi: number
  annen_bolig_lan: number
  annen_bolig_beskrivelse: string
}

export function NorskeBoliger({ onTilbake }: { onTilbake: () => void }) {
  const [modus, setModus] = useState<Modus>('ren')
  const [input, setInput] = useState('')
  const [analyse, setAnalyse] = useState<Analyse | null>(null)
  const [laster, setLaster] = useState(false)
  const [feil, setFeil] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [lagretId, setLagretId] = useState<string | null>(null)

  const [eksisterende, setEksisterende] = useState<EksisterendeBolig>({
    salgssum: 0, restgjeld: 0,
    meglerhonorar_pst: 2.0, marknadsforing: 25000,
    skattefri: true,
  })

  const [boPlan, setBoPlan] = useState<BoPlan>({
    bo_tid_mnd: 24,           // 24 mnd = 2 år, godt over 12-mnd-grensen for skattefri
    arlig_prisvekst_pst: 4,   // moderat default, AI overstyrer
  })

  const [utleieDel, setUtleieDel] = useState<UtleieDel>({
    aktiv: false,
    leie_mnd: 0,
    belegg_pst: 92,
    drift_pst: 15,
    etableringskost: 0,
    skattefri: true,         // utleiedel < halve verdien = skattefri (typisk for sokkelleilighet)
  })

  const [husholdning, setHusholdning] = useState<Husholdning>({
    antall_voksne: 2,
    antall_barn: 0,
    inntekter: [],
    skattesats_pst: 28,         // grov default for inntektsskatt — bruker kan justere
    andre_lan: [],
    annen_sikkerhet_aktiv: false,
    annen_bolig_verdi: 0,
    annen_bolig_lan: 0,
    annen_bolig_beskrivelse: '',
  })

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
  const [meglerVurderinger, setMeglerVurderinger] = useState<MeglerVurdering[]>([])
  const [pdfLaster, setPdfLaster] = useState(false)
  const [fraCache, setFraCache] = useState<number | null>(null)
  const [lagrede, setLagrede] = useState<Array<{ id: string; navn: string; opprettet: string; bolig_data?: { beliggenhet?: string }; norsk_kalkulator_data?: Record<string, unknown> | null }>>([])

  function fyllFraAnalyse(a: Analyse) {
    // Pre-utfyll oppussingsposter fra AI-forslag
    const foreslatte = (a.foreslatte_oppussingsposter || []).map(p => ({
      navn: p.navn || '',
      kostnad: p.kostnad_nok || 0,
      notat: p.begrunnelse || '',
    })).filter(p => p.navn)
    setOppussingsposter(foreslatte)
    const sumPoster = foreslatte.reduce((s, p) => s + p.kostnad, 0)

    // Hent prisvekst-estimat fra AI hvis det ble returnert
    if (a.arlig_prisvekst_pst && a.arlig_prisvekst_pst > 0) {
      setBoPlan(b => ({ ...b, arlig_prisvekst_pst: a.arlig_prisvekst_pst as number }))
    }

    // Hent utleie-del-estimat fra AI hvis mulig
    if (a.utleiedel?.mulig && a.utleiedel.estimert_leie_mnd_nok) {
      setUtleieDel(u => ({
        ...u,
        // Bare aktiver hvis leie > 0 og bruker ikke har endret feltene allerede
        aktiv: u.leie_mnd === 0,
        leie_mnd: u.leie_mnd === 0 ? (a.utleiedel?.estimert_leie_mnd_nok || 0) : u.leie_mnd,
        etableringskost: u.etableringskost === 0 ? (a.utleiedel?.etableringskost_nok || 0) : u.etableringskost,
      }))
    }

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

  async function analyser(opts: { tvingNy?: boolean } = {}) {
    if (!input.trim() || laster) return
    setLaster(true); setFeil(''); setAnalyse(null); setLagretId(null); setFraCache(null)

    // Sjekk cache først (med mindre brukeren tvinger ny analyse)
    if (!opts.tvingNy) {
      const cached = lesCache(input)
      if (cached) {
        const a = cached.analyse as Analyse
        setAnalyse(a)
        fyllFraAnalyse(a)
        setFraCache(cached.tidspunkt)
        setLaster(false)
        return
      }
    }

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
        lagreCache(input, data)
        setFraCache(null)
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Ukjent feil')
    }
    setLaster(false)
  }

  function regenerer() {
    fjernCache(input)
    void analyser({ tvingNy: true })
  }

  // Hent alle lagrede norske prosjekter — vises som liste øverst
  const hentLagrede = useCallback(async () => {
    const { data } = await supabase
      .from('prosjekter')
      .select('id, navn, opprettet, bolig_data, norsk_kalkulator_data')
      .eq('marked', 'norge')
      .order('opprettet', { ascending: false })
    if (data) setLagrede(data)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void hentLagrede() }, [hentLagrede])

  function lastInn(p: { id: string; norsk_kalkulator_data?: Record<string, unknown> | null }) {
    const d = p.norsk_kalkulator_data
    if (!d) {
      visToast('Mangler kalkulator-data — lagret før denne funksjonen ble lagt til', 'feil', 5000)
      return
    }
    setAnalyse(d.analyse as Analyse)
    setKalk(d.kalk as Kalk)
    setModus((d.modus as Modus) || 'ren')
    setEksisterende((d.eksisterende as EksisterendeBolig) || eksisterende)
    setBoPlan((d.boPlan as BoPlan) || boPlan)
    setUtleieDel((d.utleieDel as UtleieDel) || utleieDel)
    setOppussingsposter((d.oppussingsposter as Array<{ navn: string; kostnad: number; notat: string }>) || [])
    if (d.husholdning) setHusholdning(d.husholdning as Husholdning)
    if (d.meglerVurderinger) setMeglerVurderinger(d.meglerVurderinger as MeglerVurdering[])
    setLagretId(p.id)
    setFeil(''); setFraCache(null)
    visToast('Prosjekt lastet inn', 'suksess')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function slettLagret(id: string, navn: string) {
    if (!confirm(`Slette «${navn}»? Dette kan ikke angres.`)) return
    const { error } = await supabase.from('prosjekter').delete().eq('id', id)
    if (error) {
      visToast('Sletting feilet: ' + error.message, 'feil', 5000)
    } else {
      if (lagretId === id) setLagretId(null)
      await hentLagrede()
      visToast('Slettet')
    }
  }

  // === BO-PLAN: projisert salgspris med prisvekst over bo-tiden ===
  // Brukerens kalk.salgspris er "i dag, etter oppussing".
  // I bo-modus brukes prisvekst i området til å projisere fremtidig pris.
  const projisertSalgspris = useMemo(() => {
    if (modus !== 'bo' || !kalk.salgspris) return kalk.salgspris
    const aar = boPlan.bo_tid_mnd / 12
    const faktor = Math.pow(1 + boPlan.arlig_prisvekst_pst / 100, aar)
    return kalk.salgspris * faktor
  }, [modus, kalk.salgspris, boPlan.bo_tid_mnd, boPlan.arlig_prisvekst_pst])

  // I bo-modus syncer vi bo-tid → holdetid og bruker projisert pris i kalkulator.
  // Vi gjør ikke direkte mutasjon — i stedet bruker vi en "effektiv" kalk i beregningen.
  const effektivKalk = useMemo<Kalk>(() => {
    if (modus !== 'bo') return kalk
    return {
      ...kalk,
      holdetid_mnd: boPlan.bo_tid_mnd,
      salgspris: Math.round(projisertSalgspris),
    }
  }, [modus, kalk, boPlan.bo_tid_mnd, projisertSalgspris])

  // === UTLEIE-DEL (kun bo-modus + når aktiv) ===
  const utleieBeregning = useMemo(() => {
    if (modus !== 'bo' || !utleieDel.aktiv || utleieDel.leie_mnd === 0) {
      return { brutto_mnd: 0, netto_mnd: 0, brutto_total: 0, netto_total: 0, etableringskost: 0, skatt: 0 }
    }
    const brutto_mnd = utleieDel.leie_mnd * (utleieDel.belegg_pst / 100)
    const drift_mnd = brutto_mnd * (utleieDel.drift_pst / 100)
    const netto_mnd_for_skatt = brutto_mnd - drift_mnd
    const brutto_total = brutto_mnd * boPlan.bo_tid_mnd
    const drift_total = drift_mnd * boPlan.bo_tid_mnd
    // Skatteregel: utleie av mindre enn halvparten av primærbolig er skattefri.
    const skatt = utleieDel.skattefri ? 0 : (brutto_total - drift_total) * 0.22
    const netto_mnd = utleieDel.skattefri ? netto_mnd_for_skatt : netto_mnd_for_skatt * 0.78
    const netto_total = brutto_total - drift_total - skatt
    return { brutto_mnd, netto_mnd, brutto_total, netto_total, etableringskost: utleieDel.etableringskost, skatt }
  }, [modus, utleieDel, boPlan.bo_tid_mnd])

  // === SALG AV EKSISTERENDE BOLIG (kun bo-modus) ===
  const eksisterendeBeregning = useMemo(() => {
    if (modus !== 'bo' || eksisterende.salgssum === 0) {
      return { meglerhonorar: 0, salgskostnader: 0, skatt: 0, nettoTilDisposisjon: 0 }
    }
    const meglerhonorar = (eksisterende.salgssum * eksisterende.meglerhonorar_pst) / 100
    const salgskostnader = meglerhonorar + eksisterende.marknadsforing
    // Egenboligsalg er normalt skattefritt hvis bodd 12 av siste 24 mnd
    const skattegrunnlag = eksisterende.salgssum - salgskostnader - eksisterende.restgjeld
    const skatt = eksisterende.skattefri || skattegrunnlag <= 0 ? 0 : skattegrunnlag * 0.22
    const nettoTilDisposisjon = eksisterende.salgssum - salgskostnader - eksisterende.restgjeld - skatt
    return { meglerhonorar, salgskostnader, skatt, nettoTilDisposisjon }
  }, [modus, eksisterende])

  // === KALKULATOR ===
  // Bruker effektivKalk så bo-modus får projisert salgspris og bo-tid automatisk
  const beregning = useMemo(() => {
    const k = effektivKalk
    const totalKjopspris = k.kjopesum + k.fellesgjeld
    const dokavg = (k.kjopesum * k.dokumentavgift_pst) / 100
    const kjopskostnader = dokavg + k.tinglysing
    const totalKjop = k.kjopesum + kjopskostnader

    const oppussingTotal = k.oppussing_kost + k.mobler_styling

    // Lånekostnad i holdetiden
    const lanebelop = totalKjop * (1 - k.egenkapital_pst / 100)
    const renterPerMnd = (lanebelop * k.rente_pst / 100) / 12
    const renterTotal = renterPerMnd * k.holdetid_mnd
    const fellesutgTotal = k.fellesutg_mnd * k.holdetid_mnd
    const holdekostnad = renterTotal + fellesutgTotal

    const totalInvestering = totalKjop + oppussingTotal + holdekostnad

    // Salg
    const meglerhonorar = (k.salgspris * k.meglerhonorar_pst) / 100
    const salgskostnader = meglerhonorar + k.marknadsforing
    const nettoSalg = k.salgspris - salgskostnader

    // Brutto fortjeneste før skatt
    // For norsk skatt: gevinst regnes mot kjøpesum + dokavg + faktiske oppussingskostnader (ikke holdekostnader/renter)
    const skattegrunnlag = nettoSalg - (k.kjopesum + kjopskostnader + k.oppussing_kost + k.mobler_styling)
    // I bo-modus blir salget skattefritt etter 12 mnd botid — automatisk hvis bo-tid >= 12
    const erSkattefri = k.skattefri || (modus === 'bo' && boPlan.bo_tid_mnd >= 12)
    const skatt = erSkattefri || skattegrunnlag <= 0 ? 0 : (skattegrunnlag * k.skattesats_pst) / 100

    // I bo-modus med utleie-del: legg til netto leieinntekt over bo-tiden,
    // og trekk fra etableringskostnaden for utleiedelen
    const utleieBidrag = utleieBeregning.netto_total - utleieBeregning.etableringskost
    const nettoFortjeneste = nettoSalg - totalInvestering - skatt + utleieBidrag
    const egenkapital = totalInvestering - lanebelop
    const roi = egenkapital > 0 ? (nettoFortjeneste / egenkapital) * 100 : 0

    return {
      totalKjopspris, dokavg, kjopskostnader, totalKjop,
      oppussingTotal, lanebelop, renterTotal, fellesutgTotal, holdekostnad,
      totalInvestering, meglerhonorar, salgskostnader, nettoSalg,
      skattegrunnlag, skatt, nettoFortjeneste, egenkapital, roi,
      utleieBidrag,
    }
  }, [effektivKalk, modus, boPlan.bo_tid_mnd, utleieBeregning])

  // === FINANSIERING (kun bo-modus) ===
  // Bruker netto fra salg av eksisterende som faktisk egenkapital,
  // og regner ut hva som faktisk må lånes basert på det.
  const finansiering = useMemo(() => {
    if (modus !== 'bo') return null
    const totalUtlegg = beregning.totalKjop + beregning.oppussingTotal
    const tilgjengeligEK = eksisterendeBeregning.nettoTilDisposisjon
    const lanebehov = Math.max(0, totalUtlegg - tilgjengeligEK)
    const overskudd = Math.max(0, tilgjengeligEK - totalUtlegg)
    const belaningsgrad = kalk.kjopesum > 0 ? (lanebehov / kalk.kjopesum) * 100 : 0
    // Annuitetslån — vanlig norsk standard 25 år
    const nedbetalingstid_aar = 25
    const renteMnd = kalk.rente_pst / 100 / 12
    const antMnd = nedbetalingstid_aar * 12
    const mndBetaling = lanebehov > 0 && renteMnd > 0
      ? (lanebehov * renteMnd) / (1 - Math.pow(1 + renteMnd, -antMnd))
      : 0
    return { totalUtlegg, tilgjengeligEK, lanebehov, overskudd, belaningsgrad, mndBetaling }
  }, [modus, beregning.totalKjop, beregning.oppussingTotal, eksisterendeBeregning.nettoTilDisposisjon, kalk.kjopesum, kalk.rente_pst])

  // === BANK-SCORE — gjenbruker pure-funksjon fra lib (samme logikk som i PDF-bygger) ===
  const bankScore = useMemo(() => {
    return regnBankScore(husholdning, utleieBeregning, finansiering, kalk)
  }, [husholdning, utleieBeregning, finansiering, kalk])

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
        // Komplett state slik at vi kan laste inn igjen
        norsk_kalkulator_data: {
          analyse, kalk, modus, eksisterende, boPlan, utleieDel, oppussingsposter, husholdning, meglerVurderinger,
          lagret_tidspunkt: new Date().toISOString(),
        },
      }

      const { error } = await supabase.from('prosjekter').insert([{ ...nytt, ...norskeFelter, bruker }])
      if (error) {
        visToast('Lagring feilet: ' + error.message, 'feil', 5000)
      } else {
        await loggAktivitet({ handling: 'lagret norsk flippe-prosjekt', tabell: 'prosjekter', rad_id: id, detaljer: { navn } })
        setLagretId(id)
        await hentLagrede()
        visToast('Lagret! Du kan komme tilbake og fortsette senere.', 'suksess', 4000)
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
        kalk: effektivKalk,
        beregning,
        oppussingsposter,
        meglerVurderinger,
        bankVurdering: bankScore.sumInntektMnd > 0 ? {
          inntekter: husholdning.inntekter,
          antallVoksne: husholdning.antall_voksne,
          antallBarn: husholdning.antall_barn,
          andreLan: husholdning.andre_lan,
          ...bankScore,
          annenSikkerhet: husholdning.annen_sikkerhet_aktiv ? {
            aktiv: true,
            verdi: husholdning.annen_bolig_verdi,
            lan: husholdning.annen_bolig_lan,
            beskrivelse: husholdning.annen_bolig_beskrivelse,
          } : undefined,
        } : null,
        prosjektId: lagretId || undefined,
        supabaseKlient: lagretId ? supabase : undefined,
        boFlipp: modus === 'bo' && finansiering ? {
          eksisterende: {
            salgssum: eksisterende.salgssum,
            restgjeld: eksisterende.restgjeld,
            meglerhonorar_pst: eksisterende.meglerhonorar_pst,
            marknadsforing: eksisterende.marknadsforing,
            skattefri: eksisterende.skattefri,
          },
          netto: eksisterendeBeregning,
          finansiering,
          utleie: utleieDel.aktiv ? {
            aktiv: true,
            leie_mnd: utleieDel.leie_mnd,
            belegg_pst: utleieDel.belegg_pst,
            drift_pst: utleieDel.drift_pst,
            etableringskost: utleieDel.etableringskost,
            skattefri: utleieDel.skattefri,
            brutto_mnd: utleieBeregning.brutto_mnd,
            netto_mnd: utleieBeregning.netto_mnd,
            brutto_total: utleieBeregning.brutto_total,
            netto_total: utleieBeregning.netto_total,
            skatt: utleieBeregning.skatt,
            nettoBidrag: utleieBeregning.netto_total - utleieBeregning.etableringskost,
          } : undefined,
        } : null,
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
    setInput(''); setAnalyse(null); setFeil(''); setLagretId(null); setFraCache(null)
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

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 10 }}>NORGE — FLIPP</div>
        <h2 style={{ fontSize: 28, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.01em' }}>Norske boliger</h2>
        <p style={{ color: FARGER.tekstMid, margin: '6px 0 0', fontSize: 14, fontWeight: 300 }}>Analyser en Finn-annonse og kjør flippe-kalkulator</p>
      </div>

      <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Modus</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <button onClick={() => setModus('ren')}
            style={{
              background: modus === 'ren' ? FARGER.mork : 'transparent',
              color: modus === 'ren' ? 'white' : FARGER.mork,
              border: `1px solid ${modus === 'ren' ? FARGER.mork : FARGER.gullSvak}`,
              padding: '12px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '0.06em', textAlign: 'left',
            }}>
            <div>🏘️ REN FLIPP</div>
            <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 4, letterSpacing: 'normal' }}>Kjøp, puss opp, selg</div>
          </button>
          <button onClick={() => setModus('bo')}
            style={{
              background: modus === 'bo' ? FARGER.mork : 'transparent',
              color: modus === 'bo' ? 'white' : FARGER.mork,
              border: `1px solid ${modus === 'bo' ? FARGER.mork : FARGER.gullSvak}`,
              padding: '12px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '0.06em', textAlign: 'left',
            }}>
            <div>🏡 BO OG FLIPP</div>
            <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 4, letterSpacing: 'normal' }}>Selg eget hjem → kjøp ny → bo og puss → selg</div>
          </button>
        </div>
      </div>

      {lagrede.length > 0 && (
        <LagredeProsjekter prosjekter={lagrede} onLastInn={lastInn} onSlett={slettLagret} aktivId={lagretId} />
      )}

      {modus === 'bo' && (
        <SalgEgenBolig eks={eksisterende} setEks={setEksisterende} netto={eksisterendeBeregning} />
      )}

      <div style={{ background: FARGER.creamLys, borderRadius: RADIUS.sm, padding: 20, marginBottom: 24, border: `1px solid ${FARGER.gullSvak}` }}>
        <label style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Lim inn Finn-lenke eller annonsetekst</label>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="https://www.finn.no/realestate/homes/ad.html?finnkode=..."
          style={{ width: '100%', height: 90, padding: 12, fontSize: 14, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, resize: 'vertical', fontFamily: 'sans-serif', boxSizing: 'border-box', background: 'white' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={() => analyser()} disabled={laster || !input}
            style={{ flex: 1, minWidth: 200, background: laster ? '#888' : FARGER.mork, color: 'white', border: 'none', padding: 14, borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: laster ? 'not-allowed' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {laster ? 'Analyserer...' : 'Kjør analyse'}
          </button>
          {analyse && !laster && (
            <button onClick={regenerer}
              title="Sletter cache og kjører analysen på nytt mot AI"
              style={{ background: 'transparent', color: FARGER.mork, border: `1px solid ${FARGER.gull}`, padding: '14px 18px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              🔄 Regenerer
            </button>
          )}
          {(input || analyse) && <button onClick={nullstill}
            style={{ background: FARGER.flateLys, color: FARGER.tekstMid, border: 'none', padding: '14px 20px', borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Nullstill
          </button>}
        </div>
        {fraCache && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fdfcf7', border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, fontSize: 12, color: FARGER.tekstMid }}>
            ✓ Hentet fra cache (analysert {new Date(fraCache).toLocaleString('nb-NO')}) — samme analyse hver gang. Klikk «🔄 Regenerer» hvis du vil ha en ny vurdering fra AI.
          </div>
        )}
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
          {modus === 'bo' && (
            <>
              <BoPlanPanel
                boPlan={boPlan} setBoPlan={setBoPlan}
                salgsprisIDag={kalk.salgspris}
                projisert={projisertSalgspris}
                aiBegrunnelse={analyse.prisvekst_begrunnelse}
              />
              <UtleieDelPanel
                utleieDel={utleieDel} setUtleieDel={setUtleieDel}
                boTidMnd={boPlan.bo_tid_mnd}
                beregning={utleieBeregning}
                aiForslag={analyse.utleiedel}
              />
            </>
          )}
          <Kalkulator kalk={kalk} setKalk={setKalk} beregning={beregning} oppussingFraPoster={oppussingsposter.length > 0} boModus={modus === 'bo'} effektivSalgspris={effektivKalk.salgspris} effektivHoldetid={effektivKalk.holdetid_mnd} />
          <MeglerVurderingerPanel
            vurderinger={meglerVurderinger}
            setVurderinger={setMeglerVurderinger}
            forventetSalgspris={effektivKalk.salgspris}
          />
          {modus === 'bo' && finansiering && (
            <Finansiering f={finansiering} eks={eksisterendeBeregning} salgssum={effektivKalk.salgspris} utleieMnd={utleieBeregning.netto_mnd} />
          )}
          <HusholdningPanel husholdning={husholdning} setHusholdning={setHusholdning} />
          <BankScore s={bankScore} />
          <Sensitivitet kalk={effektivKalk} basis={beregning} utleieBidrag={utleieBeregning.netto_total - utleieBeregning.etableringskost} />

          {!lagretId && (
            <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: 18, marginBottom: 16 }}>
              <button onClick={lagreSomProsjekt} disabled={lagrer}
                style={{ width: '100%', background: lagrer ? '#888' : FARGER.mork, color: 'white', border: 'none', padding: 14, borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: lagrer ? 'wait' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {lagrer ? 'Lagrer...' : '💾 Lagre som prosjekt'}
              </button>
              <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '10px 0 0' }}>Lagre prosjektet for å laste opp bilder og generere før/etter-visualiseringer.</p>
            </div>
          )}

          {lagretId && (
            <>
              <div style={{ background: '#e8f5ed', border: `1px solid #2D7D4644`, borderRadius: RADIUS.sm, padding: 14, marginBottom: 16, fontSize: 13, color: '#1a4d2b' }}>
                ✓ Prosjektet er lagret. Last opp bilder nedenfor — AI analyserer dem og kan generere før/etter-visualiseringer som blir med i PDF-prospektet.
              </div>

              <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>📸 Bilder + AI-visualisering</div>
                <ProsjektBilder prosjektId={lagretId} />
              </div>

              <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: 18, marginBottom: 16 }}>
                <button onClick={lastNedPdf} disabled={pdfLaster}
                  style={{ width: '100%', background: pdfLaster ? '#888' : FARGER.mork, color: 'white', border: 'none', padding: 14, borderRadius: RADIUS.sm, fontSize: 12, fontWeight: 600, cursor: pdfLaster ? 'wait' : 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {pdfLaster ? 'Bygger PDF...' : '📄 Last ned komplett PDF-prospekt'}
                </button>
                <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '10px 0 0' }}>Inkluderer score, kalkulator, oppussingsposter, sensitivitet, bud-strategi{modus === 'bo' ? ', salg/finansiering, utleie-del' : ''} og før/etter-bilder.</p>
              </div>
            </>
          )}
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
  utleieBidrag?: number
}

function Kalkulator({ kalk, setKalk, beregning, oppussingFraPoster, boModus, effektivSalgspris, effektivHoldetid }: {
  kalk: Kalk; setKalk: (k: Kalk) => void; beregning: Beregning
  oppussingFraPoster: boolean; boModus: boolean
  effektivSalgspris?: number; effektivHoldetid?: number
}) {
  const oppdater = (felt: keyof Kalk, verdi: number | boolean) => setKalk({ ...kalk, [felt]: verdi })
  const visningHoldetid = boModus && effektivHoldetid !== undefined ? effektivHoldetid : kalk.holdetid_mnd
  const visningSalgspris = boModus && effektivSalgspris !== undefined ? effektivSalgspris : kalk.salgspris

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

      <Seksjon tittel={boModus ? 'Bo- og lånekostnader' : 'Holde-kostnader'}>
        {boModus ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: FARGER.tekstMid, fontStyle: 'italic' }}>
            <span>Bo-tid (settes i steg 2 ovenfor)</span>
            <span style={{ color: FARGER.mork, fontWeight: 600, fontStyle: 'normal' }}>{visningHoldetid} mnd</span>
          </div>
        ) : (
          <KalkFelt lbl="Holdetid (mnd)" val={kalk.holdetid_mnd} onChange={v => oppdater('holdetid_mnd', v)} step={1} />
        )}
        <KalkFelt lbl="Rente %" val={kalk.rente_pst} onChange={v => oppdater('rente_pst', v)} step={0.1} />
        <KalkFelt lbl="Egenkapital %" val={kalk.egenkapital_pst} onChange={v => oppdater('egenkapital_pst', v)} step={1} />
        <KalkFelt lbl="Fellesutgifter / mnd" val={kalk.fellesutg_mnd} onChange={v => oppdater('fellesutg_mnd', v)} />
        <Resultatlinje lbl={`Renter ${visningHoldetid} mnd`} val={beregning.renterTotal} />
        <Resultatlinje lbl={`Fellesutg. ${visningHoldetid} mnd`} val={beregning.fellesutgTotal} />
      </Seksjon>

      <Seksjon tittel="Salg">
        {boModus ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: FARGER.tekstMid, fontStyle: 'italic' }}>
            <span>Salgspris (projisert fra steg 2 — bo-tid + prisvekst)</span>
            <span style={{ color: FARGER.mork, fontWeight: 600, fontStyle: 'normal' }}>{fmtNok(visningSalgspris)}</span>
          </div>
        ) : (
          <KalkFelt lbl="Forventet salgssum" val={kalk.salgspris} onChange={v => oppdater('salgspris', v)} />
        )}
        <KalkFelt lbl="Meglerhonorar %" val={kalk.meglerhonorar_pst} onChange={v => oppdater('meglerhonorar_pst', v)} step={0.1} />
        <KalkFelt lbl="Markedsføring / takst" val={kalk.marknadsforing} onChange={v => oppdater('marknadsforing', v)} />
        <Resultatlinje lbl="Meglerhonorar" val={beregning.meglerhonorar} />
        <Resultatlinje lbl="Netto salg" val={beregning.nettoSalg} bold />
      </Seksjon>

      <Seksjon tittel="Skatt">
        {boModus ? (
          <div style={{ padding: '8px 0', fontSize: 13, color: FARGER.tekstMid, fontStyle: 'italic' }}>
            Skattestatus styres av bo-tid (skattefritt ved ≥ 12 mnd).
          </div>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', padding: '6px 0' }}>
              <input type="checkbox" checked={kalk.skattefri} onChange={e => oppdater('skattefri', e.target.checked)} style={{ width: 18, height: 18 }} />
              <span>Skattefri (bodd 12 av siste 24 mnd)</span>
            </label>
            {!kalk.skattefri && <KalkFelt lbl="Skattesats %" val={kalk.skattesats_pst} onChange={v => oppdater('skattesats_pst', v)} step={1} />}
          </>
        )}
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
function regnUt(k: Kalk, utleieBidrag = 0): Beregning {
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

  const nettoFortjeneste = nettoSalg - totalInvestering - skatt + utleieBidrag
  const egenkapital = totalInvestering - lanebelop
  const roi = egenkapital > 0 ? (nettoFortjeneste / egenkapital) * 100 : 0

  return {
    totalKjopspris, dokavg, kjopskostnader, totalKjop,
    oppussingTotal, lanebelop, renterTotal, fellesutgTotal, holdekostnad,
    totalInvestering, meglerhonorar, salgskostnader, nettoSalg,
    skattegrunnlag, skatt, nettoFortjeneste, egenkapital, roi,
    utleieBidrag,
  }
}

function Sensitivitet({ kalk, basis, utleieBidrag = 0 }: { kalk: Kalk; basis: Beregning; utleieBidrag?: number }) {
  // Scenarier — hver justerer ett felt
  const scenarier: Array<{ navn: string; emoji: string; resultat: Beregning }> = [
    { navn: 'Salgspris −5 %', emoji: '📉', resultat: regnUt({ ...kalk, salgspris: kalk.salgspris * 0.95 }, utleieBidrag) },
    { navn: 'Salgspris −10 %', emoji: '📉', resultat: regnUt({ ...kalk, salgspris: kalk.salgspris * 0.9 }, utleieBidrag) },
    { navn: 'Oppussing +20 %', emoji: '🔨', resultat: regnUt({ ...kalk, oppussing_kost: kalk.oppussing_kost * 1.2 }, utleieBidrag) },
    { navn: 'Holdetid +3 mnd', emoji: '⏱️', resultat: regnUt({ ...kalk, holdetid_mnd: kalk.holdetid_mnd + 3 }, utleieBidrag) },
    { navn: 'Rente +1 %', emoji: '💸', resultat: regnUt({ ...kalk, rente_pst: kalk.rente_pst + 1 }, utleieBidrag) },
  ]

  // Break-even: hvor lavt kan salgsprisen gå før netto = 0?
  // Vi prøver lineær søk fra dagens salgspris og ned
  let breakEven = 0
  if (kalk.salgspris > 0) {
    let lavt = kalk.kjopesum, hoyt = kalk.salgspris
    for (let i = 0; i < 40; i++) {
      const midt = (lavt + hoyt) / 2
      const r = regnUt({ ...kalk, salgspris: midt }, utleieBidrag)
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

function MeglerVurderingerPanel({ vurderinger, setVurderinger, forventetSalgspris }: {
  vurderinger: MeglerVurdering[]
  setVurderinger: (v: MeglerVurdering[]) => void
  forventetSalgspris: number
}) {
  function leggTil() {
    setVurderinger([...vurderinger, {
      navn: '', firma: '', telefon: '', epost: '',
      verdi_nok: 0, dato: new Date().toISOString().slice(0, 10), notat: '',
    }])
  }
  function fjern(i: number) {
    setVurderinger(vurderinger.filter((_, idx) => idx !== i))
  }
  function oppdater(i: number, felt: keyof MeglerVurdering, verdi: string | number) {
    setVurderinger(vurderinger.map((v, idx) => idx === i ? { ...v, [felt]: verdi } : v))
  }

  const med_verdi = vurderinger.filter(v => v.verdi_nok > 0)
  const snitt = med_verdi.length > 0 ? med_verdi.reduce((s, v) => s + v.verdi_nok, 0) / med_verdi.length : 0
  const min = med_verdi.length > 0 ? Math.min(...med_verdi.map(v => v.verdi_nok)) : 0
  const max = med_verdi.length > 0 ? Math.max(...med_verdi.map(v => v.verdi_nok)) : 0
  const avvikSnittPst = forventetSalgspris > 0 && snitt > 0 ? ((forventetSalgspris - snitt) / snitt) * 100 : 0

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>📋 Megler-verdivurderinger</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 16px', fontWeight: 300 }}>
        Forhåndsvurderinger fra meglere du har snakket med. Brukes som ekstern referanse i bankprospektet — styrker troverdigheten betydelig.
      </p>

      {vurderinger.length === 0 && (
        <div style={{ background: FARGER.creamLys, padding: 14, borderRadius: RADIUS.sm, fontSize: 13, color: FARGER.tekstMid, marginBottom: 14, fontStyle: 'italic', textAlign: 'center' }}>
          Ingen verdivurderinger registrert. Legg til vurderinger fra meglere du har vært i kontakt med.
        </div>
      )}

      {vurderinger.map((v, i) => (
        <div key={i} style={{ background: FARGER.creamLys, borderRadius: RADIUS.sm, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Vurdering {i + 1}</div>
            <button onClick={() => fjern(i)} title="Fjern"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#888', padding: '2px 6px' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
            <MeglerFelt lbl="Megler navn" val={v.navn} onChange={s => oppdater(i, 'navn', s)} placeholder="Ola Hansen" />
            <MeglerFelt lbl="Firma" val={v.firma} onChange={s => oppdater(i, 'firma', s)} placeholder="Krogsveen Bergen" />
            <MeglerFelt lbl="Telefon" val={v.telefon} onChange={s => oppdater(i, 'telefon', s)} placeholder="91 23 45 67" />
            <MeglerFelt lbl="E-post" val={v.epost} onChange={s => oppdater(i, 'epost', s)} placeholder="ola@krogsveen.no" />
            <MeglerFeltTall lbl="Verdivurdering (kr)" val={v.verdi_nok} onChange={n => oppdater(i, 'verdi_nok', n)} />
            <MeglerFeltDato lbl="Dato" val={v.dato} onChange={s => oppdater(i, 'dato', s)} />
          </div>
          <MeglerFelt lbl="Notat fra megleren (valgfri)" val={v.notat} onChange={s => oppdater(i, 'notat', s)} placeholder="F.eks. 'Tror det er marginalt over markedssnittet i området'" multiline />
        </div>
      ))}

      <button onClick={leggTil}
        style={{ background: FARGER.mork, color: 'white', border: 'none', borderRadius: RADIUS.sm, padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
        + Legg til verdivurdering
      </button>

      {med_verdi.length > 0 && (
        <div style={{ marginTop: 16, padding: 14, background: '#fdfcf7', border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm }}>
          <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Sammendrag av verdivurderinger</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: FARGER.tekstLys, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Snitt ({med_verdi.length} st.)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: FARGER.mork, marginTop: 2 }}>{fmtNok(snitt)}</div>
            </div>
            {med_verdi.length > 1 && (
              <>
                <div>
                  <div style={{ fontSize: 10, color: FARGER.tekstLys, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lavest</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.tekstMid, marginTop: 2 }}>{fmtNok(min)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: FARGER.tekstLys, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Høyest</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.tekstMid, marginTop: 2 }}>{fmtNok(max)}</div>
                </div>
              </>
            )}
            {forventetSalgspris > 0 && (
              <div>
                <div style={{ fontSize: 10, color: FARGER.tekstLys, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vår kalkulasjon vs snitt</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: avvikSnittPst > 5 ? '#7a0c1e' : avvikSnittPst < -5 ? '#1a4d2b' : FARGER.tekstMid, marginTop: 2 }}>
                  {avvikSnittPst >= 0 ? '+' : ''}{avvikSnittPst.toFixed(1)} %
                </div>
              </div>
            )}
          </div>
          {Math.abs(avvikSnittPst) > 10 && forventetSalgspris > 0 && (
            <div style={{ marginTop: 10, padding: 10, background: 'rgba(255,255,255,0.7)', borderRadius: RADIUS.sm, fontSize: 12, color: FARGER.tekstMid, lineHeight: 1.5 }}>
              ⚠ Vår forventede salgspris ligger {Math.abs(avvikSnittPst).toFixed(0)}% {avvikSnittPst > 0 ? 'over' : 'under'} meglersnittet — vurder å justere kalkulasjonen for å være konsistent med de eksterne vurderingene.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MeglerFelt({ lbl, val, onChange, placeholder, multiline }: { lbl: string; val: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 600 }}>{lbl}</label>
      {multiline ? (
        <textarea value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          rows={2}
          style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white', boxSizing: 'border-box', resize: 'vertical' }} />
      ) : (
        <input value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white', boxSizing: 'border-box' }} />
      )}
    </div>
  )
}

function MeglerFeltTall({ lbl, val, onChange }: { lbl: string; val: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 600 }}>{lbl}</label>
      <input type="number" min={0} step={10000} value={val || ''} onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white', boxSizing: 'border-box', textAlign: 'right' }} />
    </div>
  )
}

function MeglerFeltDato({ lbl, val, onChange }: { lbl: string; val: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4, fontWeight: 600 }}>{lbl}</label>
      <input type="date" value={val} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white', boxSizing: 'border-box' }} />
    </div>
  )
}

function HusholdningPanel({ husholdning, setHusholdning }: {
  husholdning: Husholdning
  setHusholdning: (h: Husholdning) => void
}) {
  const sumInntekt = husholdning.inntekter.reduce((s, i) => s + (i.belop_mnd || 0), 0)
  const livsopphold = regnLivsopphold(husholdning.antall_voksne, husholdning.antall_barn)
  const sumAndreLanMnd = husholdning.andre_lan.reduce((s, l) => s + (l.mnd_betaling || 0), 0)
  const annenSikkerhet = husholdning.annen_sikkerhet_aktiv
    ? Math.max(0, husholdning.annen_bolig_verdi - husholdning.annen_bolig_lan) : 0

  function leggTilInntekt() {
    setHusholdning({ ...husholdning, inntekter: [...husholdning.inntekter, { beskrivelse: '', belop_mnd: 0 }] })
  }
  function fjernInntekt(i: number) {
    setHusholdning({ ...husholdning, inntekter: husholdning.inntekter.filter((_, idx) => idx !== i) })
  }
  function oppdaterInntekt(i: number, felt: 'beskrivelse' | 'belop_mnd', verdi: string | number) {
    setHusholdning({
      ...husholdning,
      inntekter: husholdning.inntekter.map((inn, idx) => idx === i ? { ...inn, [felt]: verdi } : inn),
    })
  }

  function leggTilLan() {
    setHusholdning({ ...husholdning, andre_lan: [...husholdning.andre_lan, { beskrivelse: '', type: 'annet', saldo: 0, mnd_betaling: 0 }] })
  }
  function fjernLan(i: number) {
    setHusholdning({ ...husholdning, andre_lan: husholdning.andre_lan.filter((_, idx) => idx !== i) })
  }
  function oppdaterLan(i: number, felt: keyof AnnetLan, verdi: string | number) {
    setHusholdning({
      ...husholdning,
      andre_lan: husholdning.andre_lan.map((l, idx) => idx === i ? { ...l, [felt]: verdi } : l),
    })
  }

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>👨‍👩‍👧 Steg 4 — Husholdning og sikkerhet</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 18px', fontWeight: 300 }}>
        Inntekter, husholdningssammensetning, andre lån og evt. ekstra sikkerhet. Brukes til bank-vurdering nedenfor.
      </p>

      {/* Husholdning + skattesats */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.tekstMid, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Husholdning</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 10 }}>
          <KalkInput lbl="Antall voksne" val={husholdning.antall_voksne}
            onChange={v => setHusholdning({ ...husholdning, antall_voksne: Math.max(1, Math.min(2, v)) })} step={1} />
          <KalkInput lbl="Barn under 18" val={husholdning.antall_barn}
            onChange={v => setHusholdning({ ...husholdning, antall_barn: Math.max(0, v) })} step={1} />
          <KalkInput lbl="Skattesats % (lønn)" val={husholdning.skattesats_pst}
            onChange={v => setHusholdning({ ...husholdning, skattesats_pst: v })} step={1} />
        </div>
        <div style={{ background: FARGER.creamLys, padding: 10, borderRadius: RADIUS.sm, fontSize: 12, color: FARGER.tekstMid, lineHeight: 1.6 }}>
          📊 Estimert SIFO-livsopphold: <strong>{fmtNok(livsopphold)}/mnd</strong>
          {husholdning.antall_barn > 0 && ` (${fmtNok(livsopphold - regnLivsopphold(husholdning.antall_voksne, 0))} av dette går til barn)`}
        </div>
      </div>

      {/* Inntekter */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.tekstMid, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Brutto månedlige inntekter</div>
        {husholdning.inntekter.length === 0 && (
          <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', padding: '8px 0' }}>Ingen inntekter lagt inn ennå.</div>
        )}
        {husholdning.inntekter.map((inn, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: i < husholdning.inntekter.length - 1 ? `1px solid ${FARGER.kantLys}` : 'none' }}>
            <input value={inn.beskrivelse} onChange={e => oppdaterInntekt(i, 'beskrivelse', e.target.value)}
              placeholder="F.eks. Person 1 - Lønn fast jobb"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white' }} />
            <input type="number" min={0} step={1000} value={inn.belop_mnd || ''}
              onChange={e => oppdaterInntekt(i, 'belop_mnd', Number(e.target.value) || 0)}
              placeholder="kr/mnd"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
            <button onClick={() => fjernInntekt(i)} title="Fjern"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '4px 8px' }}>✕</button>
          </div>
        ))}
        <button onClick={leggTilInntekt}
          style={{ marginTop: 10, background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: '8px 14px', fontSize: 12, color: FARGER.mork, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          + Legg til inntektskilde
        </button>
        {sumInntekt > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: FARGER.creamLys, borderRadius: RADIUS.sm, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: FARGER.tekstMid }}>Sum brutto</span>
            <span style={{ fontWeight: 700, color: FARGER.mork }}>{fmtNok(sumInntekt)}/mnd ({fmtNok(sumInntekt * 12)}/år)</span>
          </div>
        )}
      </div>

      {/* Andre lån */}
      <div style={{ marginBottom: 18, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.tekstMid, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Andre eksisterende lån (billån, studielån, kreditt osv.)</div>
        {husholdning.andre_lan.length === 0 && (
          <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', padding: '8px 0' }}>Ingen andre lån lagt inn.</div>
        )}
        {husholdning.andre_lan.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 110px auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: i < husholdning.andre_lan.length - 1 ? `1px solid ${FARGER.kantLys}` : 'none' }}>
            <input value={l.beskrivelse} onChange={e => oppdaterLan(i, 'beskrivelse', e.target.value)}
              placeholder="F.eks. Billån VW Golf"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white' }} />
            <select value={l.type} onChange={e => oppdaterLan(i, 'type', e.target.value)}
              style={{ padding: '6px 8px', fontSize: 12, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, background: 'white' }}>
              <option value="billan">Billån</option>
              <option value="studielan">Studielån</option>
              <option value="kreditt">Kreditt</option>
              <option value="annet_boliglan">Boliglån</option>
              <option value="annet">Annet</option>
            </select>
            <input type="number" min={0} step={10000} value={l.saldo || ''}
              onChange={e => oppdaterLan(i, 'saldo', Number(e.target.value) || 0)}
              placeholder="Saldo"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
            <input type="number" min={0} step={500} value={l.mnd_betaling || ''}
              onChange={e => oppdaterLan(i, 'mnd_betaling', Number(e.target.value) || 0)}
              placeholder="kr/mnd"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
            <button onClick={() => fjernLan(i)} title="Fjern"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '4px 8px' }}>✕</button>
          </div>
        ))}
        <button onClick={leggTilLan}
          style={{ marginTop: 10, background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: '8px 14px', fontSize: 12, color: FARGER.mork, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          + Legg til lån
        </button>
        {sumAndreLanMnd > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: FARGER.creamLys, borderRadius: RADIUS.sm, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: FARGER.tekstMid }}>Sum andre lån — månedlig</span>
            <span style={{ fontWeight: 700, color: FARGER.mork }}>{fmtNok(sumAndreLanMnd)}/mnd</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={husholdning.annen_sikkerhet_aktiv}
            onChange={e => setHusholdning({ ...husholdning, annen_sikkerhet_aktiv: e.target.checked })}
            style={{ width: 18, height: 18 }} />
          <span style={{ fontWeight: 600 }}>🏦 Vi kan stille sikkerhet i en annen bolig</span>
        </label>

        {husholdning.annen_sikkerhet_aktiv && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>Beskrivelse</label>
              <input value={husholdning.annen_bolig_beskrivelse}
                onChange={e => setHusholdning({ ...husholdning, annen_bolig_beskrivelse: e.target.value })}
                placeholder="F.eks. Hytte i Hemsedal, fritidsbolig, sokkelleilighet"
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', boxSizing: 'border-box', background: 'white' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <KalkInput lbl="Verdi (markedstakst)" val={husholdning.annen_bolig_verdi}
                onChange={v => setHusholdning({ ...husholdning, annen_bolig_verdi: v })} />
              <KalkInput lbl="Eksisterende lån" val={husholdning.annen_bolig_lan}
                onChange={v => setHusholdning({ ...husholdning, annen_bolig_lan: v })} />
            </div>
            <div style={{ background: FARGER.creamLys, padding: 12, borderRadius: RADIUS.sm, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: FARGER.tekstMid }}>Tilgjengelig sikkerhet</span>
              <span style={{ fontWeight: 700, color: FARGER.mork }}>{fmtNok(annenSikkerhet)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BankScore({ s }: { s: import('../lib/norskBankScore').BankScore }) {
  const lysBg = s.lys === '🟢' ? '#e8f5ed' : s.lys === '🔴' ? '#fde8ec' : '#fff8e1'
  const lysBorder = s.lys === '🟢' ? '#2D7D46' : s.lys === '🔴' ? '#C8102E' : '#B05E0A'
  const lysText = s.lys === '🟢' ? '#1a4d2b' : s.lys === '🔴' ? '#7a0c1e' : '#6b3a0a'

  const ingenInntekt = s.sumInntektMnd === 0
  const fargeForScore = (sc: number) => sc >= 75 ? '#2D7D46' : sc >= 50 ? '#B05E0A' : '#C8102E'

  return (
    <div style={{ background: lysBg, border: `2px solid ${lysBorder}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 48 }}>{s.lys}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.16em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>🏦 Bank-vurdering</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: lysText }}>{s.lysTekst}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: lysText, lineHeight: 1 }}>{s.total}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>/ 100</div>
        </div>
      </div>

      {ingenInntekt && (
        <div style={{ background: 'rgba(255,255,255,0.7)', padding: 12, borderRadius: RADIUS.sm, fontSize: 13, color: FARGER.tekstMid, fontStyle: 'italic', marginBottom: 14 }}>
          Legg inn husholdningens inntekter ovenfor for å få en bank-vurdering basert på Finanstilsynets utlånsforskrift.
        </div>
      )}

      {!ingenInntekt && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <ScoreBoks lbl="Gjeldsgrad" val={s.gjeldsgrad.toFixed(1) + 'x'} score={s.gjeldsgradScore} farge={fargeForScore(s.gjeldsgradScore)}
              undertekst={`Lån / årsinntekt — bør være ≤5x${s.annenSikkerhetNetto > 0 ? ' (justert for ekstra sikkerhet)' : ''}`} />
            <ScoreBoks lbl="Belåningsgrad" val={fmtPct(s.belaningsgrad)} score={s.belaningsgradScore} farge={fargeForScore(s.belaningsgradScore)}
              undertekst="Lån / boligverdi — bør være ≤75 %" />
            <ScoreBoks lbl="Betjeningsevne" val={fmtPct(s.betjeningRatio * 100)} score={s.betjeningScore} farge={fargeForScore(s.betjeningScore)}
              undertekst="Mnd-kost / mnd-inntekt — bør være <40 %" />
            <ScoreBoks lbl="Stresstest" val={s.stressDisponibel >= 0 ? fmtNok(s.stressDisponibel) : 'Negativ'} score={s.stressScore} farge={fargeForScore(s.stressScore)}
              undertekst="Disponibelt etter alt med rente +3pp" />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.85)', padding: 14, borderRadius: RADIUS.sm }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 13 }}>
              <span style={{ color: FARGER.tekstMid }}>Brutto husholdningsinntekt</span>
              <span style={{ textAlign: 'right' }}>{fmtNok(s.sumInntektMnd)}/mnd</span>
              <span style={{ color: FARGER.tekstMid }}>− Skatt (estimat)</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(s.skatt_anslag_mnd)}</span>
              {s.utleieMnd > 0 && (
                <>
                  <span style={{ color: FARGER.tekstMid }}>+ Netto leieinntekt fra utleie-del</span>
                  <span style={{ textAlign: 'right' }}>+ {fmtNok(s.utleieMnd)}</span>
                </>
              )}
              <span style={{ color: FARGER.tekstMork, fontWeight: 600, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 4 }}>= Netto inntekt</span>
              <span style={{ textAlign: 'right', fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 4 }}>{fmtNok(s.netto_inntekt_mnd)}/mnd</span>

              <span style={{ color: FARGER.tekstMid, marginTop: 8 }}>− Livsopphold (SIFO)</span>
              <span style={{ textAlign: 'right', marginTop: 8 }}>− {fmtNok(s.livsopphold)}</span>
              <span style={{ color: FARGER.tekstMid }}>− Mnd-betaling nytt boliglån (etter ev. leie)</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(s.nettoMndBetaling)}</span>
              {s.andreLanMndSum > 0 && (
                <>
                  <span style={{ color: FARGER.tekstMid }}>− Andre lån (billån/studielån/kreditt)</span>
                  <span style={{ textAlign: 'right' }}>− {fmtNok(s.andreLanMndSum)}</span>
                </>
              )}
              <span style={{ color: FARGER.tekstMork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 4 }}>= Disponibelt etter alt</span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: s.disponibelEtterAlt < 0 ? '#7a0c1e' : s.disponibelEtterAlt < 3000 ? '#6b3a0a' : '#1a4d2b', borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 4, fontSize: 15 }}>
                {fmtNok(s.disponibelEtterAlt)}
              </span>
              <span style={{ color: FARGER.tekstMid, marginTop: 8 }}>Stresstest disponibel (rente +3pp)</span>
              <span style={{ textAlign: 'right', marginTop: 8, color: s.stressDisponibel < 0 ? '#7a0c1e' : '#5a6171' }}>
                {fmtNok(s.stressDisponibel)}
              </span>
              {s.annenSikkerhetNetto > 0 && (
                <>
                  <span style={{ color: FARGER.tekstMid, marginTop: 6 }}>Tilgjengelig ekstra sikkerhet</span>
                  <span style={{ textAlign: 'right', marginTop: 6, color: FARGER.suksess, fontWeight: 600 }}>{fmtNok(s.annenSikkerhetNetto)}</span>
                </>
              )}
              <span style={{ color: FARGER.tekstMid, marginTop: 6 }}>Total gjeld inkl. nytt boliglån</span>
              <span style={{ textAlign: 'right', marginTop: 6 }}>{fmtNok(s.totalGjeld)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ScoreBoks({ lbl, val, score, farge, undertekst }: { lbl: string; val: string; score: number; farge: string; undertekst: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.85)', padding: 12, borderRadius: RADIUS.sm }}>
      <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 4, fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: farge }}>{val}</div>
      <div style={{ background: '#e0e0e0', borderRadius: 3, height: 4, marginTop: 6, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: 4, background: farge }} />
      </div>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, marginTop: 6, lineHeight: 1.4 }}>{undertekst}</div>
    </div>
  )
}

function LagredeProsjekter({ prosjekter, onLastInn, onSlett, aktivId }: {
  prosjekter: Array<{ id: string; navn: string; opprettet: string; bolig_data?: { beliggenhet?: string }; norsk_kalkulator_data?: Record<string, unknown> | null }>
  onLastInn: (p: { id: string; norsk_kalkulator_data?: Record<string, unknown> | null }) => void
  onSlett: (id: string, navn: string) => void
  aktivId: string | null
}) {
  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>📂 Dine norske prosjekter</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {prosjekter.map(p => {
          const erAktiv = aktivId === p.id
          const beliggenhet = p.bolig_data?.beliggenhet || ''
          const dato = new Date(p.opprettet).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', borderRadius: RADIUS.sm,
              background: erAktiv ? FARGER.creamLys : 'transparent',
              border: erAktiv ? `1px solid ${FARGER.gull}` : `1px solid transparent`,
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: FARGER.mork }}>
                  {erAktiv && '★ '}{p.navn}
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2 }}>
                  {beliggenhet ? beliggenhet + ' · ' : ''}Lagret {dato}
                </div>
              </div>
              <button onClick={() => onLastInn(p)} disabled={erAktiv}
                style={{ background: erAktiv ? FARGER.flateLys : FARGER.mork, color: erAktiv ? FARGER.tekstMid : 'white', border: 'none', borderRadius: RADIUS.sm, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: erAktiv ? 'default' : 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {erAktiv ? 'Aktiv' : 'Åpne'}
              </button>
              <button onClick={() => onSlett(p.id, p.navn)}
                title="Slett prosjekt"
                style={{ background: 'transparent', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 14, padding: '4px 8px' }}>
                🗑
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SalgEgenBolig({ eks, setEks, netto }: {
  eks: EksisterendeBolig
  setEks: (e: EksisterendeBolig) => void
  netto: { meglerhonorar: number; salgskostnader: number; skatt: number; nettoTilDisposisjon: number }
}) {
  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>🏠 Steg 1 — Salg av eksisterende bolig</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 16px', fontWeight: 300 }}>
        Hva netto frigjøres fra salget av nåværende bolig — pengene du har til kjøp av flippen.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
        <KalkInput lbl="Forventet salgssum" val={eks.salgssum} onChange={v => setEks({ ...eks, salgssum: v })} />
        <KalkInput lbl="Restgjeld på lån" val={eks.restgjeld} onChange={v => setEks({ ...eks, restgjeld: v })} />
        <KalkInput lbl="Meglerhonorar %" val={eks.meglerhonorar_pst} onChange={v => setEks({ ...eks, meglerhonorar_pst: v })} step={0.1} />
        <KalkInput lbl="Markedsføring/takst" val={eks.marknadsforing} onChange={v => setEks({ ...eks, marknadsforing: v })} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', padding: '6px 0', marginBottom: 10 }}>
        <input type="checkbox" checked={eks.skattefri} onChange={e => setEks({ ...eks, skattefri: e.target.checked })} style={{ width: 18, height: 18 }} />
        <span>Skattefritt salg (har bodd 12 av siste 24 mnd — vanlig for primærbolig)</span>
      </label>

      <div style={{ background: FARGER.creamLys, padding: 16, borderRadius: RADIUS.sm }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 13 }}>
          <span style={{ color: FARGER.tekstMid }}>Forventet salgssum</span>
          <span style={{ textAlign: 'right' }}>{fmtNok(eks.salgssum)}</span>
          <span style={{ color: FARGER.tekstMid }}>− Meglerhonorar ({eks.meglerhonorar_pst} %)</span>
          <span style={{ textAlign: 'right' }}>− {fmtNok(netto.meglerhonorar)}</span>
          <span style={{ color: FARGER.tekstMid }}>− Markedsføring/takst</span>
          <span style={{ textAlign: 'right' }}>− {fmtNok(eks.marknadsforing)}</span>
          <span style={{ color: FARGER.tekstMid }}>− Restgjeld</span>
          <span style={{ textAlign: 'right' }}>− {fmtNok(eks.restgjeld)}</span>
          {!eks.skattefri && netto.skatt > 0 && (
            <>
              <span style={{ color: FARGER.tekstMid }}>− Skatt (22 %)</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(netto.skatt)}</span>
            </>
          )}
          <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
            = Netto til disposisjon (egenkapital)
          </span>
          <span style={{ textAlign: 'right', fontWeight: 700, color: FARGER.mork, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
            {fmtNok(netto.nettoTilDisposisjon)}
          </span>
        </div>
      </div>
    </div>
  )
}

function BoPlanPanel({ boPlan, setBoPlan, salgsprisIDag, projisert, aiBegrunnelse }: {
  boPlan: BoPlan
  setBoPlan: (b: BoPlan) => void
  salgsprisIDag: number
  projisert: number
  aiBegrunnelse?: string
}) {
  const aar = (boPlan.bo_tid_mnd / 12).toFixed(1)
  const oppjustering = projisert - salgsprisIDag
  const skattefri = boPlan.bo_tid_mnd >= 12

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>📈 Steg 2 — Bo-tid og prisvekst</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 16px', fontWeight: 300 }}>
        Hvor lenge bor du der før du selger? Markedsveksten i området jobber for deg.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
        <KalkInput lbl="Bo-tid før salg (mnd)" val={boPlan.bo_tid_mnd}
          onChange={v => setBoPlan({ ...boPlan, bo_tid_mnd: v })} step={1} />
        <KalkInput lbl="Årlig prisvekst i området %" val={boPlan.arlig_prisvekst_pst}
          onChange={v => setBoPlan({ ...boPlan, arlig_prisvekst_pst: v })} step={0.1} />
      </div>

      {aiBegrunnelse && (
        <div style={{ background: FARGER.creamLys, padding: 12, borderRadius: RADIUS.sm, fontSize: 12, color: FARGER.tekstMid, marginBottom: 14, fontStyle: 'italic', lineHeight: 1.6 }}>
          🤖 {aiBegrunnelse}
        </div>
      )}

      <div style={{ background: FARGER.creamLys, padding: 16, borderRadius: RADIUS.sm }}>
        <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Projisert salgspris</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 13 }}>
          <span style={{ color: FARGER.tekstMid }}>Salgspris i dag (etter oppussing)</span>
          <span style={{ textAlign: 'right' }}>{fmtNok(salgsprisIDag)}</span>
          <span style={{ color: FARGER.tekstMid }}>+ Markedsvekst over {aar} år ({boPlan.arlig_prisvekst_pst} % årlig)</span>
          <span style={{ textAlign: 'right', color: FARGER.suksess, fontWeight: 600 }}>+ {fmtNok(oppjustering)}</span>
          <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
            = Forventet salgspris om {aar} år
          </span>
          <span style={{ textAlign: 'right', fontWeight: 700, color: FARGER.mork, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4, fontSize: 16 }}>
            {fmtNok(projisert)}
          </span>
        </div>
        <div style={{ marginTop: 12, padding: 10, borderRadius: RADIUS.sm, background: skattefri ? '#e8f5ed' : '#fff8e1', fontSize: 12, color: skattefri ? '#1a4d2b' : '#6b3a0a' }}>
          {skattefri
            ? '✓ Bo-tid ≥ 12 mnd — salget blir normalt skattefritt (12 av 24 mnd-regelen).'
            : '⚠ Bo-tid < 12 mnd — gevinsten beskattes med 22 % (slik kalkulatoren regner). Bo minst 12 mnd for skattefri.'}
        </div>
      </div>
    </div>
  )
}

function UtleieDelPanel({ utleieDel, setUtleieDel, boTidMnd, beregning, aiForslag }: {
  utleieDel: UtleieDel
  setUtleieDel: (u: UtleieDel) => void
  boTidMnd: number
  beregning: { brutto_mnd: number; netto_mnd: number; brutto_total: number; netto_total: number; etableringskost: number; skatt: number }
  aiForslag?: { mulig?: boolean; type_egnet?: string; estimert_leie_mnd_nok?: number; etableringskost_nok?: number; begrunnelse?: string }
}) {
  const aiSierMulig = aiForslag?.mulig
  const netto_bidrag = beregning.netto_total - beregning.etableringskost

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>🔑 Steg 3 — Utleie-del</div>
          <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: 0, fontWeight: 300 }}>
            Sokkelleilighet, hybel eller utleiedel som genererer leieinntekt mens du bor i hovedboligen.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={utleieDel.aktiv} onChange={e => setUtleieDel({ ...utleieDel, aktiv: e.target.checked })} style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: FARGER.mork }}>Aktiv</span>
        </label>
      </div>

      {aiForslag && (aiForslag.begrunnelse || aiForslag.type_egnet) && (
        <div style={{
          background: aiSierMulig ? '#e8f5ed' : '#fff8e1',
          border: `1px solid ${aiSierMulig ? '#2D7D46' : '#B05E0A'}33`,
          padding: 12, borderRadius: RADIUS.sm, fontSize: 12, lineHeight: 1.6, marginBottom: 14,
          color: aiSierMulig ? '#1a4d2b' : '#6b3a0a',
        }}>
          🤖 <strong>AI-vurdering:</strong> {aiForslag.type_egnet ? `${aiForslag.type_egnet}. ` : ''}{aiForslag.begrunnelse}
          {aiForslag.estimert_leie_mnd_nok ? ` Estimert leie: ${fmtNok(aiForslag.estimert_leie_mnd_nok)}/mnd.` : ''}
        </div>
      )}

      {utleieDel.aktiv && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 14 }}>
            <KalkInput lbl="Leie pr. mnd" val={utleieDel.leie_mnd} onChange={v => setUtleieDel({ ...utleieDel, leie_mnd: v })} step={500} />
            <KalkInput lbl="Belegg %" val={utleieDel.belegg_pst} onChange={v => setUtleieDel({ ...utleieDel, belegg_pst: v })} step={1} />
            <KalkInput lbl="Drift %" val={utleieDel.drift_pst} onChange={v => setUtleieDel({ ...utleieDel, drift_pst: v })} step={1} />
            <KalkInput lbl="Etableringskost (engang)" val={utleieDel.etableringskost} onChange={v => setUtleieDel({ ...utleieDel, etableringskost: v })} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', padding: '6px 0', marginBottom: 12 }}>
            <input type="checkbox" checked={utleieDel.skattefri} onChange={e => setUtleieDel({ ...utleieDel, skattefri: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span>Skattefri (utleiedelen er mindre enn halvparten av primærboligens utleieverdi)</span>
          </label>

          <div style={{ background: FARGER.creamLys, padding: 16, borderRadius: RADIUS.sm }}>
            <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Resultat over bo-tiden ({boTidMnd} mnd)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 13 }}>
              <span style={{ color: FARGER.tekstMid }}>Effektiv brutto leie ({utleieDel.belegg_pst} % belegg)</span>
              <span style={{ textAlign: 'right' }}>{fmtNok(beregning.brutto_total)}</span>
              <span style={{ color: FARGER.tekstMid }}>− Drift ({utleieDel.drift_pst} %)</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(beregning.brutto_total * (utleieDel.drift_pst / 100))}</span>
              {beregning.skatt > 0 && (
                <>
                  <span style={{ color: FARGER.tekstMid }}>− Skatt (22 %)</span>
                  <span style={{ textAlign: 'right' }}>− {fmtNok(beregning.skatt)}</span>
                </>
              )}
              <span style={{ color: FARGER.tekstMid }}>− Etableringskost</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(beregning.etableringskost)}</span>
              <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
                = Bidrag til total fortjeneste
              </span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: netto_bidrag >= 0 ? FARGER.suksess : FARGER.feil, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4, fontSize: 16 }}>
                {netto_bidrag >= 0 ? '+' : ''}{fmtNok(netto_bidrag)}
              </span>
              <span style={{ color: FARGER.tekstMid, fontSize: 12, fontStyle: 'italic' }}>Tilsvarer netto pr. mnd</span>
              <span style={{ textAlign: 'right', color: FARGER.tekstMid, fontSize: 12, fontStyle: 'italic' }}>{fmtNok(beregning.netto_mnd)}/mnd</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Finansiering({ f, salgssum, utleieMnd = 0 }: {
  f: { totalUtlegg: number; tilgjengeligEK: number; lanebehov: number; overskudd: number; belaningsgrad: number; mndBetaling: number }
  eks: { nettoTilDisposisjon: number }
  salgssum: number
  utleieMnd?: number
}) {
  const sunnBelaning = f.belaningsgrad <= 75
  const farge = sunnBelaning ? '#1a4d2b' : f.belaningsgrad <= 85 ? '#6b3a0a' : '#7a0c1e'
  const bgFarge = sunnBelaning ? '#e8f5ed' : f.belaningsgrad <= 85 ? '#fff8e1' : '#fde8ec'
  const nettoMndKost = f.mndBetaling - utleieMnd

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>💰 Finansiering & lånebehov</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 16px', fontWeight: 300 }}>
        Hvor mye må du faktisk låne — og hva blir mnd-betalingen mens du bor i flippen.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 13, marginBottom: 14 }}>
        <span style={{ color: FARGER.tekstMid }}>Totalt utlegg (kjøp + dokavg + tinglysing + oppussing + møblering)</span>
        <span style={{ textAlign: 'right' }}>{fmtNok(f.totalUtlegg)}</span>
        <span style={{ color: FARGER.tekstMid }}>− Tilgjengelig EK fra salg av eget hjem</span>
        <span style={{ textAlign: 'right' }}>− {fmtNok(f.tilgjengeligEK)}</span>
        <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
          = Lånebehov
        </span>
        <span style={{ textAlign: 'right', fontWeight: 700, color: FARGER.mork, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
          {fmtNok(f.lanebehov)}
        </span>
        {f.overskudd > 0 && (
          <>
            <span style={{ color: FARGER.suksess, fontWeight: 600 }}>+ Overskudd EK (gjenstår fri kapital)</span>
            <span style={{ textAlign: 'right', color: FARGER.suksess, fontWeight: 600 }}>{fmtNok(f.overskudd)}</span>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div style={{ background: bgFarge, padding: 14, borderRadius: RADIUS.sm }}>
          <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Belåningsgrad</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: farge }}>{fmtPct(f.belaningsgrad)}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            {sunnBelaning ? 'Sunn belåning (under 75 %)' : f.belaningsgrad <= 85 ? 'Høy — banken kan stille krav' : 'For høy — vil normalt ikke godkjennes'}
          </div>
        </div>
        <div style={{ background: FARGER.creamLys, padding: 14, borderRadius: RADIUS.sm }}>
          <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Mnd-betaling (annuitet 25 år)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: FARGER.mork }}>{fmtNok(f.mndBetaling)}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Renter + avdrag</div>
        </div>
        {utleieMnd > 0 && (
          <div style={{ background: '#e8f5ed', padding: 14, borderRadius: RADIUS.sm, border: '1px solid #2D7D4644' }}>
            <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Netto bo-kostnad / mnd</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a4d2b' }}>{fmtNok(nettoMndKost)}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Etter {fmtNok(utleieMnd)} netto leieinntekt</div>
          </div>
        )}
        {salgssum > 0 && (
          <div style={{ background: FARGER.creamLys, padding: 14, borderRadius: RADIUS.sm }}>
            <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Frigjøring ved salg</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: FARGER.mork }}>{fmtNok(salgssum - f.lanebehov)}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Salgssum − lånebehov</div>
          </div>
        )}
      </div>
    </div>
  )
}

function KalkInput({ lbl, val, onChange, step = 1000 }: { lbl: string; val: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>{lbl}</label>
      <input type="number" min={0} step={step} value={val || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white', boxSizing: 'border-box' }} />
    </div>
  )
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
