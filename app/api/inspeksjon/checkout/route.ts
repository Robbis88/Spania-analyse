import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { hentStripe, harStripeKonfig, stripeIntervall } from '../../../lib/stripe'
import { TJENESTE_ETIKETT, STORRELSE_ETIKETT, type TjenesteType, type Storrelse } from '../../../lib/inspeksjon'

// Oppretter en Stripe Checkout Session for en gitt bestilling.
// Kunden sendes til Stripe's hosted side, og kommer tilbake til min-side
// etter fullført betaling. Webhook setter betaling_status.

type Body = { bestilling_id?: string }

export async function POST(req: NextRequest) {
  try {
    if (!harStripeKonfig()) {
      return NextResponse.json({ feil: 'Stripe er ikke konfigurert ennå. Kontakt oss for å fullføre betaling.' }, { status: 503 })
    }

    const { bestilling_id } = (await req.json()) as Body
    if (!bestilling_id) return NextResponse.json({ feil: 'Mangler bestilling_id' }, { status: 400 })

    const supabase = hentSupabaseAdmin()
    const { data: b, error } = await supabase
      .from('inspeksjon_bestillinger')
      .select('id, kunde_navn, kunde_epost, adresse, leilighet_nr, storrelse, tjeneste_type, pris_eur, kunde_token, stripe_customer_id')
      .eq('id', bestilling_id)
      .maybeSingle()
    if (error || !b) return NextResponse.json({ feil: 'Bestilling ikke funnet' }, { status: 404 })

    const stripe = hentStripe()
    const tjeneste = b.tjeneste_type as TjenesteType
    const storrelse = b.storrelse as Storrelse
    const erAbo = tjeneste !== 'engangs'

    // Domain base for redirect-URLer
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    const host = req.headers.get('host') || 'www.loeiendom.com'
    const baseUrl = `${proto}://${host}`

    const beskrivelse = `${TJENESTE_ETIKETT[tjeneste]} — ${STORRELSE_ETIKETT[storrelse]}, ${b.adresse}${b.leilighet_nr ? `, ${b.leilighet_nr}` : ''}`

    const session = await stripe.checkout.sessions.create({
      mode: erAbo ? 'subscription' : 'payment',
      customer: b.stripe_customer_id || undefined,
      customer_email: b.stripe_customer_id ? undefined : b.kunde_epost,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(b.pris_eur) * 100),
          product_data: {
            name: TJENESTE_ETIKETT[tjeneste],
            description: beskrivelse.slice(0, 250),
          },
          recurring: stripeIntervall(tjeneste),
        },
      }],
      success_url: `${baseUrl}/inspeksjon/min/${b.kunde_token}?betalt=1`,
      cancel_url: `${baseUrl}/inspeksjon/min/${b.kunde_token}?avbrutt=1`,
      metadata: { bestilling_id: b.id, kunde_token: b.kunde_token || '' },
      ...(erAbo ? { subscription_data: { metadata: { bestilling_id: b.id } } } : {}),
    })

    // Marker bestilling som pending
    await supabase
      .from('inspeksjon_bestillinger')
      .update({ stripe_session_id: session.id, betaling_status: 'pending' })
      .eq('id', b.id)

    return NextResponse.json({ ok: true, url: session.url })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Stripe checkout-feil:', m)
    return NextResponse.json({ feil: m }, { status: 500 })
  }
}
