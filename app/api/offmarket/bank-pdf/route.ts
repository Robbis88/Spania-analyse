import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { byggBankPdf } from '../../../lib/pdfOffmarketBank'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { prosjektId } = await req.json()
    if (typeof prosjektId !== 'string' || !prosjektId) {
      return NextResponse.json({ feil: 'prosjektId mangler' }, { status: 400 })
    }
    const admin = hentSupabaseAdmin()
    const resultat = await byggBankPdf(prosjektId, admin)
    if (!resultat) return NextResponse.json({ feil: 'Prosjekt ikke funnet eller ikke off-market' }, { status: 404 })

    await admin.from('aktivitetslogg').insert([{
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      bruker: auth.bruker,
      handling: 'lastet ned bankvennlig off-market PDF',
      tabell: 'prosjekter',
      rad_id: prosjektId,
      detaljer: { filnavn: resultat.filnavn },
    }])

    return NextResponse.json(resultat)
  } catch (e) {
    console.error('Bank-PDF-feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'PDF-bygging feilet' }, { status: 500 })
  }
}
