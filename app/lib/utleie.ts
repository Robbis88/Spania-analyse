import type { AirbnbData, FaktiskeInntekter, LanInfo, Utleieanalyse, UtleieScenario } from '../types'

export const MANED_NAVN = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

export const DAGER_I_MANED = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function parseManed(iso: string | null): { ar: number; maned: number } | null {
  if (!iso) return null
  const [a, m] = iso.split('-').map(Number)
  if (!a || !m) return null
  return { ar: a, maned: m }
}

export const faktiskNokkel = (ar: number, maned: number) =>
  `${ar}-${String(maned).padStart(2, '0')}`

export function manedligLaanebetaling(lan: LanInfo | null | undefined): number {
  if (!lan) return 0
  if (lan.maanedlig_renter_avdrag && lan.maanedlig_renter_avdrag > 0) return lan.maanedlig_renter_avdrag
  const L = lan.lanebelop || 0
  const r = ((lan.rente_prosent || 0) / 100) / 12
  const n = (lan.nedbetalingstid_ar || 0) * 12
  if (L <= 0 || n <= 0) return 0
  if (r === 0) return L / n
  return L * r / (1 - Math.pow(1 + r, -n))
}

export function interpolasjonFaktor(opYear: number, progresjonEtablert: number): number {
  if (progresjonEtablert <= 1 || opYear >= progresjonEtablert) return 1
  if (opYear <= 1) return 0
  return (opYear - 1) / (progresjonEtablert - 1)
}

export function scenarioFaktor(data: AirbnbData, s: UtleieScenario): number {
  const base = data.scenarier?.realistisk?.brutto_etablert || 0
  const v = data.scenarier?.[s]?.brutto_etablert || 0
  if (base <= 0 || v <= 0) return 1
  return v / base
}

export function manedligInntektKorttid(
  data: AirbnbData,
  maned1based: number,
  opYear: number,
  progresjonEtablert: number,
  scenario: UtleieScenario,
): number {
  const m = data.maaneder?.find(x => x.maaned === maned1based)
  if (!m) return 0
  const frac = interpolasjonFaktor(opYear, progresjonEtablert)
  const nattpris = m.nattpris_ar1 + (m.nattpris_etablert - m.nattpris_ar1) * frac
  const belegg = m.belegg_ar1 + (m.belegg_etablert - m.belegg_ar1) * frac
  const dager = DAGER_I_MANED[maned1based - 1] || 30
  const base = nattpris * belegg * dager
  return base * scenarioFaktor(data, scenario)
}

export function estimertManedligInntekt(
  data: AirbnbData,
  analyse: Utleieanalyse,
  ar: number,
  maned1based: number,
): number {
  const start = parseManed(analyse.utleiestart)
  if (!start) return 0
  const erUtleie = (ar > start.ar) || (ar === start.ar && maned1based >= start.maned)
  if (!erUtleie) return 0
  if (analyse.leietype === 'langtid') return analyse.langtidsleie_maned || 0
  const opYear = ar - start.ar + 1
  return manedligInntektKorttid(data, maned1based, opYear, analyse.progresjon_til_etablert_ar || 3, analyse.scenario)
}

export function faktiskEllerEstimat(
  faktiske: FaktiskeInntekter | null | undefined,
  ar: number,
  maned1based: number,
  estimat: number,
): { belop: number; kilde: 'faktisk' | 'estimat' } {
  const f = faktiske?.[faktiskNokkel(ar, maned1based)]
  if (typeof f === 'number' && !Number.isNaN(f)) return { belop: f, kilde: 'faktisk' }
  return { belop: estimat, kilde: 'estimat' }
}

export function sumKostnaderAr(data: AirbnbData): number {
  const k = data.kostnader_arlig || {}
  return (k.airbnb_kommisjon || 0) + (k.renhold || 0) + (k.strom_vann || 0) +
    (k.internett || 0) + (k.comunidad || 0) + (k.forsikring || 0) +
    (k.ibi || 0) + (k.basura || 0) + (k.vedlikehold || 0) +
    (k.management || 0) + (k.leietakerregistrering || 0)
}

export type AarligOversikt = {
  ar: number
  maneder_eid: number
  maneder_utleie: number
  maneder_tom: number
  brutto_inntekt: number
  kostnader_lopende: number
  kostnad_per_post: Record<string, number>
  lan_mnd: number
  lan_ar: number
  oppussing: number
  netto_uten_lan: number
  netto_med_lan: number
  per_maned_inntekt: { belop: number; kilde: 'faktisk' | 'estimat' }[]
}

export function beregnAar(aar: number, data: AirbnbData | null, analyse: Utleieanalyse): AarligOversikt {
  const kjop = parseManed(analyse.kjopsmaaned)
  const start = parseManed(analyse.utleiestart)
  const perMnd: { belop: number; kilde: 'faktisk' | 'estimat' }[] =
    Array.from({ length: 12 }, () => ({ belop: 0, kilde: 'estimat' as const }))
  let manederEid = 0
  let manederUtleie = 0

  if (kjop) {
    for (let m = 1; m <= 12; m++) {
      const eid = (aar > kjop.ar) || (aar === kjop.ar && m >= kjop.maned)
      if (!eid) continue
      manederEid++
      const utleie = start && ((aar > start.ar) || (aar === start.ar && m >= start.maned))

      let estimat = 0
      if (utleie && data) {
        manederUtleie++
        estimat = estimertManedligInntekt(data, analyse, aar, m)
      }
      // Faktisk kan også være satt for "tom" måneder (bruker har registrert faktisk leie før planlagt start)
      const res = faktiskEllerEstimat(analyse.faktiske_inntekter, aar, m, estimat)
      perMnd[m - 1] = res
      if (!utleie && res.kilde === 'faktisk' && res.belop > 0) {
        manederUtleie++
      }
    }
  }

  const brutto = perMnd.reduce((s, x) => s + x.belop, 0)
  const kostnaderHele = data ? sumKostnaderAr(data) : 0
  const kostnaderProRatert = kostnaderHele * (manederEid / 12)

  const perPost: Record<string, number> = {}
  if (data?.kostnader_arlig) {
    for (const [key, val] of Object.entries(data.kostnader_arlig)) {
      perPost[key] = ((val as number) || 0) * (manederEid / 12)
    }
  }

  const lanMnd = manedligLaanebetaling(analyse.lan)
  const lanAr = lanMnd * manederEid

  const oppussing = (analyse.oppussing_per_ar || []).find(x => x.ar === aar)?.kostnad || 0

  const netto_uten_lan = brutto - kostnaderProRatert - oppussing
  const netto_med_lan = netto_uten_lan - lanAr

  return {
    ar: aar,
    maneder_eid: manederEid,
    maneder_utleie: manederUtleie,
    maneder_tom: manederEid - manederUtleie,
    brutto_inntekt: brutto,
    kostnader_lopende: kostnaderProRatert,
    kostnad_per_post: perPost,
    lan_mnd: lanMnd,
    lan_ar: lanAr,
    oppussing,
    netto_uten_lan,
    netto_med_lan,
    per_maned_inntekt: perMnd,
  }
}

export function aarligYield(brutto: number, totalKjopspris: number): number {
  return totalKjopspris > 0 ? (brutto / totalKjopspris) * 100 : 0
}

export const KOSTNAD_LABEL: Record<string, string> = {
  airbnb_kommisjon: 'Airbnb-kommisjon',
  renhold: 'Renhold',
  strom_vann: 'Strøm / vann',
  internett: 'Internett',
  comunidad: 'Comunidad',
  forsikring: 'Forsikring',
  ibi: 'IBI',
  basura: 'Basura',
  vedlikehold: 'Vedlikehold',
  management: 'Property management',
  leietakerregistrering: 'Leietakerregistrering',
}
