-- C10 steg 8 — backfill av er_portefolje for eide Spania-eiendommer.
--
-- Bakgrunn: Flipp/Utleie-seksjonene (nå fjernet fra nav) viste Spania-prosjekter
-- filtrert på `kategori`, UTEN å bry seg om `er_portefolje`. Det nye Eiendommer-
-- registeret viser derimot kun `er_portefolje = true`. En eid eiendom med
-- er_portefolje=false var altså synlig i den gamle seksjonen, men mangler i
-- registeret. Denne migrasjonen løfter de eide inn i registeret så ingen blir
-- usynlig når de gamle seksjonene tas bort.
--
-- Idempotent — trygg å kjøre flere ganger. Kjør STEG 1 først, se på radene,
-- kjør deretter STEG 2.

-- ===========================================================================
-- STEG 1 — FORHÅNDSVISNING (ingen endring)
-- Alle Spania-prosjekter som i dag kun var synlige via Flipp/Utleie
-- (kategori satt, er_portefolje=false). Sjekk eieretappe-kolonnen:
--   * eid / under_kjop / under_oppussing / salgsklar / solgt  → promoteres i STEG 2
--   * analyse                                                 → hører hjemme under Analyse, røres ikke
-- ===========================================================================
select id, navn, kategori, eieretappe, strategi, er_portefolje
  from prosjekter
 where er_portefolje = false
   and (marked is null or marked = 'spania')
   and kategori in ('flipp', 'utleie')
 order by eieretappe, navn;

-- ===========================================================================
-- STEG 2 — BACKFILL (endring)
-- Promoter kun EIDE eiendommer inn i registeret. Rene analysekandidater
-- (eieretappe='analyse') utelates bevisst.
-- ===========================================================================
update prosjekter
   set er_portefolje = true
 where er_portefolje = false
   and (marked is null or marked = 'spania')
   and kategori in ('flipp', 'utleie')
   and eieretappe in ('under_kjop', 'eid', 'under_oppussing', 'salgsklar', 'solgt');

-- Kontroll: hvor mange eiendommer ligger nå i registeret, fordelt på land?
select coalesce(marked, 'spania') as land, count(*) as antall
  from prosjekter
 where er_portefolje = true
 group by coalesce(marked, 'spania')
 order by land;
