# Arkitektur & utviklerguide — Loeiendom (Leganger & Osvaag)

> Komplett oversikt for utviklere. Les denne før du begynner å endre kode.
> Se også `AGENTS.md`: dette er en Next.js-versjon med breaking changes — slå opp i
> `node_modules/next/dist/docs/` før du skriver Next.js-spesifikk kode.
>
> **Status:** Beskriver tilstanden **etter Fase A (rydding) + Fase B (v2)**.
> Den opprinnelige planen ligger i `PROSJEKT.md` (alle 9 milepæler er bygget).

---

## 1. Hva er dette?

Et **internt styringsverktøy for eiendomsinvestering** for Loeiendom AS (Norge) og LO-casas SL
(Spania), bygget som én Next.js-app. Det dekker hele livsløpet — analyse → oppussing → drift →
utleie/salg — for to markeder, og svarer kontinuerlig på to spørsmål:

1. **Per eiendom:** «Hva er beste bruk av denne akkurat nå?» (flipp / langtid / korttid / behold+refi)
2. **Per portefølje:** «Hvor mye kan vi kjøpe for neste runde?» (kjøpekraft)

Systemet anbefaler med begrunnelse og regnestykke bak — **aldri falske sikkerhetsprosenter**.
Tungt AI-drevet (Claude) for analyse, OCR, bildebehandling, beslutningsanbefalinger og daglig brief.

> Historikk: hadde tidligere en offentlig utleieportal + betalt inspeksjonstjeneste (Stripe).
> Begge fjernet i Fase A. All data legges inn manuelt — ingen skraping/bankfeeds/regnskapsintegrasjon.

### Én flate
| Flate | Tilgang |
|---|---|
| `/admin` | Sesjons-cookie (`/api/auth`) |
| `/` | Redirect → `/admin` |

---

## 2. Teknisk stack

| Lag | Teknologi |
|---|---|
| Rammeverk | Next.js 16.2 (App Router), React 19.2 |
| Språk | TypeScript 5 |
| UI | Inline-styles på design-tokens (`app/lib/styles.ts`) — ingen CSS-rammeverk |
| Database + fillagring | Supabase (Postgres + Storage) |
| AI (tekst/vision) | Anthropic Claude — `@anthropic-ai/sdk` (`claude-sonnet-4-6`, OCR `claude-sonnet-4-5`) |
| AI (bilde) | Replicate (Nano Banana / Flux Kontext) |
| E-post | Resend · Bildebehandling | sharp · PDF | jsPDF |

**Scripts:** `npm run dev` · `build` · `start` · `lint`. `next.config.ts` er tom.

---

## 3. Mappestruktur (utdrag)

```
app/
  page.tsx                  Redirect → /admin
  admin/page.tsx            Adminpanel (13 seksjoner, lazy-loaded) + daglig brief på forsiden
  types.ts                  ★ Domenemodellen
  api/                      Route handlers (se §6)
  components/               React-komponenter (se §5)
    portefolje/faner/       Faner i eiendomsdetalj (inkl. Beslutning, Tilbud, Tidslinje)
    norsk/                  Norsk kalkulator-modul
  lib/                      Forretningslogikk + infrastruktur (se §4)
migrasjoner/               SQL-migrasjoner (kjøres MANUELT i Supabase — se README der)
```

> **Migrasjoner kjøres aldri automatisk.** All ny SQL legges også på utklippstavlen (Roberts flyt: lim inn i Supabase SQL Editor).

---

## 4. `app/lib/` — forretningslogikk & infrastruktur

### 4.1 Rene beregninger (single source of truth — brukes både i UI og PDF/AI)
| Fil | Ansvar |
|---|---|
| `beslutning.ts` | ★ **Beslutningsmotoren (B4).** `beregnBeslutning` → 4 scenarier (flipp/langtid/korttid/refi) på **bundet EK**, med selskapets skatteprofil. `beregnBundetEk` er delt med kapitaloversikten. Terskler/forutsetninger som konstanter (yield-terskel 6 %, salgskost 2 %, maks LTV 75 %) |
| `skatteprofil.ts` | Defaults per land (= dagens satser), type-guards, `gevinstSatsPst`/`utleieSatsPst`, `medDefaults` |
| `beregninger.ts` 🇪🇸 | `beregnSalg` (CGT 19/24 %, plusvalía, 3 % retention) — tar nå satser som param |
| `utleie.ts` 🇪🇸 | Airbnb-motor, `beregnAar` (langtidsleie sendes inn som param etter B7) |
| `norskKalkulator.ts` 🇳🇴 | Flippe-/bo-kalkyle — skattesatser parametrisert (default 22 %) |
| `norskBankScore.ts` 🇳🇴 | Bankscore 0–100 (SIFO, 5×-regel, stresstest) |
| `offmarket.ts` · `catastro.ts` | Off-market (Geonorge) · spansk matrikkel |
| `portefolje.ts` | KPI for eide eiendommer: `sisteVerdi`, `totalRestgjeld`, `gjeldendeLeieMnd`, `belaningsgrad`, `rentesjokk`, `annuitetMnd` m.fl. |
| `oppussing.ts` · `oppgaver.ts` | Oppussingsbudsjett · oppgave-prioritering |
| `tilbud.ts` | Konstanter for tilbudsopplasting (mime, arbeidstyper, storage-sti) |

> **Fjernet i B7:** `prosjektSync.ts`. Leie/lån har nå **én kilde** (`prosjekter.leieinntekt_mnd` / `lån_mnd`); Utleie-fanen leser/skriver dem direkte.

### 4.2 PDF-byggere (jsPDF): `pdf.ts`, `pdfNorsk.ts`, `pdfCashflow.ts`, `pdfSalgspakke.ts`, `pdfOffmarket(Bank).ts`

### 4.3 Infrastruktur
| Fil | Ansvar |
|---|---|
| `supabase.ts` / `supabaseAdmin.ts` | Anon-klient (klient) / service-role (`hentSupabaseAdmin`, server) |
| `requireAuth.ts` | HMAC-signert sesjons-cookie `admin-sesjon` |
| `logg.ts` | `loggAktivitet` → `aktivitetslogg` — utvidet med `prosjekt_id` + `hendelsestype` (B10) |
| `rateLimit.ts` | In-memory per IP (login). ⚠️ Kun per Vercel-instans |
| `epost.ts` · `styles.ts` · `format.ts` · `aktivBruker.ts` | Resend · tokens · formatering · localStorage-UI-hint |

---

## 5. `app/components/` — etter funksjonsområde

- **Analyse:** `Boliganalyse`, `NorskeBoliger`, `Offmarket(Detalj)`, `TakstAnalyse`, `ScoreKort`
- **Kontrollrom (Fase C):** `HjemDashboard` (konsern-forside: KPI-er + grafer + raske innsikter + beste/svakeste + aktivitet + porteføljetabell), `SelskapDashboard` (Loeiendom/Lo Casas), `EiendomsRegister` (globalt register → `EiendomDetalj`), `Varsler` (flaggmotor), `KortFortalt` (C0 AI-oppsummering fra sidens tall), `MaalSeksjon` (B11)
- **Selskap & kapital (v2):** `Selskaper` (skatteprofil-redigering), `Kapital` (kjøpekraft, bundet EK, konsernlån)
- **Prosjektstyring:** `Regnskap`, `ProsjektFelter`, `Oppussingsbudsjett`, `Utleieanalyse`, `Selge`, `Salgspakke`, `Dokumenter`, `Kvitteringer`, `ProsjektBilder`, `SendForesporselModal` (håndverker), `TilbudHistorikk`
- **Eiendomsside (`portefolje/`):** `EiendomDetalj` (åpnes fra `EiendomsRegister`), `useEiendomData`. Faner (`faner/`): `EiendomOversikt`, **`EiendomBeslutning`** (B4/B5), `EiendomLaan/Inntekter/Kostnader/Verdi/Cashflow/Leietakere`, `EiendomOppussing`, **`EiendomTilbud`** (B8), **`EiendomTidslinje`** (B10), `EiendomAi`, `EiendomDokumenter/Bilder/Kvitteringer`
- **Håndverk/timer/AI/felles:** `Handverkere`, `Timer`, `AgentChat`, `Dashboard`, `Oppgaver`, `Aktivitetslogg`, `Innlogging`, `Toaster`

Admin-UI er hardkodet på norsk (den flerspråklige portal-i18n ble fjernet i Fase A).

---

## 6. API-ruter (`app/api/`)

Alle krever `requireAuth` + `hentSupabaseAdmin`.

| Gruppe | Ruter |
|---|---|
| Auth/oppsett | `auth`, `auth/brukere`, `husholdning-default`, `dashboard` |
| Analyse (AI) | `analyse`, `analyse-norge`, `airbnb`, `analyse-takst`, `catastro`, `agent`, `agent/salgsestimat` |
| Dokument/kvittering/bilder | `dokument/*`, `dokument-sjekkpunkt`, `kvittering/*`, `bilder/*` |
| Salg/portefølje | `selge/analyse`, `portefolje/{ai-forslag,cashflow-pdf,verdivurdering-fil}`, `salgspakke`, `offmarket/*` |
| E-post/håndverker | `epost/send`, `handverker/{send-foresporsel,oversett}` |
| **v2 — selskap & kapital** | `selskaper`, `konsernlaan`, `kapital` |
| **v2 — beslutning** | `beslutning` (AI-anbefaling), `portefolje-rangering`, `estimat-justering` (B5), `brief` (B9) |
| **v2 — tilbud** | `tilbud`, `tilbud/last-opp`, `tilbud/analyser` (Claude-OCR) |
| **v2 — mål** | `maal` |

---

## 7. Autentisering

Én mekanisme: **admin-sesjon** (`requireAuth.ts`), HMAC-signert cookie, brukere fra `APP_USERS`/`APP_USERNAME`+`APP_PASSWORD`. `aktivBruker.ts` (localStorage) er kun UI-hint, ikke sikkerhet.

---

## 8. Datamodell (Supabase)

**`prosjekter`** — sentral, dekker begge markeder + AI-JSONB-blobber. v2-felt: `selskap_id`, `markedsleie_mnd`. (`er_portefolje` + `eieretappe` markerer eide eiendommer.)

| Domene | Tabeller |
|---|---|
| **Selskap & kapital (v2)** | `selskaper` (navn, land, valuta, `skatteprofil` jsonb, `fri_likviditet`, `laanekapasitet`), `konsernlaan` |
| Oppussing/tilbud | `oppussing_budsjett/poster/tillegg`, **`tilbud`** (v2, m/ OCR-felt + `akseptert`) |
| Portefølje (eide) | `eiendom_laan/inntekter/kostnader/verdivurderinger/cashflow/leietakere` |
| Utleie/dokument | `utleieanalyse`, `dokumenter`, `dokument_sjekkpunkter`, `kvitteringer`, `prosjekt_bilder` |
| **v2 — læring/mål** | `estimat_justeringer` (B5), `maal` (B11) |
| Drift/logg | `oppgaver`, `handverkere`, `tilbudsforesporsler`, `timeloggning`, `eposter`, `aktivitetslogg` (+ `prosjekt_id`, `hendelsestype`), `husholdning_default` |

Storage-buckets: `bilder`, `dokumenter` (tilbud ligger under `dokumenter/tilbud/…`).

**Migrasjoner** (kjør i rekkefølge i Supabase — filene ligger i `migrasjoner/`):
`A1/A3` (rydding) → `B1_selskaper` → `B7_drop_langtidsleie_maned` → `B2_B3_konsernlaan_kapital`
→ `B8_B10_tilbud_tidslinje` → `B5_estimat_justeringer` → `B6_markedsleie` → `B11_maal`.

---

## 9. Dataflyt — beslutningskjeden (v2)

```
tilbud (B8, OCR)  →  min vurdering (B5, "dine tall vinner")  →  BESLUTNINGSMOTOR (B4)
    (kilde: renoveringskost)                                        beregnBeslutning + skatteprofil
        │                                                                   │
        └──────────► estimat_justeringer (mater AI med historikk)          ▼
                                                          porteføljerangering (B6, yield på bundet EK + flagg)
                                                                            │
                                                                            ▼
                                                          kapitaloversikt (B3) + konsernlån (B2)
                                                                            │
                                                                            ▼
                                                          daglig brief (B9) + mål (B11) på admin-forsiden
```

Hvert tall har **én kilde**; alt annet beregnes ved lesing. `beregnBundetEk` deles mellom Beslutning (B4) og Kapital/Rangering (B3/B6) så tallet er identisk overalt.

---

## 10. Miljøvariabler

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` (**uvanlig navn — ikke `_ANON_KEY`**),
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `BILDE_MODELL`,
`APP_USERS` (JSON) el. `APP_USERNAME`/`APP_PASSWORD`, `AUTH_SECRET`, `EPOST_SIGNATUR_LINJER`.

> Utgått i Fase A: `STRIPE_*`, `CRON_SECRET`, `PORTAL_PASSORD`, `UTLEIE_FORESPORSEL_EPOST`.

---

## 11. Konvensjoner & fallgruver

- **Norsk i kode** (variabler, funksjoner, æøå i felt som `kjøpesum`).
- **Ingen CSS-rammeverk** — inline-styles + `styles.ts`-tokens; animasjoner i `globals.css`.
- **Beregninger er delt sannhet** — endrer du en formel i `lib/`, treffer det UI, PDF og AI-kontekst samtidig.
- **Én kilde per tall** (B7-prinsippet) — ingen sync-funksjoner, ingen duplikatfelt. Sjekk om et tall finnes før du lager nytt felt.
- **Skattesatser er parametriske** — kommer fra `selskaper.skatteprofil` (defaults = dagens verdier i `skatteprofil.ts`). Endre formler forsiktig; endre satser i admin.
- **`bundet EK` = `beregnBundetEk`** — bruk den ene funksjonen, ikke kopier formelen.
- **Ny SQL → utklippstavlen** og som fil i `migrasjoner/`. Kjøres manuelt i Supabase.
- **Rate-limit er in-memory** (per instans). **Supabase select-strenger** tåler ikke `ø` i typeparseren — bruk `select('*')` for tabeller med æøå-kolonner.
- **AI gir aldri falske sikkerhetsprosenter** — anbefaling + begrunnelse + regnestykke.
- **Next.js med breaking changes** — se `AGENTS.md`, les `node_modules/next/dist/docs/`.
