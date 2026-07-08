-- Fase B2 + B3 — konsernlån + kapitalfelt per selskap
-- Idempotent (trygt å kjøre flere ganger).

begin;

-- B2: konsernlån (Loeiendom AS -> LO-casas osv.)
create table if not exists konsernlaan (
  id uuid primary key default gen_random_uuid(),
  fra_selskap uuid references selskaper(id),
  til_selskap uuid references selskaper(id),
  hovedstol numeric not null,
  valuta text not null check (valuta in ('NOK','EUR')),
  rente_pct numeric not null default 0,   -- armlengdes rente, settes manuelt
  startdato date not null,
  nedbetalinger jsonb not null default '[]',  -- [{dato, belop}]
  notat text,
  opprettet timestamptz default now()
);

-- B3: manuelle kapitalfelt per selskap (oppdateres av Robert)
alter table selskaper add column if not exists fri_likviditet numeric not null default 0;
alter table selskaper add column if not exists laanekapasitet numeric not null default 0;

commit;
