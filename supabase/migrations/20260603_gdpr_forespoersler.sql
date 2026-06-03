-- GDPR-forespørsler — logg av innsyns- og slette-henvendelser fra registrerte.
-- Forespørselen mottas via /personvern-skjemaet, bekreftes på e-post,
-- og behandles manuelt av admin innen 30 dager (jf. GDPR art. 12).
-- Loggen brukes til å dokumentere at vi har respondert.

create table if not exists public.gdpr_forespoersler (
  id                  text primary key,
  opprettet           timestamptz not null default now(),

  -- Hvem og hva
  epost               text not null,
  navn                text,
  type                text not null check (type in ('innsyn', 'sletting', 'retting', 'portabilitet', 'annet')),
  melding             text,

  -- Sporing
  ip_hash             text,                -- SHA-256 av IP for sporing av misbruk (ikke selve IP-en)
  bekreftelse_sendt   timestamptz,         -- når automatisk bekreftelse gikk ut til søker
  varsling_sendt      timestamptz,         -- når admin-varsel gikk ut

  -- Behandling
  status              text not null default 'mottatt'
                      check (status in ('mottatt', 'under_behandling', 'fullfort', 'avvist')),
  behandlet_av        text,                -- admin-brukernavn
  behandlet_tidspunkt timestamptz,
  intern_notat        text                 -- hva ble gjort, hvilke data ble eksportert/slettet
);

create index if not exists gdpr_forespoersler_status_idx
  on public.gdpr_forespoersler (status, opprettet desc);

create index if not exists gdpr_forespoersler_epost_idx
  on public.gdpr_forespoersler (lower(epost));
