-- Fase B12 — Kontantkonto: fri likviditet blir BEREGNET fra en hovedbok, ikke tastet.
-- Se PROSJEKT_B12_kontantkonto.md. Idempotent (trygt å kjøre flere ganger).
--
-- Modell: kontantbevegelser holder KAPITALHENDELSER (innskudd, låneopptak, kjøp,
-- omkostninger, oppussing, avdrag, renter, uttak). Operativ drift/leie leses live
-- fra eiendom_cashflow ved beregning av saldo — den posteres IKKE hit (unngår
-- dobbelttelling og skrive-hooks). Saldo = sum(kontantbevegelser.belop) + sum(cashflow netto).

begin;

create table if not exists kontantbevegelser (
  id uuid primary key default gen_random_uuid(),
  selskap_id uuid not null references selskaper(id) on delete cascade,
  prosjekt_id uuid references prosjekter(id) on delete set null,  -- kobling til eiendom, valgfri
  dato date not null,
  type text not null check (type in (
    'innskudd', 'laaneopptak', 'kjop', 'omkostninger', 'oppussing',
    'driftskostnad', 'renter', 'avdrag', 'leieinntekt', 'uttak', 'annet'
  )),
  belop numeric not null,          -- FORTEGNSSATT: + øker kontanter, − reduserer
  valuta text not null check (valuta in ('NOK','EUR')),
  kilde text not null default 'manuell',
  kilde_id uuid,                   -- referanse til prosjekt/laan/bilag for idempotens
  notat text,
  opprettet timestamptz default now()
);

-- Idempotens for auto-postering: samme kilde+kilde_id+type kan bare finnes én gang.
-- Manuelle bevegelser (kilde='manuell', kilde_id=null) rammes ikke (null er distinct i unique).
create unique index if not exists kontantbevegelser_kilde_unik
  on kontantbevegelser (kilde, kilde_id, type)
  where kilde_id is not null;

create index if not exists kontantbevegelser_selskap_dato on kontantbevegelser (selskap_id, dato);
create index if not exists kontantbevegelser_prosjekt on kontantbevegelser (prosjekt_id);

-- selskaper.fri_likviditet BEHOLDES foreløpig som overgangs-fallback:
-- API bruker beregnet saldo når selskapet har bevegelser, ellers dette feltet.
-- Fjernes i egen migrasjon når alle selskaper er seedet.
comment on column selskaper.fri_likviditet is
  'Utgår (B12). Overgangs-fallback til kontantbevegelser er seedet. Ikke rediger manuelt lenger.';

commit;
