-- B4b — Fler-enhets utviklingsmodell: en bolig kan seksjoneres til N leiligheter.
-- Hver enhet har egen leie + driftskostnad. Brukes av beslutningsmotoren til
-- «utvikle og lei ut»-scenariene (behold lån / refinansier på utviklet verdi).
-- Idempotent.

begin;

alter table prosjekter add column if not exists enheter jsonb not null default '[]';
-- Form: [{ "navn": "H0101 · 2-roms", "leie_mnd": 11000, "drift_mnd": 3000 }, ...]

comment on column prosjekter.enheter is
  'Fler-enhets utleie (B4b): [{navn, leie_mnd, drift_mnd}]. Tom = enkeltbolig.';

commit;
