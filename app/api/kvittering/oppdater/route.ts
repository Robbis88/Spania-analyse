import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { KVITTERING_KATEGORIER, KVITTERING_ROM } from '../../../lib/kvittering'

const TILLATTE_FELT = new Set([
  'dato', 'belop_eks_mva', 'mva', 'belop_inkl_mva', 'valuta',
  'leverandor', 'leverandor_orgnr', 'dokument_nr',
  'kategori', 'rom', 'oppussing_post_id', 'tagger', 'notat',
])

// Manuell korrigering av felter etter OCR. Klient sender { id, endringer }
// hvor endringer er et delvis kvittering-objekt.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { id, endringer } = await req.json()
    if (typeof id !== 'string' || !id) {
      return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
    }
    if (!endringer || typeof endringer !== 'object') {
      return NextResponse.json({ feil: 'endringer mangler' }, { status: 400 })
    }

    const oppdatering: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(endringer as Record<string, unknown>)) {
      if (!TILLATTE_FELT.has(k)) continue
      if (k === 'kategori' && v !== null && !(KVITTERING_KATEGORIER as readonly string[]).includes(String(v))) continue
      if (k === 'rom' && v !== null && !(KVITTERING_ROM as readonly string[]).includes(String(v))) continue
      if (k === 'valuta' && v !== null && v !== 'NOK' && v !== 'EUR') continue
      if (k === 'tagger' && !Array.isArray(v)) continue
      oppdatering[k] = v
    }

    if (Object.keys(oppdatering).length === 0) {
      return NextResponse.json({ feil: 'Ingen gyldige felt' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const { error } = await admin.from('kvitteringer').update(oppdatering).eq('id', id)
    if (error) return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })

    return NextResponse.json({ suksess: true })
  } catch (e) {
    console.error('Kvittering oppdater feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Oppdatering feilet' }, { status: 500 })
  }
}
