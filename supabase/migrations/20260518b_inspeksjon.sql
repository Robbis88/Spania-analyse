-- Boliginspeksjons-tjeneste — egen modul med bestillinger, rapporter og tilbud.
-- Tre tabeller: bestillinger (booking-skjema fra kunde), rapporter (utfylt etter
-- inspeksjon) og tilbud (utbedrings-forslag som sendes kunden etter rapport).
-- Idempotent — trygg å kjøre flere ganger.

-- ===========================================================================
-- BESTILLINGER — kunden booker via /inspeksjon, vi tar over derfra
-- ===========================================================================

create table if not exists public.inspeksjon_bestillinger (
  id                  text primary key,
  opprettet           timestamptz not null default now(),

  -- Kunde-info (fra booking-skjemaet)
  kunde_navn          text not null,
  kunde_epost         text not null,
  kunde_telefon       text,
  kunde_sprak         text not null default 'no' check (kunde_sprak in ('no','en','es')),

  -- Leilighet
  adresse             text not null,
  kompleks            text,
  leilighet_nr        text,
  storrelse           text not null check (storrelse in ('1-rom','2-rom','3-rom','4-rom','villa')),
  bra_m2              numeric,

  -- Tjenestevalg
  tjeneste_type       text not null check (tjeneste_type in (
                        'engangs', 'manedlig_visuell', 'kvartalsvis_grundig'
                      )),
  pris_eur            numeric not null,

  -- Ønsket tidspunkt — frist eller dato
  onsket_dato         date,
  fleksibel           boolean not null default true,
  melding             text,

  -- Status-flyt: ny → planlagt → utfort → tilbud_sendt → avsluttet
  status              text not null default 'ny'
                      check (status in ('ny','planlagt','utfort','tilbud_sendt','avsluttet','avlyst')),
  planlagt_tidspunkt  timestamptz,

  -- Hvis dette er en abonnement-kunde, lenker vi tilbake til første bestilling
  abonnement_rot_id   text references public.inspeksjon_bestillinger(id) on delete set null,

  intern_notat        text
);

create index if not exists inspeksjon_bestillinger_status_idx
  on public.inspeksjon_bestillinger (status, opprettet desc);

create index if not exists inspeksjon_bestillinger_kunde_idx
  on public.inspeksjon_bestillinger (kunde_epost);

-- ===========================================================================
-- RAPPORTER — utfylt etter inspeksjonsbesøk
-- ===========================================================================

create table if not exists public.inspeksjon_rapporter (
  id                  text primary key,
  bestilling_id       text not null references public.inspeksjon_bestillinger(id) on delete cascade,
  opprettet           timestamptz not null default now(),

  inspektor           text not null,    -- hvem som utførte (typisk stefar / admin-bruker)
  besokt_dato         date not null,

  -- Strukturert sjekkliste — hver kategori har en status og evt. notat.
  -- Bruker jsonb så vi enkelt kan utvide kategorier uten ny migrasjon.
  -- Forventet form: { kategori_id: { status: 'ok'|'merknad'|'kritisk', notat: '...' } }
  sjekkliste          jsonb not null default '{}'::jsonb,

  -- Bilder lastet opp via inspeksjon-bucket — array med storage-stier
  bilde_stier         text[] not null default '{}',

  oppsummering        text,
  anbefalinger        text,             -- AI-flett av sjekklisten kan brukes her senere
  intern_notat        text
);

create index if not exists inspeksjon_rapporter_bestilling_idx
  on public.inspeksjon_rapporter (bestilling_id);

-- ===========================================================================
-- TILBUD — utbedrings-forslag generert fra rapporten, sendes kunden
-- ===========================================================================

create table if not exists public.inspeksjon_tilbud (
  id                  text primary key,
  rapport_id          text not null references public.inspeksjon_rapporter(id) on delete cascade,
  bestilling_id       text not null references public.inspeksjon_bestillinger(id) on delete cascade,
  opprettet           timestamptz not null default now(),

  tittel              text not null,
  beskrivelse         text not null,
  pris_eur            numeric not null,
  estimert_dager      numeric,

  -- Status: utkast → sendt → akseptert/avvist → utfort
  status              text not null default 'utkast'
                      check (status in ('utkast','sendt','akseptert','avvist','utfort')),
  sendt_tidspunkt     timestamptz,
  kunde_svar          text,
  kunde_svar_dato     timestamptz
);

create index if not exists inspeksjon_tilbud_rapport_idx
  on public.inspeksjon_tilbud (rapport_id);

create index if not exists inspeksjon_tilbud_status_idx
  on public.inspeksjon_tilbud (status, opprettet desc);

-- ===========================================================================
-- STORAGE BUCKET — privat for inspeksjons-bilder
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('inspeksjon', 'inspeksjon', false)
on conflict (id) do nothing;
