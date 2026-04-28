import { NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { BUCKET_BILDER } from '../../lib/bilder'

const VARIGHET_SEKUNDER = 60 * 60

// Returnerer alle publiserte utleieboliger med ett representativt
// marketing-bilde (lavest marketing_rekkefolge). Brukes på offentlig forside.
export async function GET() {
  try {
    const admin = hentSupabaseAdmin()
    const { data: prosjekter, error } = await admin
      .from('prosjekter')
      .select('id, navn, utleie_kort_beskrivelse, utleie_pris_natt, utleie_maks_gjester, bolig_data')
      .eq('publisert_utleie', true)
      .order('opprettet', { ascending: false })

    if (error) return NextResponse.json({ feil: error.message }, { status: 500 })

    const ids = (prosjekter || []).map(p => p.id)
    if (ids.length === 0) return NextResponse.json({ boliger: [] })

    const { data: bilder } = await admin
      .from('prosjekt_bilder')
      .select('id, prosjekt_id, storage_sti, marketing_rekkefolge')
      .in('prosjekt_id', ids)
      .eq('er_marketing', true)
      .order('marketing_rekkefolge', { ascending: true, nullsFirst: false })

    const førstebildePerProsjekt: Record<string, { id: string; sti: string }> = {}
    for (const b of bilder || []) {
      if (!førstebildePerProsjekt[b.prosjekt_id]) {
        førstebildePerProsjekt[b.prosjekt_id] = { id: b.id, sti: b.storage_sti }
      }
    }

    const boliger = await Promise.all((prosjekter || []).map(async p => {
      const bilde = førstebildePerProsjekt[p.id]
      let bilde_url: string | null = null
      if (bilde) {
        const { data: signert } = await admin.storage.from(BUCKET_BILDER).createSignedUrl(bilde.sti, VARIGHET_SEKUNDER)
        bilde_url = signert?.signedUrl || null
      }
      return {
        id: p.id,
        navn: p.navn,
        kort_beskrivelse: p.utleie_kort_beskrivelse,
        pris_natt: p.utleie_pris_natt,
        maks_gjester: p.utleie_maks_gjester,
        beliggenhet: p.bolig_data?.beliggenhet || null,
        soverom: p.bolig_data?.soverom || null,
        bilde_url,
      }
    }))

    return NextResponse.json({ boliger })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
