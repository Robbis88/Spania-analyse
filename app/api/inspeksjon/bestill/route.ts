import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { STORRELSE, TJENESTE_TYPE, beregnPris, type Storrelse, type TjenesteType } from '../../../lib/inspeksjon'
import { validerEpostadresse } from '../../../lib/epost'

// Public-rute — ingen auth-krav. Kunden booker en inspeksjon.
// Validerer minimum-felt og beregner pris serverside (kan ikke stoles på fra client).

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

type Body = {
  kunde_navn?: string
  kunde_epost?: string
  kunde_telefon?: string
  kunde_sprak?: string
  adresse?: string
  kompleks?: string
  leilighet_nr?: string
  storrelse?: string
  bra_m2?: number | string
  tjeneste_type?: string
  onsket_dato?: string
  fleksibel?: boolean
  melding?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body

    // Valider påkrevde felt
    if (!body.kunde_navn?.trim()) return svar('Navn er påkrevd', 400)
    if (!body.kunde_epost?.trim() || !validerEpostadresse(body.kunde_epost)) return svar('Gyldig e-post er påkrevd', 400)
    if (!body.adresse?.trim()) return svar('Adresse er påkrevd', 400)
    if (!body.storrelse || !STORRELSE.includes(body.storrelse as Storrelse)) return svar('Ugyldig størrelse', 400)
    if (!body.tjeneste_type || !TJENESTE_TYPE.includes(body.tjeneste_type as TjenesteType)) return svar('Ugyldig tjeneste-type', 400)

    const storrelse = body.storrelse as Storrelse
    const tjeneste = body.tjeneste_type as TjenesteType
    const pris = beregnPris(storrelse, tjeneste)

    const id = nyId()
    const supabase = hentSupabaseAdmin()

    const { error } = await supabase.from('inspeksjon_bestillinger').insert([{
      id,
      kunde_navn: body.kunde_navn.trim(),
      kunde_epost: body.kunde_epost.trim().toLowerCase(),
      kunde_telefon: body.kunde_telefon?.trim() || null,
      kunde_sprak: ['no', 'en', 'es'].includes(body.kunde_sprak || '') ? body.kunde_sprak : 'no',
      adresse: body.adresse.trim(),
      kompleks: body.kompleks?.trim() || null,
      leilighet_nr: body.leilighet_nr?.trim() || null,
      storrelse,
      bra_m2: body.bra_m2 ? Number(body.bra_m2) : null,
      tjeneste_type: tjeneste,
      pris_eur: pris,
      onsket_dato: body.onsket_dato || null,
      fleksibel: body.fleksibel ?? true,
      melding: body.melding?.trim() || null,
      status: 'ny',
    }])

    if (error) {
      console.error('Bestilling-insert feilet:', error.message)
      return svar('Kunne ikke lagre bestillingen. Prøv igjen, eller kontakt oss direkte.', 500)
    }

    return NextResponse.json({ ok: true, id, pris_eur: pris })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error('Bestilling-feil:', m)
    return svar('Noe gikk galt', 500)
  }
}

function svar(feil: string, status: number) {
  return NextResponse.json({ feil }, { status })
}
