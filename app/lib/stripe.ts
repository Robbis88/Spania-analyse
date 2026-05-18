// Stripe-klient — lazy init slik at appen kan bygges uten STRIPE_SECRET_KEY,
// og slik at endepunktene gir en tydelig feilmelding hvis env-var mangler.

import Stripe from 'stripe'
import type { TjenesteType } from './inspeksjon'

let klient: Stripe | null = null

export function hentStripe(): Stripe {
  if (klient) return klient
  const noekkel = process.env.STRIPE_SECRET_KEY
  if (!noekkel) throw new Error('STRIPE_SECRET_KEY er ikke satt')
  klient = new Stripe(noekkel)
  return klient
}

export function harStripeKonfig(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// Map tjeneste-type til Stripe recurring-konfig.
// Bruker inline-objekt-typing for å unngå nested Stripe namespace-feilen i SDK-en.
type Recurring = { interval: 'month' | 'year' | 'week' | 'day'; interval_count?: number }

export function stripeIntervall(tjeneste: TjenesteType): Recurring | undefined {
  if (tjeneste === 'manedlig_visuell') return { interval: 'month', interval_count: 1 }
  if (tjeneste === 'kvartalsvis_grundig') return { interval: 'month', interval_count: 3 }
  return undefined  // engangs
}
