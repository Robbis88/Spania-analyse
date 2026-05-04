import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { byggCashflowPdf } from '../../../lib/pdfCashflow'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { prosjekt_id, ar } = await req.json()
    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }
    const arNum = Number(ar)
    if (!Number.isInteger(arNum) || arNum < 2000 || arNum > 2100) {
      return NextResponse.json({ feil: 'Ugyldig år' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const resultat = await byggCashflowPdf(prosjekt_id, arNum, admin)
    if (!resultat) return NextResponse.json({ feil: 'Eiendom ikke funnet' }, { status: 404 })

    await admin.from('aktivitetslogg').insert([{
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      bruker: auth.bruker,
      handling: 'lastet ned cashflow-PDF',
      tabell: 'prosjekter',
      rad_id: prosjekt_id,
      detaljer: { ar: arNum, filnavn: resultat.filnavn },
    }])

    return NextResponse.json(resultat)
  } catch (e) {
    console.error('Cashflow PDF feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'PDF-bygging feilet' }, { status: 500 })
  }
}
