-- Property Financial & Documentation System.
-- Tre nye tabeller (kvitteringer, dokumenter, dokument_sjekkpunkter),
-- utvidelser av oppussing_poster (status/faktisk/frist) og prosjekter
-- (salgsmaal_eur, salgsmaal_nok), tilhørende indekser, og en privat
-- storage-bucket for dokumenter og kvitteringer.
-- Idempotent — trygg å kjøre flere ganger.

-- ===========================================================================
-- 1) KVITTERINGER — fakturaer/kvitteringer per eiendom med OCR-felt
-- ===========================================================================

create table if not exists public.kvitteringer (
  id                  text primary key,
  prosjekt_id         text not null references public.prosjekter(id) on delete cascade,
  bruker              text not null,
  opprettet           timestamptz not null default now(),

  -- Fil
  storage_sti         text not null,
  filnavn             text,
  mime_type           text,

  -- OCR
  ocr_status          text not null default 'venter'
                      check (ocr_status in ('venter','analysert','feilet')),
  ocr_kjort           timestamptz,
  ocr_radata          jsonb,
  ocr_feilmelding     text,

  -- Strukturerte felt (fylles av OCR, redigerbare av bruker)
  dato                date,
  belop_eks_mva       numeric,
  mva                 numeric,
  belop_inkl_mva      numeric,
  valuta              text check (valuta in ('NOK','EUR')),
  leverandor          text,
  leverandor_orgnr    text,
  dokument_nr         text,

  -- Kategorisering
  kategori            text check (kategori in (
                        'elektriker','maling','kjokken','bad','rorlegger',
                        'gulv','mobler','mur_betong','tak_fasade',
                        'hage_uteplass','hvitevarer','verktoy','avgifter','div'
                      )),
  rom                 text check (rom in (
                        'kjokken','bad','stue','sov','gang','kjeller','loft',
                        'felles','utomhus'
                      )),

  -- Kobling til oppussingsbudsjett
  oppussing_post_id   text references public.oppussing_poster(id) on delete set null,

  tagger              text[] not null default '{}',
  notat               text
);

create index if not exists kvitteringer_prosjekt_dato_idx
  on public.kvitteringer (prosjekt_id, dato desc);

create index if not exists kvitteringer_oppussing_post_idx
  on public.kvitteringer (oppussing_post_id)
  where oppussing_post_id is not null;

create index if not exists kvitteringer_ocr_status_idx
  on public.kvitteringer (ocr_status)
  where ocr_status = 'venter';

-- ===========================================================================
-- 2) DOKUMENTER — juridiske/eierskaps-dokumenter per eiendom
-- ===========================================================================

create table if not exists public.dokumenter (
  id              text primary key,
  prosjekt_id     text not null references public.prosjekter(id) on delete cascade,
  bruker          text not null,
  opprettet       timestamptz not null default now(),

  tittel          text not null,
  type            text not null check (type in (
                    -- Spania
                    'escritura','nota_simple','ibi','vft_lisens','suministros',
                    'energiattest','comunidad','cedula_habitabilidad',
                    -- Norge
                    'takst','salgsoppgave','egenerklaring','ferdigattest',
                    'tilstandsrapport','seksjoneringspapirer',
                    -- Felles
                    'kjopskontrakt','forsikring','byggetegninger','annet'
                  )),

  storage_sti     text not null,
  filnavn         text,
  mime_type       text,

  utstedt_dato    date,
  gyldig_til      date,
  notat           text,
  tagger          text[] not null default '{}'
);

create index if not exists dokumenter_prosjekt_type_idx
  on public.dokumenter (prosjekt_id, type);

create index if not exists dokumenter_gyldig_til_idx
  on public.dokumenter (gyldig_til)
  where gyldig_til is not null;

-- ===========================================================================
-- 3) DOKUMENT-SJEKKPUNKTER — forventet-liste per prosjekt
-- Brukes i dashboard/varsler. Standardsett autopopulerer per marked.
-- ===========================================================================

create table if not exists public.dokument_sjekkpunkter (
  id              text primary key,
  prosjekt_id     text not null references public.prosjekter(id) on delete cascade,
  dokument_type   text not null,
  status          text not null default 'mangler'
                  check (status in ('mangler','i_prosess','ok','ikke_relevant')),
  ansvarlig       text,
  frist           date,
  notat           text,
  oppdatert       timestamptz not null default now(),
  unique (prosjekt_id, dokument_type)
);

create index if not exists dokument_sjekkpunkter_prosjekt_idx
  on public.dokument_sjekkpunkter (prosjekt_id);

-- ===========================================================================
-- 4) UTVIDELSE — oppussing_poster: status, faktisk-kostnad, frist
-- ===========================================================================

alter table public.oppussing_poster
  add column if not exists status            text not null default 'ikke_startet'
                                              check (status in ('ikke_startet','pagar','ferdig')),
  add column if not exists faktisk_kostnad   numeric,
  add column if not exists frist             date,
  add column if not exists ferdig_dato       date,
  add column if not exists ansvarlig         text;

create index if not exists oppussing_poster_status_idx
  on public.oppussing_poster (status)
  where status <> 'ferdig';

-- ===========================================================================
-- 5) UTVIDELSE — prosjekter: salgsmål (brukes i dashboard ROI-anbefaling)
-- ===========================================================================

alter table public.prosjekter
  add column if not exists salgsmaal_eur numeric,
  add column if not exists salgsmaal_nok numeric;

-- ===========================================================================
-- 6) STORAGE BUCKET — privat bucket for dokumenter og kvitteringer
-- Filer hentes alltid via signert URL fra server (samme mønster som "bilder").
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('dokumenter', 'dokumenter', false)
on conflict (id) do nothing;
