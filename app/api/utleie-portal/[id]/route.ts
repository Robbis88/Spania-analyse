import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { BUCKET_BILDER } from '../../../lib/bilder'

const VARIGHET_SEKUNDER = 60 * 60

// Returnerer detaljinfo + alle marketing-bilder for ett prosjekt.
// 404 hvis hverken utleie eller salg er publisert (skjuler upubliserte
// boliger fra publikum også når id-en gjettes).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const admin = hentSupabaseAdmin()

    const { data: p, error } = await admin
      .from('prosjekter')
      .select('id, navn, publisert_utleie, publisert_salg, utleie_pris_natt, utleie_pris_uke, utleie_min_netter, utleie_maks_gjester, utleie_beskrivelse, utleie_kort_beskrivelse, utleie_fasiliteter, salgspris_eur, salg_kort_beskrivelse, salg_beskrivelse, byggear, tomt_m2, kort_avstand, bolig_data')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })
    if (!p || (!p.publisert_utleie && !p.publisert_salg)) {
      return NextResponse.json({ feil: 'Ikke funnet' }, { status: 404 })
    }

    const { data: bilder } = await admin
      .from('prosjekt_bilder')
      .select('id, storage_sti, marketing_rekkefolge')
      .eq('prosjekt_id', id)
      .eq('er_marketing', true)
      .order('marketing_rekkefolge', { ascending: true, nullsFirst: false })

    const bildeUrler = await Promise.all((bilder || []).map(async b => {
      const { data: signert } = await admin.storage.from(BUCKET_BILDER).createSignedUrl(b.storage_sti, VARIGHET_SEKUNDER)
      return { id: b.id, url: signert?.signedUrl || null }
    }))

    return NextResponse.json({
      bolig: {
        id: p.id,
        navn: p.navn,
        til_leie: !!p.publisert_utleie,
        til_salgs: !!p.publisert_salg,
        // Utleie
        pris_natt: p.utleie_pris_natt,
        pris_uke: p.utleie_pris_uke,
        min_netter: p.utleie_min_netter,
        maks_gjester: p.utleie_maks_gjester,
        utleie_beskrivelse: p.utleie_beskrivelse,
        utleie_kort: p.utleie_kort_beskrivelse,
        fasiliteter: p.utleie_fasiliteter || [],
        // Salg
        salgspris_eur: p.salgspris_eur,
        salg_beskrivelse: p.salg_beskrivelse,
        salg_kort: p.salg_kort_beskrivelse,
        byggear: p.byggear,
        tomt_m2: p.tomt_m2,
        kort_avstand: p.kort_avstand || {},
        // Felles
        bolig_data: p.bolig_data || {},
        bilder: bildeUrler.filter(b => b.url),
      },
    })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
