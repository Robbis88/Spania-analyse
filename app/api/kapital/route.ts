import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import type { EiendomLaan, EiendomVerdivurdering, Konsernlaan, Prosjekt, Selskap } from '../../types'
import { sisteVerdi, totalRestgjeld } from '../../lib/portefolje'
import { beregnBundetEk, MAKS_LTV_PST } from '../../lib/beslutning'
import { gevinstSatsPst, medDefaults } from '../../lib/skatteprofil'

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

    const [selskaperRes, prosjekterRes, konsernRes] = await Promise.all([
      admin.from('selskaper').select('*').order('opprettet', { ascending: true }),
      admin.from('prosjekter').select('*').eq('er_portefolje', true),
      admin.from('konsernlaan').select('*'),
    ])

    const selskaper = (selskaperRes.data || []) as Selskap[]
    const prosjekter = (prosjekterRes.data || []) as Prosjekt[]
    const konsernlaan = (konsernRes.data || []) as Konsernlaan[]

    // Hent lån + verdivurderinger for alle porteføljeeiendommer i bulk
    const ider = prosjekter.map(p => p.id)
    let laanAlle: EiendomLaan[] = []
    let vurdAlle: EiendomVerdivurdering[] = []
    if (ider.length > 0) {
      const [laanRes, vurdRes] = await Promise.all([
        admin.from('eiendom_laan').select('*').in('prosjekt_id', ider),
        admin.from('eiendom_verdivurderinger').select('*').in('prosjekt_id', ider),
      ])
      laanAlle = (laanRes.data || []) as EiendomLaan[]
      vurdAlle = (vurdRes.data || []) as EiendomVerdivurdering[]
    }

    const perSelskap = selskaper.map(s => {
      const profil = medDefaults(s.land, s.skatteprofil)
      const gevinstPst = gevinstSatsPst(profil)
      const eiendommer = prosjekter.filter(p => p.selskap_id === s.id)

      let bundetEk = 0
      let frigjorbarRefi = 0
      let samletVerdi = 0
      for (const e of eiendommer) {
        const laan = laanAlle.filter(l => (l as { prosjekt_id?: string }).prosjekt_id === e.id)
        const vurd = vurdAlle.filter(v => (v as { prosjekt_id?: string }).prosjekt_id === e.id)
        const verdi = sisteVerdi(vurd)
        const gjeld = totalRestgjeld(laan)
        const anskaffelse = (e.kjøpesum || 0) + (e.kjøpskostnader || 0) + (e.oppussing_faktisk || 0)
        bundetEk += beregnBundetEk(verdi, gjeld, anskaffelse, gevinstPst).bundet_ek
        frigjorbarRefi += Math.max(0, verdi * (MAKS_LTV_PST / 100) - gjeld)
        samletVerdi += verdi
      }

      const fordringer = konsernlaan.filter(l => l.fra_selskap === s.id)
      const gjeldKonsern = konsernlaan.filter(l => l.til_selskap === s.id)
      const konsernFordring = fordringer.reduce((sum, l) => sum + utestaaende(l), 0)
      const konsernGjeld = gjeldKonsern.reduce((sum, l) => sum + utestaaende(l), 0)
      const paalopteFordring = fordringer.reduce((sum, l) => sum + paalopteRenter(l, naa), 0)

      const friLikviditet = s.fri_likviditet || 0
      const laanekapasitet = s.laanekapasitet || 0
      const kjopekraft = friLikviditet + laanekapasitet

      return {
        id: s.id, navn: s.navn, land: s.land, valuta: s.valuta,
        antall_eiendommer: eiendommer.length,
        samlet_verdi: samletVerdi,
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
    const perValuta: Record<string, { valuta: string; bundet_ek: number; fri_likviditet: number; laanekapasitet: number; kjopekraft: number }> = {}
    for (const r of perSelskap) {
      const v = perValuta[r.valuta] || (perValuta[r.valuta] = { valuta: r.valuta, bundet_ek: 0, fri_likviditet: 0, laanekapasitet: 0, kjopekraft: 0 })
      v.bundet_ek += r.bundet_ek
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
