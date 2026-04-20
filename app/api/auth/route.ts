import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { passord } = await req.json()
  const forventet = process.env.APP_PASSWORD
  if (!forventet) return NextResponse.json({ ok: false, feil: 'APP_PASSWORD er ikke satt' }, { status: 500 })
  return NextResponse.json({ ok: passord === forventet })
}
