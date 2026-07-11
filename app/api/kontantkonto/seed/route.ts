import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { loggAktivitet } from '../../../lib/logg'
import type { Selskap, Prosjekt, EiendomLaan, KontantbevegelseType } from '../../../types'

type SeedRad = {
  selskap_id: string
  prosjekt_id: string | null
  dato: string
  type: KontantbevegelseType
  belop: number
  valuta: 'NOK' | 'EUR'
  kilde: string
  kilde_id: string
  notat: string
}

// Bygger åpningsbevegelser fra dagens kjente fakta (selskaper + prosjekter + lån).
// Startkapital (innskutt EK) kan overstyres per selskap (fri_likviditet-feltet er
// upålitelig som startkapital). Oppussing tas IKKE med — det er budsjett, ikke brukt
// kontant; faktisk oppussing kommer som egne bevegelser når den betales.
async function byggSeed(overstyr: Record<string, number> = {}): Promise<{ rader: SeedRad[]; saldoPerSelskap: Record<string, number> }> {
  const admin = hentSupabaseAdmin()
  const [selskaperRes, prosjekterRes, laanRes] = await Promise.all([
    admin.from('selskaper').select('*'),
    admin.from('prosjekter').select('*').eq('er_portefolje', true),
    admin.from('eiendom_laan').select('*'),
  ])
  const selskaper = (selskaperRes.data || []) as Selskap[]
  const prosjekter = (prosjekterRes.data || []) as Prosjekt[]
  const laanAlle = (laanRes.data || []) as EiendomLaan[]

  const rader: SeedRad[] = []
  for (const s of selskaper) {
    const val = (s.valuta === 'EUR' ? 'EUR' : 'NOK') as 'NOK' | 'EUR'
    const startdato = (s.opprettet || new Date().toISOString()).slice(0, 10)

    // 1) Startkapital (innskutt egenkapital) — overstyrbar per selskap
    const startkapital = overstyr[s.id] ?? (s.fri_likviditet || 0)
    if (startkapital > 0) {
      rader.push({
        selskap_id: s.id, prosjekt_id: null, dato: startdato, type: 'innskudd',
        belop: startkapital, valuta: val, kilde: 'seed', kilde_id: s.id,
        notat: 'Startkapital (åpningsbalanse)',
      })
    }

    const eiendommer = prosjekter.filter(p => p.selskap_id === s.id)
    for (const e of eiendommer) {
      const kjopsdato = (e.dato_kjopt || startdato).slice(0, 10)
      // 2) Lån utbetalt (+)
      for (const l of laanAlle.filter(l => l.prosjekt_id === e.id)) {
        if ((l.hovedstol || 0) > 0) {
          rader.push({
            selskap_id: s.id, prosjekt_id: e.id, dato: (l.startdato || kjopsdato).slice(0, 10),
            type: 'laaneopptak', belop: l.hovedstol || 0, valuta: val, kilde: 'laan_opptak', kilde_id: l.id,
            notat: `Låneopptak ${l.bank || ''}`.trim(),
          })
        }
      }
      // 3) Kjøp (−), omkostninger (−), oppussing (−) — alle knyttet til prosjektet
      if ((e.kjøpesum || 0) > 0) {
        rader.push({ selskap_id: s.id, prosjekt_id: e.id, dato: kjopsdato, type: 'kjop', belop: -(e.kjøpesum || 0), valuta: val, kilde: 'kjop_registrering', kilde_id: e.id, notat: `Kjøp ${e.navn}` })
      }
      if ((e.kjøpskostnader || 0) > 0) {
        rader.push({ selskap_id: s.id, prosjekt_id: e.id, dato: kjopsdato, type: 'omkostninger', belop: -(e.kjøpskostnader || 0), valuta: val, kilde: 'kjop_registrering', kilde_id: e.id, notat: `Omkostninger ${e.navn}` })
      }
      // Oppussing tas IKKE med i seed — oppussing_faktisk er ofte budsjett, ikke brukt kontant.
      // Faktiske oppussingsbetalinger føres som egne bevegelser når de skjer.
    }
  }

  const saldoPerSelskap: Record<string, number> = {}
  for (const r of rader) saldoPerSelskap[r.selskap_id] = (saldoPerSelskap[r.selskap_id] || 0) + r.belop
  return { rader, saldoPerSelskap }
}

// GET: forhåndsvisning — regner ut bevegelsene UTEN å skrive.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { rader, saldoPerSelskap } = await byggSeed()
    return NextResponse.json({ forhandsvisning: true, rader, saldoPerSelskap, antall: rader.length })
  } catch (e) {
    console.error('Seed GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke bygge forhåndsvisning' }, { status: 500 })
  }
}

// POST: commit. Skriver ferskt — fjerner tidligere auto-seedede rader og legger inn
// på nytt (manuelle bevegelser bevares), så re-seed med korrigert startkapital blir riktig.
// Body: { startkapital?: { [selskap_id]: number } } overstyrer innskutt EK per selskap.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json().catch(() => ({}))
    const overstyr = body && typeof body.startkapital === 'object' && body.startkapital ? body.startkapital as Record<string, number> : {}
    const { rader } = await byggSeed(overstyr)
    const admin = hentSupabaseAdmin()
    // Fjern tidligere auto-seedede rader (behold manuelle bevegelser).
    const { error: delErr } = await admin.from('kontantbevegelser').delete().neq('kilde', 'manuell')
    if (delErr) return NextResponse.json({ feil: 'Seed feilet (opprydding): ' + delErr.message }, { status: 500 })
    if (rader.length === 0) return NextResponse.json({ suksess: true, skrevet: 0, notat: 'Ingen bevegelser å seede' })
    const { error } = await admin.from('kontantbevegelser').insert(rader)
    if (error) return NextResponse.json({ feil: 'Seed feilet: ' + error.message }, { status: 500 })
    await loggAktivitet({ handling: 'seedet kontantkonto (åpningsbalanse)', tabell: 'kontantbevegelser', detaljer: { antall: rader.length } })
    return NextResponse.json({ suksess: true, skrevet: rader.length })
  } catch (e) {
    console.error('Seed POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Seed feilet' }, { status: 500 })
  }
}
