import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'
import {
  FRA_ADRESSE, byggInnholdMedSignatur, erGyldigFormaal, erGyldigMottakerType,
  hentResendKlient, validerEpostadresse,
} from '../../../lib/epost'

const nyId = () => Date.now().toString()
const nyLoggId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      til,
      emne,
      innhold,
      formaal,
      mottaker_navn,
      mottaker_type,
      sprak,
      relatert_prosjekt_id,
      sendt_av,
      vedlegg_pdf_base64,
      vedlegg_filnavn,
      bruker_endret,
    } = body as Record<string, unknown>

    if (!validerEpostadresse(String(til))) {
      return NextResponse.json({ suksess: false, feil: 'Ugyldig e-postadresse' }, { status: 400 })
    }
    if (!sendt_av || typeof sendt_av !== 'string') {
      return NextResponse.json({ suksess: false, feil: 'sendt_av mangler' }, { status: 400 })
    }
    if (!erGyldigFormaal(formaal)) {
      return NextResponse.json({ suksess: false, feil: 'Ugyldig formål' }, { status: 400 })
    }
    if (!emne || typeof emne !== 'string' || !innhold || typeof innhold !== 'string') {
      return NextResponse.json({ suksess: false, feil: 'Emne og innhold kan ikke være tomme' }, { status: 400 })
    }
    if (mottaker_type !== undefined && mottaker_type !== null && !erGyldigMottakerType(mottaker_type)) {
      return NextResponse.json({ suksess: false, feil: 'Ugyldig mottaker_type' }, { status: 400 })
    }

    const innholdSendt = byggInnholdMedSignatur(innhold, sendt_av)
    const epostId = nyId()
    const harVedlegg = typeof vedlegg_pdf_base64 === 'string' && vedlegg_pdf_base64.length > 0
    const filnavn = harVedlegg ? (typeof vedlegg_filnavn === 'string' ? vedlegg_filnavn : 'Analyse.pdf') : null

    let klient
    try {
      klient = hentResendKlient()
    } catch (e) {
      const melding = e instanceof Error ? e.message : 'RESEND_API_KEY mangler'
      return NextResponse.json({ suksess: false, feil: melding }, { status: 500 })
    }

    let resendId: string | null = null
    let status: 'sendt' | 'feilet' = 'sendt'
    let feilmelding: string | null = null

    try {
      const res = await klient.emails.send({
        from: FRA_ADRESSE,
        to: [String(til)],
        subject: emne,
        text: innholdSendt,
        attachments: harVedlegg
          ? [{ filename: filnavn || 'Analyse.pdf', content: vedlegg_pdf_base64 as string }]
          : undefined,
      })
      if (res.error) {
        status = 'feilet'
        feilmelding = res.error.message || 'Resend returnerte feil'
      } else if (res.data) {
        resendId = res.data.id
      }
    } catch (e) {
      status = 'feilet'
      feilmelding = e instanceof Error ? e.message : String(e)
    }

    const rad = {
      id: epostId,
      til: String(til),
      mottaker_navn: typeof mottaker_navn === 'string' ? mottaker_navn : null,
      mottaker_type: typeof mottaker_type === 'string' ? mottaker_type : null,
      formaal,
      fra: 'post@loeiendom.com',
      emne,
      innhold,
      innhold_sendt: innholdSendt,
      sprak: typeof sprak === 'string' ? sprak : null,
      status,
      resend_id: resendId,
      feilmelding,
      bruker_endret: !!bruker_endret,
      har_vedlegg: harVedlegg,
      vedlegg_filnavn: filnavn,
      sendt_av,
      relatert_prosjekt_id: typeof relatert_prosjekt_id === 'string' ? relatert_prosjekt_id : null,
      sendt_tidspunkt: status === 'sendt' ? new Date().toISOString() : null,
    }
    await supabase.from('eposter').insert([rad])

    await supabase.from('aktivitetslogg').insert([{
      id: nyLoggId(),
      bruker: sendt_av,
      handling: status === 'sendt' ? 'sendte e-post' : 'e-post feilet',
      tabell: 'eposter',
      rad_id: epostId,
      detaljer: {
        til: String(til),
        emne,
        formaal,
        mottaker_type: typeof mottaker_type === 'string' ? mottaker_type : null,
        har_vedlegg: harVedlegg,
        relatert_prosjekt_id: typeof relatert_prosjekt_id === 'string' ? relatert_prosjekt_id : null,
      },
    }])

    if (status === 'sendt') {
      return NextResponse.json({ suksess: true, id: epostId, resend_id: resendId })
    }
    return NextResponse.json({ suksess: false, feil: feilmelding, id: epostId }, { status: 502 })
  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error)
    console.error('E-post send feil:', melding)
    return NextResponse.json({ suksess: false, feil: melding }, { status: 500 })
  }
}
