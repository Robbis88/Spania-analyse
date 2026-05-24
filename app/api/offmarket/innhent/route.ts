import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/requireAuth'
import { sokAdresse } from '../../../lib/offmarket'

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { adresse } = await req.json()
    if (typeof adresse !== 'string' || !adresse.trim()) {
      return NextResponse.json({ feil: 'Adresse mangler' }, { status: 400 })
    }
    const res = await sokAdresse(adresse)
    if ('feil' in res) return NextResponse.json({ feil: res.feil }, { status: 404 })
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Offmarket innhent-feil:', m)
    return NextResponse.json({ feil: m }, { status: 500 })
  }
}
