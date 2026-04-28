-- Utvider portalen til å støtte salgsboliger i tillegg til utleie,
-- og legger til en generell interesse-registrering (uavhengig av bolig).
-- Idempotent.

alter table public.prosjekter
  add column if not exists publisert_salg boolean not null default false,
  add column if not exists salgspris_eur numeric,
  add column if not exists salg_kort_beskrivelse text,
  add column if not exists salg_beskrivelse text,
  add column if not exists byggear integer,
  add column if not exists tomt_m2 numeric,
  add column if not exists kort_avstand jsonb;

create index if not exists idx_prosjekter_publisert_salg
  on public.prosjekter (publisert_salg)
  where publisert_salg = true;

-- Generell interesse-registrering (når besøkende klikker «Register interest»
-- uten å være på en spesifikk bolig). Bolig-spesifikke forespørsler bruker
-- fortsatt utleie_foresporsler.
create table if not exists public.interesse_registreringer (
  id uuid primary key default gen_random_uuid(),
  navn text not null,
  epost text not null,
  telefon text,
  interesse text,             -- 'kjop' | 'leie' | 'begge' | null
  region text,                -- f.eks. 'Marbella', 'Costa Blanca' — fritekst
  budsjett_eur numeric,
  melding text,
  prosjekt_id text references public.prosjekter(id) on delete set null,
  sprak text,
  sendt_til_epost text,
  resend_id text,
  opprettet timestamptz not null default now()
);

create index if not exists idx_interesse_registreringer_opprettet
  on public.interesse_registreringer (opprettet desc);
