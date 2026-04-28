-- Offentlig utleie-portal: legger til publisering og marketing-flagg.
-- Kun prosjekter med publisert_utleie = true vises offentlig, og kun bilder
-- med er_marketing = true brukes i portalen. Idempotent.

alter table public.prosjekter
  add column if not exists publisert_utleie boolean not null default false,
  add column if not exists utleie_pris_natt numeric,
  add column if not exists utleie_pris_uke numeric,
  add column if not exists utleie_min_netter integer,
  add column if not exists utleie_maks_gjester integer,
  add column if not exists utleie_beskrivelse text,
  add column if not exists utleie_kort_beskrivelse text,
  add column if not exists utleie_fasiliteter text[];

create index if not exists idx_prosjekter_publisert_utleie
  on public.prosjekter (publisert_utleie)
  where publisert_utleie = true;

alter table public.prosjekt_bilder
  add column if not exists er_marketing boolean not null default false,
  add column if not exists marketing_rekkefolge integer;

create index if not exists idx_prosjekt_bilder_marketing
  on public.prosjekt_bilder (prosjekt_id, marketing_rekkefolge)
  where er_marketing = true;

-- Logg over forespørsler fra publikum slik at vi har historikk og kan
-- følge opp uten å være avhengig av e-post-innboks.
create table if not exists public.utleie_foresporsler (
  id uuid primary key default gen_random_uuid(),
  prosjekt_id text references public.prosjekter(id) on delete set null,
  navn text not null,
  epost text not null,
  telefon text,
  fra_dato date,
  til_dato date,
  antall_gjester integer,
  melding text,
  sendt_til_epost text,
  resend_id text,
  opprettet timestamptz not null default now()
);

create index if not exists idx_utleie_foresporsler_opprettet
  on public.utleie_foresporsler (opprettet desc);
