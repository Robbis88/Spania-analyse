-- Lån: skill renter fra avdrag + avdragsfritt.
--
-- Bakgrunn: terminbeløp alene skiller ikke rentedel (ekte kostnad) fra
-- avdragsdel (bygger egenkapital). Med disse feltene kan systemet vise
-- RESULTAT (leie − kostnader − renter) adskilt fra CASHFLOW (− renter − avdrag),
-- og modellere avdragsfrie flipp-lån eksplisitt.
--
-- Idempotent. Eksisterende rader: feltene blir null/false, og beregningene
-- faller tilbake til terminbeløp nøyaktig som før (cashflow uendret) til du
-- fyller inn splitten.

begin;

alter table eiendom_laan add column if not exists rente_belop  numeric;   -- rentedel per termin
alter table eiendom_laan add column if not exists avdrag_belop numeric;   -- avdragsdel per termin
alter table eiendom_laan add column if not exists avdragsfritt boolean not null default false;

commit;
