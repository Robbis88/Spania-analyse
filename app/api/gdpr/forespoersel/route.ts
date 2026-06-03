import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { FRA_ADRESSE, SVAR_ADRESSE, hentResendKlient, validerEpostadresse } from '../../../lib/epost'

// Offentlig endepunkt for GDPR-forespørsler (innsyn, sletting, retting,
// portabilitet). Krever ikke admin-auth siden alle data-subjekter skal kunne
// be om sine rettigheter — men beskytter mot misbruk med rate-limiting per IP
// (rudimentært: én forespørsel per epost per 24t).

const GYLDIGE_TYPER = ['innsyn', 'sletting', 'retting', 'portabilitet', 'annet'] as const
type GyldigType = typeof GYLDIGE_TYPER[number]

const TYPE_ETIKETT: Record<GyldigType, string> = {
  innsyn: 'Innsyn — kopi av lagrede data',
  sletting: 'Sletting av personopplysninger',
  retting: 'Retting av feil i lagrede data',
  portabilitet: 'Dataportabilitet — utlevering i maskinlesbart format',
  annet: 'Annet (spesifisert i melding)',
}

function nyId(): string {
  return Date.now().toString() + '-' + Math.random().toString(36).slice(2, 10)
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null
  const salt = process.env.IP_HASH_SALT || 'loeiendom-gdpr'
  return crypto.createHash('sha256').update(ip + salt).digest('hex')
}

function hentIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const epost = String(body?.epost || '').trim().toLowerCase()
    const navn = typeof body?.navn === 'string' ? body.navn.trim() : null
    const type = String(body?.type || '') as GyldigType
    const melding = typeof body?.melding === 'string' ? body.melding.trim().slice(0, 2000) : null

    if (!validerEpostadresse(epost)) {
      return NextResponse.json({ feil: 'Ugyldig e-postadresse' }, { status: 400 })
    }
    if (!GYLDIGE_TYPER.includes(type)) {
      return NextResponse.json({ feil: 'Ugyldig type forespørsel' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()

    // Rate-limit: maks én ubehandlet forespørsel per epost siste 24t
    // (forhindrer skjema-spam, men lar legitime brukere prøve igjen ved feil)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('gdpr_forespoersler')
      .select('id', { count: 'exact', head: true })
      .eq('epost', epost)
      .eq('status', 'mottatt')
      .gte('opprettet', cutoff)
    if ((count || 0) > 0) {
      return NextResponse.json({
        feil: 'Du har allerede en ubehandlet forespørsel registrert. Vi kontakter deg innen 30 dager.',
      }, { status: 429 })
    }

    const id = nyId()
    const ipHash = hashIp(hentIp(req))

    const { error: insertErr } = await admin.from('gdpr_forespoersler').insert([{
      id, epost, navn, type, melding, ip_hash: ipHash,
    }])
    if (insertErr) {
      console.error('GDPR insert feilet:', insertErr.message)
      return NextResponse.json({ feil: 'Kunne ikke registrere forespørselen' }, { status: 500 })
    }

    // Best-effort: send bekreftelse til søker + varsling til admin.
    // Vi feiler ikke forespørselen hvis e-post-sending feiler — den er logget
    // i DB og admin ser den uansett ved neste innlogging.
    let bekreftelseSendt: string | null = null
    let varslingSendt: string | null = null
    try {
      const klient = hentResendKlient()
      const typeEtikett = TYPE_ETIKETT[type]
      const nå = new Date().toISOString()

      // Bekreftelse til søker
      const bekreftelseTekst = [
        navn ? `Hei ${navn},` : 'Hei,',
        '',
        `Vi har mottatt forespørselen din om: ${typeEtikett}.`,
        '',
        'Vi behandler forespørselen din innen 30 dager (jf. GDPR artikkel 12).',
        'Du får svar på denne e-postadressen så snart vi har behandlet saken.',
        '',
        melding ? `Din melding:\n«${melding}»\n` : '',
        'Hvis du ikke har sendt denne forespørselen kan du se bort fra denne e-posten.',
        '',
        'Med vennlig hilsen,',
        'Leganger & Osvaag Eiendom',
        SVAR_ADRESSE,
      ].filter(l => l !== null && l !== undefined).join('\n')

      const r1 = await klient.emails.send({
        from: FRA_ADRESSE,
        to: [epost],
        replyTo: SVAR_ADRESSE,
        subject: `Bekreftelse — vi har mottatt din GDPR-forespørsel`,
        text: bekreftelseTekst,
      })
      if (r1.data?.id) bekreftelseSendt = nå

      // Varsling til admin
      const varslingTekst = [
        `Ny GDPR-forespørsel mottatt på loeiendom.com`,
        ``,
        `Type:    ${typeEtikett}`,
        `E-post:  ${epost}`,
        `Navn:    ${navn || '(ikke oppgitt)'}`,
        `Tid:     ${new Date().toLocaleString('nb-NO')}`,
        ``,
        melding ? `Melding fra søker:\n${melding}\n` : '(ingen ekstra melding)',
        ``,
        `Frist for behandling: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('nb-NO')} (30 dager).`,
        ``,
        `Se admin → GDPR for å behandle og dokumentere svaret.`,
      ].join('\n')

      const r2 = await klient.emails.send({
        from: FRA_ADRESSE,
        to: [SVAR_ADRESSE],
        subject: `[GDPR] ${typeEtikett.split(' — ')[0]} — ${epost}`,
        text: varslingTekst,
      })
      if (r2.data?.id) varslingSendt = nå

      if (bekreftelseSendt || varslingSendt) {
        await admin.from('gdpr_forespoersler').update({
          bekreftelse_sendt: bekreftelseSendt,
          varsling_sendt: varslingSendt,
        }).eq('id', id)
      }
    } catch (e) {
      console.error('GDPR e-post-sending feilet:', e instanceof Error ? e.message : String(e))
    }

    return NextResponse.json({ ok: true, id })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('GDPR forespørsel-feil:', m)
    return NextResponse.json({ feil: 'Uventet feil' }, { status: 500 })
  }
}
