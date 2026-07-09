-- Fase C1 — to dimensjoner: livssyklus (eieretappe) og strategi er adskilt.
-- Legger til strategi + VFT-status. Idempotent.

begin;

-- Strategi: hva eiendommen SKAL brukes til (adskilt fra eieretappe/livssyklus)
alter table prosjekter add column if not exists strategi text default 'uavklart';

-- VFT/turistlisens (Spania korttid): har | sokt | mangler | null
alter table prosjekter add column if not exists vft_status text;

-- Migrer fra kategori (flipp -> flipp, utleie -> langtid). Kun der strategi
-- fortsatt er default, så manuelle valg overlever ny kjøring. kategori beholdes
-- til alle lesesteder er flyttet, deretter fases den ut.
update prosjekter
   set strategi = case kategori when 'flipp' then 'flipp' when 'utleie' then 'langtid' else 'uavklart' end
 where kategori is not null and (strategi is null or strategi = 'uavklart');

commit;
