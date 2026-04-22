-- AI-bildeanalyse: nye kolonner på prosjekt_bilder + ny tabell oppussing_tillegg.
-- Idempotent — trygg å kjøre flere ganger.

-- 1) AI-felter på prosjekt_bilder
alter table public.prosjekt_bilder
  add column if not exists ai_beskrivelse        text,
  add column if not exists ai_synlige_problemer  jsonb not null default '[]'::jsonb,
  add column if not exists ai_foreslatte_poster  jsonb not null default '[]'::jsonb,
  add column if not exists ai_potensielle_tillegg jsonb not null default '[]'::jsonb,
  add column if not exists ai_salgbarhet_score   numeric,
  add column if not exists ai_analysert          timestamptz,
  add column if not exists ai_modell_versjon     text;

-- Indekser for oppslag ("hent analyserte bilder for et prosjekt")
create index if not exists prosjekt_bilder_ai_analysert_idx
  on public.prosjekt_bilder (prosjekt_id, ai_analysert)
  where ai_analysert is not null;

-- 2) oppussing_tillegg: godtatte potensial-tillegg (basseng, pergola, osv.)
create table if not exists public.oppussing_tillegg (
  id                      text primary key,
  bolig_id                text not null references public.prosjekter(id) on delete cascade,
  navn                    text not null,
  tillegg_type            text,
  kostnad                 numeric not null default 0,
  verdiokning_estimat     text,
  regulering_vurdering    text check (regulering_vurdering in ('sannsynlig_ok','ma_sjekkes','sannsynlig_problematisk')),
  regulering_begrunnelse  text,
  ma_sjekkes_videre       jsonb,
  notat                   text,
  rekkefolge              integer not null default 0,
  kilde_bilde_id          text references public.prosjekt_bilder(id) on delete set null,
  opprettet               timestamptz not null default now()
);

create index if not exists oppussing_tillegg_bolig_id_idx
  on public.oppussing_tillegg (bolig_id, rekkefolge);

-- RLS: skru på hvis dine øvrige tabeller bruker RLS (f.eks. oppussing_poster).
-- Avkommenter blokken under og tilpass policyen så den matcher resten av skjemaet ditt:
--
-- alter table public.oppussing_tillegg enable row level security;
-- create policy oppussing_tillegg_all on public.oppussing_tillegg
--   for all using (true) with check (true);
