-- Kobler oppussing_poster tilbake til kildebildet så vi kan samle
-- godtatte forslag per bilde når vi genererer før/etter-visualisering.
-- Idempotent — trygg å kjøre flere ganger.

alter table public.oppussing_poster
  add column if not exists kilde_bilde_id text
    references public.prosjekt_bilder(id) on delete set null;

create index if not exists oppussing_poster_kilde_bilde_id_idx
  on public.oppussing_poster (kilde_bilde_id)
  where kilde_bilde_id is not null;
