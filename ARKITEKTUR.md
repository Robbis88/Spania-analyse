# Arkitektur & utviklerguide — Loeiendom (Leganger & Osvaag)

> Komplett oversikt for utviklere. Les denne før du begynner å endre kode.
> Se også `AGENTS.md`: dette er en Next.js-versjon med breaking changes — slå opp i
> `node_modules/next/dist/docs/` før du skriver Next.js-spesifikk kode.

---

## 1. Hva er dette?

En **eiendomsplattform** bygget som én Next.js-app. Den dekker hele livsløpet til en
eiendomsinvestering — fra analyse av et potensielt kjøp, via oppussing og drift, til utleie
og salg — for **to markeder**: Spania (Costa del Sol) og Norge. I tillegg driver den en
offentlig kundeportal og en betalt boliginspeksjonstjeneste.

Systemet er tungt AI-drevet (Claude) for analyse, OCR, bildebehandling, oversettelse og en
chat-agent.

### Tre flater i én kodebase

| Flate | Målgruppe | Tilgang |
|---|---|---|
| `/`, `/bolig/[id]` | Kjøper/leietaker | Offentlig (evt. bak `/laast`) |
| `/inspeksjon` | Boligeier | Offentlig, betaling via Stripe |
| `/inspeksjon/min/[token]` | Inspeksjonskunde | Token i URL (ingen innlogging) |
| `/laast` | Besøkende under utvikling | Tilgangskode |
| `/admin` | Eier/drift | Sesjons-cookie (`/api/auth`) |

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
| Betaling | Stripe (engangs + abonnement) | `stripe` |
| E-post | Resend | `resend` |
| Bildebehandling | sharp | `sharp` |
| PDF | jsPDF + autotable | `jspdf`, `jspdf-autotable` |
| Nettskraping | rå `fetch` + regex (ikke cheerio/playwright i praksis) | — |

**Scripts:** `npm run dev` · `npm run build` · `npm run start` · `npm run lint`

> Merk: `next.config.ts` er tom (ingen custom config). `cheerio` og `playwright` er i
> `package.json`, men API-rutene skraper med rå `fetch` + regex-stripping av HTML.

---

## 3. Mappestruktur

```
app/
  page.tsx                  Offentlig portal-forside
  layout.tsx                Root layout (Geist-fonter, Toaster, metadata)
  globals.css               Animasjoner + utility-klasser (anim-fade-up, skimmer, kort-loft …)
  types.ts                  ★ Domenemodellen — all TypeScript-typing samlet her
  admin/page.tsx            Adminpanel (12 seksjoner, lazy-loaded)
  bolig/[id]/page.tsx       Offentlig boligdetalj
  laast/page.tsx            Passordvegg
  inspeksjon/
    page.tsx                Bestillingsside (Stripe)
    min/[token]/page.tsx    Kundens "min side"
  api/                      ~53 route handlers (se §6)
  components/               ~40 React-komponenter (se §5)
    portefolje/faner/       Faner i eiendomsdetalj
    portal/                 Offentlige portal-komponenter
    norsk/                  Norsk kalkulator-modul
  lib/                      Forretningslogikk + infrastruktur (se §4)
middleware.ts               Portal-passordvegg (se §7)
next.config.ts             (tom)
```

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
| `inspeksjon.ts` | tjeneste | Prismodell: `BASIS_PRIS_EUR` × `TJENESTE_FAKTOR`, status-flyt |
| `oppgaver.ts` | felles | `beregnEffektivPrioritet` (frist-eskalering), `fristTekst` |
| `prosjektSync.ts` | felles | Holder duplikate felt (leie/lån) konsistente mellom `prosjekter` og `utleieanalyse` |

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
| `supabase.ts` | Anon-klient (klient-side + offentlige ruter). Bruker `NEXT_PUBLIC_SUPABASE_KEY` (ikke `_ANON_KEY`) |
| `supabaseAdmin.ts` | `hentSupabaseAdmin()` — service-role singleton (server-side, de fleste API-ruter) |
| `requireAuth.ts` | HMAC-signert HTTPOnly sesjons-cookie `admin-sesjon` (7 dager, `timingSafeEqual`) |
| `portalAuth.ts` | HMAC-token for `/laast`-veggen (Web Crypto, funker i Edge + Node) |
| `aktivBruker.ts` | Klient-side "hvem er innlogget" via localStorage (kun UI, ikke sikkerhet) |
| `rateLimit.ts` | In-memory per IP (login 10/min, portal 5/min). ⚠️ Kun per Vercel-instans — trenger Redis for skalering |
| `epost.ts` | Resend-integrasjon, avsender `post@loeiendom.com`, signatur + tekst→HTML |
| `logg.ts` | `loggAktivitet` → `aktivitetslogg`-tabellen |
| `stripe.ts` | Stripe-klient (`STRIPE_SECRET_KEY`) |
| `styles.ts` | Design-tokens: `FARGER`, `RADIUS`, `SHADOW`, `MOTION`, `SPACING`, `BREAKPOINT` + input-hjelpere |
| `i18n.ts` | Portal-i18n (8 språk) + `useValuta` (EUR/NOK/DKK/SEK, live-kurs via frankfurter.app) |
| `inspeksjon-i18n.ts` | Eget i18n for inspeksjonstjenesten (no/en/es) |
| `format.ts` | `fmtNok`, `fmtEur`, `fmtBelop` (skjermformatering) |

---

## 5. `app/components/` — komponenter etter funksjonsområde

**A. Analyse av nye kjøp:** `Boliganalyse` (Spania), `NorskeBoliger` (Finn-flipp, cacher per URL),
`Offmarket`/`OffmarketDetalj`, `TakstAnalyse`, `ScoreKort`.

**B. Norsk kalkulator-modul (`norsk/`):** `types.ts`, `KalkInput`, `HusholdningPanel`,
`SalgEgenBolig`, `LagredeProsjekter`.

**C. Prosjekt- & regnskapsstyring (Spania):** `Regnskap` (nav for ett prosjekt), `ProsjektFelter`,
`Oppussingsbudsjett`, `Utleieanalyse`, `Selge`/`SalgsanalyseVisning`, `Salgspakke`,
`Dokumenter`, `Kvitteringer`, `ProsjektBilder`, `NesteSteg`, `ProsjektDialog`, `TilbudHistorikk`,
`BoligerSeksjon`/`BoligListe`.

**D. Portefølje — eide eiendommer (`portefolje/`):** `Portefolje`, `PortefoljeDashboard`,
`EiendomKort`, `EiendomDetalj`, `useEiendomData` (sentral data-hook). Faner (`faner/`):
`EiendomOversikt`, `EiendomVerdi`, `EiendomLaan`, `EiendomInntekter`, `EiendomKostnader`,
`EiendomCashflow`, `EiendomLeietakere`, `EiendomAi` + wrappere `EiendomOppussing/Bilder/Dokumenter/Kvitteringer`.

**E. Utleieportal-admin:** `UtleiePortalAdmin` (publiserer til offentlig portal). `portal/`:
`PortalHeader`, `InteresseModal`. E-post: `SendForesporselModal`, `SendteEposter`, `EpostGodkjenningsKort`.

**F. Boliginspeksjon (admin):** `Inspeksjon` (~1200 linjer — bestillinger, rapport-/planlegg-/tilbud-modal, kalender).

**G. Håndverk & timer:** `Handverkere` (register + forespørsler med AI-oversettelse), `Timer`.

**H. AI-assistent:** `AgentChat` (flytende Claude-chat med tool_use, PDF- og e-postutkast).

**I. Felles:** `Dashboard`, `Oppgaver`, `Aktivitetslogg`, `Innlogging`, `Toaster`.

> Admin-UI er hardkodet på norsk. i18n gjelder kundevendte flater (portal + inspeksjon).

---

## 6. API-ruter (`app/api/`, ~53 handlers)

Mønster: admin-ruter bruker `requireAuth(req)` + `hentSupabaseAdmin()`. AI via `@anthropic-ai/sdk`.

| Gruppe | Ruter | Auth |
|---|---|---|
| **Auth/oppsett** | `auth` (login/logout/sesjon), `auth/brukere`, `husholdning-default`, `dashboard` | Krever (unntatt login) |
| **Analyse (AI)** | `analyse` (Spania), `analyse-norge` (Finn), `airbnb`, `analyse-takst` (vision), `catastro`, `agent/salgsestimat` | Krever |
| **AI-agent** | `agent` (chat + e-postutkast) | Krever |
| **Dokumenter** | `dokument/{last-opp,oppdater,signert-url,slett}`, `dokument-sjekkpunkt` | Krever |
| **Kvitteringer (OCR)** | `kvittering/{last-opp,analyser,oppdater,signert-url,slett}` | Krever |
| **Bilder** | `bilder/{last-opp,analyser,generer,generer/[id],signert-url,slett}` | Krever |
| **E-post** | `epost/send` (Resend) | Krever |
| **Portefølje** | `portefolje/{ai-forslag,cashflow-pdf,verdivurdering-fil}`, `salgspakke` | Krever |
| **Salg** | `selge/analyse` | Krever |
| **Off-market** | `offmarket/{innhent,sammenlignbar,analyse,pdf,bank-pdf}` | Krever |
| **Håndverker** | `handverker/{send-foresporsel,oversett}` | Krever |
| **Utleie-portal** | `utleie-portal` (GET liste), `utleie-portal/[id]`, `utleie-portal/oversett` | Blandet* |
| **Portal-forespørsler** | `utleie-portal/{foresporsel,interesse}` | Offentlig (rate-limit 5/min) |
| **Inspeksjon** | `inspeksjon/{bestill,checkout,kunde/[token]}` | Offentlig |
| **Inspeksjon (admin)** | `inspeksjon/rapport/{last-opp,signert-url}` | Krever |
| **Inspeksjon (system)** | `inspeksjon/webhook` (Stripe-signatur), `inspeksjon/paaminnelser` (CRON_SECRET) | Egen |
| **Portal-vegg** | `portal-tilgang` (validerer `PORTAL_PASSORD`) | Offentlig |

\* `utleie-portal` GET-listing/detalj er offentlig; `oversett` krever auth.

Lange AI-ruter setter `maxDuration` (300s for `airbnb`, `offmarket/analyse`; 60s for `salgspakke`, `handverker/send-foresporsel`).

---

## 7. Autentisering & tilgang

Det finnes **tre uavhengige tilgangsmekanismer**:

1. **Admin-sesjon** (`requireAuth.ts`) — HMAC-signert cookie `admin-sesjon`. Brukere defineres i
   `APP_USERS` (JSON) eller `APP_USERNAME`/`APP_PASSWORD`. Beskytter alle admin-API-ruter.
2. **Portal-vegg** (`middleware.ts` + `portalAuth.ts`) — hvis `PORTAL_PASSORD` er satt, låses hele
   den offentlige portalen bak `/laast`. Admin og alle admin-API-ruter er unntatt (whitelist i
   middleware). Ingen `PORTAL_PASSORD` = portal åpen.
3. **Kunde-token** — inspeksjonskunder får en unik token i URL (`/inspeksjon/min/[token]`), ingen
   innlogging. Stripe-webhook validerer signatur; cron validerer `CRON_SECRET`.

`aktivBruker.ts` (localStorage) er kun UI-hint — den er **ikke** sikkerhet; server verifiserer alltid sesjons-cookien.

---

## 8. Datamodell (Supabase)

Sentral tabell: **`prosjekter`** — bred rad som dekker begge markeder (kjøpesum, oppussing, leie,
lån, `kategori: flipp|utleie`, `marked: spania|norge`, publiseringsfelt + `*_oversettelser`) og
lagrer AI-resultater som **JSONB-blobber**: `bolig_data`, `airbnb_score`, `airbnb_data`,
`salgsanalyse_data`, `norsk_kalkulator_data`, `portefolje_ai_data`, `off_market_data`.
`er_portefolje` + `eieretappe` (analyse → under_kjøp → eid → salgsklar → solgt) markerer eide eiendommer.

| Domene | Tabeller |
|---|---|
| Oppussing | `oppussing_budsjett`, `oppussing_poster`, `oppussing_tillegg` |
| Portefølje (eide) | `eiendom_laan`, `eiendom_inntekter`, `eiendom_kostnader`, `eiendom_verdivurderinger`, `eiendom_cashflow`, `eiendom_leietakere` |
| Dokumentflyt | `dokumenter`, `dokument_sjekkpunkter`, `kvitteringer` (OCR-felt), `prosjekt_bilder` |
| Utleieanalyse | `utleieanalyse` |
| Portal/kunde | `utleie_foresporsler`, `interesse_registreringer` |
| Inspeksjon | `inspeksjon_bestillinger` (+ rapporter/tilbud) |
| Drift | `oppgaver`, `handverkere`, `tilbudsforesporsler`, `timeloggning`, `eposter`, `aktivitetslogg`, `husholdning_default` |

Storage-buckets: `bilder`, `dokumenter`, `inspeksjon` (private — tilgang via signerte URL-er).

Domenemodellen i TypeScript er samlet i **`app/types.ts`** (`Prosjekt`, `Eiendom*`, `Oppussing*`,
`Airbnb*`, `Dokument`, `Kvittering`, m.fl. + factory-funksjonene `tomtProsjekt()`/`tomBolig()`).

---

## 9. Typisk dataflyt (livsløp for en investering)

```
1. ANALYSE     Admin analyserer annonse (Spania /api/analyse el. Finn /api/analyse-norge)
               → Claude gir score/strategi → lagres som JSONB på prosjekter
2. KJØP        Prosjekt får budsjett, dokumentsjekkliste, kvitteringer (OCR via Claude vision)
3. OPPUSSING   Bilder lastes opp → AI-analyse → Replicate genererer "etter"-visualisering
4. UTLEIE/SALG Utleieanalyse (beregnAar) eller salgskalkyle. prosjektSync holder leie/lån i synk
5. PUBLISERING UtleiePortalAdmin publiserer bolig (m/ oversettelser) til offentlig portal
6. KUNDE       Ser bolig på /, registrerer interesse el. bestiller inspeksjon (Stripe)
7. RAPPORT     PDF for bankmøte (pdfNorsk), regnskapsfører (pdfCashflow), kjøper (pdfSalgspakke)
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
| `STRIPE_SECRET_KEY` | Stripe |
| `STRIPE_WEBHOOK_SECRET` | Verifiserer Stripe-webhook |
| `BILDE_MODELL` | Overstyr Replicate-bildemodell (default Nano Banana) |
| `APP_USERS` (JSON) el. `APP_USERNAME`/`APP_PASSWORD` | Admin-brukere |
| `AUTH_SECRET` | HMAC-hemmelighet for sesjons-cookie (utledes fra APP_* hvis mangler) |
| `PORTAL_PASSORD` | Låser offentlig portal (tom = åpen) |
| `CRON_SECRET` | Beskytter inspeksjons-cron |
| `UTLEIE_FORESPORSEL_EPOST` | Mottaker for portal-forespørsler |
| `EPOST_SIGNATUR_LINJER` | E-postsignatur |

---

## 11. Konvensjoner & fallgruver

- **Språk i kode:** norsk (variabler, funksjoner, kommentarer, æøå i felt som `kjøpesum`). Følg dette.
- **Ingen CSS-rammeverk:** all styling via inline-styles + `app/lib/styles.ts`-tokens. Nye animasjoner legges i `app/globals.css`.
- **To i18n-systemer:** `i18n.ts` (portal, 8 språk) og `inspeksjon-i18n.ts` (tjeneste, 3 språk) — egne dictionaries, ikke bibliotek.
- **Beregninger er delt sannhet:** endrer du en formel i `lib/`, sjekk at PDF-en som bruker den fortsatt stemmer.
- **`prosjektSync`:** leie/mnd og lån/mnd lagres to steder (`prosjekter` + `utleieanalyse`) — bruk sync-funksjonene, ikke skriv direkte.
- **Rate-limit er in-memory:** fungerer bare per instans. Ved skalering trengs Redis.
- **Next.js med breaking changes:** se `AGENTS.md` — les `node_modules/next/dist/docs/` før Next-spesifikk kode.
- **Supabase-nøkkelnavn:** klient-anon bruker `NEXT_PUBLIC_SUPABASE_KEY`, ikke standard `_ANON_KEY`.
```
