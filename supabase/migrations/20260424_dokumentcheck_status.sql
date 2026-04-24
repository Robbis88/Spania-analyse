-- Bruker-fremdrift på AI-genererte dokumentcheck-rader (huket av + notater).
-- Holdes separat fra salgsanalyse_data så regenerering av analysen ikke
-- overskriver brukerens progresjon og notater.
-- Idempotent — trygg å kjøre flere ganger.

alter table public.prosjekter
  add column if not exists dokumentcheck_status jsonb;
