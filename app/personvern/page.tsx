import type { Metadata } from 'next'
import Link from 'next/link'
import { FARGER, RADIUS } from '../lib/styles'
import { GdprSkjema } from './GdprSkjema'

export const metadata: Metadata = {
  title: 'Personvernerklæring — Leganger & Osvaag Eiendom',
  description: 'Hvordan vi behandler personopplysninger i loeiendom.com',
}

// Sist oppdatert — bump denne datoen ved enhver materiell endring.
const SIST_OPPDATERT = '3. juni 2026'

export default function Personvern() {
  return (
    <main style={{ background: FARGER.cream, minHeight: '100vh', padding: '60px 24px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: RADIUS.lg, padding: '56px 48px', boxShadow: '0 4px 24px rgba(14,23,38,0.06)' }}>
        <Link href="/" style={{ fontSize: 12, color: FARGER.tekstMid, textDecoration: 'none', letterSpacing: '0.06em' }}>← Tilbake</Link>

        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>
          PERSONVERNERKLÆRING
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>
          Slik behandler vi dine personopplysninger
        </h1>
        <p style={{ fontSize: 13, color: FARGER.tekstLys, marginTop: 12, fontStyle: 'italic' }}>
          Sist oppdatert: {SIST_OPPDATERT}
        </p>

        <Seksjon tittel="1. Behandlingsansvarlig">
          <p>
            <strong>Leganger &amp; Osvaag Eiendom</strong> (heretter «vi» eller «oss») er behandlingsansvarlig
            for personopplysninger som samles inn via loeiendom.com.
          </p>
          <p>
            Kontakt: <a href="mailto:post@loeiendom.com" style={lenkeStil}>post@loeiendom.com</a>
          </p>
        </Seksjon>

        <Seksjon tittel="2. Hvilke opplysninger vi behandler">
          <p>Avhengig av hvordan du bruker tjenesten kan vi behandle:</p>
          <ul style={listeStil}>
            <li><strong>Kontaktinformasjon:</strong> navn, e-postadresse, telefonnummer</li>
            <li><strong>Eiendomsdata:</strong> adresse, gnr/bnr, bilder, dokumenter du laster opp</li>
            <li><strong>Selger-/megler-/håndverker-kontakter:</strong> du legger inn for kommunikasjon i prosjekter</li>
            <li><strong>Finansielle opplysninger:</strong> ved bestilling av inspeksjon (behandles av Stripe)</li>
            <li><strong>Innloggings-data:</strong> sesjons-cookie for administratortilgang</li>
            <li><strong>Aktivitetslogg:</strong> hva som er gjort i systemet (for revisjon og feilsøking)</li>
          </ul>
        </Seksjon>

        <Seksjon tittel="3. Formål og rettslig grunnlag">
          <p>Vi behandler personopplysninger for å:</p>
          <ul style={listeStil}>
            <li>Levere tjenesten du har bestilt (rettslig grunnlag: <em>avtale</em>, GDPR art. 6(1)(b))</li>
            <li>Sende deg e-post knyttet til prosjektet (rettslig grunnlag: <em>avtale</em> eller <em>berettiget interesse</em>)</li>
            <li>Behandle betaling og oppfylle regnskapsplikt (rettslig grunnlag: <em>rettslig forpliktelse</em>)</li>
            <li>Forbedre tjenesten og rette feil (rettslig grunnlag: <em>berettiget interesse</em>)</li>
          </ul>
        </Seksjon>

        <Seksjon tittel="4. Databehandlere og tredjeparter">
          <p>For å levere tjenesten bruker vi følgende databehandlere:</p>
          <ul style={listeStil}>
            <li><strong>Supabase</strong> (databaseinfrastruktur) — data lagres i EU</li>
            <li><strong>Vercel</strong> (hosting) — applikasjonen kjører på serverne deres</li>
            <li><strong>Anthropic</strong> (AI — Claude) — analyserer dine bilder og tekster ved forespørsel</li>
            <li><strong>Replicate</strong> (AI — bildegenerering) — visualiserer oppussingsforslag</li>
            <li><strong>Google</strong> (AI — Gemini via Replicate) — bildegenerering</li>
            <li><strong>Resend</strong> (e-postutsending) — for transaksjonelle e-poster</li>
            <li><strong>Stripe</strong> (betalingsbehandling) — kun ved bestilling av inspeksjon</li>
            <li><strong>Kartverket / Geonorge</strong> (offentlige eiendomsdata) — adressesøk</li>
          </ul>
          <p>Vi har databehandleravtaler med alle disse leverandørene som krever det.</p>
        </Seksjon>

        <Seksjon tittel="5. Lagringstid">
          <p>Vi lagrer personopplysninger så lenge det er nødvendig for formålet:</p>
          <ul style={listeStil}>
            <li>Prosjekter og tilknyttede data: så lenge du har aktiv konto hos oss</li>
            <li>Regnskapsdata (kvitteringer, fakturaer): 5 år (bokføringsloven)</li>
            <li>Aktivitetslogg: 12 måneder</li>
            <li>E-postlogg: 24 måneder</li>
            <li>Kontaktforespørsler uten oppfølging: 12 måneder</li>
          </ul>
        </Seksjon>

        <Seksjon tittel="6. Dine rettigheter">
          <p>Som registrert har du rett til å:</p>
          <ul style={listeStil}>
            <li>Få innsyn i hvilke opplysninger vi har om deg</li>
            <li>Få rettet uriktige opplysninger</li>
            <li>Få slettet opplysninger (med unntak av lovpålagt oppbevaring)</li>
            <li>Begrense behandlingen</li>
            <li>Få utlevert dine data i et maskinlesbart format (dataportabilitet)</li>
            <li>Trekke tilbake samtykke der det er gitt</li>
            <li>Klage til Datatilsynet (<a href="https://www.datatilsynet.no" target="_blank" rel="noopener" style={lenkeStil}>datatilsynet.no</a>)</li>
          </ul>
          <p>
            For å bruke rettighetene dine, send e-post til <a href="mailto:post@loeiendom.com" style={lenkeStil}>post@loeiendom.com</a>
            {' '}eller bruk skjemaet under. Vi svarer innen 30 dager.
          </p>
          <GdprSkjema />
        </Seksjon>

        <Seksjon tittel="7. Cookies">
          <p>Vi bruker kun strengt nødvendige cookies:</p>
          <ul style={listeStil}>
            <li><strong>portal-tilgang</strong> — sesjons-cookie for administratortilgang (gyldig én økt)</li>
            <li><strong>Stripe</strong> — settes av Stripe ved betaling for å hindre svindel</li>
          </ul>
          <p>
            Vi bruker <strong>ingen</strong> analyse-, markedsførings- eller tredjeparts sporings-cookies.
            Derfor vises ikke en cookie-banner.
          </p>
        </Seksjon>

        <Seksjon tittel="8. Sikkerhet">
          <p>
            Vi bruker tekniske og organisatoriske tiltak for å beskytte opplysningene: kryptert overføring (HTTPS),
            tilgangskontroll med sterk autentisering, signerte sesjons-tokens, og kryptering ved lagring der det er relevant.
          </p>
          <p>
            Ved alvorlige brudd på personvernet melder vi til Datatilsynet innen 72 timer i tråd med GDPR art. 33.
          </p>
        </Seksjon>

        <Seksjon tittel="9. Endringer">
          <p>
            Vi kan oppdatere denne erklæringen ved endringer i tjenesten eller lovgivningen.
            Den til enhver tid gjeldende versjonen ligger på denne siden med dato øverst.
            Vesentlige endringer varsles på e-post til brukere som har aktiv konto.
          </p>
        </Seksjon>

        <div style={{ marginTop: 48, padding: 20, background: FARGER.creamLys, borderRadius: RADIUS.md, fontSize: 13, color: FARGER.tekstMid, lineHeight: 1.6 }}>
          Spørsmål om personvern? Send e-post til{' '}
          <a href="mailto:post@loeiendom.com" style={lenkeStil}>post@loeiendom.com</a> — vi svarer alltid innen rimelig tid.
        </div>
      </div>
    </main>
  )
}

function Seksjon({ tittel, children }: { tittel: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
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
