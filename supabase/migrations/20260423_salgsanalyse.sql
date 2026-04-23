-- Cache av AI-generert salgsanalyse per prosjekt.
-- Idempotent — trygg å kjøre flere ganger.

alter table public.prosjekter
  add column if not exists salgsanalyse_data jsonb,
  add column if not exists salgsanalyse_generert timestamptz,
  add column if not exists salgsanalyse_modell_versjon text;
