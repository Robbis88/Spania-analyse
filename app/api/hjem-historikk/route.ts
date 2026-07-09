import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import type { EiendomCashflow, EiendomVerdivurdering, Prosjekt } from '../../types'

// Historikk til Hjem-grafene. Aggregerer KUN ekte, loggede data:
//   * resultat_serie  ← eiendom_cashflow (månedlig inntekt/kostnad per eiendom)
//   * verdi_serie     ← eiendom_verdivurderinger (datert markedsverdi per eiendom)
// Ingen snapshots genereres, ingen kurver fabrikkeres. Har vi ikke historikk,
// returneres tomme serier og klienten viser «historikk bygges opp fra nå».

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const pRes = await admin.from('prosjekter').select('id').eq('er_portefolje', true)
    const ider = ((pRes.data || []) as Array<Pick<Prosjekt, 'id'>>).map(p => p.id)

    if (ider.length === 0) {
      return NextResponse.json({ resultat_serie: [], verdi_serie: [] })
    }

    const [cfRes, vurdRes] = await Promise.all([
      admin.from('eiendom_cashflow').select('*').in('prosjekt_id', ider),
      admin.from('eiendom_verdivurderinger').select('*').in('prosjekt_id', ider),
    ])
    const cashflow = (cfRes.data || []) as Array<EiendomCashflow & { prosjekt_id: string }>
    const vurderinger = (vurdRes.data || []) as Array<EiendomVerdivurdering & { prosjekt_id: string }>

    // --- resultat_serie: summer inntekt/kostnad per måned, siste 12 mnd med data ---
    const perMnd = new Map<string, { inntekt: number; kostnad: number }>()
    for (const c of cashflow) {
      if (!c.maaned) continue
      const rad = perMnd.get(c.maaned) || { inntekt: 0, kostnad: 0 }
      rad.inntekt += Number(c.inntekt) || 0
      rad.kostnad += Number(c.kostnad) || 0
      perMnd.set(c.maaned, rad)
    }
    const resultat_serie = [...perMnd.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([maaned, r]) => ({ maaned, inntekt: r.inntekt, kostnad: r.kostnad, resultat: r.inntekt - r.kostnad }))

    // --- verdi_serie: samlet porteføljeverdi ved hver verdivurderingsdato ---
    // For hver dato der en eiendom ble revurdert: summer siste kjente verdi per
    // eiendom fram til den datoen. Gir en ærlig trappekurve over faktiske hendelser.
    const gyldige = vurderinger
      .filter(v => v.dato && typeof v.verdi === 'number')
      .sort((a, b) => a.dato.localeCompare(b.dato))
    const datoer = [...new Set(gyldige.map(v => v.dato))]
    const sisteVerdiPerEiendom = new Map<string, number>()
    let vIdx = 0
    const verdi_serie: Array<{ dato: string; verdi: number }> = []
    for (const dato of datoer) {
      while (vIdx < gyldige.length && gyldige[vIdx].dato <= dato) {
        sisteVerdiPerEiendom.set(gyldige[vIdx].prosjekt_id, Number(gyldige[vIdx].verdi))
        vIdx++
      }
      const sum = [...sisteVerdiPerEiendom.values()].reduce((s, v) => s + v, 0)
      verdi_serie.push({ dato, verdi: sum })
    }

    return NextResponse.json({ resultat_serie, verdi_serie })
  } catch (e) {
    console.error('Hjem-historikk feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente historikk' }, { status: 500 })
  }
}
