-- B4c — «Leke med tall»: oppussingsposter + to oppussingsnivåer.
-- Flipp krever gjerne tyngre oppussing (høyere kost + høyere ARV) enn en lett
-- oppussing for å øke verdi, refinansiere og leie ut. Motoren regner hvert
-- scenario med sitt eget nivå. Idempotent.

begin;

-- Oppussingsposter for flipp-nivået: [{navn, kost}]. Sum = renoveringskost (flipp).
alter table prosjekter add column if not exists oppussing_poster jsonb not null default '[]';

-- Lett oppussing for utleie-veien (valgfritt — tomt = samme som flipp).
alter table prosjekter add column if not exists oppussing_utleie numeric;   -- kostnad, lett oppussing
alter table prosjekter add column if not exists verdi_utleie numeric;       -- verdi etter lett oppussing (for refi)

comment on column prosjekter.oppussing_poster is 'Flipp-oppussing linje for linje (B4c): [{navn, kost}]. Sum = renoveringskost.';
comment on column prosjekter.oppussing_utleie is 'Lett oppussing for utleie-veien (B4c). NULL = samme som flipp.';
comment on column prosjekter.verdi_utleie is 'Verdi etter lett oppussing, for refinansiering (B4c). NULL = ARV.';

commit;
