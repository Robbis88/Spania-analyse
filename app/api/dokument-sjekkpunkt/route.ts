import { NextRequest, NextResponse } from 'next/server'
import { hentSupabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAuth } from '../../lib/requireAuth'
import {
  DOKUMENT_TYPER,
  STANDARD_SJEKKPUNKTER_NORGE, STANDARD_SJEKKPUNKTER_SPANIA,
  type DokumentType,
} from '../../lib/dokument'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const TILLATTE_OPPDATER_FELT = new Set(['status', 'ansvarlig', 'frist', 'notat'])
const GYLDIGE_STATUS = new Set(['mangler', 'i_prosess', 'ok', 'ikke_relevant'])

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const body = await req.json()
    const action = body?.action

    if (action === 'seed') {
      // Autopopulerer standardsett basert på prosjekt.marked. Trygg å kjøre
      // flere ganger — hopper over typer som allerede har et sjekkpunkt.
      const prosjekt_id = body.prosjekt_id
      if (typeof prosjekt_id !== 'string') return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })

      const admin = hentSupabaseAdmin()
      const { data: p } = await admin.from('prosjekter').select('id, marked').eq('id', prosjekt_id).maybeSingle()
      if (!p) return NextResponse.json({ feil: 'Prosjekt ikke funnet' }, { status: 404 })

      const sett: DokumentType[] = p.marked === 'norge'
        ? STANDARD_SJEKKPUNKTER_NORGE
        : STANDARD_SJEKKPUNKTER_SPANIA

      const { data: eksisterende } = await admin.from('dokument_sjekkpunkter')
        .select('dokument_type').eq('prosjekt_id', prosjekt_id)
      const allerede = new Set((eksisterende || []).map(r => r.dokument_type))

      // Sjekk om det finnes opplastede dokumenter — sett da status til 'ok' direkte
      const { data: dokumenter } = await admin.from('dokumenter')
        .select('type').eq('prosjekt_id', prosjekt_id)
      const harDokumentAvType = new Set((dokumenter || []).map(r => r.type))

      const naa = new Date().toISOString()
      const nye = sett
        .filter(t => !allerede.has(t))
        .map(t => ({
          id: nyId(),
          prosjekt_id,
          dokument_type: t,
          status: harDokumentAvType.has(t) ? 'ok' : 'mangler',
          oppdatert: naa,
        }))

      if (nye.length > 0) {
        const { error } = await admin.from('dokument_sjekkpunkter').insert(nye)
        if (error) return NextResponse.json({ feil: 'Seed feilet: ' + error.message }, { status: 500 })
      }
      return NextResponse.json({ suksess: true, lagt_til: nye.length })
    }

    if (action === 'legg-til') {
      const prosjekt_id = body.prosjekt_id
      const dokument_type = body.dokument_type
      if (typeof prosjekt_id !== 'string' || !prosjekt_id) {
        return NextResponse.json({ feil: 'prosjekt_id mangler' }, { status: 400 })
      }
      if (typeof dokument_type !== 'string' || !(DOKUMENT_TYPER as readonly string[]).includes(dokument_type)) {
        return NextResponse.json({ feil: 'Ugyldig dokument_type' }, { status: 400 })
      }
      const admin = hentSupabaseAdmin()
      const id = nyId()
      const { error } = await admin.from('dokument_sjekkpunkter').insert([{
        id, prosjekt_id, dokument_type, status: 'mangler',
      }])
      // unique-constraint på (prosjekt_id, dokument_type) — duplikat returnerer feil; det er greit å oversette
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ feil: 'Dette sjekkpunktet finnes allerede' }, { status: 409 })
        }
        return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
      }
      return NextResponse.json({ suksess: true, id })
    }

    if (action === 'oppdater') {
      const id = body.id
      const endringer = body.endringer
      if (typeof id !== 'string' || !id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
      if (!endringer || typeof endringer !== 'object') return NextResponse.json({ feil: 'endringer mangler' }, { status: 400 })

      const oppdatering: Record<string, unknown> = { oppdatert: new Date().toISOString() }
      for (const [k, v] of Object.entries(endringer as Record<string, unknown>)) {
        if (!TILLATTE_OPPDATER_FELT.has(k)) continue
        if (k === 'status' && (typeof v !== 'string' || !GYLDIGE_STATUS.has(v))) continue
        oppdatering[k] = v
      }
      if (Object.keys(oppdatering).length === 1) {  // bare 'oppdatert'
        return NextResponse.json({ feil: 'Ingen gyldige felt' }, { status: 400 })
      }

      const admin = hentSupabaseAdmin()
      const { error } = await admin.from('dokument_sjekkpunkter').update(oppdatering).eq('id', id)
      if (error) return NextResponse.json({ feil: 'Lagring feilet' }, { status: 500 })
      return NextResponse.json({ suksess: true })
    }

    if (action === 'slett') {
      const id = body.id
      if (typeof id !== 'string' || !id) return NextResponse.json({ feil: 'id mangler' }, { status: 400 })
      const admin = hentSupabaseAdmin()
      const { error } = await admin.from('dokument_sjekkpunkter').delete().eq('id', id)
      if (error) return NextResponse.json({ feil: 'Slett feilet' }, { status: 500 })
      return NextResponse.json({ suksess: true })
    }

    return NextResponse.json({ feil: 'Ukjent action' }, { status: 400 })
  } catch (e) {
    console.error('Sjekkpunkt-feil:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ feil: 'Operasjonen feilet' }, { status: 500 })
  }
}
