import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../../lib/supabaseAdmin'

// Public-rute — kunden henter sine egne bestillinger via tilfeldig token.
// Token er privat og distribueres kun via bekreftelses-side / e-post.

type Params = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params
    if (!token || token.length < 12) {
      return NextResponse.json({ feil: 'Ugyldig token' }, { status: 400 })
    }

    const supabase = hentSupabaseAdmin()

    const { data: bestillinger, error: bErr } = await supabase
      .from('inspeksjon_bestillinger')
      .select('id, opprettet, kunde_navn, kunde_epost, adresse, kompleks, leilighet_nr, storrelse, tjeneste_type, pris_eur, onsket_dato, status, planlagt_tidspunkt')
      .eq('kunde_token', token)
      .order('opprettet', { ascending: false })

    if (bErr || !bestillinger || bestillinger.length === 0) {
      return NextResponse.json({ feil: 'Ingen bestillinger funnet for denne lenken' }, { status: 404 })
    }

    const bestillingIder = bestillinger.map(b => b.id)

    const [rRes, tRes] = await Promise.all([
      supabase
        .from('inspeksjon_rapporter')
        .select('id, bestilling_id, opprettet, besokt_dato, oppsummering, anbefalinger')
        .in('bestilling_id', bestillingIder)
        .order('opprettet', { ascending: false }),
      supabase
        .from('inspeksjon_tilbud')
        .select('id, bestilling_id, opprettet, tittel, beskrivelse, pris_eur, estimert_dager, status, sendt_tidspunkt')
        .in('bestilling_id', bestillingIder)
        .order('opprettet', { ascending: false }),
    ])

    return NextResponse.json({
      kunde: {
        navn: bestillinger[0].kunde_navn,
        epost: bestillinger[0].kunde_epost,
      },
      bestillinger,
      rapporter: rRes.data || [],
      tilbud: tRes.data || [],
    })
  } catch (e) {
    console.error('Kunde-portal-feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Noe gikk galt' }, { status: 500 })
  }
}
