import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import type { EiendomLaan, EiendomInntekt, EiendomKostnad, EiendomVerdivurdering, Konsernlaan, Prosjekt, Selskap } from '../../types'
import { sisteVerdi, totalRestgjeld, gjeldendeLeieMnd, sumKostnaderPerMnd, totalRenterMnd, laanBetjeningHittil } from '../../lib/portefolje'
import { beregnBundetEk, MAKS_LTV_PST } from '../../lib/beslutning'
import { gevinstSatsPst, medDefaults } from '../../lib/skatteprofil'
import { fakturaKostnader } from '../../lib/kontant'

// Utestående på et konsernlån = hovedstol minus nedbetalinger.
function utestaaende(l: Konsernlaan): number {
  const nedbetalt = (l.nedbetalinger || []).reduce((s, n) => s + (Number(n.belop) || 0), 0)
  return Math.max(0, (l.hovedstol || 0) - nedbetalt)
}

// Påløpte renter (enkel lineær akkumulering fra startdato — kun visning, bokføres ikke).
function paalopteRenter(l: Konsernlaan, naa: number): number {
  if (!l.startdato || !l.rente_pct) return 0
  const start = new Date(l.startdato).getTime()
  if (Number.isNaN(start) || start > naa) return 0
  const dager = (naa - start) / (1000 * 60 * 60 * 24)
  return utestaaende(l) * (l.rente_pct / 100) * (dager / 365)
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const naa = Date.now()

    const [selskaperRes, prosjekterRes, konsernRes, bevegelserRes, bilagRes] = await Promise.all([
      admin.from('selskaper').select('*').order('opprettet', { ascending: true }),
      admin.from('prosjekter').select('*').eq('er_portefolje', true),
      admin.from('konsernlaan').select('*'),
      admin.from('kontantbevegelser').select('selskap_id, belop'),
      admin.from('bilag').select('id, prosjekt_id, selskap_id, status, belop, faktura_dato, leverandor, kategori, valuta'),
    ])

    const selskaper = (selskaperRes.data || []) as Selskap[]
    const prosjekter = (prosjekterRes.data || []) as Prosjekt[]
    const konsernlaan = (konsernRes.data || []) as Konsernlaan[]
    const bevegelser = (bevegelserRes.data || []) as Array<{ selskap_id: string; belop: number }>

    // Kobling prosjekt→selskap + valuta, brukt til fakturakostnader.
    const prosjektTilSelskap = new Map<string, string>()
    for (const p of prosjekter) if (p.selskap_id) prosjektTilSelskap.set(p.id, p.selskap_id)
    const selskapValuta = new Map<string, 'NOK' | 'EUR'>()
    for (const s of selskaper) selskapValuta.set(s.id, s.valuta)

    // Kontantsaldo per selskap = hovedbok (kapitalhendelser) + realisert cashflow-netto.
    // Fallback til det manuelle fri_likviditet-feltet så lenge selskapet ikke er seedet (B12).
    const ledgerPerSelskap = new Map<string, number>()
    for (const b of bevegelser) ledgerPerSelskap.set(b.selskap_id, (ledgerPerSelskap.get(b.selskap_id) || 0) + (b.belop || 0))

    // Hent lån + verdivurderinger for alle porteføljeeiendommer i bulk
    const ider = prosjekter.map(p => p.id)
    let laanAlle: EiendomLaan[] = []
    let vurdAlle: EiendomVerdivurdering[] = []
    let inntekterAlle: EiendomInntekt[] = []
    let kostnaderAlle: EiendomKostnad[] = []
    let cashflowAlle: Array<{ prosjekt_id: string; inntekt: number }> = []
    let kvitteringAlle: Array<{ id: string; prosjekt_id: string; ocr_status: string; belop_inkl_mva: number | null; dato: string | null; leverandor: string | null; oppussing_post_id: string | null }> = []
    if (ider.length > 0) {
      const [laanRes, vurdRes, innRes, kostRes, cashRes, kvitteringRes] = await Promise.all([
        admin.from('eiendom_laan').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_verdivurderinger').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_inntekter').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_kostnader').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_cashflow').select('prosjekt_id, inntekt').in('prosjekt_id', ider),
        admin.from('kvitteringer').select('id, prosjekt_id, ocr_status, belop_inkl_mva, dato, leverandor, oppussing_post_id').in('prosjekt_id', ider),
      ])
      laanAlle = (laanRes.data || []) as EiendomLaan[]
      vurdAlle = (vurdRes.data || []) as EiendomVerdivurdering[]
      inntekterAlle = (innRes.data || []) as EiendomInntekt[]
      kostnaderAlle = (kostRes.data || []) as EiendomKostnad[]
      cashflowAlle = (cashRes.data || []) as Array<{ prosjekt_id: string; inntekt: number }>
      kvitteringAlle = (kvitteringRes.data || []) as typeof kvitteringAlle
    }

    // Fakturakostnader (kvitteringer + bilag) per selskap — trekkes fra kontantsaldoen.
    const fakturaPerSelskap = fakturaKostnader(kvitteringAlle, bilagRes.data || [], prosjektTilSelskap, selskapValuta).perSelskap

    const perSelskap = selskaper.map(s => {
      const profil = medDefaults(s.land, s.skatteprofil)
      const gevinstPst = gevinstSatsPst(profil)
      const eiendommer = prosjekter.filter(p => p.selskap_id === s.id)

      let bundetEk = 0
      let frigjorbarRefi = 0
      let samletVerdi = 0
      let samletGjeld = 0
      let resultatMnd = 0
      for (const e of eiendommer) {
        const laan = laanAlle.filter(l => (l as { prosjekt_id?: string }).prosjekt_id === e.id)
        const vurd = vurdAlle.filter(v => (v as { prosjekt_id?: string }).prosjekt_id === e.id)
        const inntekter = inntekterAlle.filter(i => (i as { prosjekt_id?: string }).prosjekt_id === e.id)
        const kostnader = kostnaderAlle.filter(k => (k as { prosjekt_id?: string }).prosjekt_id === e.id)
        const verdi = sisteVerdi(vurd)
        const gjeld = totalRestgjeld(laan)
        const anskaffelse = (e.kjøpesum || 0) + (e.kjøpskostnader || 0) + (e.oppussing_faktisk || 0)
        bundetEk += beregnBundetEk(verdi, gjeld, anskaffelse, gevinstPst).bundet_ek
        frigjorbarRefi += Math.max(0, verdi * (MAKS_LTV_PST / 100) - gjeld)
        samletVerdi += verdi
        samletGjeld += gjeld
        // Resultat = overskudd: kun renter trekkes (avdrag bygger egenkapital, er ikke en kostnad)
        resultatMnd += gjeldendeLeieMnd(inntekter) - sumKostnaderPerMnd(kostnader) - totalRenterMnd(laan)
      }

      const fordringer = konsernlaan.filter(l => l.fra_selskap === s.id)
      const gjeldKonsern = konsernlaan.filter(l => l.til_selskap === s.id)
      const konsernFordring = fordringer.reduce((sum, l) => sum + utestaaende(l), 0)
      const konsernGjeld = gjeldKonsern.reduce((sum, l) => sum + utestaaende(l), 0)
      const paalopteFordring = fordringer.reduce((sum, l) => sum + paalopteRenter(l, naa), 0)

      // Kontantsaldo: seedet selskap → hovedbok + leieinntekt − lånebetjening + fakturakostnader;
      // ellers gammelt felt (fallback inntil seeding).
      const cashflowInntekt = eiendommer.reduce((sum, e) => {
        const cf = cashflowAlle.filter(c => c.prosjekt_id === e.id)
        return sum + cf.reduce((a, c) => a + (c.inntekt || 0), 0)
      }, 0)
      const selskapLaan = laanAlle.filter(l => eiendommer.some(e => e.id === (l as { prosjekt_id?: string }).prosjekt_id))
      const laanebetjening = laanBetjeningHittil(selskapLaan, naa)
      const fakturaKost = fakturaPerSelskap.get(s.id) || 0   // negativ sum av opplastede fakturaer
      const harLedger = ledgerPerSelskap.has(s.id)
      const friLikviditet = harLedger ? (ledgerPerSelskap.get(s.id)! + cashflowInntekt - laanebetjening + fakturaKost) : (s.fri_likviditet || 0)
      const laanekapasitet = s.laanekapasitet || 0
      // Kjøpekraft = kapital du kan deployere UTEN å selge: fri likviditet +
      // refinansieringspotensial (opp til maks LTV) + bankramme. Salgseffekt
      // holdes utenfor (betinget av salgsbeslutning) og vises som egen løftestang.
      const kjopekraft = friLikviditet + laanekapasitet + frigjorbarRefi

      return {
        id: s.id, navn: s.navn, land: s.land, valuta: s.valuta,
        antall_eiendommer: eiendommer.length,
        samlet_verdi: samletVerdi,
        restgjeld: samletGjeld,
        egenkapital: samletVerdi - samletGjeld,
        resultat_mnd: resultatMnd,
        bundet_ek: bundetEk,
        frigjorbar_refi: frigjorbarRefi,
        fri_likviditet: friLikviditet,
        laanekapasitet,
        konsern_fordring: konsernFordring,
        konsern_gjeld: konsernGjeld,
        paalopte_renter_fordring: paalopteFordring,
        kjopekraft,
      }
    })

    // Konsolidert per valuta (kan ikke summere NOK og EUR uten kurs)
    const perValuta: Record<string, { valuta: string; samlet_verdi: number; restgjeld: number; egenkapital: number; resultat_mnd: number; antall: number; bundet_ek: number; frigjorbar_refi: number; fri_likviditet: number; laanekapasitet: number; kjopekraft: number }> = {}
    for (const r of perSelskap) {
      const v = perValuta[r.valuta] || (perValuta[r.valuta] = { valuta: r.valuta, samlet_verdi: 0, restgjeld: 0, egenkapital: 0, resultat_mnd: 0, antall: 0, bundet_ek: 0, frigjorbar_refi: 0, fri_likviditet: 0, laanekapasitet: 0, kjopekraft: 0 })
      v.samlet_verdi += r.samlet_verdi
      v.restgjeld += r.restgjeld
      v.egenkapital += r.egenkapital
      v.resultat_mnd += r.resultat_mnd
      v.antall += r.antall_eiendommer
      v.bundet_ek += r.bundet_ek
      v.frigjorbar_refi += r.frigjorbar_refi
      v.fri_likviditet += r.fri_likviditet
      v.laanekapasitet += r.laanekapasitet
      v.kjopekraft += r.kjopekraft
    }

    return NextResponse.json({
      selskaper: perSelskap,
      konsolidert: Object.values(perValuta),
      konsernlaan,
    })
  } catch (e) {
    console.error('Kapital GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente kapitaloversikt' }, { status: 500 })
  }
}
