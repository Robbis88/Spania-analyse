-- Fase A1 — dropp inspeksjonstjenestens tabeller
-- KJØR BACKUP FØRST (se README.md).
--
-- FK-kjede: inspeksjon_tilbud.rapport_id  -> inspeksjon_rapporter
--           inspeksjon_rapporter.*        -> inspeksjon_bestillinger
--           inspeksjon_tilbud.*           -> inspeksjon_bestillinger
-- Derfor: tilbud FØRST, så rapporter, så bestillinger.
-- cascade som sikring mot ev. andre avhengige objekter (hele funksjonen fjernes).

begin;

drop table if exists inspeksjon_tilbud cascade;
drop table if exists inspeksjon_rapporter cascade;
drop table if exists inspeksjon_bestillinger cascade;

commit;
