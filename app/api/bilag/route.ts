import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import { BILAG_BUCKET } from '../../lib/bilag'
import type { Bilag } from '../../types'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Felt en bruker/importør kan sette. Beregnede/systemfelt (status-overganger,
// godkjent_*) styres via egne flagg for å holde livssyklusen ryddig.
const SKRIVBARE: (keyof Bilag)[] = [
  'selskap_id', 'prosjekt_id', 'leverandor', 'faktura_dato', 'forfall_dato',
  'belop', 'mva', 'valuta', 'bilagsnummer', 'fakturanummer', 'kategori',
  'underkategori', 'kilde', 'ekstern_id', 'notat',
]

function plukk(body: Record<string, unknown>): Partial<Bilag> {
  const ut: Record<string, unknown> = {}
  for (const k of SKRIVBARE) if (k in body) ut[k] = body[k]
  return ut as Partial<Bilag>
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const admin = hentSupabaseAdmin()
    const status = req.nextUrl.searchParams.get('status')
    const prosjekt = req.nextUrl.searchParams.get('prosjekt_id')
    let q = admin.from('bilag').select('*').order('opprettet', { ascending: false })
    if (status) q = q.eq('status', status)
    if (prosjekt) q = q.eq('prosjekt_id', prosjekt)
    const { data, error } = await q
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ bilag: data || [] })
  } catch (e) {
    console.error('Bilag GET feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke hente bilag' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json() as Record<string, unknown>
    const admin = hentSupabaseAdmin()
    const felt = plukk(body)

    // Statusoverganger: 'laas' låser til prosjektregnskapet; 'status' kan settes
    // direkte (f.eks. 'godkjent'/'avvist'). godkjent_av/-tid stemples ved lås.
    const oppdatering: Record<string, unknown> = { ...felt }
    if (body.laas === true) {
      oppdatering.status = 'laast'
      oppdatering.godkjent_av = auth.bruker
      oppdatering.godkjent_tid = new Date().toISOString()
    } else if (typeof body.status === 'string' && ['ny', 'foreslatt', 'godkjent', 'laast', 'avvist'].includes(body.status)) {
      oppdatering.status = body.status
      if (body.status === 'godkjent') { oppdatering.godkjent_av = auth.bruker; oppdatering.godkjent_tid = new Date().toISOString() }
    }

    if (typeof body.id === 'string' && body.id) {
      const { error } = await admin.from('bilag').update(oppdatering).eq('id', body.id)
      if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
      return NextResponse.json({ suksess: true, id: body.id })
    }

    const id = nyId()
    const { error } = await admin.from('bilag').insert([{
      id, bruker: auth.bruker,
      valuta: (felt.valuta === 'EUR' || felt.valuta === 'NOK') ? felt.valuta : 'NOK',
      kilde: (felt.kilde as string) || 'manuell',
      status: 'ny',
      ...felt,
    }])
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ suksess: true, id })
  } catch (e) {
    console.error('Bilag POST feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke lagre bilag' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    const admin = hentSupabaseAdmin()
    const { data: rad } = await admin.from('bilag').select('storage_sti').eq('id', id).maybeSingle()
    if (rad?.storage_sti) await admin.storage.from(BILAG_BUCKET).remove([rad.storage_sti])
    const { error } = await admin.from('bilag').delete().eq('id', id)
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Bilag DELETE feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Kunne ikke slette bilag' }, { status: 500 })
  }
}
