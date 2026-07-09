# Bilagsinnboks — importkontrakt (integrasjonsklar, ikke integrert)

Dette dokumentet beskriver hvordan en **fremtidig** regnskapsintegrasjon skal
mate bilag inn i Loeiendom. Selve integrasjonen er bevisst **ikke** bygget ennå
— strukturen (`bilag`-tabellen + innboksflyten) er klar til å ta imot den uten
skjemaendringer.

## Prinsipp

> Regnskapssystemet er **fasit** for bokføring. Loeiendom er **styringssystem**.

Importerte bilag **bokføres ikke på nytt**. De brukes til prosjektregnskap,
oppussingsbudsjett, kostnadskontroll, cashflow, beslutningsmotor, avvik mot
budsjett og dokumentasjon per eiendom.

## Slik kobler en fremtidig importør seg på

En importør (Tripletex / DNB Regnskap / Fiken / …) trenger **bare å sette inn
rader i `bilag`** — ingen kode i styringssystemet må endres:

```
insert into bilag (id, bruker, leverandor, faktura_dato, forfall_dato,
                   belop, mva, valuta, fakturanummer, bilagsnummer,
                   kilde, ekstern_id, ekstern_data, import_batch, status)
values (...)
```

Regler:

- **`status = 'ny'`** ved import. Da dukker bilaget opp i innboksen.
- **`kilde`** = kildesystemet (`'tripletex'`, `'dnb_regnskap'`, …). `'manuell'`
  er reservert for bilag lagt inn for hånd i innboksen.
- **`ekstern_id`** = bilagets id i kildesystemet. Unik indeks `(kilde, ekstern_id)`
  gjør importen **idempotent** — samme bilag importeres aldri to ganger.
- **`ekstern_data`** = hele rå-payloaden fra kildesystemet (jsonb), for full
  sporbarhet tilbake til fasit.
- **`import_batch`** = valgfri kjøre-id, gjør det lett å rulle tilbake én import.
- La `selskap_id`, `prosjekt_id`, `kategori` stå **tomme** — AI-forslaget og
  brukeren fyller dem i innboksen. (Importøren kan sette dem hvis kilden vet.)

## Livssyklus (innboksflyten)

```
ny  →  foreslatt  →  godkjent  →  laast
                                    │
'avvist' (blindgate)                └─ teller i prosjektregnskap/dashboard
```

1. **ny** — bilag importert (eller lagt inn manuelt). Ligger i innboksen.
2. **foreslatt** — AI har foreslått selskap, eiendom og kategori (`ai_forslag`).
3. **godkjent** — bruker har bekreftet/endret tilknytning og klassifisering.
4. **laast** — bilaget er låst til prosjektregnskapet (`godkjent_av`/`godkjent_tid`).
5. Tallene oppdateres i dashboard (beregnes ved lesing fra låste bilag).

## Forholdet til `eiendom_kostnader` (viktig, for å unngå dobbelttelling)

Dagens verifiserte cashflow/resultat regnes fra `eiendom_kostnader` +
`eiendom_laan`. Låste bilag vises i dag som **egen, tydelig merket** oversikt per
eiendom (dokumentasjon + sum) — de mates **ikke** automatisk inn i den
verifiserte kostnadsberegningen ennå.

Når den ekte regnskapsimporten kobles på, tas en **bevisst** beslutning om at
låste bilag blir kostnadskilden (og manuell `eiendom_kostnader`-føring fases ut),
slik at ingen kostnad telles to steder. Det er det siste integrasjonssteget —
og det som med vilje er utsatt til importen faktisk finnes.
