-- Fase B5 — lærende estimater: logg over "AI sa X, jeg mente Y, fasit ble Z"
-- Mater AI-en med Roberts historiske justeringer (kun kontekst i prompt, ingen ML).
-- Idempotent.

begin;

create table if not exists estimat_justeringer (
  id text primary key,
  prosjekt_id text not null,
  felt text not null,            -- 'renoveringskost', 'markedsverdi', 'leie_mnd' osv.
  ai_verdi numeric,
  min_verdi numeric,
  faktisk_verdi numeric,         -- settes når fasit er kjent (solgt/utleid)
  kontekst jsonb,                -- {marked, kommune, type}
  tidspunkt timestamptz default now()
);
create index if not exists estimat_justeringer_felt_idx on estimat_justeringer (felt);
create index if not exists estimat_justeringer_prosjekt_idx on estimat_justeringer (prosjekt_id);

commit;
