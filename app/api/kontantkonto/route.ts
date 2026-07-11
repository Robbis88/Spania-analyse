import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import { loggAktivitet } from '../../lib/logg'
import { laanBetjeningHittil } from '../../lib/portefolje'
import type { Kontantbevegelse, KontantbevegelseType, EiendomLaan } from '../../types'

// Innganger (+) vs utganger (−). 'annet' signeres eksplisitt av kaller.
const INNGANG: KontantbevegelseType[] = ['innskudd', 'laaneopptak', 'leieinntekt']
const GYLDIGE: KontantbevegelseType[] = [
  'innskudd', 'laaneopptak', 'kjop', 'omkostninger', 'oppussing',
  'driftskostnad', 'renter', 'avdrag', 'leieinntekt', 'uttak', 'annet',
]

// Fortegnssett et beløp ut fra type (bruker taster alltid positivt tall).
function signer(type: KontantbevegelseType, belop: number): number {
  const abs = Math.abs(belop)
  return INNGANG.includes(type) ? abs : -abs
}

// GET: bevegelser (valgfritt filtrert på selskap_id/prosjekt_id) + saldo per selskap.
// Saldo = sum(kontantbevegelser) + sum(eiendom_cashflow netto for selskapets eiendommer).
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { searchParams } = new URL(req.url)
    const selskapId = searchParams.get('selskap_id')
    const prosjektId = searchParams.get('prosjekt_id')
    const admin = hentSupabaseAdmin()

    let q = admin.from('kontantbevegelser').select('*').order('dato', { ascending: false })
    if (selskapId) q = q.eq('selskap_id', selskapId)
    if (prosjektId) q = q.eq('prosjekt_id', prosjektId)
    const { data, error } = await q
    if (error) return NextResponse.json({ feil: 'Kunne ikke hente bevegelser: ' + error.message }, { status: 500 })
    const bevegelser = (data || []) as Kontantbevegelse[]

    // Operativ kontant fra realisert cashflow + lånebetjening (per selskap via prosjekt-kobling).
    const naa = Date.now()
    const [prosjekterRes, cashflowRes, laanRes] = await Promise.all([
      admin.from('prosjekter').select('id, selskap_id').eq('er_portefolje', true),
      admin.from('eiendom_cashflow').select('prosjekt_id, inntekt, kostnad'),
      admin.from('eiendom_laan').select('*'),
    ])
    const prosjektTilSelskap = new Map<string, string>()
    for (const p of (prosjekterRes.data || []) as Array<{ id: string; selskap_id: string | null }>) {
      if (p.selskap_id) prosjektTilSelskap.set(p.id, p.selskap_id)
    }
    const cashflowNettoPerSelskap = new Map<string, number>()
    for (const c of (cashflowRes.data || []) as Array<{ prosjekt_id: string; inntekt: number; kostnad: number }>) {
      const sid = prosjektTilSelskap.get(c.prosjekt_id)
      if (!sid) continue
      cashflowNettoPerSelskap.set(sid, (cashflowNettoPerSelskap.get(sid) || 0) + ((c.inntekt || 0) - (c.kostnad || 0)))
    }
    // Akkumulert lånebetjening (renter + avdrag) hittil, per selskap.
    const laanPerSelskap = new Map<string, EiendomLaan[]>()
    for (const l of (laanRes.data || []) as EiendomLaan[]) {
      const sid = prosjektTilSelskap.get(l.prosjekt_id)
      if (!sid) continue
      const arr = laanPerSelskap.get(sid) || []
      arr.push(l); laanPerSelskap.set(sid, arr)
    }
    const laanebetjening: Record<string, number> = {}
    for (const [sid, ls] of laanPerSelskap) laanebetjening[sid] = laanBetjeningHittil(ls, naa)

    // Saldo per selskap = ledger + realisert cashflow-netto − lånebetjening hittil.
    const ledgerPerSelskap = new Map<string, number>()
    for (const b of bevegelser) ledgerPerSelskap.set(b.selskap_id, (ledgerPerSelskap.get(b.selskap_id) || 0) + (b.belop || 0))
    const saldo: Record<string, number> = {}
    const alle = new Set<string>([...ledgerPerSelskap.keys(), ...cashflowNettoPerSelskap.keys(), ...Object.keys(laanebetjening)])
    for (const sid of alle) saldo[sid] = (ledgerPerSelskap.get(sid) || 0) + (cashflowNettoPerSelskap.get(sid) || 0) - (laanebetjening[sid] || 0)

    return NextResponse.json({ bevegelser, saldo, laanebetjening })
  } catch (e) {
    console.error('Kontantkonto GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente kontantkonto' }, { status: 500 })
  }
}

// POST: manuell bevegelse (innskudd, uttak, justering). belop tastes positivt; server signerer.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const b = await req.json()
    const type = b.type as KontantbevegelseType
    if (!b.selskap_id || typeof b.selskap_id !== 'string') return NextResponse.json({ feil: 'selskap_id mangler' }, { status: 400 })
    if (!GYLDIGE.includes(type)) return NextResponse.json({ feil: 'ugyldig type' }, { status: 400 })
    if (!b.dato) return NextResponse.json({ feil: 'dato mangler' }, { status: 400 })
    const raatall = Number(b.belop)
    if (!Number.isFinite(raatall) || raatall === 0) return NextResponse.json({ feil: 'beløp mangler' }, { status: 400 })

    // 'annet' beholder kallers fortegn; ellers signeres av type.
    const belop = type === 'annet' ? raatall : signer(type, raatall)
    const rad = {
      selskap_id: b.selskap_id,
      prosjekt_id: b.prosjekt_id || null,
      dato: b.dato,
      type,
      belop,
      valuta: b.valuta === 'EUR' ? 'EUR' : 'NOK',
      kilde: 'manuell',
      kilde_id: null,
      notat: typeof b.notat === 'string' ? b.notat : null,
    }
    const admin = hentSupabaseAdmin()
    const { data, error } = await admin.from('kontantbevegelser').insert([rad]).select('id').single()
    if (error) return NextResponse.json({ feil: 'Lagring feilet: ' + error.message }, { status: 500 })
    await loggAktivitet({ handling: 'registrerte kontantbevegelse', tabell: 'kontantbevegelser', rad_id: data?.id, detaljer: { type, belop } })
    return NextResponse.json({ suksess: true, id: data?.id })
  } catch (e) {
    console.error('Kontantkonto POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('kontantbevegelser').delete().eq('id', id)
    if (error) return NextResponse.json({ feil: 'Sletting feilet: ' + error.message }, { status: 500 })
    await loggAktivitet({ handling: 'slettet kontantbevegelse', tabell: 'kontantbevegelser', rad_id: id, detaljer: {} })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Kontantkonto DELETE feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Sletting feilet' }, { status: 500 })
  }
}
