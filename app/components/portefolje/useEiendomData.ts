'use client'
// Sentral data-hook for én eiendom i porteføljen.
// Henter prosjektet + alle støttetabeller én gang og eksponerer refresh-funksjon.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type {
  Prosjekt, EiendomLaan, EiendomLeietaker, EiendomInntekt, EiendomKostnad,
  EiendomVerdivurdering, EiendomCashflow,
} from '../../types'

export type EiendomData = {
  prosjekt: Prosjekt | null
  laan: EiendomLaan[]
  leietakere: EiendomLeietaker[]
  inntekter: EiendomInntekt[]
  kostnader: EiendomKostnad[]
  verdivurderinger: EiendomVerdivurdering[]
  cashflow: EiendomCashflow[]
}

const TOMT: EiendomData = {
  prosjekt: null, laan: [], leietakere: [], inntekter: [], kostnader: [],
  verdivurderinger: [], cashflow: [],
}

export function useEiendomData(prosjektId: string) {
  const [data, setData] = useState<EiendomData>(TOMT)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState<string | null>(null)

  const hent = useCallback(async () => {
    setLaster(true); setFeil(null)
    const [
      pRes,
      laanRes,
      leietakereRes,
      inntekterRes,
      kostnaderRes,
      vurderingerRes,
      cashflowRes,
    ] = await Promise.all([
      supabase.from('prosjekter').select('*').eq('id', prosjektId).maybeSingle(),
      supabase.from('eiendom_laan').select('*').eq('prosjekt_id', prosjektId).order('opprettet', { ascending: true }),
      supabase.from('eiendom_leietakere').select('*').eq('prosjekt_id', prosjektId).order('opprettet', { ascending: true }),
      supabase.from('eiendom_inntekter').select('*').eq('prosjekt_id', prosjektId).order('startdato', { ascending: false, nullsFirst: false }),
      supabase.from('eiendom_kostnader').select('*').eq('prosjekt_id', prosjektId).order('opprettet', { ascending: true }),
      supabase.from('eiendom_verdivurderinger').select('*').eq('prosjekt_id', prosjektId).order('dato', { ascending: false }),
      supabase.from('eiendom_cashflow').select('*').eq('prosjekt_id', prosjektId).order('maaned', { ascending: false }),
    ])
    if (pRes.error || !pRes.data) {
      setFeil(pRes.error?.message || 'Eiendom ikke funnet')
      setLaster(false)
      return
    }
    setData({
      prosjekt: pRes.data as Prosjekt,
      laan: (laanRes.data || []) as EiendomLaan[],
      leietakere: (leietakereRes.data || []) as EiendomLeietaker[],
      inntekter: (inntekterRes.data || []) as EiendomInntekt[],
      kostnader: (kostnaderRes.data || []) as EiendomKostnad[],
      verdivurderinger: (vurderingerRes.data || []) as EiendomVerdivurdering[],
      cashflow: (cashflowRes.data || []) as EiendomCashflow[],
    })
    setLaster(false)
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  return { data, laster, feil, refresh: hent }
}
