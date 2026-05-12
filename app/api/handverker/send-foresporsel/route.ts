import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAuth } from '../../../lib/requireAuth'
import { FRA_ADRESSE, SVAR_ADRESSE, byggHtmlFraTekst, hentResendKlient, validerEpostadresse } from '../../../lib/epost'
import { BUCKET_BILDER } from '../../../lib/bilder'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

// Maks 5 bilder per e-post for å holde størrelsen rimelig (Resend ~40MB grense)
const MAKS_VEDLEGG = 5

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json()
    const handverker_ids: string[] = Array.isArray(body?.handverker_ids) ? body.handverker_ids.filter((x: unknown) => typeof x === 'string') : []
    const prosjekt_id: string | null = typeof body?.prosjekt_id === 'string' ? body.prosjekt_id : null
    const oppussing_post_id: string | null = typeof body?.oppussing_post_id === 'string' ? body.oppussing_post_id : null
    const tittel_no: string = typeof body?.tittel_no === 'string' ? body.tittel_no : ''
    const tittel_sendt: string = typeof body?.tittel_sendt === 'string' ? body.tittel_sendt : tittel_no
    const beskrivelse_no: string = typeof body?.beskrivelse_no === 'string' ? body.beskrivelse_no : ''
    const beskrivelse_sendt: string = typeof body?.beskrivelse_sendt === 'string' ? body.beskrivelse_sendt : beskrivelse_no
    const bilde_ids: string[] = Array.isArray(body?.bilde_ids) ? body.bilde_ids.filter((x: unknown) => typeof x === 'string') : []
    const inkluder_bilder_som_vedlegg = body?.inkluder_bilder_som_vedlegg !== false  // default true

    if (handverker_ids.length === 0) return NextResponse.json({ feil: 'Velg minst én håndverker' }, { status: 400 })
    if (!tittel_no.trim() || !beskrivelse_no.trim()) {
      return NextResponse.json({ feil: 'Tittel og beskrivelse må fylles inn' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()

    // Hent håndverkere
    const { data: handverkere } = await admin.from('handverkere').select('*').in('id', handverker_ids)
    if (!handverkere || handverkere.length === 0) {
      return NextResponse.json({ feil: 'Fant ingen av de valgte håndverkerne' }, { status: 404 })
    }

    // Hent bilder + signerte URL-er
    const { data: bilder } = bilde_ids.length > 0
      ? await admin.from('prosjekt_bilder').select('id, storage_sti, filnavn, mime_type, kategori').in('id', bilde_ids)
      : { data: [] }
    const bildeListe = (bilder || []).slice(0, MAKS_VEDLEGG)

    // Hent vedlegg-buffer for hvert bilde (kun de første MAKS_VEDLEGG)
    type Vedlegg = { filename: string; content: string }  // base64
    type SignertBilde = { id: string; url: string; filnavn: string }
    const vedlegg: Vedlegg[] = []
    const signerte: SignertBilde[] = []

    for (const b of bildeListe) {
      const { data: signert } = await admin.storage.from(BUCKET_BILDER)
        .createSignedUrl(b.storage_sti, 60 * 60 * 24 * 14)  // 14 dager — håndverker rekker å se det
      if (signert?.signedUrl) {
        const filnavn = b.filnavn || `${b.kategori || 'bilde'}-${b.id.slice(-6)}.jpg`
        signerte.push({ id: b.id, url: signert.signedUrl, filnavn })
        if (inkluder_bilder_som_vedlegg) {
          const { data: blob } = await admin.storage.from(BUCKET_BILDER).download(b.storage_sti)
          if (blob) {
            const buffer = Buffer.from(await blob.arrayBuffer())
            vedlegg.push({ filename: filnavn, content: buffer.toString('base64') })
          }
        }
      }
    }

    // Bygg e-postinnhold (samme for alle valgte håndverkere, kun til-adresse varierer)
    const linjerBunn: string[] = []
    if (signerte.length > MAKS_VEDLEGG) {
      linjerBunn.push('')
      linjerBunn.push('Bilder (lenker som er gyldige i 14 dager):')
      for (const s of signerte.slice(MAKS_VEDLEGG)) {
        linjerBunn.push(`- ${s.url}`)
      }
    }
    linjerBunn.push('')
    linjerBunn.push('— Leganger & Osvaag Eiendom')
    const innholdSendt = beskrivelse_sendt.trim() + '\n' + linjerBunn.join('\n')

    let klient
    try { klient = hentResendKlient() } catch (e) {
      const m = e instanceof Error ? e.message : 'RESEND_API_KEY mangler'
      return NextResponse.json({ feil: m }, { status: 500 })
    }

    // Send til hver håndverker og lagre forespørsel-rad
    type Resultat = { handverker_id: string; navn: string; status: 'sendt' | 'feilet'; feilmelding?: string; resend_id?: string }
    const resultater: Resultat[] = []

    for (const h of handverkere as Array<{ id: string; navn: string; epost: string | null; sprak: 'no' | 'en' | 'es' }>) {
      const forsporsel_id = nyId()

      let status: 'sendt' | 'feilet' = 'sendt'
      let resendId: string | null = null
      let feilmelding: string | null = null

      if (!h.epost || !validerEpostadresse(h.epost)) {
        status = 'feilet'
        feilmelding = 'Ugyldig eller manglende e-postadresse'
      } else {
        try {
          const res = await klient.emails.send({
            from: FRA_ADRESSE,
            to: [h.epost],
            replyTo: SVAR_ADRESSE,
            subject: tittel_sendt || tittel_no,
            text: innholdSendt,
            html: byggHtmlFraTekst(innholdSendt),
            headers: { 'X-Entity-Ref-ID': forsporsel_id },
            attachments: vedlegg.length > 0 ? vedlegg : undefined,
          })
          if (res.error) {
            status = 'feilet'
            feilmelding = res.error.message || 'Resend-feil'
          } else if (res.data) {
            resendId = res.data.id
          }
        } catch (e) {
          status = 'feilet'
          feilmelding = e instanceof Error ? e.message : String(e)
        }
      }

      // Lagre forespørsel-rad uansett (status reflekterer om det gikk)
      await admin.from('tilbudsforesporsler').insert([{
        id: forsporsel_id,
        bruker: auth.bruker,
        handverker_id: h.id,
        prosjekt_id,
        oppussing_post_id,
        tittel: tittel_no,
        beskrivelse_no,
        beskrivelse_sendt: beskrivelse_sendt !== beskrivelse_no ? beskrivelse_sendt : null,
        sendt_sprak: h.sprak,
        bilde_ids,
        status,
        sendt_via: 'epost',
        resend_id: resendId,
        feilmelding,
        sendt_tidspunkt: status === 'sendt' ? new Date().toISOString() : null,
      }])

      resultater.push({
        handverker_id: h.id, navn: h.navn,
        status,
        feilmelding: feilmelding || undefined,
        resend_id: resendId || undefined,
      })
    }

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: auth.bruker,
      handling: 'sendte tilbudsforespørsel',
      tabell: 'tilbudsforesporsler',
      rad_id: null,
      detaljer: {
        antall: handverker_ids.length,
        suksess: resultater.filter(r => r.status === 'sendt').length,
        prosjekt_id, tittel: tittel_no,
      },
    }])

    return NextResponse.json({ suksess: true, resultater })
  } catch (e) {
    console.error('Send-forespørsel feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Sending feilet' }, { status: 500 })
  }
}
