import type { Metadata } from 'next'
import Link from 'next/link'
import { FARGER, RADIUS } from '../lib/styles'

export const metadata: Metadata = {
  title: 'Brukervilkår — Leganger & Osvaag Eiendom',
  description: 'Vilkår for bruk av loeiendom.com',
}

const SIST_OPPDATERT = '31. mai 2026'

export default function Vilkar() {
  return (
    <main style={{ background: FARGER.cream, minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: RADIUS.lg, padding: '56px 48px', boxShadow: '0 4px 24px rgba(14,23,38,0.06)' }}>
        <Link href="/" style={{ fontSize: 12, color: FARGER.tekstMid, textDecoration: 'none', letterSpacing: '0.06em' }}>← Tilbake</Link>

        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>
          BRUKERVILKÅR
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>
          Vilkår for bruk av loeiendom.com
        </h1>
        <p style={{ fontSize: 13, color: FARGER.tekstLys, marginTop: 12, fontStyle: 'italic' }}>
          Sist oppdatert: {SIST_OPPDATERT}
        </p>

        <Seksjon tittel="1. Aksept av vilkår">
          <p>
            Ved å bruke loeiendom.com («tjenesten») bekrefter du at du har lest, forstått og godtatt disse vilkårene.
            Hvis du ikke aksepterer vilkårene, må du ikke bruke tjenesten.
          </p>
        </Seksjon>

        <Seksjon tittel="2. Om tjenesten">
          <p>
            Tjenesten leveres av <strong>Leganger &amp; Osvaag Eiendom</strong> og består av:
          </p>
          <ul style={listeStil}>
            <li>Visning av eiendommer til salgs og leie</li>
            <li>Verktøy for boliganalyse, flippekalkulator og porteføljeoppfølging</li>
            <li>AI-genererte estimater for markedsverdi, oppussingsbudsjett og visualisering</li>
            <li>Off-market eiendomsvurdering</li>
            <li>Inspeksjonsbestilling (mot betaling)</li>
            <li>Kommunikasjon med håndverkere, meglere og selgere</li>
          </ul>
        </Seksjon>

        <Seksjon tittel="3. Viktig — om AI-genererte estimater" framhevet>
          <p style={{ fontWeight: 600, color: FARGER.mork }}>
            Tjenesten bruker kunstig intelligens (AI) til å generere estimater, analyser og visualiseringer.
            Disse er <strong>veiledende</strong> og <strong>ikke</strong>:
          </p>
          <ul style={listeStil}>
            <li>En formell takst eller verdivurdering</li>
            <li>En tilstandsrapport som tilfredsstiller avhendingsloven</li>
            <li>Juridisk, skattemessig eller finansiell rådgivning</li>
            <li>Garanti for fremtidig markedsutvikling, salgspris eller leieinntekt</li>
          </ul>
          <p>
            <strong>Du tar selv ansvar for beslutninger basert på AI-output.</strong>
            Før kjøp, salg eller annen vesentlig økonomisk beslutning anbefaler vi sterkt:
          </p>
          <ul style={listeStil}>
            <li>Profesjonell takst eller tilstandsrapport fra autorisert takstmann</li>
            <li>Juridisk gjennomgang av kontrakt og heftelser</li>
            <li>Finansiell rådgivning fra bank eller uavhengig rådgiver</li>
          </ul>
          <p>
            AI-genererte «etter»-bilder fra oppussing er <strong>illustrasjoner</strong>, ikke produktbilder.
            Faktisk resultat avhenger av material- og håndverker-valg.
          </p>
        </Seksjon>

        <Seksjon tittel="4. Off-market vurdering">
          <p>
            Off-market vurderinger sammenstiller offentlig tilgjengelig data (Kartverket, NVE, Enova) med
            informasjon du selv legger inn og AI-analyse. Dette erstatter <strong>ikke</strong>:
          </p>
          <ul style={listeStil}>
            <li>Befaring av eiendommen</li>
            <li>Takstrapport eller tilstandsrapport</li>
            <li>Grunnbok-utskrift og heftelsesattest</li>
            <li>Juridisk gjennomgang før kjøp</li>
          </ul>
        </Seksjon>

        <Seksjon tittel="5. Inspeksjon — betalt tjeneste">
          <p>
            Bestilling av inspeksjon er en avtale om utførelse av tjeneste mellom deg og oss.
          </p>
          <ul style={listeStil}>
            <li>Pris vises tydelig før bestilling og betaling</li>
            <li>Betaling skjer via Stripe — vi mottar aldri kortinformasjonen din direkte</li>
            <li>Inspeksjonsrapporten er en faglig vurdering, men erstatter ikke formell takst</li>
            <li>Forbrukere har 14 dagers angrerett etter angrerettloven. Angreretten faller bort hvis tjenesten er fullført før fristen utløper og du har samtykket til oppstart</li>
            <li>Refusjon av allerede utført arbeid kan avkortes proporsjonalt</li>
          </ul>
        </Seksjon>

        <Seksjon tittel="6. Brukerinnhold">
          <p>
            Bilder, dokumenter og opplysninger du laster opp («brukerinnhold») er ditt ansvar.
            Du garanterer at du har rett til å laste opp materialet og at det ikke krenker andres rettigheter.
          </p>
          <p>
            Du gir oss en begrenset, ikke-eksklusiv rett til å behandle brukerinnhold for å levere tjenesten —
            inkludert å sende det videre til våre AI-leverandører (Anthropic, Replicate, Google) for analyse.
          </p>
        </Seksjon>

        <Seksjon tittel="7. Akseptabel bruk">
          <p>Du skal ikke:</p>
          <ul style={listeStil}>
            <li>Bruke tjenesten til ulovlige formål</li>
            <li>Forsøke å omgå tilgangskontroller eller utnytte sårbarheter</li>
            <li>Laste opp innhold som er ulovlig, skadelig, krenkende eller villedende</li>
            <li>Bruke automatiserte verktøy (bots, skrapere) uten skriftlig tillatelse</li>
            <li>Videreselge tilgang til tjenesten</li>
          </ul>
        </Seksjon>

        <Seksjon tittel="8. Ansvarsbegrensning" framhevet>
          <p>
            Tjenesten leveres «som den er». Vi gjør vårt beste for å sikre korrekt informasjon, men kan ikke garantere:
          </p>
          <ul style={listeStil}>
            <li>Riktigheten av AI-genererte estimater og analyser</li>
            <li>Tilgjengelighet uten avbrudd</li>
            <li>At eksterne datakilder (Kartverket, Finn.no, NVE m.fl.) er oppdatert eller korrekt</li>
            <li>Resultatet av investerings- eller kjøpsbeslutninger</li>
          </ul>
          <p>
            Vårt erstatningsansvar er, i den utstrekning loven tillater det, begrenset til det du har betalt
            oss for tjenesten siste 12 måneder. Vi er ikke ansvarlig for indirekte tap eller tapt fortjeneste.
          </p>
          <p style={{ fontSize: 12, color: FARGER.tekstMid, fontStyle: 'italic' }}>
            Begrensningene gjelder ikke ved grov uaktsomhet eller forsett fra vår side, eller for
            ansvar som ikke kan fraskrives etter ufravikelig forbrukerlovgivning.
          </p>
        </Seksjon>

        <Seksjon tittel="9. Personvern">
          <p>
            Behandling av personopplysninger er beskrevet i vår{' '}
            <Link href="/personvern" style={lenkeStil}>personvernerklæring</Link>.
          </p>
        </Seksjon>

        <Seksjon tittel="10. Endringer i vilkårene">
          <p>
            Vi kan endre vilkårene ved behov. Den til enhver tid gjeldende versjonen ligger på denne siden.
            Vesentlige endringer varsles på e-post til registrerte brukere senest 14 dager før de trer i kraft.
          </p>
        </Seksjon>

        <Seksjon tittel="11. Lovvalg og verneting">
          <p>
            Disse vilkårene reguleres av norsk rett. Eventuelle tvister søkes løst i minnelighet.
            Hvis enighet ikke oppnås, er <strong>Hordaland tingrett</strong> verneting i første instans.
          </p>
          <p style={{ fontSize: 12, color: FARGER.tekstMid, fontStyle: 'italic' }}>
            Forbrukere kan også klage til Forbrukerrådet eller benytte EUs nettbaserte
            tvisteløsningsplattform: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener" style={lenkeStil}>ec.europa.eu/consumers/odr</a>.
          </p>
        </Seksjon>

        <div style={{ marginTop: 48, padding: 20, background: FARGER.creamLys, borderRadius: RADIUS.md, fontSize: 13, color: FARGER.tekstMid, lineHeight: 1.6 }}>
          Spørsmål om vilkårene? Send e-post til{' '}
          <a href="mailto:post@loeiendom.com" style={lenkeStil}>post@loeiendom.com</a>.
        </div>
      </div>
    </main>
  )
}

function Seksjon({ tittel, children, framhevet }: { tittel: string; children: React.ReactNode; framhevet?: boolean }) {
  return (
    <section style={{
      marginTop: 36,
      ...(framhevet ? { background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.md, padding: '20px 24px' } : {}),
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px', color: FARGER.mork, letterSpacing: '-0.005em' }}>
        {tittel}
      </h2>
      <div style={{ fontSize: 14, color: FARGER.tekstMork, lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

const lenkeStil: React.CSSProperties = {
  color: FARGER.gull, textDecoration: 'underline', textUnderlineOffset: 2,
}

const listeStil: React.CSSProperties = {
  paddingLeft: 22, margin: '8px 0',
}
