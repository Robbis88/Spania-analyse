import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { hentResendKlient, FRA_ADRESSE, byggHtmlFraTekst } from '../../../lib/epost'

// Vercel Cron: kjøres daglig kl 09:00 (se vercel.json). Sender automatisk
// påminnelse til kunden 24t før planlagt besøk, og en daglig oversikt over
// dagens jobber til inspektøren.
//
// Beskyttet av CRON_SECRET i Authorization-headeren (Vercel Cron sender det).

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Vercel Cron har egen autentisering via Authorization: Bearer $CRON_SECRET
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ feil: 'Ikke autorisert' }, { status: 401 })
  }

  try {
    const supabase = hentSupabaseAdmin()

    // Finn alle planlagte besøk de neste 24-48 timene som ikke har fått påminnelse ennå
    const naa = new Date()
    const om24 = new Date(naa.getTime() + 24 * 3600 * 1000)
    const om48 = new Date(naa.getTime() + 48 * 3600 * 1000)

    const { data: bestillinger, error } = await supabase
      .from('inspeksjon_bestillinger')
      .select('id, kunde_navn, kunde_epost, kunde_sprak, adresse, leilighet_nr, kompleks, planlagt_tidspunkt, tjeneste_type, paaminnelse_24t_sendt, kunde_token')
      .eq('status', 'planlagt')
      .is('paaminnelse_24t_sendt', null)
      .gte('planlagt_tidspunkt', om24.toISOString())
      .lte('planlagt_tidspunkt', om48.toISOString())

    if (error) {
      console.error('Påminnelses-query feilet:', error.message)
      return NextResponse.json({ feil: error.message }, { status: 500 })
    }

    const sendte: string[] = []
    const feilet: Array<{ id: string; feil: string }> = []

    if (bestillinger && bestillinger.length > 0) {
      const resend = process.env.RESEND_API_KEY ? hentResendKlient() : null
      if (!resend) {
        return NextResponse.json({ feil: 'RESEND_API_KEY mangler — kan ikke sende' }, { status: 503 })
      }

      for (const b of bestillinger) {
        try {
          const tid = b.planlagt_tidspunkt
            ? new Date(b.planlagt_tidspunkt).toLocaleString('nb-NO', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
            : 'i morgen'

          const fornavn = b.kunde_navn.split(' ')[0]
          const sprak = (b.kunde_sprak || 'no') as 'no' | 'en' | 'es'
          const portalUrl = b.kunde_token ? `https://www.loeiendom.com/inspeksjon/min/${b.kunde_token}` : ''

          const tekst = sprak === 'en'
            ? `Hi ${fornavn},\n\nA reminder that we're coming to inspect your apartment at ${b.adresse}${b.leilighet_nr ? `, ${b.leilighet_nr}` : ''} ${tid}.\n\nIf the time doesn't work, please reply to this email as soon as possible.\n\nYou can see all your bookings and reports here:\n${portalUrl}\n\nBest regards,\nLeganger & Osvaag`
            : sprak === 'es'
            ? `Hola ${fornavn},\n\nTe recordamos que vendremos a inspeccionar tu apartamento en ${b.adresse}${b.leilighet_nr ? `, ${b.leilighet_nr}` : ''} el ${tid}.\n\nSi el horario no te funciona, responde a este correo lo antes posible.\n\nPuedes ver todas tus reservas e informes aquí:\n${portalUrl}\n\nSaludos cordiales,\nLeganger & Osvaag`
            : `Hei ${fornavn},\n\nDette er en påminnelse om at vi kommer for å inspisere leiligheten din i ${b.adresse}${b.leilighet_nr ? `, ${b.leilighet_nr}` : ''} ${tid}.\n\nHvis tidspunktet ikke passer, vennligst svar på denne e-posten så snart som mulig.\n\nDu kan se alle dine bestillinger og rapporter her:\n${portalUrl}\n\nMvh,\nLeganger & Osvaag`

          const emne = sprak === 'en'
            ? 'Reminder: inspection tomorrow'
            : sprak === 'es'
            ? 'Recordatorio: inspección mañana'
            : 'Påminnelse: inspeksjon i morgen'

          await resend.emails.send({
            from: FRA_ADRESSE,
            to: b.kunde_epost,
            subject: emne,
            text: tekst,
            html: byggHtmlFraTekst(tekst),
          })

          await supabase
            .from('inspeksjon_bestillinger')
            .update({ paaminnelse_24t_sendt: new Date().toISOString() })
            .eq('id', b.id)

          sendte.push(b.id)
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          feilet.push({ id: b.id, feil: m })
          console.error(`Påminnelse til ${b.id} feilet:`, m)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      sjekket: bestillinger?.length || 0,
      sendt: sendte.length,
      feilet: feilet.length,
      detaljer: feilet,
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Påminnelses-cron feilet:', m)
    return NextResponse.json({ feil: m }, { status: 500 })
  }
}
