-- Tidsstyrt beslutningsmotor — nye planforutsetninger per eiendom.
--
-- Motoren (B4) tar nå hensyn til hvor lang tid oppussingen tar:
--   - Flipp: holdekostnad (renter + drift) i oppussingsperioden trekkes fra,
--     og forventet salgssum (ARV) brukes hvis satt (forventet_salgsverdi finnes fra før).
--   - Leie: leiestart utsettes med oppussingsvarigheten; forventet_leie_mnd brukes
--     som planleie før faktiske leieinntekter er registrert.
--
-- forventet_salgsverdi finnes allerede på prosjekter og gjenbrukes som ARV.
-- Idempotent.

begin;

alter table prosjekter add column if not exists oppussing_varighet_mnd integer default 0;
alter table prosjekter add column if not exists forventet_leie_mnd    numeric default 0;

commit;
