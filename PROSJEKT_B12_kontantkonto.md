# B12 — Kontantkonto (fri likviditet blir beregnet, ikke tastet)

> Utvidelse av B3 (kapital) / C8 (kjøpekraft). Løser rotårsaken bak feil egenkapital/kjøpekraft
> på dashbordet: `selskaper.fri_likviditet` er i dag et manuelt felt som blir stale i det øyeblikket
> penger flytter seg (huskjøp, omkostninger, oppussing, drift). Resultat: dobbelttelling.
> Denne modulen gjør kontantsaldoen til et **beregnet** tall fra én hovedbok, slik at egenkapital
> og kjøpekraft alltid er riktige uten månedlig manuelt vedlikehold.

---

## 0. Mål og prinsipp

- **Kontantsaldo (fri likviditet) = summen av alle kontantbevegelser.** Aldri et tastet tall.
- **Egenkapital = Σ(eiendom: verdi − gjeld) + kontantsaldo.** Beregnes ved lesing, som nå.
- **Én kilde for kontanter:** hovedboken `kontantbevegelser`. Bilag/kvittering/kjøp er *dokumentene*;
  hovedbok-raden er *kontanteffekten* (ikke en duplikatlagring — det er selve kontantregisteret).
- **Ingen bankfeed** (jf. scope): bevegelser kommer fra manuelle kapitalhendelser + auto-postering
  fra ting du allerede registrerer i systemet.
- **Scenario-ratene beholdes urørt:** `eiendom_kostnader`/`eiendom_inntekter` er *forutsetninger per
  måned* som beslutningsmotoren (B4) regner fra — de er IKKE kontantbevegelser og skal ikke posteres.
  Kontanteffekten kommer fra realiserte tall (`eiendom_cashflow`) og godkjente bilag.

### Den finansielle regelen modulen håndhever
- Renter og driftskostnader = ekte tap → ned kontanter **og** ned egenkapital.
- Avdrag = ned kontanter, ned gjeld like mye → egenkapital **uendret** (bytte).
- Oppussing / kjøp / omkostninger = ned kontanter, opp eiendomsverdi/kostbasis → egenkapital
  **uendret** ved posteringen (bytte); egenkapital endres først når verdivurdering eller salg endrer verdi.
- Egenkapital endres løpende av **nettoresultat** (leie − drift − renter), ikke av bruttokostnader.

---

## 1. Datamodell — ny tabell `kontantbevegelser`

```sql
create table kontantbevegelser (
  id uuid primary key default gen_random_uuid(),
  selskap_id uuid not null references selskaper(id) on delete cascade,
  prosjekt_id uuid references prosjekter(id) on delete set null,  -- kobling til eiendom, valgfri
  dato date not null,
  type text not null check (type in (
    'innskudd',        -- egenkapital inn fra eier (+)
    'laaneopptak',     -- lån utbetalt til konto (+)
    'kjop',            -- kjøp av eiendom (−)
    'omkostninger',    -- dok.avgift, tinglysing, ITP m.m. (−)
    'oppussing',       -- betalt oppussing (−)
    'driftskostnad',   -- comunidad, IBI, forsikring, gestor, vedlikehold … (−)
    'renter',          -- rentedel av termin (−)
    'avdrag',          -- avdragsdel av termin (−)
    'leieinntekt',     -- realisert leie inn (+)
    'uttak',           -- utbytte / uttak til eier (−)
    'annet'
  )),
  belop numeric not null,          -- FORTEGNSSATT: + øker kontanter, − reduserer
  valuta text not null check (valuta in ('NOK','EUR')),
  kilde text not null default 'manuell'
    check (kilde in ('manuell','bilag','kvittering','cashflow','kjop_registrering','laan_termin','tilbud')),
  kilde_id uuid,                   -- referanse til bilag/kvittering/cashflow-rad for idempotens
  notat text,
  opprettet timestamptz default now(),
  unique (kilde, kilde_id)         -- hindrer dobbeltpostering fra samme auto-kilde
);
create index on kontantbevegelser (selskap_id, dato);
create index on kontantbevegelser (prosjekt_id);
```

Fortegn settes av UI/posteringslaget ut fra `type` (innskudd/laaneopptak/leieinntekt = +, resten = −),
så bruker aldri taster minus manuelt. `belop` lagres likevel fortegnssatt så saldo = `sum(belop)`.

---

## 2. Beregnet saldo — `fri_likviditet` retires som manuelt felt

- **`GET /api/kapital`**: `fri_likviditet` per selskap = `select coalesce(sum(belop),0) from kontantbevegelser where selskap_id = s.id`.
  Alt nedstrøms (egenkapital, kjøpekraft, konsolidert) bruker dette uendret — kun *kilden* endres.
- `selskaper.fri_likviditet` beholdes IKKE som redigerbart felt. To alternativer:
  - **Anbefalt:** slett kolonnen; åpningssaldo legges som `innskudd`-bevegelser (se §5).
  - Alternativt: behold som skrivebeskyttet cache (nei — bryter «én kilde», frarådes).
- Inputfeltet «Fri likviditet» på Kapital-siden fjernes og erstattes av en **kontantkonto-visning** (§6).
- `laanekapasitet` (bankramme) forblir manuelt felt — det er en ramme, ikke en kontantsaldo.

---

## 3. Auto-postering — det du allerede registrerer driver saldoen

Hver bevegelse bærer `kilde` + `kilde_id` med `unique(kilde, kilde_id)`, så re-kjøring aldri dobler.

| Handling i systemet | Postering (kilde) | Fortegn |
|---|---|---|
| Registrer ny eiendom (kjøpesum, omkostninger) | `kjop` + `omkostninger` (kjop_registrering) | − |
| Lån knyttet til eiendom (`eiendom_laan.hovedstol`) | `laaneopptak` (kjop_registrering) | + |
| Manuell justering (eier skyter inn / tar ut, korreksjon) | `innskudd`/`uttak`/… (manuell) | ± |
| **Opplastet kvittering** (analysert) | **leses live, brutto inkl. mva — `oppussing`/`driftskostnad`** | − |
| **Godkjent bilag** (`godkjent`/`laast`) | **leses live, brutto inkl. mva** | − |
| **Realisert leieinntekt** (`eiendom_cashflow.inntekt`) | **leses live i saldo** | + |
| **Lånebetjening** (renter + avdrag, `eiendom_laan`) | **leses live i saldo** | − |

> **Implementert:** kostnader kommer fra **opplastede fakturaer** (kvittering + bilag), lest live og
> trukket brutto (inkl. mva — boligselskap uten mva-fradrag bærer mva-en som kostnad). Ingenting av
> dette posteres til hovedboken; alt beregnes ved lesing (`app/lib/kontant.ts`), så saldoen oppdaterer
> seg når en faktura lastes opp og analyseres. Fakturalinjene vises i kontantkontoen med 📄-merke.
>
> **Saldo = Σ(kontantbevegelser) + Σ(leieinntekt) − lånebetjening hittil − Σ(fakturaer brutto).**
> Kostnads-sannheten er fakturaene; `eiendom_cashflow` bidrar nå kun med **inntekt** (leie), så drift
> aldri dobbelttelles. Avdrag motsvares av lavere `restgjeld` (vedlikeholdes manuelt, som LTV), så
> egenkapital er nøytral for avdrag og negativ for renter.

---

## 4. Hva egenkapital og kjøpekraft blir (uendret formler, riktig kilde)

- **Egenkapital** = Σ(verdi − gjeld) + Σ(kontantbevegelser). Oppdaterer seg av seg selv når du
  registrerer verdivurdering, lån endres, eller en kontantbevegelse posteres.
- **Kjøpekraft** = kontantsaldo + refinansieringspotensial + bankramme (som nå etter siste fix).
- **Frigjørbar ved salg** (bundet EK) = uendret, vises på Kapital/eiendomsside.

---

## 5. Migrasjon / seed — fra dagens feil felt til korrekt åpningsbalanse

Engangs-script per selskap, som gjør dagens kjente fakta om til åpningsbevegelser:

1. `innskudd` = startkapital (redigerbart i forhåndsvisningen, ikke hentet fra `fri_likviditet`
   som er upålitelig; for Loeiendom: 943 000 × 2 = 1 886 000) på selskapets startdato.
2. `laaneopptak` = `eiendom_laan.hovedstol` per eksisterende lån, datert `startdato`.
3. `kjop` = `prosjekter.kjøpesum` (−), datert `dato_kjopt`.
4. `omkostninger` = `prosjekter.kjøpskostnader` (−).
5. `oppussing` tas IKKE med — `oppussing_faktisk` er ofte budsjett, ikke brukt kontant.
   Faktiske oppussingsbetalinger føres som egne bevegelser når de skjer; et eget oppussingslån
   føres som ny `laaneopptak` når det utbetales.

Beregnet saldo faller da ut korrekt (Loeiendom: 1 886 000 + 2 030 000 − 2 900 000 − 73 590 kjøpskost
= **942 410**, minus akkumulert lånebetjening). Det gamle `fri_likviditet`-tallet **ignoreres** —
det var endret til dagens kontanter og skal ikke brukes som startkapital.

> Script skal være idempotent (kan kjøres på nytt) via `unique(kilde, kilde_id)`, og skrive en
> CSV-forhåndsvisning av bevegelsene før commit, så Robert kan verifisere åpningsbalansen.

---

## 6. Visning

- **Kapital-siden:** «Fri likviditet»-input erstattes av **Kontantkonto**-kort per selskap:
  stor saldo øverst + liste over siste bevegelser (dato, type, beløp, kilde), «+ Legg til bevegelse»
  for manuelle innskudd/uttak/justeringer. Delsummen i kjøpekraft-heroen bruker beregnet saldo.
- **Eiendomsside → Regnskap-fanen:** vis eiendommens egne kontantbevegelser (`prosjekt_id`-filter).
- **Hjem:** ingen endring i layout — «Fri kapital» og «Egenkapital» viser nå beregnet saldo automatisk.

---

## 7. Hva som IKKE endres (bevisst)

- `eiendom_kostnader` / `eiendom_inntekter` (scenario-rater) — beholdes som B4-forutsetninger.
- `eiendom_cashflow` — beholdes; blir nå ÉN av kildene til kontantbevegelser.
- Ingen bankfeed, ingen bakgrunnsjobb. Auto-postering skjer i handlingen (godkjenn bilag, lagre
  realisert måned, registrer kjøp), ikke i en cron.
- Beslutningsmotor, PDF-byggere, skatteprofil — urørt.

---

## 8. Åpne valg (avklares før bygging)

1. **Operativ kilde v1:** `eiendom_cashflow` (anbefalt) vs. `bilag`-nivå. → default cashflow.
2. **Lån brutto vs netto:** postere `laaneopptak +` og `kjop −` hver for seg (bank-transparent,
   anbefalt) vs. kun egenkapital-andelen. → default brutto.
3. **Valuta:** kontantbevegelser i selskapets valuta; konsolidering til NOK som i dag (kurs).
4. **Startdato for innskudd:** `selskaper.opprettet` vs. eksplisitt stiftelsesdato-felt.

---

## 9. Byggerekkefølge

1. Migrasjon: `kontantbevegelser`-tabell + drop/retire `selskaper.fri_likviditet`.
2. Seed-script (§5) med CSV-forhåndsvisning — verifiser Loeiendom-åpningsbalanse med Robert.
3. `GET /api/kapital`: bytt kilde for `fri_likviditet` til `sum(belop)`.
4. Auto-postering ved kjøpsregistrering + realisert `eiendom_cashflow`-måned (idempotent).
5. Kapital-side: Kontantkonto-kort (saldo + bevegelsesliste + manuell +/−).
6. Auto-postering fra godkjent bilag (når bilagsflyt er klar) — bytt cashflow→bilag per periode.
7. Verifiser: dashboard egenkapital/kjøpekraft matcher håndregnet åpningsbalanse.
