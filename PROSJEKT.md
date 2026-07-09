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

## FASE C — Kontrollrommet: nav, dashboards og visuell stil

> Bakgrunn: v2-ryddingen beholdt for mye av v1s skjermorganisering. Fase C bygger systemet om
> til et investor-kontrollrom: brukeren skal på under 60 sekunder forstå hvordan selskapene går,
> hvilke eiendommer som tjener penger, hva som binder kapital, hva som kan kjøpes neste gang,
> og hvilken beslutning som er best nå. Ingen nye beregninger — alt hentes fra `lib/`-funksjonene
> og beregnes ved lesing. Gjenbruk eksisterende komponenter, men IKKE la dem diktere strukturen:
> bygg nye sider og monter komponentene inn.

### C0. Designprinsipper (gjelder alle sider i fase C)

- **Tall først, detaljer etterpå.** Store nøkkeltall øverst, alt annet ett klikk unna.
- **Disiplin på antall:** maks 5–6 store nøkkeltall per side. Flere tall = mindre oversikt. Resten bor på Kapital-/detaljsidene.
- **Fargespråk:** rød = tap/risiko, grønn = lønnsomt/positivt, gul = bør vurderes, grå = nøytralt. Statuslys på kort.
- **"Kort fortalt" på hver dashboardside:** 2–4 setninger generert av Claude fra sidens tall (samme agent-mønster som B4/B9): status → hva går bra → hva må følges → anbefalt neste handling. Eksempel: "Loeiendom AS har positiv cashflow på 18 400 kr/mnd, men 1,1 MNOK er låst i Søndre Skogvei. Refinansiering etter oppussing øker kjøpekraften betydelig."
- **Én tydelig anbefaling per side.** Aldri sikkerhetsprosenter — anbefaling + begrunnelse + tallgrunnlag.
- **Visuell stil:** finansielt/porteføljeforvaltning, ikke SaaS-admin. Kort, grafer, statuslys, store tall. Mobilvennlig (Robert sjekker fra byggeplass), fullverdig på desktop.
- **Grafer bygges KUN på historikk som finnes** (`eiendom_verdivurderinger`, `eiendom_cashflow`, tidslinjen). Mangler historikk: vis "historikk bygges opp fra nå" — ALDRI fabrikkerte kurver. Ingen bakgrunnsjobber for snapshots.

### C1. Datamodell: to dimensjoner, ikke én status

⚠️ Viktig presisering: livssyklus og strategi er TO separate felt — de skal IKKE slås sammen til ett status-felt (en bolig kan være under oppussing OG planlagt for langtidsleie samtidig).

- **`eieretappe`** (finnes): analyse → under_kjøp → eid → salgsklar → solgt. Utvides evt. med `under_oppussing` mellom eid og salgsklar hvis det ikke dekkes i dag.
- **`strategi`** (ny): `flipp | langtid | korttid | uavklart`, default uavklart. Settes av bruker; beslutningsmotoren (B4) viser anbefalt strategi med "Følg anbefaling"-knapp. Strategiendring logges i tidslinjen (B10). Migrer fra `kategori`: flipp→flipp, utleie→langtid; `kategori` fases ut.
- Dashboards kan vise en kombinert status-badge ("Under oppussing · Flipp"), men datamodellen holder dimensjonene adskilt.
- **Spanske kostnadskategorier** legges inn som kategorier i `eiendom_kostnader`: comunidad, IBI, forsikring, gestor/regnskap, vedlikehold, skatt. Norske tilsvarende: kommunale avgifter, felleskostnader, forsikring, vedlikehold, regnskap.

### C2. Ny hovednavigasjon (erstatter dagens 12-seksjons adminmeny)

| Meny | Innhold |
|---|---|
| **Hjem** | Konsern-/porteføljedashboard — se C3 |
| **Analyse** | Eksisterende analysefunksjon (Finn, Idealista, off-market, takst) — se C4 |
| **Loeiendom** | Selskapsdashboard Norge — se C5 |
| **Lo Casas** | Selskapsdashboard Spania — se C5 + C6 |
| **Eiendommer** | Globalt register over alle eiendommer — se C7 |
| **Kapital** | Kjøpekraftmotoren (B3) som egen side — se C8 |
| **Varsler** | Alle flagg samlet (arkiv/oversikt) — se C9 |

Sekundærfunksjoner (håndverkere, timer, oppgaver, e-post, aktivitetslogg, innstillinger/brukere) i undermeny — de skal ikke konkurrere med hovednavigasjonen. Selskapsmenyene genereres fra `selskaper`-tabellen.

### C3. Hjem — investordashboard for hele porteføljen

Ikke en liste. Struktur ovenfra:

1. **"Kort fortalt"** (C0) + AI-anbefaling "dette bør dere gjøre nå" (fra B9-logikken)
2. **5–6 store tall:** total porteføljeverdi · total gjeld · total egenkapital (med låst/fri-fordeling) · kjøpekraft neste runde · resultat per måned (netto inntekt − kostnader) · antall eiendommer (fordelt Norge/Spania)
3. **Røde flagg** (fra B6/C9), sortert etter alvorlighet, med anbefalt handling
4. **Beste og svakeste eiendom akkurat nå** (topp/bunn fra B6-rangeringen) som to kort
5. **Grafer (der historikk finnes):** inntekter vs. kostnader per måned · egenkapitalutvikling · cashflow per selskap. LTV vises som nøkkeltall med stresstest (`rentesjokk`), ikke graf, inntil historikk finnes.
6. Mål-status (B11)

### C4. Analyse — beholdes, strammes opp

Funksjonaliteten finnes og beholdes. Forbedringer:

- Inputfelt for annonsetekst/URL (Finn, Idealista) — som i dag
- **Resultatkort** per analyse: kjøpesum, omkostninger, oppussingsestimat, forventet verdi, leie, yield, skatt, og beslutningsmotorens anbefaling
- **Tydelig konklusjon med statuslys:** Kjøp (grønn) / Vurder (gul) / Ikke kjøp (rød) — basert på terskler + `regnTotalScore`, alltid med begrunnelse synlig
- **Sammenligningsvisning:** flere analyserte kandidater side om side
- Kandidater (`eieretappe='analyse'`) listes her med mulighet for å konvertere til eiendom (→ Eiendommer/selskap)

### C5. Selskapsdashboard (én mal, Loeiendom og Lo Casas)

Filtrert på `selskap_id`, i selskapets valuta (Lo Casas: EUR med NOK-omregning via `useValuta`).

1. **"Kort fortalt"** for selskapet
2. **Store tall:** eiendomsverdi · gjeld · egenkapital (låst/fri) · resultat per måned · kjøpekraft i dette selskapet · refinansieringspotensial (sum frigjørbar kapital fra `regnFinansiering`)
3. **Eiendomskort** gruppert på strategi (Selges / Langtidsleie / Korttidsleie / Uavklart): navn, markedsverdi, gjeld, egenkapital, netto/mnd, yield på bundet EK, statuslys, motoranbefaling i én linje. Klikk → eiendomssiden (C7)
4. Kommende betalinger: terminbeløp fra `eiendom_laan` + manuelt registrerte frister (IBI, forsikring o.l.) — enkel liste, ingen betalingsintegrasjon
5. Skatteeffekt-estimat fra selskapets `skatteprofil`

### C6. Lo Casas-siden — spanske særtrekk

Samme mal som C5, men skal tydelig vise det som er annerledes i Spania:

- Kostnadskortene viser comunidad, IBI, gestor m.m. (fra C1-kategoriene)
- **VFT/turistlisens-status** per korttidsbolig (felt på prosjektet: har/søkt/mangler) — mangler = rødt flagg
- Ved salgsscenario: **3 % retention og plusvalía** vises eksplisitt i regnestykket (finnes i `beregnSalg`)
- **Konsernlån fra Loeiendom AS** (B2): saldo, rente, påløpte renter
- **Valutavisning EUR + NOK**; valutarisiko vises som nøkkeltall (hvor mye NOK-verdien svinger ved ±5 % EUR/NOK), ikke som prognose

### C7. Eiendommer — globalt register + eiendomsside

Registeret: alle eiendommer på tvers, filtrerbart på selskap/land/eieretappe/strategi. "Legg til eiendom" med minimal input (selskap, adresse, kjøpesum — resten fylles gradvis, jf. designprinsipp om minst mulig tasting).

**Eiendomssiden** (gjenbruk eksisterende faner, restrukturert):

| Fane | Innhold | Gjenbruker |
|---|---|---|
| **Oversikt** | Markedsverdi, kjøpesum, gjeld, EK, låst kapital, netto/mnd, yield, LTV, status-badge, motoranbefaling, tidslinje (B10) | EiendomOversikt/Verdi + nytt |
| **Regnskap** | Inntekter, kostnader (kategorisert), månedlig/årlig resultat, graf inntekt vs. kostnad, manuelle føringer | EiendomInntekter/Kostnader/Cashflow |
| **Lån** | Lånebeløp, rente, avdrag, restgjeld, terminbeløp, LTV, refinansieringspotensial | EiendomLaan + `regnFinansiering` |
| **Oppussing** | Budsjett vs. faktisk, avvik med statuslys, tilbud (B8), akseptert tilbud, internt arbeid, fremdrift | Oppussingsbudsjett + B8 |
| **Utleie** | Langtid vs. korttid side om side: leie, belegg, kostnader, netto, yield — og beste utleiestrategi | Utleieanalyse + `utleie.ts` |
| **Beslutning** | Beslutningsmotoren (B4): fire scenarier, anbefaling i klartekst, tallgrunnlag bak | B4 |

Dokumenter, kvitteringer og bilder beholdes som i dag (egne faner eller under Oversikt).

### C8. Kapital — kjøpekraftmotoren som egen side

B3 realiseres som denne siden. Visuelt regnestykke, ikke tabell:

```
Fri likviditet            800 000
+ Refinansieringspotensial 1 200 000
+ Mulig salgseffekt        1 600 000
+ Bankramme                4 000 000
= KJØPEKRAFT               7 600 000
```

Per selskap + konsolidert. Under: låst EK per eiendom (sortert, viser hvor kapitalen sitter), konsernlån-oversikt (B2), og hver komponent klikkbar ned til grunnlaget.

### C9. Varsler — flaggmotoren samlet

Flaggtypene (beregnes ved lesing fra eksisterende tall, ingen bakgrunnsjobber):

- Negativ cashflow per eiendom · LTV over terskel · rentesjokk-stresstest gir negativt resultat · oppussing over budsjett (fra B8/oppussing-avvik) · leie under markedsnivå (manuelt markedsleie-felt) · mye kapital låst i eiendom med svak avkastning · manglende dokumentasjon (fra `dokument_sjekkpunkter`) · manglende VFT-lisens (Spania, korttid) · kostnad/inntekt-forhold over terskel · motoranbefaling avviker fra valgt strategi ("bør vurderes solgt/refinansiert")

Terskler redigerbare (innstillinger). Varsler vises der de gjelder (Hjem, selskapsside, eiendomsside) — Varsler-siden er samlet oversikt med filter og "kvittert/ikke kvittert".

### C10. Rekkefølge for fase C

1. C1 datamodell (strategi-felt, kostnadskategorier, VFT-felt) + migrasjon
2. C2 ny nav (skall for alle sidene)
3. C3 Hjem-dashboard
4. C5 selskapsdashboard-mal → Loeiendom, så C6 Lo Casas-særtrekk
5. C7 eiendomsregister + restrukturert eiendomsside
6. C8 Kapital-siden
7. C9 varsler + "Kort fortalt" på alle sider
8. Slett gamle adminseksjoner som nå er dekket — ingen side skal finnes to steder

Fase C kan bygges parallelt med sene B-faser, men C1 bør inn straks etter B1 (selskaper), siden begge er migrasjoner på `prosjekter`. C3–C9 forutsetter at B4 (motoren) og B3-beregningene finnes — dashboardene er visning av dem.

---

## Rekkefølge og milepæler (samlet, A+B+C)

1. **A1–A5** rydding (1 commit-serie, build grønn)
2. **B1** selskaper + **C1** datamodell (strategi, kostnadskategorier, VFT-felt — samme migrasjonsrunde)
3. **B7** fjern prosjektSync-duplikatet (én kilde per tall FØR motoren bygges)
4. **B4** beslutningsmotoren — testes med **Søndre Skogvei med ekte tall** (kjøpesum 2,9 MNOK + omkostninger, gjeld, renoveringsbudsjett, antatt verdi etter oppussing — Robert legger inn)
5. **B3** kapitalberegningene + **B2** konsernlån (logikken — visningen kommer i C8)
6. **C2–C3** ny nav + Hjem-dashboard
7. **C5–C6** selskapsdashboards (Loeiendom, så Lo Casas)
8. **C7** eiendomsregister + restrukturert eiendomsside, inkl. **B8** tilbudsopplasting og **B10** tidslinje
9. **B5** dine-tall-vinner + justeringslogg
10. **B6** porteføljerangering + **C8** Kapital-siden + **C9** varsler
11. **B9** "Kort fortalt"/brief på alle sider + **B11** mål
12. Slett gamle adminseksjoner som er erstattet — ingen side skal finnes to steder

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
