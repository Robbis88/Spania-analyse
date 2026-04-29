-- Støtte for norske boliger (flippe-prosjekter i Norge).
-- Beløp er fortsatt i samme valuta-felter som før — for norske prosjekter
-- tolkes de som NOK i stedet for EUR. Idempotent.

alter table public.prosjekter
  add column if not exists marked text not null default 'spania',
  add column if not exists eierform text,
  add column if not exists fellesgjeld_nok numeric,
  add column if not exists fellesutgifter_mnd_nok numeric,
  add column if not exists kommunale_avgifter_aar_nok numeric,
  add column if not exists energimerke text,
  add column if not exists adresse text;

create index if not exists idx_prosjekter_marked
  on public.prosjekter (marked);
