-- Lagrer hele kalkulator-state for norske flippe-prosjekter (kalk, boPlan,
-- eksisterende-bolig, utleie-del, oppussingsposter, ev. analyse-objekt fra AI)
-- så brukeren kan komme tilbake og fortsette/redigere. Idempotent.

alter table public.prosjekter
  add column if not exists norsk_kalkulator_data jsonb;
