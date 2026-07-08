# Arkitektur & utviklerguide — Loeiendom (Leganger & Osvaag)

> Komplett oversikt for utviklere. Les denne før du begynner å endre kode.
> Se også `AGENTS.md`: dette er en Next.js-versjon med breaking changes — slå opp i
> `node_modules/next/dist/docs/` før du skriver Next.js-spesifikk kode.
>
> **Status:** Dette dokumentet beskriver tilstanden **etter Fase A (rydding)**.
> Kommende arbeid (beslutningsmotor, kapitaloversikt m.m.) er beskrevet i `PROSJEKT.md`.

---

## 1. Hva er dette?

Et **internt styringsverktøy for eiendomsinvestering**, bygget som én Next.js-app. Det dekker
hele livsløpet til en investering — fra analyse av et potensielt kjøp, via oppussing og drift,
til utleie og salg — for **to markeder**: Spania (Costa del Sol) og Norge.

Systemet er tungt AI-drevet (Claude) for analyse, OCR, bildebehandling og en chat-agent.

> Historikk: appen hadde tidligere også en offentlig utleieportal og en betalt
> boliginspeksjonstjeneste (med Stripe). Begge ble fjernet i Fase A — se `PROSJEKT.md`.

### Én flate

| Flate | Målgruppe | Tilgang |
|---|---|---|
| `/admin` | Eier/drift | Sesjons-cookie (`/api/auth`) |
| `/` | — | Redirecter til `/admin` |

---

## 2. Teknisk stack

| Lag | Teknologi | Fil/pakke |
|---|---|---|
| Rammeverk | Next.js 16.2 (App Router) | `next@16.2.4` |
| UI | React 19.2, inline-styles (ingen CSS-rammeverk) | `app/lib/styles.ts` |
| Språk | TypeScript 5 | `tsconfig.json` |
| Database + fillagring | Supabase (Postgres + Storage) | `@supabase/supabase-js` |
| AI (tekst/vision) | Anthropic Claude (`sonnet`) | `@anthropic-ai/sdk` |
| AI (bildegenerering) | Replicate (Nano Banana / Flux Kontext) | `replicate` |
| E-post | Resend | `resend` |
| Bildebehandling | sharp | `sharp` |
| PDF | jsPDF + autotable | `jspdf`, `jspdf-autotable` |
| Nettskraping | rå `fetch` + regex (ikke cheerio/playwright i praksis) | — |

**Scripts:** `npm run dev` · `npm run build` · `npm run start` · `npm run lint`

> Merk: `next.config.ts` er tom (ingen custom config). Stripe ble avinstallert i Fase A.

---

## 3. Mappestruktur

```
app/
  page.tsx                  Redirect → /admin (portalen er fjernet)
  layout.tsx                Root layout (Geist-fonter, Toaster, metadata)
  globals.css               Animasjoner + utility-klasser (anim-fade-up, skimmer, kort-loft …)
  types.ts                  ★ Domenemodellen — all TypeScript-typing samlet her
  admin/page.tsx            Adminpanel (11 seksjoner, lazy-loaded)
  api/                      Route handlers (se §6)
  components/               React-komponenter (se §5)
    portefolje/faner/       Faner i eiendomsdetalj
    norsk/                  Norsk kalkulator-modul
  lib/                      Forretningslogikk + infrastruktur (se §4)
next.config.ts             (tom)
migrasjoner/               SQL-migrasjoner (kjøres manuelt i Supabase)
```

> Fjernet i Fase A: `app/bolig/`, `app/laast/`, `app/inspeksjon/`, `app/api/inspeksjon/`,
> `app/api/utleie-portal/`, `app/api/portal-tilgang/`, `app/components/portal/`, `middleware.ts`.

---

## 4. `app/lib/` — forretningslogikk & infrastruktur

Delt i tre lag: **rene beregninger**, **PDF-byggere**, og **infrastruktur**.

### 4.1 Rene beregningsfunksjoner (single source of truth)

> Prinsipp: samme funksjon brukes både live i UI **og** når PDF-ene rekonstruerer tallene
> fra lagret Supabase-state. Det garanterer at PDF alltid matcher skjerm. Endrer du en
> formel, endres begge steder samtidig.

| Fil | Marked | Ansvar |
|---|---|---|
| `beregninger.ts` | 🇪🇸 | Total investering, cashflow, yield, ROI. `beregnSalg`: kapitalgevinstskatt **19 % (EU) / 24 % (ikke-EU)** + plusvalía + 3 % kildeskatt-retention |
| `utleie.ts` | 🇪🇸 | Airbnb-motor: nattpris × belegg × dager, interpolerer år 1 → etablert, 3 scenarier. `beregnAar` gir full årsoversikt |
| `catastro.ts` | 🇪🇸 | Slår opp spansk matrikkel (areal, byggeår) fra gratis Catastro OVC-API |
| `norskKalkulator.ts` | 🇳🇴 | Flippe-/bo-og-flipp-kalkyle: dokumentavgift, holdekostnader, skatt (**22 %**, fritak ≥12 mnd botid). `regnFinansiering` modellerer hva banken faktisk finansierer + refinansiering etter oppussing |
| `norskBankScore.ts` | 🇳🇴 | Bankscore 0–100: gjeldsgrad 25 % (Finanstilsynets 5×-regel), belåningsgrad 25 %, betjeningsevne 30 % (SIFO-livsopphold), stresstest +3pp 20 %. `regnTotalScore` = AI-flippescore + bankscore + megler-realisme |
| `offmarket.ts` | 🇳🇴 | Adressesøk mot Geonorge/matrikkel, dyplenker (SeEiendom/NVE/Enova), budkalkyle (2,5 % dokumentavgift) |
| `portefolje.ts` | felles | KPI for eide eiendommer: cashflow, LTV (`belaningsgrad`), yield, `rentesjokk`-stresstest, `annuitetMnd` |
| `oppussing.ts` | felles | Oppussingsbudsjett, ROI, brutto fortjeneste, `erEstimatUtdatert` |
| `oppgaver.ts` | felles | `beregnEffektivPrioritet` (frist-eskalering), `fristTekst` |
| `prosjektSync.ts` | felles | Holder duplikate felt (leie/lån) konsistente mellom `prosjekter` og `utleieanalyse`. ⚠️ Planlagt fjernet i B7 (én kilde per tall) |

### 4.2 PDF-byggere (jsPDF, dynamisk importert)

| Fil | Genererer |
|---|---|
| `pdf.ts` | Spansk prosjekt-PDF (full analyse + før/etter-bilder) |
| `pdfNorsk.ts` | ★ Norsk flippe-prospekt "klart til bankmøte" (~1130 linjer). Rekonstruerer hele kalkylen fra `norskKalkulator.ts` + `norskBankScore.ts` |
| `pdfCashflow.ts` | Årsrapport for regnskapsfører fra `eiendom_cashflow` |
| `pdfSalgspakke.ts` | Kjøper-/investorrettet salgspakke (server-side, laster bilder direkte) |
| `pdfOffmarket.ts` / `pdfOffmarketBank.ts` | Off-market-rapport (vanlig + bankvennlig) |

### 4.3 Infrastruktur / sikkerhet

| Fil | Ansvar |
|---|---|
| `supabase.ts` | Anon-klient (klient-side). Bruker `NEXT_PUBLIC_SUPABASE_KEY` (ikke `_ANON_KEY`) |
| `supabaseAdmin.ts` | `hentSupabaseAdmin()` — service-role singleton (server-side, de fleste API-ruter) |
| `requireAuth.ts` | HMAC-signert HTTPOnly sesjons-cookie `admin-sesjon` (7 dager, `timingSafeEqual`) |
| `aktivBruker.ts` | Klient-side "hvem er innlogget" via localStorage (kun UI, ikke sikkerhet) |
| `rateLimit.ts` | In-memory per IP (login 10/min). ⚠️ Kun per Vercel-instans — trenger Redis for skalering |
| `epost.ts` | Resend-integrasjon, avsender `post@loeiendom.com`, signatur + tekst→HTML |
| `logg.ts` | `loggAktivitet` → `aktivitetslogg`-tabellen |
| `styles.ts` | Design-tokens: `FARGER`, `RADIUS`, `SHADOW`, `MOTION`, `SPACING`, `BREAKPOINT` + input-hjelpere |
| `format.ts` | `fmtNok`, `fmtEur`, `fmtBelop` (skjermformatering) |

---

## 5. `app/components/` — komponenter etter funksjonsområde

**A. Analyse av nye kjøp:** `Boliganalyse` (Spania), `NorskeBoliger` (Finn-flipp, cacher per URL),
`Offmarket`/`OffmarketDetalj`, `TakstAnalyse`, `ScoreKort`.

**B. Norsk kalkulator-modul (`norsk/`):** `types.ts`, `KalkInput`, `HusholdningPanel`,
`SalgEgenBolig`, `LagredeProsjekter`.

**C. Prosjekt- & regnskapsstyring:** `Regnskap` (nav for ett prosjekt), `ProsjektFelter`,
`Oppussingsbudsjett`, `Utleieanalyse`, `Selge`/`SalgsanalyseVisning`, `Salgspakke`,
`Dokumenter`, `Kvitteringer`, `ProsjektBilder`, `NesteSteg`, `ProsjektDialog`, `TilbudHistorikk`,
`BoligerSeksjon`/`BoligListe`. `SendForesporselModal` (håndverker-forespørsel med bilder — brukt
av `ProsjektBilder` og `Oppussingsbudsjett`).

**D. Portefølje — eide eiendommer (`portefolje/`):** `Portefolje`, `PortefoljeDashboard`,
`EiendomKort`, `EiendomDetalj`, `useEiendomData` (sentral data-hook). Faner (`faner/`):
`EiendomOversikt`, `EiendomVerdi`, `EiendomLaan`, `EiendomInntekter`, `EiendomKostnader`,
`EiendomCashflow`, `EiendomLeietakere`, `EiendomAi` + wrappere `EiendomOppussing/Bilder/Dokumenter/Kvitteringer`.

**E. Håndverk & timer:** `Handverkere` (register + forespørsler med AI-oversettelse), `Timer`.
E-post: `SendteEposter`, `EpostGodkjenningsKort`.

**F. AI-assistent:** `AgentChat` (flytende Claude-chat med tool_use, PDF- og e-postutkast).

**G. Felles:** `Dashboard`, `Oppgaver`, `Aktivitetslogg`, `Innlogging`, `Toaster`.

> Fjernet i Fase A: `components/portal/*` (PortalHeader, InteresseModal), `UtleiePortalAdmin`,
> `Inspeksjon`. Admin-UI er hardkodet på norsk (den flerspråklige i18n hørte til portalen og er fjernet).

---

## 6. API-ruter (`app/api/`)

Mønster: alle ruter bruker `requireAuth(req)` + `hentSupabaseAdmin()`. AI via `@anthropic-ai/sdk`.

| Gruppe | Ruter |
|---|---|
| **Auth/oppsett** | `auth` (login/logout/sesjon), `auth/brukere`, `husholdning-default`, `dashboard` |
| **Analyse (AI)** | `analyse` (Spania), `analyse-norge` (Finn), `airbnb`, `analyse-takst` (vision), `catastro`, `agent/salgsestimat` |
| **AI-agent** | `agent` (chat + e-postutkast) |
| **Dokumenter** | `dokument/{last-opp,oppdater,signert-url,slett}`, `dokument-sjekkpunkt` |
| **Kvitteringer (OCR)** | `kvittering/{last-opp,analyser,oppdater,signert-url,slett}` |
| **Bilder** | `bilder/{last-opp,analyser,generer,generer/[id],signert-url,slett}` |
| **E-post** | `epost/send` (Resend) |
| **Portefølje** | `portefolje/{ai-forslag,cashflow-pdf,verdivurdering-fil}`, `salgspakke` |
| **Salg** | `selge/analyse` |
| **Off-market** | `offmarket/{innhent,sammenlignbar,analyse,pdf,bank-pdf}` |
| **Håndverker** | `handverker/{send-foresporsel,oversett}` |

Alle krever admin-auth. Lange AI-ruter setter `maxDuration` (300s for `airbnb`, `offmarket/analyse`; 60s for `salgspakke`, `handverker/send-foresporsel`).

> Fjernet i Fase A: `api/inspeksjon/*`, `api/utleie-portal/*`, `api/portal-tilgang`.

---

## 7. Autentisering & tilgang

Én mekanisme igjen etter Fase A:

**Admin-sesjon** (`requireAuth.ts`) — HMAC-signert cookie `admin-sesjon`. Brukere defineres i
`APP_USERS` (JSON) eller `APP_USERNAME`/`APP_PASSWORD`. Beskytter alle API-ruter.

`aktivBruker.ts` (localStorage) er kun UI-hint — **ikke** sikkerhet; server verifiserer alltid sesjons-cookien.

> Fjernet i Fase A: portal-passordvegg (`middleware.ts` + `portalAuth.ts`) og de token-baserte
> kundesidene for inspeksjon.

---

## 8. Datamodell (Supabase)

Sentral tabell: **`prosjekter`** — bred rad som dekker begge markeder (kjøpesum, oppussing, leie,
lån, `kategori: flipp|utleie`, `marked: spania|norge`) og lagrer AI-resultater som **JSONB-blobber**:
`bolig_data`, `airbnb_score`, `airbnb_data`, `salgsanalyse_data`, `norsk_kalkulator_data`,
`portefolje_ai_data`, `off_market_data`. `er_portefolje` + `eieretappe`
(analyse → under_kjøp → eid → salgsklar → solgt) markerer eide eiendommer.

| Domene | Tabeller |
|---|---|
| Oppussing | `oppussing_budsjett`, `oppussing_poster`, `oppussing_tillegg` |
| Portefølje (eide) | `eiendom_laan`, `eiendom_inntekter`, `eiendom_kostnader`, `eiendom_verdivurderinger`, `eiendom_cashflow`, `eiendom_leietakere` |
| Dokumentflyt | `dokumenter`, `dokument_sjekkpunkter`, `kvitteringer` (OCR-felt), `prosjekt_bilder` |
| Utleieanalyse | `utleieanalyse` |
| Drift | `oppgaver`, `handverkere`, `tilbudsforesporsler`, `timeloggning`, `eposter`, `aktivitetslogg`, `husholdning_default` |

Storage-buckets: `bilder`, `dokumenter` (private — tilgang via signerte URL-er).

Domenemodellen i TypeScript er samlet i **`app/types.ts`**.

> Fjernet i Fase A (via `migrasjoner/`): tabellene `inspeksjon_bestillinger`,
> `inspeksjon_rapporter`, `inspeksjon_tilbud`, `utleie_foresporsler`, `interesse_registreringer`;
> portal-/publiserings- og `*_oversettelser`-kolonner på `prosjekter`; storage-bucket `inspeksjon`.

---

## 9. Typisk dataflyt (livsløp for en investering)

```
1. ANALYSE     Admin analyserer annonse (Spania /api/analyse el. Finn /api/analyse-norge)
               → Claude gir score/strategi → lagres som JSONB på prosjekter
2. KJØP        Prosjekt får budsjett, dokumentsjekkliste, kvitteringer (OCR via Claude vision)
3. OPPUSSING   Bilder lastes opp → AI-analyse → Replicate genererer "etter"-visualisering
4. UTLEIE/SALG Utleieanalyse (beregnAar) eller salgskalkyle. prosjektSync holder leie/lån i synk
5. RAPPORT     PDF for bankmøte (pdfNorsk), regnskapsfører (pdfCashflow), kjøper (pdfSalgspakke)
   → alt logges i aktivitetslogg
```

---

## 10. Miljøvariabler

| Variabel | Brukes til |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-URL (klient + server) |
| `NEXT_PUBLIC_SUPABASE_KEY` | Anon-nøkkel (klient-side) — **merk uvanlig navn** |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role (server-side admin-klient) |
| `ANTHROPIC_API_KEY` | Claude (all AI) |
| `RESEND_API_KEY` | E-post |
| `BILDE_MODELL` | Overstyr Replicate-bildemodell (default Nano Banana) |
| `APP_USERS` (JSON) el. `APP_USERNAME`/`APP_PASSWORD` | Admin-brukere |
| `AUTH_SECRET` | HMAC-hemmelighet for sesjons-cookie (utledes fra APP_* hvis mangler) |
| `EPOST_SIGNATUR_LINJER` | E-postsignatur |

> Utgått i Fase A: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`,
> `PORTAL_PASSORD`, `UTLEIE_FORESPORSEL_EPOST`.

---

## 11. Konvensjoner & fallgruver

- **Språk i kode:** norsk (variabler, funksjoner, kommentarer, æøå i felt som `kjøpesum`). Følg dette.
- **Ingen CSS-rammeverk:** all styling via inline-styles + `app/lib/styles.ts`-tokens. Nye animasjoner legges i `app/globals.css`.
- **Beregninger er delt sannhet:** endrer du en formel i `lib/`, sjekk at PDF-en som bruker den fortsatt stemmer.
- **`prosjektSync`:** leie/mnd og lån/mnd lagres to steder (`prosjekter` + `utleieanalyse`) — bruk sync-funksjonene. Fjernes i B7 (én kilde per tall).
- **Rate-limit er in-memory:** fungerer bare per instans. Ved skalering trengs Redis.
- **Next.js med breaking changes:** se `AGENTS.md` — les `node_modules/next/dist/docs/` før Next-spesifikk kode.
- **Supabase-nøkkelnavn:** klient-anon bruker `NEXT_PUBLIC_SUPABASE_KEY`, ikke standard `_ANON_KEY`.
- **Ny SQL → utklippstavlen:** generert SQL legges på clipboard for innliming i Supabase SQL Editor.
