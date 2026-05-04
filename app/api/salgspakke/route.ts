import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import { byggSalgspakkePdf, type SalgspakkeOpt } from '../../lib/pdfSalgspakke'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

export const maxDuration = 60  // PDF + bildelasting kan ta tid

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json()
    const prosjekt_id = body?.prosjekt_id
    const opt = (body?.opt || {}) as SalgspakkeOpt

    if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
      return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()
    const resultat = await byggSalgspakkePdf(prosjekt_id, admin, opt)
    if (!resultat) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: auth.bruker,
      handling: 'genererte salgspakke-PDF',
      tabell: 'prosjekter',
      rad_id: prosjekt_id,
      detaljer: { filnavn: resultat.filnavn, opt },
    }])

    return NextResponse.json(resultat)
  } catch (e) {
    console.error('Salgspakke feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Salgspakke-bygging feilet' }, { status: 500 })
  }
}
