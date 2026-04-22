import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../../lib/supabaseAdmin'
import { BUCKET_BILDER } from '../../../lib/bilder'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

export async function POST(req: NextRequest) {
  try {
    const { bilde_id, slettet_av } = await req.json()
    if (typeof bilde_id !== 'string' || !bilde_id) {
      return NextResponse.json({ feil: 'bilde_id mangler' }, { status: 400 })
    }
    if (typeof slettet_av !== 'string' || !slettet_av) {
      return NextResponse.json({ feil: 'slettet_av mangler' }, { status: 400 })
    }

    const admin = hentSupabaseAdmin()

    const { data: hoved } = await admin.from('prosjekt_bilder').select('id, storage_sti, prosjekt_id, kategori, filnavn').eq('id', bilde_id).single()
    if (!hoved) return NextResponse.json({ feil: 'Bilde ikke funnet' }, { status: 404 })

    // Samle alle avhengige (visualiseringer med denne som original) slik at vi sletter Storage-objektene også
    const { data: avhengige } = await admin.from('prosjekt_bilder').select('id, storage_sti').eq('original_bilde_id', bilde_id)
    const stier = [hoved.storage_sti, ...(avhengige || []).map(a => a.storage_sti)].filter(Boolean) as string[]

    if (stier.length > 0) {
      await admin.storage.from(BUCKET_BILDER).remove(stier)
    }

    // DB-slett. Cascade fjerner avhengige rader automatisk.
    const { error } = await admin.from('prosjekt_bilder').delete().eq('id', bilde_id)
    if (error) return NextResponse.json({ feil: 'DB-slett feilet: ' + error.message }, { status: 500 })

    await admin.from('aktivitetslogg').insert([{
      id: nyId(),
      bruker: slettet_av,
      handling: 'slettet bilde',
      tabell: 'prosjekt_bilder',
      rad_id: bilde_id,
      detaljer: { prosjekt_id: hoved.prosjekt_id, kategori: hoved.kategori, filnavn: hoved.filnavn, avhengige_fjernet: avhengige?.length || 0 },
    }])

    return NextResponse.json({ suksess: true })
  } catch (e) {
    const melding = e instanceof Error ? e.message : String(e)
    console.error('Slett-feil:', melding)
    return NextResponse.json({ feil: melding }, { status: 500 })
  }
}
