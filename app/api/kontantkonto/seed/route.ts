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
// Startkapital = dagens (stale) fri_likviditet-felt, som nettopp ER den innskutte
// egenkapitalen. Alt annet (lån, kjøp, omkostninger, oppussing) trekkes fra den.
async function byggSeed(): Promise<{ rader: SeedRad[]; saldoPerSelskap: Record<string, number> }> {
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

    // 1) Startkapital (innskutt egenkapital)
    if ((s.fri_likviditet || 0) > 0) {
      rader.push({
        selskap_id: s.id, prosjekt_id: null, dato: startdato, type: 'innskudd',
        belop: s.fri_likviditet || 0, valuta: val, kilde: 'seed', kilde_id: s.id,
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
      if ((e.oppussing_faktisk || 0) > 0) {
        rader.push({ selskap_id: s.id, prosjekt_id: e.id, dato: kjopsdato, type: 'oppussing', belop: -(e.oppussing_faktisk || 0), valuta: val, kilde: 'kjop_registrering', kilde_id: e.id, notat: `Oppussing (faktisk hittil) ${e.navn}` })
      }
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

// POST: commit idempotent (unique(kilde, kilde_id, type) hindrer duplikater ved re-kjøring).
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { rader } = await byggSeed()
    if (rader.length === 0) return NextResponse.json({ suksess: true, skrevet: 0, notat: 'Ingen bevegelser å seede' })
    const admin = hentSupabaseAdmin()
    const { error } = await admin
      .from('kontantbevegelser')
      .upsert(rader, { onConflict: 'kilde,kilde_id,type', ignoreDuplicates: true })
    if (error) return NextResponse.json({ feil: 'Seed feilet: ' + error.message }, { status: 500 })
    await loggAktivitet({ handling: 'seedet kontantkonto (åpningsbalanse)', tabell: 'kontantbevegelser', detaljer: { antall: rader.length } })
    return NextResponse.json({ suksess: true, skrevet: rader.length })
  } catch (e) {
    console.error('Seed POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Seed feilet' }, { status: 500 })
  }
}
