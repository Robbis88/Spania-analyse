-- Fase B8 (tilbudsopplasting) + B10 (tidslinje)
-- Idempotent.

begin;

-- B8: opplastede tilbud (mottatte pristilbud, ikke forespørsler)
create table if not exists tilbud (
  id text primary key,
  prosjekt_id text not null,
  bruker text,
  storage_sti text,
  filnavn text,
  mime_type text,
  ocr_status text not null default 'venter',   -- venter | analysert | feilet | manuelt
  aktor text,
  totalsum numeric,
  valuta text,                                  -- NOK | EUR
  poster jsonb default '[]',                    -- [{navn, sum}]
  inkluderer text,
  ekskluderer text,
  gyldig_til date,
  arbeidstype text,
  akseptert boolean not null default false,
  er_internt boolean not null default false,    -- internt arbeid (Ronny) uten fil
  notat text,
  ocr_radata jsonb,
  ocr_kjort timestamptz,
  ocr_feilmelding text,
  opprettet timestamptz default now()
);
create index if not exists tilbud_prosjekt_idx on tilbud (prosjekt_id);

-- B10: tidslinje — utvid aktivitetslogg med eiendomskobling og hendelsestype
alter table aktivitetslogg add column if not exists prosjekt_id text;
alter table aktivitetslogg add column if not exists hendelsestype text;

commit;
