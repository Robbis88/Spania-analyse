-- Min portefølje — eieroversikt etter kjøp.
-- Bygger på eksisterende prosjekter-tabell (gjenbruker bilder/dokumenter/
-- kvitteringer/oppussing). Spesialiserte tabeller for lån, inntekter,
-- kostnader, leietakere, verdivurderinger og månedlig cashflow-logg.
--
-- Tabellene er marked-agnostiske — fungerer for både norske og spanske
-- eiendommer når Spania-flyten bygges senere.
--
-- Idempotent — trygg å kjøre flere ganger.

-- ===========================================================================
-- 1) UTVIDELSE — prosjekter med eierskap-flagg og eieretappe
-- ===========================================================================

alter table public.prosjekter
  add column if not exists er_portefolje boolean not null default false,
  add column if not exists eieretappe text default 'analyse'
    check (eieretappe in ('analyse','under_kjop','eid','salgsklar','solgt'));

create index if not exists prosjekter_portefolje_idx
  on public.prosjekter (marked, eieretappe)
  where er_portefolje = true;

-- ===========================================================================
-- 2) LÅN — flere lån per eiendom
-- ===========================================================================

create table if not exists public.eiendom_laan (
  id                  text primary key,
  prosjekt_id         text not null references public.prosjekter(id) on delete cascade,
  bruker              text not null,
  opprettet           timestamptz not null default now(),

  bank                text,
  laanetype           text check (laanetype in ('annuitet','serie','rammelaan','annet')),
  hovedstol           numeric,
  restgjeld           numeric,
  rente_pst           numeric,
  rentetype           text check (rentetype in ('flytende','fast')),
  bindingstid_aar     numeric,
  termin_belop        numeric,
  termin_frekvens     text default 'mnd' check (termin_frekvens in ('mnd','kvartal','aar')),
  nedbetalingstid_aar numeric,
  startdato           date,
  notat               text
);

create index if not exists eiendom_laan_prosjekt_idx
  on public.eiendom_laan (prosjekt_id);

-- ===========================================================================
-- 3) LEIETAKERE — separat fra inntektslinjer for fleksibilitet
-- ===========================================================================

create table if not exists public.eiendom_leietakere (
  id              text primary key,
  prosjekt_id     text not null references public.prosjekter(id) on delete cascade,
  bruker          text not null,
  opprettet       timestamptz not null default now(),

  navn            text not null,
  epost           text,
  telefon         text,
  notat           text
);

create index if not exists eiendom_leietakere_prosjekt_idx
  on public.eiendom_leietakere (prosjekt_id);

-- ===========================================================================
-- 4) INNTEKTER — leiekontrakter / korttidsleie
-- ===========================================================================

create table if not exists public.eiendom_inntekter (
  id              text primary key,
  prosjekt_id     text not null references public.prosjekter(id) on delete cascade,
  bruker          text not null,
  opprettet       timestamptz not null default now(),

  type            text check (type in ('langtidsleie','korttidsleie','annet')),
  leietaker_id    text references public.eiendom_leietakere(id) on delete set null,
  belop_mnd       numeric,
  depositum       numeric,
  startdato       date,
  sluttdato       date,
  notat           text
);

create index if not exists eiendom_inntekter_prosjekt_idx
  on public.eiendom_inntekter (prosjekt_id, startdato desc);

create index if not exists eiendom_inntekter_leietaker_idx
  on public.eiendom_inntekter (leietaker_id)
  where leietaker_id is not null;

-- ===========================================================================
-- 5) KOSTNADER — løpende og engangs
-- ===========================================================================

create table if not exists public.eiendom_kostnader (
  id              text primary key,
  prosjekt_id     text not null references public.prosjekter(id) on delete cascade,
  bruker          text not null,
  opprettet       timestamptz not null default now(),

  kategori        text check (kategori in (
                    'kommunale','forsikring','felleskostnader','strom','internett',
                    'vedlikehold','eiendomsskatt','ibi','comunidad','annet'
                  )),
  beskrivelse     text,
  belop           numeric not null,
  frekvens        text not null default 'mnd' check (frekvens in ('mnd','aar','engangs')),
  startdato       date,
  sluttdato       date,
  notat           text
);

create index if not exists eiendom_kostnader_prosjekt_idx
  on public.eiendom_kostnader (prosjekt_id);

-- ===========================================================================
-- 6) VERDIVURDERINGER — historikk over tid
-- ===========================================================================

create table if not exists public.eiendom_verdivurderinger (
  id              text primary key,
  prosjekt_id     text not null references public.prosjekter(id) on delete cascade,
  bruker          text not null,
  opprettet       timestamptz not null default now(),

  dato            date not null,
  verdi           numeric not null,
  kilde           text check (kilde in ('e_takst','takstmann','megler','egen_vurdering','salg','annet')),
  utstedt_av      text,
  notat           text
);

create index if not exists eiendom_verdivurderinger_prosjekt_idx
  on public.eiendom_verdivurderinger (prosjekt_id, dato desc);

-- ===========================================================================
-- 7) CASHFLOW — månedlig logg av faktisk inntekt og kostnad
-- ===========================================================================

create table if not exists public.eiendom_cashflow (
  id              text primary key,
  prosjekt_id     text not null references public.prosjekter(id) on delete cascade,
  bruker          text not null,
  opprettet       timestamptz not null default now(),

  maaned          text not null,    -- format YYYY-MM
  inntekt         numeric not null default 0,
  kostnad         numeric not null default 0,
  notat           text,

  unique (prosjekt_id, maaned)
);

create index if not exists eiendom_cashflow_prosjekt_maaned_idx
  on public.eiendom_cashflow (prosjekt_id, maaned desc);

-- ===========================================================================
-- 8) AI-FORSLAG — cachet Claude-analyse per eiendom
-- ===========================================================================

alter table public.prosjekter
  add column if not exists portefolje_ai_data jsonb,
  add column if not exists portefolje_ai_generert timestamptz,
  add column if not exists portefolje_ai_modell_versjon text;
