# PROSJEKT: Loeiendom v2 — Rydding + Beslutningsmotor

> Kontekst for Claude Code: Eksisterende Next.js 16.2-kodebase (se `ARKITEKTUR.md` i repoet).
> Dette er IKKE et nybygg. Beregningslogikken i `app/lib/` er verifisert og skal bevares.
> Prosjektet har to faser: (A) fjerne dødvekt, (B) bygge beslutningsmotor og kapitaloversikt oppå eksisterende `lib/`-funksjoner.

---

## 0. Formål og forretningskontekst

Loeiendom AS (tidl. Osvaag Eiendom AS, eid 50/50 av Robert Leganger og Ronny Osvaag) driver kjøp–oppussing–salg/utleie av bolig i Norge. Et spansk SL (under etablering, rådgivere: Almudena/Mislav) skal eie spanske boliger. Loeiendom AS låner ut kapital til SL for kjøp i Spania.

Systemets jobb: **for hver eiendom, kontinuerlig svare på "hva er beste bruk av denne akkurat nå?"** — flipp / langtidsleie / korttidsleie / behold+refinansier — og på porteføljenivå svare på **"hvor mye kan vi kjøpe for neste runde?"**

Visjon: *Loeiendom er en digital investeringspartner som kontinuerlig analyserer hver eiendom, hele porteføljen og kapitalen — og alltid forteller hva som er neste beste beslutning.* Systemet anbefaler med begrunnelse og regnestykke bak; det gir ALDRI falske sikkerhetsprosenter ("96 % sikker") — anbefalinger skal kunne etterprøves, ikke bare stoles på.

Første ekte case: **Søndre Skogvei, Bergen** — kjøpt 2,9 MNOK + omkostninger, under oppbygging.

Designprinsipp nr. 1: **Enkel i bruk, ikke nødvendigvis enkel under panseret.** Minst mulig manuell inntasting, svaret først og regnestykket bak, én ting per skjerm. All data legges inn manuelt — ingen nye integrasjoner (ingen skraping, ingen bankfeeds, ingen Tripletex).

---

## FASE A — Rydding (gjøres først, egen commit-serie)

### A1. Slett: Inspeksjonstjenesten
- Ruter: `app/inspeksjon/` (bestillingsside + `min/[token]`)
- API: `app/api/inspeksjon/*` (bestill, checkout, kunde, rapport, webhook, paaminnelser)
- Komponent: `app/components/Inspeksjon.tsx` (~1200 linjer)
- Lib: `app/lib/inspeksjon.ts`, `app/lib/inspeksjon-i18n.ts`
- DB: `inspeksjon_bestillinger` (+ rapporter/tilbud) — lag migrasjonsscript som dropper tabellene. Ta backup-eksport (CSV) før dropp.
- Storage-bucket `inspeksjon`: eksporter innhold, deretter slett.
- Env-variabler som utgår: `CRON_SECRET`
- Fjern cron-oppsett i Vercel hvis konfigurert.

### A2. Slett: Stripe (all betaling)
- `app/lib/stripe.ts`, alle Stripe-referanser i API-ruter
- `npm uninstall stripe`
- Env-variabler som utgår: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### A3. Slett: Offentlig utleieportal
- Ruter: offentlig forside `app/page.tsx` (portal-varianten), `app/bolig/[id]/`, `app/laast/`
- API: `app/api/utleie-portal/*`, `app/api/portal-tilgang`
- Komponenter: `app/components/portal/*`, `UtleiePortalAdmin`, `SendForesporselModal`, `InteresseModal`
- Middleware: fjern portal-passordvegg fra `middleware.ts` (behold evt. tom middleware)
- Lib: `app/lib/portalAuth.ts`, `app/lib/i18n.ts` (8-språks portal-i18n) — **MEN**: sjekk om `useValuta` (EUR/NOK-kurs via frankfurter.app) brukes i admin. Hvis ja, flytt `useValuta` til egen fil `app/lib/valuta.ts` før sletting.
- DB: `utleie_foresporsler`, `interesse_registreringer` — backup + dropp. Fjern `*_oversettelser`- og publiseringsfelt fra `prosjekter` i egen migrasjon.
- Env-variabler som utgår: `PORTAL_PASSORD`, `UTLEIE_FORESPORSEL_EPOST`
- Roten `/` redirecter nå til `/admin` (eller login).

### A4. Behold uendret
- **Håndverkerregisteret** (`Handverkere`, `handverker/*`-API, AI-oversettelse, `tilbudsforesporsler`) — brukes aktivt i Spania.
- Hele `app/lib/`-beregningslaget, PDF-byggerne, auth (`requireAuth`), OCR-kvitteringer, aktivitetslogg, Resend-epost, Timer.
- E-post-agenten og `AgentChat`.

### A5. Verifisering etter rydding
- `npm run build` grønn, `npm run lint` grønn
- Manuell test: login → admin → åpne et eksisterende prosjekt → alle faner fungerer → generer én PDF (pdfNorsk)

---

## FASE B — Påbygg (bygges oppå eksisterende `lib/`)

### Dataflyt-prinsipp (overordnet, gjelder alt i fase B)

**Hvert tall har nøyaktig ÉN kilde.** Ingen sync-funksjoner, ingen duplikatfelt, ingen jobb som gjøres to steder. Dataflyten går én vei:

```
tilbud/manuelle felt (B8/B5)  →  scenariomotor (B4)  →  porteføljerangering (B6)  →  kapitaloversikt (B3)
        (kilde)                     (beregner)              (aggregerer)               (aggregerer)
```

- Kildedata lagres én gang, i én tabell. Alt annet BEREGNES ved lesing (via `lib/`-funksjonene) — aldri lagret på nytt et annet sted.
- Renoveringskost har én autoritativ kjede: akseptert tilbud (B8) → kan overstyres av "min vurdering" (B5) → brukes overalt. `oppussing_budsjett` forblir detaljbudsjettet BAK tallet, ikke en konkurrerende kilde — scenariomotoren leser toppsummen fra ett definert sted.
- Før en ny tabell eller et nytt felt opprettes: sjekk om tallet allerede finnes. Finnes det, bruk det derfra — ikke kopier.

### B1. Selskaps-entitet (grunnmur for alt annet)

Ny tabell `selskaper`:

```sql
create table selskaper (
  id uuid primary key default gen_random_uuid(),
  navn text not null,               -- 'Loeiendom AS', 'RG Casas SL' (navn TBD)
  land text not null check (land in ('norge','spania')),
  valuta text not null check (valuta in ('NOK','EUR')),
  skatteprofil jsonb not null,      -- satser per land, se B1.1
  opprettet timestamptz default now()
);
```

`prosjekter` får `selskap_id uuid references selskaper(id)`. Migrasjon: alle eksisterende rader med `marked='norge'` → Loeiendom AS, `marked='spania'` → SL. `marked`-feltet beholdes (visningsfilter), men skatt/regler hentes fra selskapets `skatteprofil` — ikke hardkodet i beregningsfunksjonene lenger.

#### B1.1 Skatteprofil (jsonb, redigerbar i admin)
- Norge: gevinstskatt 22 %, fritaksregler, dokumentavgift 2,5 %, utleiebeskatning
- Spania: gevinst 19/24 %, plusvalía-parametre, 3 % retention, ITP/omkostninger, VFT-krav (flagg)
- Eksisterende funksjoner (`norskKalkulator.ts`, `beregninger.ts`) refaktoreres til å ta satser som parameter med dagens verdier som default — **formlene endres ikke**.

### B2. Konsernlån-modul (Loeiendom AS → SL)

Ny tabell `konsernlaan`:

```sql
create table konsernlaan (
  id uuid primary key default gen_random_uuid(),
  fra_selskap uuid references selskaper(id),
  til_selskap uuid references selskaper(id),
  hovedstol numeric not null,
  valuta text not null,
  rente_pct numeric not null,       -- armlengdes rente, settes manuelt etter råd fra Almudena/norsk skatterådgiver
  startdato date not null,
  nedbetalinger jsonb default '[]', -- [{dato, belop}]
  notat text
);
```

Effekt i kapitaloversikten (B3): fordring binder kapital hos långiver, gjeld+likviditet hos låntaker. Påløpte renter beregnes og vises, men bokføres IKKE her (regnskap skjer i DNB Regnskap / gestoría — systemet er styringsverktøy, ikke regnskapssystem).

⚠️ Ikke bygg automatikk rundt skatt på konsernlån — vis kun tallene. Rentesats og lån-vs-EK-innskudd avklares med rådgivere før første utbetaling.

### B3. Kapitaloversikt / "kjøpekraft neste runde"

Ny side i admin: **Kapital**. Per selskap + konsolidert:

- Bundet EK per eiendom: siste verdivurdering − gjeld (`eiendom_laan`) − estimert salgskost
- Fri likviditet: manuelt felt per selskap (oppdateres av Robert)
- Utestående konsernlån (fordring/gjeld)
- Lånekapasitet: manuelt felt (bankramme) — evt. estimat via `norskBankScore.regnFinansiering`
- → **Kjøpekraft** = fri likviditet + tilgjengelig ramme, vist stort øverst

Gjenbruk: `portefolje.ts` (LTV, `belaningsgrad`), `norskKalkulator.regnFinansiering` (refinansieringspotensial per objekt vises som "frigjørbar kapital").

### B4. Beslutningsmotoren — én side, fire svar

Kjernen i v2 (omtales i UI som "Beslutning"). Per eiendom (både `eieretappe='analyse'` og `eid`) én **Beslutning**-fane:

| Scenario | Gjenbruker | Output |
|---|---|---|
| Flipp / selg nå | `norskKalkulator.ts` / `beregnSalg` (Spania) | Gevinst etter skatt, frigjort kapital, effekt på kjøpekraft |
| Langtidsleie | `portefolje.ts` + `utleieanalyse` | Netto yield på **bundet EK**, cashflow/mnd |
| Korttidsleie | `utleie.ts` (Airbnb-motor, 3 scenarier) | Yield på bundet EK, belegg-følsomhet |
| Behold + refinansier | `regnFinansiering` | Frigjort kapital ved refi, ny cashflow, ny LTV |

Alle fire regnes med selskapets skatteprofil. Øverst på siden: **anbefaling i klartekst** (Claude via eksisterende agent-mønster) med begrunnelse — f.eks. "Selg innen Q2: flipp gir 480' etter skatt og løfter kjøpekraften til 2,1 MNOK; langtidsleie gir bare 4,2 % på bundet EK, under terskelen din på 6 %." Regnestykket bak er alltid ett klikk unna.

Terskler (f.eks. min. yield på bundet EK per land) lagres i `selskaper.skatteprofil` eller egen `innstillinger`-tabell, redigerbar.

### B5. "Dine tall vinner" + lærende estimater

- I analyse-/beslutningsvisningen har hvert nøkkeltall to verdier: **AI-estimat** (med begrunnelse) og **min vurdering** (input-felt). Er "min vurdering" fylt ut, brukes den i ALLE beregninger. AI-tallet står som referanse med avviket synlig.
- Ny tabell `estimat_justeringer`: `{prosjekt_id, felt, ai_verdi, min_verdi, kontekst (marked/kommune/type), tidspunkt}`. Ved solgt/utleid objekt lagres også **faktisk verdi**.
- Når AI-en lager nye estimater, sendes relevante historiske justeringer + fasit inn i prompten ("Robert har justert renoveringskost ned ~30 % på Bergen-objekter fordi arbeid gjøres internt; faktisk kost på Søndre Skogvei ble X"). Ingen ML — kun kontekst i prompt.

### B6. Porteføljerangering med flagging

Utvid Portefølje-dashboardet:

- Rangert liste: alle eide eiendommer sortert på **avkastning på bundet EK** (årlig netto / bundet EK)
- Flagg under terskel, med årsak + anbefalt handling:
  - leie < markedsleie (manuelt felt per objekt) → **"Øk leien til X"**
  - leie OK men verdi steget mye → **"Selg — frigjør Y i kapital"**
  - driftskost > normtall → **"Gjennomgå kostnader"** (list største poster fra `eiendom_kostnader`)
  - langtid svak, korttid-estimat godt → **"Vurder Airbnb"** (kjør `utleie.ts` som sammenligning)
- Toppen av siden: kjøpekraft (fra B3). Gjenbruk `rentesjokk`-stresstesten som kolonne.

### B8. Tilbudsopplasting — renoveringskost fra faktiske tilbud

Renoveringskost i scenariomotoren skal komme fra opplastede tilbud, ikke fra integrasjoner. Gjenbruker eksisterende mønstre: `TilbudHistorikk`-komponenten, `tilbudsforesporsler`-tabellen, dokumentopplasting og OCR-flyten fra kvitteringer (Claude vision).

- Last opp tilbud (PDF/bilde) per prosjekt → AI trekker ut: aktør, totalsum, poster, hva som inngår/ikke inngår, gyldighetsdato
- Tilbud vises side om side per prosjekt for sammenligning
- Ett tilbud markeres som **akseptert** → summen blir `renoveringskost` i scenariomotoren (B4). Kan overstyres manuelt (B5-mønsteret: dine tall vinner)
- Internt arbeid (Ronny) legges inn som manuelt "internt tilbud" — samme datamodell, ingen systemkobling
- Alle tilbud (aksepterte og ikke) lagres med kontekst (type arbeid, marked, kommune) og mater `estimat_justeringer`-historikken (B5) — over tid gir dette reelle prisdata per arbeidstype hos aktørene som faktisk brukes, i begge markeder

### B9. Forsiden = daglig brief (presentasjonslag, ingen ny motor)

Admin-forsiden erstattes med en brief som svarer på "hva bør jeg se på i dag?":

- Øverst: kjøpekraft per selskap + konsolidert (fra B3)
- Deretter: flaggede eiendommer fra B6, sortert etter viktighet, hver med anbefalt handling og tallgrunnlag ett klikk unna ("🔴 Søndre Skogvei: refinansiering frigjør ~820'. 🟡 Objekt X: leie 17 % under marked — øk til Y.")
- Måloppfølging (B11) nederst
- Genereres ved sidelast fra eksisterende beregninger — INGEN nye datakilder, ingen bakgrunnsjobber. Claude formulerer briefen fra tallene (samme agent-mønster som B4).

### B10. Tidslinje per eiendom (utvid aktivitetslogg)

`aktivitetslogg` utvides med `prosjekt_id` + `hendelsestype` (kjøpt, bud, renovering start/slutt, verdivurdering, refinansiert, utleid, anbefaling_gitt, solgt …). Hendelser logges automatisk der de skjer i systemet (statusendring, ny verdivurdering, akseptert tilbud, AI-anbefaling) + mulighet for manuell hendelse. Vises som vertikal tidslinje på eiendomssiden. Formål: full historikk per objekt — om fem år skal hele reisen kunne leses.

### B11. Mål

Enkel `maal`-tabell per selskap: `{beskrivelse, maaltall, enhet (antall_boliger|egenkapital|cashflow_mnd), frist}`. Briefen (B9) viser status mot mål beregnet fra porteføljen ("Mål: 10 boliger innen 2032 — du ligger 3 boliger / 11 mnd foran plan"). Ingen egen motor — ren sammenligning.

### B7. Fjern duplikatlogikk — prosjektSync elimineres

- Leie/mnd og lån/mnd lagres i dag TO steder (`prosjekter` + `utleieanalyse`) med `prosjektSync.ts` som plaster. Dette bryter dataflyt-prinsippet og fjernes: velg `utleieanalyse` som eneste hjem for leietall og `eiendom_laan` for lånetall, migrer data, slett duplikatfeltene fra `prosjekter`, slett `prosjektSync.ts`. Oppdater alle lesesteder (inkl. PDF-byggerne) til å lese fra den ene kilden.
- Gjøres FØR B4 bygges, slik at scenariomotoren aldri forholder seg til duplikater.
- JSONB-blobbene (`bolig_data`, `airbnb_data` m.fl.) beholdes som lagring av AI-analyseresultater — de er historikk/referanse, ikke kilder scenariomotoren regner fra. Ingen ny logikk skal LESE beregningsgrunnlag fra blobbene.
- Ikke innfør CSS-rammeverk, ikke bytt i18n-løsning i denne fasen.

---

## Rekkefølge og milepæler

1. **A1–A5** rydding (1 commit-serie, build grønn)
2. **B1** selskaper + migrasjon
3. **B7** fjern prosjektSync-duplikatet (én kilde per tall FØR motoren bygges)
4. **B4** beslutningsmotoren — testes med **Søndre Skogvei med ekte tall** (kjøpesum 2,9 MNOK + omkostninger, gjeld, renoveringsbudsjett, antatt verdi etter oppussing — Robert legger inn)
5. **B3** kapitaloversikt + **B2** konsernlån
6. **B8** tilbudsopplasting + **B10** tidslinje
7. **B5** dine-tall-vinner + justeringslogg
8. **B6** porteføljerangering
9. **B9** daglig brief-forside + **B11** mål (sist — presentasjonslag over alt det andre)

Milepæl 3 er go/no-go: hvis scenariosiden gir riktige og nyttige svar på Søndre Skogvei, fortsett. Hvis ikke, juster modellen før mer bygges.

## Ikke i scope (bevisst)

- Integrasjoner: Finn/Idealista-skraping utover dagens, bankfeeds, Tripletex, DNB Regnskap
- Regnskapsføring (systemet er styringsverktøy)
- Automatisk skattehåndtering av konsernlån (rådgiveroppgave)
- Kobling mot andre systemer (Troas Bygg, Akkordo) — renoveringskost kommer fra tilbud (B8) og manuelle felt
- Sikkerhetsprosenter på anbefalinger ("96 % sikker") — falsk presisjon; anbefaling + begrunnelse + regnestykke i stedet
- Automatisk markedsovervåking (prisfeeds, Airbnb-trender, skraping) — markedsdata legges inn manuelt; briefen bruker det som finnes
- Sammensatt AI-score (0–100 over mange faktorer) på porteføljenivå — rangering på avkastning på bundet EK + flagg er etterprøvbart, en samlescore er det ikke
- Portefølje-hva-hvis (kjede-simulering: "selg X → kjøp Y → belån 65 %") — fase 3-kandidat NÅR beslutningsmotoren er verifisert på enkeltobjekter
- Ny offentlig portal
