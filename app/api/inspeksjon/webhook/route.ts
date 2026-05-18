import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { hentStripe, harStripeKonfig } from '../../../lib/stripe'
import type Stripe from 'stripe'

// Stripe webhook — oppdaterer betaling_status på inspeksjons-bestillinger
// basert på events fra Stripe. Signaturen valideres via STRIPE_WEBHOOK_SECRET.
//
// I Vercel kreves det at vi henter raw body for signaturvalideringen, derfor
// `req.text()` og ikke `req.json()`.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!harStripeKonfig()) {
      return NextResponse.json({ feil: 'Stripe er ikke konfigurert' }, { status: 503 })
    }
    const signaturNoekkel = process.env.STRIPE_WEBHOOK_SECRET
    if (!signaturNoekkel) {
      return NextResponse.json({ feil: 'STRIPE_WEBHOOK_SECRET er ikke satt' }, { status: 503 })
    }

    const rawBody = await req.text()
    const sig = req.headers.get('stripe-signature') || ''
    const stripe = hentStripe()
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, signaturNoekkel)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      console.error('Webhook signatur-feil:', m)
      return NextResponse.json({ feil: 'Ugyldig signatur' }, { status: 400 })
    }

    const supabase = hentSupabaseAdmin()

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const bestillingId = session.metadata?.bestilling_id
      if (bestillingId) {
        const erAbo = session.mode === 'subscription'
        await supabase
          .from('inspeksjon_bestillinger')
          .update({
            betaling_status: erAbo ? 'abonnement_aktivt' : 'betalt',
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
            stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
            betalt_dato: new Date().toISOString(),
          })
          .eq('id', bestillingId)
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('inspeksjon_bestillinger')
        .update({ betaling_status: 'abonnement_avsluttet' })
        .eq('stripe_subscription_id', sub.id)
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      const bestillingId = session.metadata?.bestilling_id
      if (bestillingId) {
        await supabase
          .from('inspeksjon_bestillinger')
          .update({ betaling_status: 'feilet' })
          .eq('id', bestillingId)
      }
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge
      const sessionId = typeof charge.payment_intent === 'string' ? null : null  // ikke direkte mappe
      if (sessionId) void sessionId  // placeholder — krever payment_intent → session-oppslag
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Webhook-feil:', m)
    return NextResponse.json({ feil: m }, { status: 500 })
  }
}
