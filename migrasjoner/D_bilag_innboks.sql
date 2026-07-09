-- Bilagsinnboks — integrasjonsklar datamodell for fremtidig regnskapsimport.
--
-- Prinsipp: regnskapssystemet er FASIT for bokføring. Loeiendom er
-- STYRINGSSYSTEM. Importerte bilag bokføres IKKE på nytt her — de brukes til
-- prosjektregnskap, oppussingsbudsjett, kostnadskontroll, cashflow,
-- beslutningsmotor, avvik mot budsjett og dokumentasjon per eiendom.
--
-- Denne migrasjonen lager KUN strukturen. Ingen ekstern integrasjon kobles på
-- nå — men kolonnene kilde/ekstern_id/ekstern_data/import_batch gjør at en
-- fremtidig importør kan sette inn rader uten skjemaendring (se BILAG_IMPORT.md).
--
-- Idempotent.

begin;

create table if not exists bilag (
  id            text primary key,
  bruker        text not null,
  opprettet     timestamptz not null default now(),

  -- Tilknytning (AI foreslår, bruker bekrefter i innboksen)
  selskap_id    uuid references selskaper(id) on delete set null,
  prosjekt_id   text references prosjekter(id) on delete set null,

  -- Fakturadata
  leverandor    text,
  faktura_dato  date,
  forfall_dato  date,
  belop         numeric,                 -- totalbeløp inkl. mva
  mva           numeric,                 -- mva-beløp
  valuta        text default 'NOK' check (valuta in ('NOK','EUR')),
  bilagsnummer  text,                    -- bilagsnr i regnskapet
  fakturanummer text,                    -- leverandørens fakturanr

  -- Klassifisering (samme kategorier som eiendom_kostnader)
  kategori      text,
  underkategori text,

  -- Dokument/vedlegg (samme private bucket som tilbud/kvittering)
  storage_sti   text,
  filnavn       text,
  mime_type     text,

  -- AI-forslag + manuell godkjenning
  ai_forslag    jsonb,                   -- {prosjekt_id, selskap_id, kategori, underkategori, felt:{...}, begrunnelse}
  status        text not null default 'ny'
                  check (status in ('ny','foreslatt','godkjent','laast','avvist')),
  godkjent_av   text,
  godkjent_tid  timestamptz,

  -- Integrasjonsklar: kobling mot fremtidig regnskapsimport
  kilde         text not null default 'manuell',  -- 'manuell' | 'tripletex' | 'dnb_regnskap' | 'fiken' | ...
  ekstern_id    text,                    -- id i kildesystemet (idempotent import)
  ekstern_data  jsonb,                   -- rå import-payload for full sporbarhet
  import_batch  text,                    -- hvilken importkjøring raden kom fra

  notat         text
);

-- Hindrer dobbeltimport av samme bilag fra samme kildesystem.
-- (NULL ekstern_id for manuelle bilag regnes som distinkte i Postgres.)
create unique index if not exists bilag_kilde_ekstern_unik
  on bilag (kilde, ekstern_id)
  where ekstern_id is not null;

create index if not exists bilag_status_idx   on bilag (status);
create index if not exists bilag_prosjekt_idx on bilag (prosjekt_id);
create index if not exists bilag_selskap_idx  on bilag (selskap_id);

commit;
