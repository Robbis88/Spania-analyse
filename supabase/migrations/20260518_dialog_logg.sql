-- Dialog-logg per prosjekt — fanger inngående svar fra megler, bank, selger
-- og koblede beslutninger, slik at hele dialogen for én bolig er på ett sted
-- sammen med utgående eposter (tabellen `eposter`).
-- Idempotent — trygg å kjøre flere ganger.

create table if not exists public.dialog_logg (
  id                  text primary key,
  prosjekt_id         text not null references public.prosjekter(id) on delete cascade,
  bruker              text not null,
  opprettet           timestamptz not null default now(),

  -- Hva slags innslag — gjenbruker formål-vokabularet fra eposter,
  -- pluss «beslutning» og «notat» for ikke-epost-innslag.
  type                text not null check (type in (
                        'megler_svar', 'bank_svar', 'selger_svar',
                        'haandverker_svar', 'beslutning', 'notat'
                      )),

  -- Selve innholdet — lim-inn-svar, beslutningstekst eller notat.
  innhold             text not null,

  -- Min vurdering / neste handling — frivillig.
  notat               text,

  -- Hvis svar gjelder en utgående epost, lenker vi tilbake til den.
  -- ON DELETE SET NULL — historikken beholdes selv om epost-raden slettes.
  relatert_epost_id   text references public.eposter(id) on delete set null
);

create index if not exists dialog_logg_prosjekt_idx
  on public.dialog_logg (prosjekt_id, opprettet desc);

create index if not exists dialog_logg_epost_idx
  on public.dialog_logg (relatert_epost_id)
  where relatert_epost_id is not null;
