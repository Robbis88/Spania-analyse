import { supabase } from './supabase'
import { hentAktivBruker } from './aktivBruker'

// Hendelsestyper for tidslinjen (B10). 'generell' = vanlig logglinje uten
// spesiell eiendomshendelse.
export type Hendelsestype =
  | 'generell' | 'kjopt' | 'bud' | 'renovering_start' | 'renovering_slutt'
  | 'verdivurdering' | 'refinansiert' | 'utleid' | 'tilbud_akseptert'
  | 'anbefaling_gitt' | 'solgt'

type LoggInn = {
  handling: string
  tabell?: string
  rad_id?: string
  detaljer?: Record<string, unknown>
  prosjekt_id?: string
  hendelsestype?: Hendelsestype
}

export async function loggAktivitet({ handling, tabell, rad_id, detaljer, prosjekt_id, hendelsestype }: LoggInn) {
  const bruker = hentAktivBruker() || 'ukjent'
  const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)
  await supabase.from('aktivitetslogg').insert([{
    id, bruker, handling, tabell: tabell || null, rad_id: rad_id || null, detaljer: detaljer || null,
    prosjekt_id: prosjekt_id || null, hendelsestype: hendelsestype || null,
  }])
}
