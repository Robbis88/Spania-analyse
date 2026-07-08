-- Fase B11 — mål per selskap (eller konsern). Idempotent.

begin;

create table if not exists maal (
  id text primary key,
  selskap_id text,               -- null = konsern/felles
  beskrivelse text not null,
  maaltall numeric not null,
  enhet text not null check (enhet in ('antall_boliger','egenkapital','cashflow_mnd')),
  frist date,
  opprettet timestamptz default now()
);

commit;
