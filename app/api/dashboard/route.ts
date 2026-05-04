import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import type { Prosjekt, OppussingPost, DokumentSjekkpunkt } from '../../types'
import { DOKUMENT_ETIKETT, type DokumentType } from '../../lib/dokument'

export type DashboardVarsel = {
  type: 'overskridelse' | 'utlopende_dokument' | 'forfalt_sjekkpunkt' | 'ocr_venter'
  prosjekt_id: string
  prosjekt_navn: string
  beskrivelse: string
  alvorlighet: 'info' | 'advarsel' | 'kritisk'
}

export type DashboardProsjekt = {
  id: string
  navn: string
  marked: 'norge' | 'spania'
  kategori: string
  status: string
  valuta: 'NOK' | 'EUR'
  total_invest: number
  forventet_salg: number | null
  roi_pct: number | null
  cashflow_mnd: number | null     // bare for utleie
  yield_pct: number | null        // bare for utleie
  kvittering_sum: number          // sum kvitteringer i prosjektets valuta
  oppussing: { ferdig: number; totalt: number; overskridelser: number }
  sjekkliste: { ok: number; totalt: number }
  anbefaling: { tekst: string; type: 'leie' | 'salg' | 'avvent' | 'utlei_deretter_salg' }
}

export type DashboardData = {
  totaler: {
    antall_prosjekter: number
    antall_flipp: number
    antall_utleie: number
    antall_norske: number
    kapital_eur: number
    kapital_nok: number
    forventet_fortjeneste_eur: number
    forventet_fortjeneste_nok: number
    aktive_utleier: number
  }
  varsler: DashboardVarsel[]
  prosjekter: DashboardProsjekt[]
}

// Hjelpere for Spania-prosjekter (gjenbruk fra beregninger.ts uten å importere
// så vi unngår sirkulærimport hvis lib endres)
const totalInvSpania = (p: Prosjekt) =>
  (p.kjøpesum || 0) + (p.kjøpskostnader || 0) + (p.oppussing_faktisk || 0) + (p.møblering || 0)

const cashflowSpania = (p: Prosjekt) =>
  (p.leieinntekt_mnd || 0) - ((p.lån_mnd || 0) + (p.fellesutgifter_mnd || 0) + (p.strøm_mnd || 0) + (p.forsikring_mnd || 0) + (p.forvaltning_mnd || 0))

function lagAnbefaling(opt: {
  marked: 'norge' | 'spania'
  kategori: string
  cashflow: number | null
  yieldPct: number | null
  roiPct: number | null
}): { tekst: string; type: 'leie' | 'salg' | 'avvent' | 'utlei_deretter_salg' } {
  const { marked, kategori, cashflow, yieldPct, roiPct } = opt
  // Norske flippeprosjekter — typisk hold-tid er kort, gå på ROI
  if (marked === 'norge') {
    if (roiPct !== null && roiPct >= 20) return { type: 'salg', tekst: 'Selg — sterk ROI ved fullført flipp' }
    if (roiPct !== null && roiPct >= 10) return { type: 'salg', tekst: 'Selg når ferdig — moderat ROI' }
    if (roiPct !== null && roiPct < 0) return { type: 'avvent', tekst: 'Avvent — beregnet ROI er negativ, vurder strategi' }
    return { type: 'avvent', tekst: 'Mangler salgsmål — fyll inn for anbefaling' }
  }
  // Spania-utleie: positiv cashflow + ok yield = behold
  const cf = cashflow ?? 0
  const y = yieldPct ?? 0
  const r = roiPct ?? 0
  if (kategori === 'utleie') {
    if (cf > 0 && y >= 5 && r >= 25) return { type: 'utlei_deretter_salg', tekst: 'Lei ut nå, vurder salg når marked topper' }
    if (cf > 0 && y >= 5) return { type: 'leie', tekst: 'Behold som utleie — sunn cashflow og yield' }
    if (r >= 25) return { type: 'salg', tekst: 'Selg — sterk ROI, men svak cashflow' }
    if (cf < 0 && r < 10) return { type: 'avvent', tekst: 'Negativ cashflow + svak ROI — utbedre eller eksiter' }
    return { type: 'leie', tekst: 'Behold under oppbygging' }
  }
  // Spania-flipp
  if (r >= 25) return { type: 'salg', tekst: 'Selg — sterk ROI ved salg' }
  if (r >= 10) return { type: 'salg', tekst: 'Selg når oppussing er ferdig' }
  if (r < 0) return { type: 'avvent', tekst: 'Avvent — utbedre kostnader eller markedstiming' }
  return { type: 'avvent', tekst: 'Mangler salgsmål — fyll inn for anbefaling' }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()

    // Filter på marked: ?marked=spania | ?marked=norge | (default = begge)
    // Norge og Spania holdes adskilt i UI-en — hver har sitt eget dashboard.
    const url = new URL(req.url)
    const markedFilter = url.searchParams.get('marked')

    let q = admin.from('prosjekter').select('*').order('opprettet', { ascending: false })
    if (markedFilter === 'spania') {
      // marked = null tolkes som Spania for bakoverkompatibilitet
      q = q.or('marked.is.null,marked.eq.spania')
    } else if (markedFilter === 'norge') {
      q = q.eq('marked', 'norge')
    }
    const { data: prosjekterRader } = await q
    // Filtrer ut prosjekter som er skjult for denne brukeren (UI-filter — ikke
    // ekte tilgangskontroll). Gjøres på klient-siden av admin pga eldre rader
    // som mangler skjult_for-kolonne.
    const prosjekter = ((prosjekterRader || []) as Prosjekt[])
      .filter(p => !(p.skjult_for || []).includes(auth.bruker))
    const prosjektIds = prosjekter.map(p => p.id)
    const navnPerId: Record<string, string> = {}
    for (const p of prosjekter) navnPerId[p.id] = p.navn

    if (prosjektIds.length === 0) {
      return NextResponse.json({
        totaler: { antall_prosjekter: 0, antall_flipp: 0, antall_utleie: 0, antall_norske: 0, kapital_eur: 0, kapital_nok: 0, forventet_fortjeneste_eur: 0, forventet_fortjeneste_nok: 0, aktive_utleier: 0 },
        varsler: [],
        prosjekter: [],
      } satisfies DashboardData)
    }

    // === Parallelle batch-queries ===
    const [
      { data: budsjetter },
      { data: kvitteringer },
      { data: sjekkpunkter },
      { data: dokumenter },
    ] = await Promise.all([
      admin.from('oppussing_budsjett').select('id, bolig_id').in('bolig_id', prosjektIds),
      admin.from('kvitteringer').select('id, prosjekt_id, valuta, belop_inkl_mva, ocr_status, opprettet').in('prosjekt_id', prosjektIds),
      admin.from('dokument_sjekkpunkter').select('id, prosjekt_id, dokument_type, status, frist').in('prosjekt_id', prosjektIds),
      admin.from('dokumenter').select('id, prosjekt_id, type, gyldig_til, tittel').in('prosjekt_id', prosjektIds),
    ])

    const budsjettIder = (budsjetter || []).map(b => b.id)
    const budsjettTilProsjekt = new Map<string, string>()
    for (const b of (budsjetter || [])) budsjettTilProsjekt.set(b.id, b.bolig_id)

    const { data: poster } = budsjettIder.length > 0
      ? await admin.from('oppussing_poster').select('id, budsjett_id, kostnad, faktisk_kostnad, status').in('budsjett_id', budsjettIder)
      : { data: [] }

    // Sum kvittering per oppussing_post — for å beregne effektiv faktisk
    const { data: kvPerPost } = budsjettIder.length > 0
      ? await admin.from('kvitteringer').select('belop_inkl_mva, oppussing_post_id').in('prosjekt_id', prosjektIds).not('oppussing_post_id', 'is', null)
      : { data: [] }
    const kvSumPerPost: Record<string, number> = {}
    for (const k of (kvPerPost || []) as Array<{ belop_inkl_mva: number | null; oppussing_post_id: string }>) {
      if (k.belop_inkl_mva && k.oppussing_post_id) {
        kvSumPerPost[k.oppussing_post_id] = (kvSumPerPost[k.oppussing_post_id] || 0) + k.belop_inkl_mva
      }
    }

    // === Bygg per-prosjekt aggregat ===
    const dashboardProsjekter: DashboardProsjekt[] = []
    let kapitalEur = 0, kapitalNok = 0
    let fortjenesteEur = 0, fortjenesteNok = 0
    let aktiveUtleier = 0

    for (const p of prosjekter) {
      const erNorsk = p.marked === 'norge'
      const valuta: 'NOK' | 'EUR' = erNorsk ? 'NOK' : 'EUR'

      let totalInvest = 0
      let forventetSalg: number | null = null
      let roiPct: number | null = null
      let cashflow: number | null = null
      let yieldPct: number | null = null

      if (erNorsk) {
        // Hent fra norsk_kalkulator_data hvis det finnes
        const kData = (p.norsk_kalkulator_data || {}) as Record<string, unknown>
        const kalk = kData.kalk as { kjopesum?: number; salgspris?: number; oppussing_kost?: number; mobler_styling?: number } | undefined
        if (kalk) {
          totalInvest = (kalk.kjopesum || 0) + (kalk.oppussing_kost || 0) + (kalk.mobler_styling || 0)
          forventetSalg = kalk.salgspris || p.salgsmaal_nok || null
          if (totalInvest > 0 && forventetSalg) {
            roiPct = ((forventetSalg - totalInvest) / totalInvest) * 100
          }
        }
      } else {
        totalInvest = totalInvSpania(p)
        forventetSalg = p.forventet_salgsverdi || p.salgsmaal_eur || null
        if (totalInvest > 0 && forventetSalg) {
          roiPct = ((forventetSalg - totalInvest) / totalInvest) * 100
        }
        if (p.kategori === 'utleie') {
          cashflow = cashflowSpania(p)
          yieldPct = totalInvest > 0 ? ((p.leieinntekt_mnd || 0) * 12 / totalInvest) * 100 : 0
          if ((p.leieinntekt_mnd || 0) > 0) aktiveUtleier++
        }
      }

      // Aggregér til totaler
      if (valuta === 'EUR') {
        kapitalEur += totalInvest
        if (forventetSalg) fortjenesteEur += Math.max(0, forventetSalg - totalInvest)
      } else {
        kapitalNok += totalInvest
        if (forventetSalg) fortjenesteNok += Math.max(0, forventetSalg - totalInvest)
      }

      // Oppussingsstatus
      const prosjektBudsjettId = (budsjetter || []).find(b => b.bolig_id === p.id)?.id
      const prosjektPoster = (poster || []).filter(po => po.budsjett_id === prosjektBudsjettId) as OppussingPost[]
      let ferdig = 0, overskridelser = 0
      for (const po of prosjektPoster) {
        if (po.status === 'ferdig') ferdig++
        const fk = (typeof po.faktisk_kostnad === 'number' && Number.isFinite(po.faktisk_kostnad))
          ? po.faktisk_kostnad
          : (kvSumPerPost[po.id] || 0)
        if ((po.kostnad || 0) > 0 && fk > (po.kostnad || 0) * 1.10) overskridelser++
      }

      // Sjekkliste
      const prosjektSjekk = (sjekkpunkter || []).filter(s => s.prosjekt_id === p.id) as DokumentSjekkpunkt[]
      const aktive = prosjektSjekk.filter(s => s.status !== 'ikke_relevant')
      const ok = prosjektSjekk.filter(s => s.status === 'ok').length

      // Sum kvitteringer i prosjektets valuta
      const prosjektKv = (kvitteringer || []).filter(k => k.prosjekt_id === p.id)
      const kvSum = prosjektKv
        .filter(k => k.valuta === valuta)
        .reduce((s, k) => s + (k.belop_inkl_mva || 0), 0)

      dashboardProsjekter.push({
        id: p.id,
        navn: p.navn,
        marked: erNorsk ? 'norge' : 'spania',
        kategori: p.kategori,
        status: p.status,
        valuta,
        total_invest: totalInvest,
        forventet_salg: forventetSalg,
        roi_pct: roiPct,
        cashflow_mnd: cashflow,
        yield_pct: yieldPct,
        kvittering_sum: kvSum,
        oppussing: { ferdig, totalt: prosjektPoster.length, overskridelser },
        sjekkliste: { ok, totalt: aktive.length },
        anbefaling: lagAnbefaling({
          marked: erNorsk ? 'norge' : 'spania',
          kategori: p.kategori,
          cashflow,
          yieldPct,
          roiPct,
        }),
      })
    }

    // === Varsler ===
    const varsler: DashboardVarsel[] = []
    const naa = new Date()
    const om30 = new Date(naa.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Overskridelser
    for (const dp of dashboardProsjekter) {
      if (dp.oppussing.overskridelser > 0) {
        varsler.push({
          type: 'overskridelse',
          prosjekt_id: dp.id,
          prosjekt_navn: dp.navn,
          beskrivelse: `${dp.oppussing.overskridelser} oppussingspost${dp.oppussing.overskridelser !== 1 ? 'er' : ''} over budsjett`,
          alvorlighet: 'advarsel',
        })
      }
    }

    // Utløpende dokumenter (innen 30 dager)
    for (const d of (dokumenter || []) as Array<{ prosjekt_id: string; gyldig_til: string | null; type: string; tittel: string }>) {
      if (!d.gyldig_til) continue
      const dato = new Date(d.gyldig_til)
      if (dato < naa) {
        varsler.push({
          type: 'utlopende_dokument',
          prosjekt_id: d.prosjekt_id,
          prosjekt_navn: navnPerId[d.prosjekt_id] || '',
          beskrivelse: `${d.tittel} utløpt ${d.gyldig_til}`,
          alvorlighet: 'kritisk',
        })
      } else if (dato < om30) {
        varsler.push({
          type: 'utlopende_dokument',
          prosjekt_id: d.prosjekt_id,
          prosjekt_navn: navnPerId[d.prosjekt_id] || '',
          beskrivelse: `${d.tittel} utløper ${d.gyldig_til}`,
          alvorlighet: 'advarsel',
        })
      }
    }

    // Forfalt sjekkpunkt-frist
    for (const s of (sjekkpunkter || []) as Array<{ prosjekt_id: string; dokument_type: string; status: string; frist: string | null }>) {
      if (!s.frist || s.status === 'ok' || s.status === 'ikke_relevant') continue
      if (new Date(s.frist) < naa) {
        varsler.push({
          type: 'forfalt_sjekkpunkt',
          prosjekt_id: s.prosjekt_id,
          prosjekt_navn: navnPerId[s.prosjekt_id] || '',
          beskrivelse: `${DOKUMENT_ETIKETT[s.dokument_type as DokumentType] || s.dokument_type} — frist forfalt ${s.frist}`,
          alvorlighet: 'kritisk',
        })
      }
    }

    // Kvittering venter på OCR > 24t
    const enDagSiden = new Date(naa.getTime() - 24 * 60 * 60 * 1000)
    const ocrVenter = (kvitteringer || []).filter(k => k.ocr_status === 'venter' && new Date(k.opprettet) < enDagSiden)
    const venterPerProsjekt: Record<string, number> = {}
    for (const k of ocrVenter) venterPerProsjekt[k.prosjekt_id] = (venterPerProsjekt[k.prosjekt_id] || 0) + 1
    for (const [pid, antall] of Object.entries(venterPerProsjekt)) {
      varsler.push({
        type: 'ocr_venter',
        prosjekt_id: pid,
        prosjekt_navn: navnPerId[pid] || '',
        beskrivelse: `${antall} kvittering${antall !== 1 ? 'er' : ''} venter på OCR i over 24 timer`,
        alvorlighet: 'info',
      })
    }

    // Sorter varsler: kritisk → advarsel → info
    const alvorRekkefolge = { kritisk: 0, advarsel: 1, info: 2 }
    varsler.sort((a, b) => alvorRekkefolge[a.alvorlighet] - alvorRekkefolge[b.alvorlighet])

    const data: DashboardData = {
      totaler: {
        antall_prosjekter: prosjekter.length,
        antall_flipp: prosjekter.filter(p => p.kategori === 'flipp').length,
        antall_utleie: prosjekter.filter(p => p.kategori === 'utleie').length,
        antall_norske: prosjekter.filter(p => p.marked === 'norge').length,
        kapital_eur: kapitalEur,
        kapital_nok: kapitalNok,
        forventet_fortjeneste_eur: fortjenesteEur,
        forventet_fortjeneste_nok: fortjenesteNok,
        aktive_utleier: aktiveUtleier,
      },
      varsler,
      prosjekter: dashboardProsjekter,
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('Dashboard feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke bygge dashboard' }, { status: 500 })
  }
}
