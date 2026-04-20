'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Prosjekt } from '../types'

export function useProsjekter() {
  const [prosjekter, setProsjekter] = useState<Prosjekt[]>([])
  const [laster, setLaster] = useState(true)

  const hent = useCallback(async () => {
    const { data } = await supabase
      .from('prosjekter')
      .select('*')
      .eq('bruker', 'leganger')
      .order('opprettet', { ascending: false })
    if (data) setProsjekter(data as Prosjekt[])
    setLaster(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  async function leggTil(p: Prosjekt) {
    await supabase.from('prosjekter').insert([{ ...p, id: Date.now().toString(), bruker: 'leganger' }])
    await hent()
  }

  async function oppdater(p: Prosjekt) {
    await supabase.from('prosjekter').update(p).eq('id', p.id)
    await hent()
  }

  async function slett(id: string) {
    await supabase.from('prosjekter').delete().eq('id', id)
    await hent()
  }

  return { prosjekter, laster, hent, leggTil, oppdater, slett }
}
