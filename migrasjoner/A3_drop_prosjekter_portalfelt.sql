-- Fase A3 — fjern portal-/publiseringsfelt fra prosjekter
-- KJØR BACKUP AV prosjekter FØRST (se README.md).
--
-- Verifisert: ingen gjenværende (beholdt) kode leser eller skriver disse
-- feltene etter kode-ryddingen. Boliganalyse.tsx pre-fylte tidligere flere av
-- dem, men det er fjernet i samme commit-serie.
--
-- BEHOLDES bevisst (ekte bolig-fakta som fortsatt brukes i analyse/PDF):
--   byggear, tomt_m2
-- Disse skal IKKE droppes.

begin;

-- Publiseringsflagg
alter table prosjekter drop column if exists publisert_utleie;
alter table prosjekter drop column if exists publisert_salg;

-- Utleie-publisering (pris/tekst/fasiliteter)
alter table prosjekter drop column if exists utleie_pris_natt;
alter table prosjekter drop column if exists utleie_pris_uke;
alter table prosjekter drop column if exists utleie_min_netter;
alter table prosjekter drop column if exists utleie_maks_gjester;
alter table prosjekter drop column if exists utleie_beskrivelse;
alter table prosjekter drop column if exists utleie_kort_beskrivelse;
alter table prosjekter drop column if exists utleie_fasiliteter;

-- Salgs-publisering (pris/tekst)
alter table prosjekter drop column if exists salgspris_eur;
alter table prosjekter drop column if exists salg_kort_beskrivelse;
alter table prosjekter drop column if exists salg_beskrivelse;

-- Portal-detaljfelt (kun brukt av den slettede bolig-detaljsiden)
alter table prosjekter drop column if exists kort_avstand;

-- Flerspråklige oversettelser (kun portal)
alter table prosjekter drop column if exists navn_oversettelser;
alter table prosjekter drop column if exists utleie_kort_oversettelser;
alter table prosjekter drop column if exists utleie_beskrivelse_oversettelser;
alter table prosjekter drop column if exists salg_kort_oversettelser;
alter table prosjekter drop column if exists salg_beskrivelse_oversettelser;
alter table prosjekter drop column if exists utleie_fasiliteter_oversettelser;
alter table prosjekter drop column if exists oversettelser_oppdatert;

commit;
