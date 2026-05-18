-- Kunde-portal-token for inspeksjonsbestillinger.
-- Lar kunden åpne sin egen oversiktsside via /inspeksjon/min/<token>
-- uten innlogging — token genereres tilfeldig ved booking og er privat.
-- Idempotent.

alter table public.inspeksjon_bestillinger
  add column if not exists kunde_token text;

-- Unike token-er (ignorerer null-verdier slik at gamle rader uten token er OK)
create unique index if not exists inspeksjon_bestillinger_kunde_token_idx
  on public.inspeksjon_bestillinger (kunde_token)
  where kunde_token is not null;
