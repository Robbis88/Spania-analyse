-- Fase A1 — dropp inspeksjonstjenestens tabeller
-- KJØR BACKUP FØRST (se README.md).
-- Barn droppes før forelder (FK-avhengigheter).

begin;

drop table if exists inspeksjon_rapporter;
drop table if exists inspeksjon_tilbud;
drop table if exists inspeksjon_bestillinger;

commit;
