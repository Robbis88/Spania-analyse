import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { brukernavn, passord } = await req.json()
  const forventetBrukernavn = process.env.APP_USERNAME
  const forventetPassord = process.env.APP_PASSWORD
  if (!forventetBrukernavn || !forventetPassord) {
    return NextResponse.json({ ok: false, feil: 'APP_USERNAME eller APP_PASSWORD er ikke satt' }, { status: 500 })
  }
  return NextResponse.json({ ok: brukernavn === forventetBrukernavn && passord === forventetPassord })
}
