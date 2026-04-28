import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { FRA_ADRESSE, byggHtmlFraTekst, hentResendKlient, validerEpostadresse } from '../../../lib/epost'

const MOTTAKER_INTERN = process.env.UTLEIE_FORESPORSEL_EPOST || 'post@loeiendom.com'
const GYLDIG_INTERESSE = ['kjop', 'leie', 'begge'] as const

// Generell interesse-registrering — fra "Register interest"-CTA i header.
// Skiller seg fra /foresporsel ved at den ikke er knyttet til en bestemt
// dato eller spesifikk bolig (selv om prosjekt_id kan være med).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const navn = String(body?.navn || '').trim()
    const epost = String(body?.epost || '').trim()
    const telefon = body?.telefon ? String(body.telefon).trim() : null
    const interesse = body?.interesse && (GYLDIG_INTERESSE as readonly string[]).includes(String(body.interesse))
      ? String(body.interesse) : null
    const region = body?.region ? String(body.region).trim() : null
    const budsjett = Number.isFinite(Number(body?.budsjett_eur)) ? Number(body.budsjett_eur) : null
    const melding = body?.melding ? String(body.melding).trim() : null
    const prosjekt_id = body?.prosjekt_id ? String(body.prosjekt_id) : null
    const sprak = body?.sprak ? String(body.sprak).slice(0, 5) : null

    if (!navn) return NextResponse.json({ feil: 'Navn mangler' }, { status: 400 })
    if (!validerEpostadresse(epost)) return NextResponse.json({ feil: 'Ugyldig e-post' }, { status: 400 })

    const admin = hentSupabaseAdmin()

    let prosjektNavn = ''
    if (prosjekt_id) {
      const { data: p } = await admin.from('prosjekter')
        .select('navn, publisert_utleie, publisert_salg')
        .eq('id', prosjekt_id)
        .maybeSingle()
      if (!p || (!p.publisert_utleie && !p.publisert_salg)) {
        return NextResponse.json({ feil: 'Ukjent bolig' }, { status: 404 })
      }
      prosjektNavn = p.navn
    }

    const interesseEtikett = interesse === 'kjop' ? 'Vil kjøpe'
      : interesse === 'leie' ? 'Vil leie'
      : interesse === 'begge' ? 'Begge (kjøp / leie)'
      : '(ikke spesifisert)'

    const linjer = [
      `Ny interesse-registrering fra ${navn} <${epost}>`,
      telefon ? `Telefon: ${telefon}` : null,
      `Interesse: ${interesseEtikett}`,
      prosjektNavn ? `Knyttet til bolig: ${prosjektNavn}` : null,
      region ? `Ønsket område: ${region}` : null,
      budsjett ? `Budsjett: €${Math.round(budsjett).toLocaleString('en-US')}` : null,
      sprak ? `Språk: ${sprak}` : null,
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
        subject: `Interesse-registrering${prosjektNavn ? ' – ' + prosjektNavn : ''}`,
        text: tekst,
        html: byggHtmlFraTekst(tekst),
      })
      if (res.error) feilmelding = res.error.message || 'Resend-feil'
      else if (res.data) resendId = res.data.id
    } catch (e) {
      feilmelding = e instanceof Error ? e.message : String(e)
    }

    await admin.from('interesse_registreringer').insert([{
      navn, epost, telefon, interesse, region,
      budsjett_eur: budsjett,
      melding, prosjekt_id, sprak,
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
