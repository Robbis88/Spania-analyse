import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { FRA_ADRESSE, byggHtmlFraTekst, hentResendKlient, validerEpostadresse } from '../../../lib/epost'

const MOTTAKER_INTERN = process.env.UTLEIE_FORESPORSEL_EPOST || 'post@loeiendom.com'

// Mottar booking-forespørsler fra publikum. Sender e-post til oss og lagrer
// i utleie_foresporsler. Bekrefter ikke til avsender ennå — det er steg 2.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const navn = String(body?.navn || '').trim()
    const epost = String(body?.epost || '').trim()
    const telefon = body?.telefon ? String(body.telefon).trim() : null
    const fra_dato = body?.fra_dato ? String(body.fra_dato) : null
    const til_dato = body?.til_dato ? String(body.til_dato) : null
    const antall_gjester = Number.isFinite(Number(body?.antall_gjester)) ? Number(body.antall_gjester) : null
    const melding = body?.melding ? String(body.melding).trim() : null
    const prosjekt_id = body?.prosjekt_id ? String(body.prosjekt_id) : null

    if (!navn) return NextResponse.json({ feil: 'Navn mangler' }, { status: 400 })
    if (!validerEpostadresse(epost)) return NextResponse.json({ feil: 'Ugyldig e-post' }, { status: 400 })

    const admin = hentSupabaseAdmin()

    let prosjektNavn = ''
    if (prosjekt_id) {
      const { data: p } = await admin.from('prosjekter')
        .select('navn, publisert_utleie')
        .eq('id', prosjekt_id)
        .maybeSingle()
      if (!p || !p.publisert_utleie) {
        return NextResponse.json({ feil: 'Ukjent bolig' }, { status: 404 })
      }
      prosjektNavn = p.navn
    }

    const linjer = [
      `Ny utleieforespørsel fra ${navn} <${epost}>`,
      telefon ? `Telefon: ${telefon}` : null,
      prosjektNavn ? `Bolig: ${prosjektNavn}` : null,
      fra_dato || til_dato ? `Periode: ${fra_dato || '?'} til ${til_dato || '?'}` : null,
      antall_gjester ? `Antall gjester: ${antall_gjester}` : null,
      '',
      melding ? `Melding:\n${melding}` : '(ingen melding)',
    ].filter((l): l is string => l !== null)
    const tekst = linjer.join('\n')

    let resendId: string | null = null
    let feilmelding: string | null = null
    try {
      const klient = hentResendKlient()
      const res = await klient.emails.send({
        from: FRA_ADRESSE,
        to: [MOTTAKER_INTERN],
        replyTo: epost,
        subject: `Utleieforespørsel${prosjektNavn ? ' – ' + prosjektNavn : ''}`,
        text: tekst,
        html: byggHtmlFraTekst(tekst),
      })
      if (res.error) feilmelding = res.error.message || 'Resend-feil'
      else if (res.data) resendId = res.data.id
    } catch (e) {
      feilmelding = e instanceof Error ? e.message : String(e)
    }

    await admin.from('utleie_foresporsler').insert([{
      prosjekt_id,
      navn,
      epost,
      telefon,
      fra_dato,
      til_dato,
      antall_gjester,
      melding,
      sendt_til_epost: feilmelding ? null : MOTTAKER_INTERN,
      resend_id: resendId,
    }])

    if (feilmelding) return NextResponse.json({ feil: feilmelding }, { status: 502 })
    return NextResponse.json({ suksess: true })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
