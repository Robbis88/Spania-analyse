'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Prosjekt, Utleieanalyse } from '../types'
import { hentAktivBruker } from './aktivBruker'
import { loggAktivitet } from './logg'
import { harProsjektEndringer, utleieanalyseFraProsjekt } from './prosjektSync'

export function useProsjekter(kategori?: 'flipp' | 'utleie') {
  const [prosjekter, setProsjekter] = useState<Prosjekt[]>([])
  const [laster, setLaster] = useState(true)

  const hent = useCallback(async () => {
    // Hent kun Spania-prosjekter — norske har egen fane med egen visning
    // (NOK-format, egen kalkulator). marked = null tolkes som Spania for
    // bakoverkompatibilitet med rader fra før marked-feltet ble innført.
    let q = supabase
      .from('prosjekter')
      .select('*')
      .or('marked.is.null,marked.eq.spania')
      .order('opprettet', { ascending: false })
    if (kategori) q = q.eq('kategori', kategori)
    const { data } = await q
    if (data) setProsjekter(data as Prosjekt[])
    setLaster(false)
  }, [kategori])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  async function leggTil(p: Prosjekt) {
    const bruker = hentAktivBruker() || 'ukjent'
    const nyId = Date.now().toString()
    await supabase.from('prosjekter').insert([{ ...p, id: nyId, bruker }])
    await loggAktivitet({ handling: 'opprettet prosjekt', tabell: 'prosjekter', rad_id: nyId, detaljer: { navn: p.navn } })
    await hent()
  }

  async function oppdater(p: Prosjekt) {
    const forrige = prosjekter.find(x => x.id === p.id)
    await supabase.from('prosjekter').update(p).eq('id', p.id)

    // Synk til utleieanalyse hvis økonomi-felt har endret seg
    if (forrige && harProsjektEndringer(forrige, p)) {
      const { data: analyseRad } = await supabase.from('utleieanalyse').select('*').eq('bolig_id', p.id).maybeSingle()
      if (analyseRad) {
        const analyse = analyseRad as Utleieanalyse
        const oppd = utleieanalyseFraProsjekt(p, analyse)
        if (Object.keys(oppd).length > 0) {
          await supabase.from('utleieanalyse').update(oppd).eq('id', analyse.id)
        }
      }
    }

    await loggAktivitet({ handling: 'redigerte prosjekt', tabell: 'prosjekter', rad_id: p.id, detaljer: { navn: p.navn } })
    await hent()
  }

  async function slett(id: string) {
    const p = prosjekter.find(x => x.id === id)
    await supabase.from('prosjekter').delete().eq('id', id)
    await loggAktivitet({ handling: 'slettet prosjekt', tabell: 'prosjekter', rad_id: id, detaljer: { navn: p?.navn } })
    await hent()
  }

  return { prosjekter, laster, hent, leggTil, oppdater, slett }
}
