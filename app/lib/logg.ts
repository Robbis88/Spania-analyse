import { supabase } from './supabase'
import { hentAktivBruker } from './aktivBruker'

type LoggInn = {
  handling: string
  tabell?: string
  rad_id?: string
  detaljer?: Record<string, unknown>
}

export async function loggAktivitet({ handling, tabell, rad_id, detaljer }: LoggInn) {
  const bruker = hentAktivBruker() || 'ukjent'
  const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)
  await supabase.from('aktivitetslogg').insert([{
    id, bruker, handling, tabell: tabell || null, rad_id: rad_id || null, detaljer: detaljer || null,
  }])
}
