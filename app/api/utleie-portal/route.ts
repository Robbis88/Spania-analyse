import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { BUCKET_BILDER } from '../../lib/bilder'

const VARIGHET_SEKUNDER = 60 * 60

// Returnerer publiserte boliger — både utleie og salg.
// Filter via ?type=utleie eller ?type=salg, default = begge.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type') // 'utleie' | 'salg' | null

    const admin = hentSupabaseAdmin()

    let query = admin
      .from('prosjekter')
      .select('id, navn, utleie_kort_beskrivelse, utleie_pris_natt, utleie_maks_gjester, salg_kort_beskrivelse, salgspris_eur, publisert_utleie, publisert_salg, bolig_data')
      .order('opprettet', { ascending: false })

    if (type === 'utleie') query = query.eq('publisert_utleie', true)
    else if (type === 'salg') query = query.eq('publisert_salg', true)
    else query = query.or('publisert_utleie.eq.true,publisert_salg.eq.true')

    const { data: prosjekter, error } = await query
    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })

    const ids = (prosjekter || []).map(p => p.id)
    if (ids.length === 0) return NextResponse.json({ boliger: [] })

    const { data: bilder } = await admin
      .from('prosjekt_bilder')
      .select('id, prosjekt_id, storage_sti, marketing_rekkefolge')
      .in('prosjekt_id', ids)
      .eq('er_marketing', true)
      .order('marketing_rekkefolge', { ascending: true, nullsFirst: false })

    const bilderPerProsjekt: Record<string, Array<{ id: string; sti: string }>> = {}
    for (const b of bilder || []) {
      (bilderPerProsjekt[b.prosjekt_id] ||= []).push({ id: b.id, sti: b.storage_sti })
    }

    const boliger = await Promise.all((prosjekter || []).map(async p => {
      const liste = bilderPerProsjekt[p.id] || []
      const bilde_urler: string[] = []
      for (const b of liste) {
        const { data: signert } = await admin.storage.from(BUCKET_BILDER).createSignedUrl(b.sti, VARIGHET_SEKUNDER)
        if (signert?.signedUrl) bilde_urler.push(signert.signedUrl)
      }
      return {
        id: p.id,
        navn: p.navn,
        til_leie: !!p.publisert_utleie,
        til_salgs: !!p.publisert_salg,
        utleie_kort: p.utleie_kort_beskrivelse,
        salg_kort: p.salg_kort_beskrivelse,
        pris_natt: p.utleie_pris_natt,
        salgspris_eur: p.salgspris_eur,
        maks_gjester: p.utleie_maks_gjester,
        beliggenhet: p.bolig_data?.beliggenhet || null,
        soverom: p.bolig_data?.soverom || null,
        bad: p.bolig_data?.bad || null,
        areal: p.bolig_data?.areal || null,
        bilde_url: bilde_urler[0] || null,    // bakoverkompatibel
        bilde_urler,                           // alle marketing-bilder, sortert
      }
    }))

    return NextResponse.json({ boliger })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
