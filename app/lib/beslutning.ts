// B4 — Beslutningsmotoren. Ren, deterministisk beregning av fire scenarier for
// én eiendom, på samme "bundet EK"-grunnlag, med selskapets skatteprofil.
//
// "Hva er beste bruk av denne eiendommen akkurat nå?"
//   1. Flipp / selg nå
//   2. Langtidsleie
//   3. Korttidsleie (Airbnb) — krever airbnb_data
//   4. Behold + refinansier
//
// Gjenbruker eksisterende beregningsfunksjoner (portefolje.ts, utleie.ts) og
// tar satser fra skatteprofilen. Ingen AI her — kun tall. Anbefalingsteksten
// (Claude) bygges oppå dette i /api/beslutning.

import type {
  Prosjekt, EiendomLaan, EiendomInntekt, EiendomKostnad, EiendomVerdivurdering,
  AirbnbData, Skatteprofil,
} from '../types'
import {
  sisteVerdi, totalRestgjeld, gjeldendeLeieMnd, sumKostnaderPerMnd,
  totalLaanKostnadMnd, annuitetMnd,
} from './portefolje'
import { beregnAar } from './utleie'
import { gevinstSatsPst, utleieSatsPst } from './skatteprofil'

// Terskler og forutsetninger — fornuftige defaults, kan gjøres redigerbare senere.
export const TERSKEL_YIELD_BUNDET_EK_PST = 6   // under dette flagges leie som svak
export const SALGSKOST_PST = 2                 // meglerhonorar o.l. ved salg
export const MAKS_LTV_PST = 75                 // refinansiering opp til denne LTV
export const REFI_RENTE_PST = 5.5              // antatt rente ved refinansiering
export const REFI_NEDBETALING_AAR = 25

export type ScenarioType = 'flipp' | 'langtid' | 'korttid' | 'refinansier'

export type ScenarioResultat = {
  type: ScenarioType
  tittel: string
  tilgjengelig: boolean
  utilgjengeligGrunn?: string
  yield_bundet_ek_pst?: number
  cashflow_mnd?: number
  frigjort_kapital?: number
  gevinst_etter_skatt?: number
  ny_ltv_pst?: number
  detaljer: Array<{ lbl: string; verdi: number; pst?: boolean }>
}

export type BeslutningInput = {
  prosjekt: Prosjekt
  laan: EiendomLaan[]
  inntekter: EiendomInntekt[]
  kostnader: EiendomKostnad[]
  verdivurderinger: EiendomVerdivurdering[]
  skatteprofil: Skatteprofil
  airbnbData?: AirbnbData | null
}

export type Beslutning = {
  verdi: number
  restgjeld: number
  salgskostnad: number
  gevinstskatt: number
  bundet_ek: number
  terskel_yield_pst: number
  scenarier: ScenarioResultat[]
  beste: ScenarioType | null
}

// Bundet EK = kapitalen du ville frigjort ved å selge nå.
// Delt med kapitaloversikten (B3) så tallet er identisk begge steder.
export function beregnBundetEk(verdi: number, restgjeld: number, anskaffelse: number, gevinstPst: number) {
  const salgskostnad = verdi * (SALGSKOST_PST / 100)
  const gevinst = Math.max(0, verdi - anskaffelse - salgskostnad)
  const gevinstskatt = gevinst * (gevinstPst / 100)
  const nettoVedSalg = verdi - restgjeld - salgskostnad - gevinstskatt
  return { salgskostnad, gevinst, gevinstskatt, nettoVedSalg, bundet_ek: Math.max(0, nettoVedSalg) }
}

export function beregnBeslutning(input: BeslutningInput): Beslutning {
  const { prosjekt, laan, inntekter, kostnader, verdivurderinger, skatteprofil, airbnbData } = input
  const gevinst_pst = gevinstSatsPst(skatteprofil)
  const utleie_pst = utleieSatsPst(skatteprofil)

  const verdi = sisteVerdi(verdivurderinger)
  const restgjeld = totalRestgjeld(laan)
  const leieMnd = gjeldendeLeieMnd(inntekter)
  const kostnaderMnd = sumKostnaderPerMnd(kostnader)
  const laanMnd = totalLaanKostnadMnd(laan)

  // Salg / bundet EK (delt formel med B3)
  const anskaffelse = (prosjekt.kjøpesum || 0) + (prosjekt.kjøpskostnader || 0) + (prosjekt.oppussing_faktisk || 0)
  const { salgskostnad, gevinst, gevinstskatt, nettoVedSalg, bundet_ek } = beregnBundetEk(verdi, restgjeld, anskaffelse, gevinst_pst)

  const yieldPaaEk = (aarligNetto: number) => bundet_ek > 0 ? (aarligNetto / bundet_ek) * 100 : 0

  // 1) Flipp / selg nå
  const flipp: ScenarioResultat = {
    type: 'flipp', tittel: 'Flipp / selg nå', tilgjengelig: verdi > 0,
    utilgjengeligGrunn: verdi > 0 ? undefined : 'Mangler verdivurdering',
    gevinst_etter_skatt: gevinst - gevinstskatt,
    frigjort_kapital: nettoVedSalg,
    detaljer: [
      { lbl: 'Markedsverdi', verdi },
      { lbl: 'Restgjeld', verdi: -restgjeld },
      { lbl: `Salgskostnad (${SALGSKOST_PST} %)`, verdi: -salgskostnad },
      { lbl: `Gevinstskatt (${gevinst_pst} %)`, verdi: -gevinstskatt },
      { lbl: 'Frigjort kapital', verdi: nettoVedSalg },
    ],
  }

  // 2) Langtidsleie (basert på registrerte inntekter/kostnader/lån)
  const langtidAarNettoForSkatt = (leieMnd - kostnaderMnd) * 12
  const langtidSkatt = Math.max(0, langtidAarNettoForSkatt) * (utleie_pst / 100)
  const langtidAarNetto = langtidAarNettoForSkatt - langtidSkatt
  const langtidCashflowMnd = leieMnd - kostnaderMnd - laanMnd
  const langtid: ScenarioResultat = {
    type: 'langtid', tittel: 'Langtidsleie', tilgjengelig: leieMnd > 0,
    utilgjengeligGrunn: leieMnd > 0 ? undefined : 'Mangler registrert leieinntekt',
    yield_bundet_ek_pst: yieldPaaEk(langtidAarNetto),
    cashflow_mnd: langtidCashflowMnd,
    detaljer: [
      { lbl: 'Leie/mnd', verdi: leieMnd },
      { lbl: 'Driftskostnad/mnd', verdi: -kostnaderMnd },
      { lbl: 'Lån/mnd', verdi: -laanMnd },
      { lbl: 'Cashflow/mnd', verdi: langtidCashflowMnd },
      { lbl: 'Yield på bundet EK', verdi: yieldPaaEk(langtidAarNetto), pst: true },
    ],
  }

  // 3) Korttidsleie (Airbnb) — kun hvis airbnb_data finnes
  let korttid: ScenarioResultat
  if (airbnbData) {
    const iAar = new Date().getFullYear()
    // Bruk nærmeste hele driftsår som representativt
    const o = beregnAar(iAar, airbnbData, {
      // Minimal analyse-kontekst for beregnAar; leietype korttid bruker airbnbData
      id: prosjekt.id, bolig_id: prosjekt.id, leietype: 'korttid', scenario: 'realistisk',
      progresjon_til_etablert_ar: 3, total_kjopspris: verdi || null,
      kjopsmaaned: `${iAar}-01`, utleiestart: `${iAar}-01`, horisont_ar: 1,
      oppussing_per_ar: [], lan: null, faktiske_inntekter: {},
      analyse_kilde_id: prosjekt.id, analyse_hentet: null, opprettet: '',
    })
    const korttidAarNettoForSkatt = o.netto_uten_lan
    const korttidSkatt = Math.max(0, korttidAarNettoForSkatt) * (utleie_pst / 100)
    const korttidAarNetto = korttidAarNettoForSkatt - korttidSkatt
    korttid = {
      type: 'korttid', tittel: 'Korttidsleie (Airbnb)', tilgjengelig: true,
      yield_bundet_ek_pst: yieldPaaEk(korttidAarNetto),
      cashflow_mnd: (o.netto_uten_lan / 12) - laanMnd,
      detaljer: [
        { lbl: 'Brutto/år (realistisk)', verdi: o.brutto_inntekt },
        { lbl: 'Driftskostnad/år', verdi: -o.kostnader_lopende },
        { lbl: 'Netto før skatt/år', verdi: korttidAarNettoForSkatt },
        { lbl: 'Yield på bundet EK', verdi: yieldPaaEk(korttidAarNetto), pst: true },
      ],
    }
  } else {
    korttid = {
      type: 'korttid', tittel: 'Korttidsleie (Airbnb)', tilgjengelig: false,
      utilgjengeligGrunn: 'Mangler Airbnb-analyse (kjør Boliganalyse for sesongtall)',
      detaljer: [],
    }
  }

  // 4) Behold + refinansier
  const maksLaan = verdi * (MAKS_LTV_PST / 100)
  const frigjortRefi = Math.max(0, maksLaan - restgjeld)
  const nyttLaanMnd = annuitetMnd(maksLaan, REFI_RENTE_PST, REFI_NEDBETALING_AAR)
  const refiCashflowMnd = leieMnd - kostnaderMnd - nyttLaanMnd
  const refinansier: ScenarioResultat = {
    type: 'refinansier', tittel: 'Behold + refinansier', tilgjengelig: verdi > 0,
    utilgjengeligGrunn: verdi > 0 ? undefined : 'Mangler verdivurdering',
    frigjort_kapital: frigjortRefi,
    cashflow_mnd: refiCashflowMnd,
    ny_ltv_pst: MAKS_LTV_PST,
    detaljer: [
      { lbl: `Nytt lån (${MAKS_LTV_PST} % LTV)`, verdi: maksLaan },
      { lbl: 'Innfri eksisterende gjeld', verdi: -restgjeld },
      { lbl: 'Frigjort kapital', verdi: frigjortRefi },
      { lbl: `Ny lånekostnad/mnd (${REFI_RENTE_PST} %)`, verdi: -nyttLaanMnd },
      { lbl: 'Ny cashflow/mnd', verdi: refiCashflowMnd },
    ],
  }

  const scenarier = [flipp, langtid, korttid, refinansier]

  // Beste = høyest yield på bundet EK blant tilgjengelige leie-scenarier;
  // flipp/refi sammenlignes ikke på yield (de er kapital-hendelser), men motoren
  // rangerer leie-alternativene. AI-anbefalingen veier alt sammen.
  const medYield = scenarier.filter(s => s.tilgjengelig && typeof s.yield_bundet_ek_pst === 'number')
  const beste = medYield.length > 0
    ? medYield.reduce((a, b) => (b.yield_bundet_ek_pst! > a.yield_bundet_ek_pst!) ? b : a).type
    : null

  return {
    verdi, restgjeld, salgskostnad, gevinstskatt, bundet_ek,
    terskel_yield_pst: TERSKEL_YIELD_BUNDET_EK_PST,
    scenarier, beste,
  }
}
