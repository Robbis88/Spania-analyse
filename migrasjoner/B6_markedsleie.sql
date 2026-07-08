-- Fase B6 — markedsleie per eiendom (for "øk leien"-flagget i porteføljerangering)
-- Idempotent.

begin;

alter table prosjekter add column if not exists markedsleie_mnd numeric;

commit;
