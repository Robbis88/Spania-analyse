import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import { loggAktivitet } from '../../lib/logg'
import { laanBetjeningHittil } from '../../lib/portefolje'
import { fakturaKostnader } from '../../lib/kontant'
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

    // Operativ kontant: realisert leieinntekt (cashflow), lånebetjening, og fakturakostnader.
    const naa = Date.now()
    const [selskaperRes, prosjekterRes, cashflowRes, laanRes, kvitteringRes, bilagRes] = await Promise.all([
      admin.from('selskaper').select('id, valuta, fri_likviditet'),
      admin.from('prosjekter').select('id, selskap_id').eq('er_portefolje', true),
      admin.from('eiendom_cashflow').select('prosjekt_id, inntekt'),
      admin.from('eiendom_laan').select('*'),
      admin.from('kvitteringer').select('id, prosjekt_id, ocr_status, belop_inkl_mva, dato, leverandor, oppussing_post_id'),
      admin.from('bilag').select('id, prosjekt_id, selskap_id, status, belop, faktura_dato, leverandor, kategori, valuta'),
    ])
    const prosjektTilSelskap = new Map<string, string>()
    for (const p of (prosjekterRes.data || []) as Array<{ id: string; selskap_id: string | null }>) {
      if (p.selskap_id) prosjektTilSelskap.set(p.id, p.selskap_id)
    }
    const selskapValuta = new Map<string, 'NOK' | 'EUR'>()
    const friPerSelskap = new Map<string, number>()
    for (const s of (selskaperRes.data || []) as Array<{ id: string; valuta: 'NOK' | 'EUR'; fri_likviditet: number | null }>) {
      selskapValuta.set(s.id, s.valuta); friPerSelskap.set(s.id, s.fri_likviditet || 0)
    }

    // Leieinntekt fra realisert cashflow (kostnader kommer nå fra opplastede fakturaer).
    const inntektPerSelskap = new Map<string, number>()
    for (const c of (cashflowRes.data || []) as Array<{ prosjekt_id: string; inntekt: number }>) {
      const sid = prosjektTilSelskap.get(c.prosjekt_id)
      if (sid) inntektPerSelskap.set(sid, (inntektPerSelskap.get(sid) || 0) + (c.inntekt || 0))
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

    // Fakturakostnader (kvitteringer + bilag) — leses live, vises som egne linjer.
    const faktura = fakturaKostnader(kvitteringRes.data || [], bilagRes.data || [], prosjektTilSelskap, selskapValuta)

    // Saldo = hovedbok + leieinntekt − lånebetjening + fakturakostnader (negative).
    const ledgerPerSelskap = new Map<string, number>()
    for (const b of bevegelser) ledgerPerSelskap.set(b.selskap_id, (ledgerPerSelskap.get(b.selskap_id) || 0) + (b.belop || 0))
    const saldo: Record<string, number> = {}
    const alle = new Set<string>([...ledgerPerSelskap.keys(), ...inntektPerSelskap.keys(), ...Object.keys(laanebetjening), ...faktura.perSelskap.keys()])
    // Samme gate som /api/kapital: useedet selskap (ingen hovedbok) faller tilbake på fri_likviditet.
    for (const sid of alle) saldo[sid] = ledgerPerSelskap.has(sid)
      ? (ledgerPerSelskap.get(sid) || 0) + (inntektPerSelskap.get(sid) || 0) - (laanebetjening[sid] || 0) + (faktura.perSelskap.get(sid) || 0)
      : (friPerSelskap.get(sid) || 0)

    // Slå sammen ekte bevegelser + synteti­ske fakturalinjer, nyeste først.
    const alleBevegelser = [...bevegelser, ...faktura.rader].sort((a, b) => (b.dato || '').localeCompare(a.dato || ''))

    return NextResponse.json({ bevegelser: alleBevegelser, saldo, laanebetjening })
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
    // Renter og avdrag beregnes automatisk fra lånene (laanBetjeningHittil) — manuell
    // føring ville dobbelttelt i saldoen. Blokkeres.
    if (type === 'renter' || type === 'avdrag') return NextResponse.json({ feil: 'Renter og avdrag beregnes automatisk fra lånene — ikke før dem manuelt' }, { status: 400 })
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
