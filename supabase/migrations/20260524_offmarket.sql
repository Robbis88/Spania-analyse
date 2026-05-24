-- Off-market vurdering — prosjekter mottatt utenfor det åpne markedet.
-- Vi lagrer minimal flyt-tilstand på selve prosjekt-raden, og hele
-- pakken (auto-innhentet data, selger-info, sammenligninger, AI-utdata)
-- i en JSONB-blob slik at vi kan utvide felter uten nye migrasjoner.

alter table public.prosjekter
  add column if not exists off_market boolean not null default false,
  add column if not exists off_market_data jsonb;

create index if not exists prosjekter_off_market_idx
  on public.prosjekter (marked, off_market)
  where off_market = true;
