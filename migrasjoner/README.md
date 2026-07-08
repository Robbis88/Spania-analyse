# Migrasjoner — Fase A (rydding)

Disse SQL-scriptene dropper databasetabeller og kolonner som hørte til
inspeksjonstjenesten og den offentlige utleieportalen. **Kode-ryddingen er
allerede gjort og committet** (branch `fase-a-rydding`) — dette er det som
gjenstår i databasen og i eksterne tjenester.

> ⚠️ **DESTRUKTIVT OG IRREVERSIBELT.** Ta backup før du kjører noe.
> Ingenting her kjøres automatisk — du kjører det selv i Supabase SQL Editor
> når du er klar.

## Kjørerekkefølge

1. **Backup først** (se under)
2. `A1_drop_inspeksjon.sql`
3. `A3_drop_portal_tabeller.sql`
4. `A3_drop_prosjekter_portalfelt.sql`

## Backup (gjør FØR dropp)

Eksporter hver tabell til CSV fra Supabase (Table editor → ⋯ → Export as CSV),
eller via SQL/`pg_dump`:

- `inspeksjon_bestillinger`
- `inspeksjon_rapporter`
- `inspeksjon_tilbud`
- `utleie_foresporsler`
- `interesse_registreringer`
- `prosjekter` (hele tabellen — kolonnene som droppes i steg 4 forsvinner)

## Manuelle steg utenfor databasen (kun du kan gjøre disse)

- [ ] **Storage-bucket `inspeksjon`**: eksporter innhold, deretter slett bucketen.
- [ ] **Vercel Cron**: fjern cron-jobben for `/api/inspeksjon/paaminnelser` (ruten finnes ikke lenger).
- [ ] **Miljøvariabler** som nå er ubrukte — fjern i Vercel + lokal `.env.local`:
  - `CRON_SECRET` (inspeksjon-cron)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Stripe)
  - `PORTAL_PASSORD`, `UTLEIE_FORESPORSEL_EPOST` (portal)
- [ ] **Stripe webhook**: slett webhook-endepunktet i Stripe Dashboard hvis satt opp.

## Etterarbeid i koden (valgfritt, kan tas senere / i B7)

Etter at `A3_drop_prosjekter_portalfelt.sql` er kjørt, er de tilsvarende
feltene i `Prosjekt`-typen (`app/types.ts`, ca. linje 88–109) døde. De er
valgfrie (`?`) og skader ingenting om de blir stående, men kan fjernes for
ryddighet. B7 restrukturerer uansett `prosjekter` senere — det er trygt å
vente til da.
