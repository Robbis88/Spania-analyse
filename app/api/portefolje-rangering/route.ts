import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import type {
  Prosjekt, Selskap, EiendomLaan, EiendomInntekt, EiendomKostnad, EiendomVerdivurdering, AirbnbData,
} from '../../types'
import { beregnBeslutning, TERSKEL_YIELD_BUNDET_EK_PST } from '../../lib/beslutning'
import { medDefaults } from '../../lib/skatteprofil'
import { gjeldendeLeieMnd, sumKostnaderPerMnd, rentesjokk } from '../../lib/portefolje'

type Flagg = { farge: 'rod' | 'gul'; tekst: string }

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const [pRes, sRes, tRes] = await Promise.all([
      admin.from('prosjekter').select('*').eq('er_portefolje', true),
      admin.from('selskaper').select('*'),
      admin.from('tilbud').select('prosjekt_id, totalsum, akseptert').eq('akseptert', true),
    ])
    const prosjekter = (pRes.data || []) as Prosjekt[]
    const selskaper = (sRes.data || []) as Selskap[]
    const akseptTilbud = (tRes.data || []) as Array<{ prosjekt_id: string; totalsum: number | null }>

    const ider = prosjekter.map(p => p.id)
    let laanAlle: Array<EiendomLaan & { prosjekt_id?: string }> = []
    let inntekterAlle: Array<EiendomInntekt & { prosjekt_id?: string }> = []
    let kostnaderAlle: Array<EiendomKostnad & { prosjekt_id?: string }> = []
    let vurdAlle: Array<EiendomVerdivurdering & { prosjekt_id?: string }> = []
    if (ider.length > 0) {
      const [l, i, k, v] = await Promise.all([
        admin.from('eiendom_laan').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_inntekter').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_kostnader').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_verdivurderinger').select('*').in('prosjekt_id', ider),
      ])
      laanAlle = (l.data || []) as typeof laanAlle
      inntekterAlle = (i.data || []) as typeof inntekterAlle
      kostnaderAlle = (k.data || []) as typeof kostnaderAlle
      vurdAlle = (v.data || []) as typeof vurdAlle
    }

    const rader = prosjekter.map(p => {
      const selskap = selskaper.find(s => s.id === p.selskap_id)
      const profil = medDefaults(selskap?.land || (p.marked === 'norge' ? 'norge' : 'spania'), selskap?.skatteprofil)
      const laan = laanAlle.filter(x => x.prosjekt_id === p.id)
      const inntekter = inntekterAlle.filter(x => x.prosjekt_id === p.id)
      const kostnader = kostnaderAlle.filter(x => x.prosjekt_id === p.id)
      const verdivurderinger = vurdAlle.filter(x => x.prosjekt_id === p.id)
      const reno = akseptTilbud.find(t => t.prosjekt_id === p.id)?.totalsum ?? null

      const b = beregnBeslutning({
        prosjekt: p, laan, inntekter, kostnader, verdivurderinger, skatteprofil: profil,
        airbnbData: (p.airbnb_data as AirbnbData | null) || null, renoveringskost: reno,
      })
      const langtid = b.scenarier.find(s => s.type === 'langtid')
      const korttid = b.scenarier.find(s => s.type === 'korttid')
      const flipp = b.scenarier.find(s => s.type === 'flipp')

      const leieMnd = gjeldendeLeieMnd(inntekter)
      const kostMnd = sumKostnaderPerMnd(kostnader)
      const stressLaan = rentesjokk(laan, 3)
      const stressCashflow = leieMnd - kostMnd - stressLaan

      const flagg: Flagg[] = []
      const ly = langtid?.yield_bundet_ek_pst
      if (typeof ly === 'number' && ly < TERSKEL_YIELD_BUNDET_EK_PST) {
        flagg.push({ farge: 'rod', tekst: `Svak leie: ${ly.toFixed(1)} % på bundet EK (under ${TERSKEL_YIELD_BUNDET_EK_PST} %)` })
      }
      if (typeof langtid?.cashflow_mnd === 'number' && langtid.cashflow_mnd < 0) {
        flagg.push({ farge: 'rod', tekst: `Negativ cashflow (${Math.round(langtid.cashflow_mnd)}/mnd)` })
      }
      const markedsleie = typeof p.markedsleie_mnd === 'number' ? p.markedsleie_mnd : null
      if (markedsleie && leieMnd > 0 && leieMnd < markedsleie * 0.95) {
        flagg.push({ farge: 'gul', tekst: `Leie under marked — øk til ${Math.round(markedsleie)}` })
      }
      if (typeof korttid?.yield_bundet_ek_pst === 'number' && typeof ly === 'number' && korttid.yield_bundet_ek_pst > ly + 2) {
        flagg.push({ farge: 'gul', tekst: `Korttid ${korttid.yield_bundet_ek_pst.toFixed(1)} % vs langtid ${ly.toFixed(1)} % — vurder Airbnb` })
      }
      if (typeof flipp?.gevinst_etter_skatt === 'number' && b.bundet_ek > 0 && flipp.gevinst_etter_skatt > b.bundet_ek * 0.25) {
        flagg.push({ farge: 'gul', tekst: `Stor gevinst ved salg — frigjør ${Math.round(flipp.frigjort_kapital || 0)}` })
      }
      if (leieMnd > 0 && stressCashflow < -2000) {
        flagg.push({ farge: 'gul', tekst: `Rentesjokk +3pp: cashflow ${Math.round(stressCashflow)}/mnd` })
      }
      // VFT/turistlisens — korttid i Spania uten lisens (C6)
      if (p.marked === 'spania' && p.strategi === 'korttid' && p.vft_status !== 'har') {
        flagg.push({ farge: 'rod', tekst: p.vft_status === 'sokt' ? 'VFT-lisens søkt — ikke godkjent ennå' : 'Mangler VFT-turistlisens' })
      }

      return {
        id: p.id, navn: p.navn, marked: p.marked || 'spania', valuta: selskap?.valuta || (p.marked === 'norge' ? 'NOK' : 'EUR'),
        selskap_id: p.selskap_id || null, strategi: p.strategi || 'uavklart', eieretappe: p.eieretappe || 'eid',
        bundet_ek: b.bundet_ek,
        langtid_yield_pst: typeof ly === 'number' ? ly : null,
        cashflow_mnd: langtid?.cashflow_mnd ?? null,
        stress_cashflow_mnd: leieMnd > 0 ? stressCashflow : null,
        markedsleie_mnd: markedsleie,
        flagg,
      }
    })

    // Sorter: de med yield først (høyest først), deretter resten
    rader.sort((a, b) => {
      if (a.langtid_yield_pst === null && b.langtid_yield_pst === null) return 0
      if (a.langtid_yield_pst === null) return 1
      if (b.langtid_yield_pst === null) return -1
      return b.langtid_yield_pst - a.langtid_yield_pst
    })

    return NextResponse.json({ rader })
  } catch (e) {
    console.error('Porteføljerangering feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke beregne rangering' }, { status: 500 })
  }
}
