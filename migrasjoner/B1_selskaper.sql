-- Fase B1 — selskaps-entitet + kobling fra prosjekter
-- Grunnmuren for resten av v2. Idempotent (trygt å kjøre flere ganger).

begin;

-- 1) Selskapstabell
create table if not exists selskaper (
  id uuid primary key default gen_random_uuid(),
  navn text not null unique,
  land text not null check (land in ('norge','spania')),
  valuta text not null check (valuta in ('NOK','EUR')),
  skatteprofil jsonb not null default '{}'::jsonb,
  opprettet timestamptz default now()
);

-- 2) Seed de to selskapene med dagens satser som default skatteprofil
insert into selskaper (navn, land, valuta, skatteprofil) values
  (
    'Loeiendom AS', 'norge', 'NOK',
    '{"gevinstskatt_pst":22,"dokumentavgift_pst":2.5,"botid_fritak_mnd":12,"utleie_skatt_pst":22}'::jsonb
  ),
  (
    'LO-casas', 'spania', 'EUR',
    '{"gevinst_eu_pst":19,"gevinst_ikke_eu_pst":24,"retention_pst":3,"vft_krav":true}'::jsonb
  )
on conflict (navn) do nothing;

-- 3) Koble prosjekter til selskap
alter table prosjekter add column if not exists selskap_id uuid references selskaper(id);

-- 4) Backfill: marked='norge' -> Loeiendom AS, ellers (spania/null) -> LO-casas
update prosjekter p
   set selskap_id = s.id
  from selskaper s
 where p.selskap_id is null
   and (
        (p.marked = 'norge'                    and s.land = 'norge')
     or (coalesce(p.marked, 'spania') = 'spania' and s.land = 'spania')
   );

commit;
