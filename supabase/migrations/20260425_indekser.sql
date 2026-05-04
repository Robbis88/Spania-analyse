-- Indekser på fremmednøkler som ofte filtreres på men mangler indeks.
-- Akselererer side-loads, bilde-listing og e-post-historikk per prosjekt.

create index if not exists prosjekt_bilder_prosjekt_id_idx
  on prosjekt_bilder (prosjekt_id);

create index if not exists prosjekt_bilder_original_bilde_id_idx
  on prosjekt_bilder (original_bilde_id);

create index if not exists eposter_relatert_prosjekt_id_idx
  on eposter (relatert_prosjekt_id);

create index if not exists oppussing_poster_budsjett_id_idx
  on oppussing_poster (budsjett_id);

create index if not exists oppussing_poster_kilde_bilde_id_idx
  on oppussing_poster (kilde_bilde_id);

create index if not exists oppussing_tillegg_kilde_bilde_id_idx
  on oppussing_tillegg (kilde_bilde_id);
