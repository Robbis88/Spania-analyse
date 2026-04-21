'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Prosjekt } from '../types'
import { hentAktivBruker } from './aktivBruker'
import { loggAktivitet } from './logg'

export function useProsjekter() {
  const [prosjekter, setProsjekter] = useState<Prosjekt[]>([])
  const [laster, setLaster] = useState(true)

  const hent = useCallback(async () => {
    const { data } = await supabase
      .from('prosjekter')
      .select('*')
      .order('opprettet', { ascending: false })
    if (data) setProsjekter(data as Prosjekt[])
    setLaster(false)
  }, [])

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
    await supabase.from('prosjekter').update(p).eq('id', p.id)
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
