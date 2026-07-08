-- Fase B7 — fjern duplikatfelt for leie
-- Langtidsleie bor nå kun på prosjekter.leieinntekt_mnd (én kilde).
-- utleieanalyse.langtidsleie_maned var en synket kopi og fjernes.
--
-- Lån: ingen kolonne å droppe. lan.maanedlig_renter_avdrag lå i JSONB-feltet
-- `lan` og synkes ikke lenger — Utleie-fanens prognose beregner terminbeløpet
-- fra lånebetingelsene, mens prosjekter.lån_mnd er Oversikt-tallet.
--
-- KJØR BACKUP AV utleieanalyse FØRST hvis du vil ta vare på gamle leietall.

begin;

alter table utleieanalyse drop column if exists langtidsleie_maned;

commit;
