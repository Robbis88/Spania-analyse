-- Fase A3 — dropp den offentlige portalens tabeller
-- KJØR BACKUP FØRST (se README.md).

begin;

drop table if exists utleie_foresporsler;
drop table if exists interesse_registreringer;

commit;
