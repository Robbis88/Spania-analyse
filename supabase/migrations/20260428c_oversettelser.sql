-- Pre-oversettelser for portal-feltene. Lagres som JSONB med språk-koder
-- som nøkler: { en: "...", es: "...", de: "...", ... }
-- Idempotent.

alter table public.prosjekter
  add column if not exists navn_oversettelser jsonb,
  add column if not exists utleie_kort_oversettelser jsonb,
  add column if not exists utleie_beskrivelse_oversettelser jsonb,
  add column if not exists salg_kort_oversettelser jsonb,
  add column if not exists salg_beskrivelse_oversettelser jsonb,
  add column if not exists utleie_fasiliteter_oversettelser jsonb,
  add column if not exists oversettelser_oppdatert timestamptz;
