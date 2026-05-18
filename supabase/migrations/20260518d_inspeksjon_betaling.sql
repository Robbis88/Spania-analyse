-- Fase 3 — Stripe-betaling + påminnelses-spor.
-- Idempotent.

alter table public.inspeksjon_bestillinger
  add column if not exists betaling_status text not null default 'ikke_betalt'
    check (betaling_status in ('ikke_betalt','pending','betalt','abonnement_aktivt','abonnement_avsluttet','feilet','refundert')),
  add column if not exists stripe_session_id      text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id     text,
  add column if not exists betalt_dato            timestamptz,

  -- Påminnelses-spor: hvilke automatiske eposter er sendt på denne bestillingen
  add column if not exists paaminnelse_24t_sendt  timestamptz,
  add column if not exists rapport_epost_sendt    timestamptz;

create index if not exists inspeksjon_bestillinger_stripe_session_idx
  on public.inspeksjon_bestillinger (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists inspeksjon_bestillinger_stripe_sub_idx
  on public.inspeksjon_bestillinger (stripe_subscription_id)
  where stripe_subscription_id is not null;
