'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loggAktivitet } from '../lib/logg'
import type { AIForslagOppussing, AIForslagTillegg, LopendePerManed, OppussingBudsjett, OppussingPost, OppussingStandard, Prosjekt, Prosjektbilde } from '../types'
import { FARGER, RADIUS, SHADOW, MOTION, inputStyle, labelStyle, fieldStyle } from '../lib/styles'
import {
  LOPENDE_FELTER, POSTE_FORSLAG, STANDARD_LABEL,
  bruttoFortjeneste, erEstimatUtdatert, lopendePerManed, lopendeTotal,
  roiOppussing, totalPoster, totalkostnad,
} from '../lib/oppussing'
import { REGULERING_ETIKETT, REGULERING_FARGE, TILLEGG_ETIKETT, type ReguleringVurdering, type TilleggType } from '../lib/bilder'
import { visToast } from '../lib/toast'
import { SendForesporselModal } from './SendForesporselModal'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

type PostStatus = 'ikke_startet' | 'pagar' | 'ferdig'

const STATUS_VALG: Array<{ id: PostStatus; lbl: string; bg: string; tekst: string }> = [
  { id: 'ikke_startet', lbl: '○ Ikke startet', bg: '#f0ede5', tekst: '#5a6171' },
  { id: 'pagar',        lbl: '◐ Pågår',       bg: '#fff8e1', tekst: '#7a4a08' },
  { id: 'ferdig',       lbl: '● Ferdig',      bg: '#e8f5ed', tekst: '#1a4d2b' },
]

// Effektiv faktisk-kostnad: brukerens manuelle verdi om satt, ellers summen
// fra koblede kvitteringer. Brukes i overskridelse- og total-beregning.
function effektivFaktisk(p: OppussingPost, kvitteringSum: number): number {
  if (typeof p.faktisk_kostnad === 'number' && Number.isFinite(p.faktisk_kostnad)) {
    return p.faktisk_kostnad
  }
  return kvitteringSum
}

// 10% over budsjett = varsel. Kan justeres senere.
const OVERSKRIDELSE_TERSKEL = 1.10

function tomtBudsjett(boligId: string): OppussingBudsjett {
  return {
    id: nyId(),
    bolig_id: boligId,
    standard: 'bra',
    antall_maneder: 3,
    lopende_per_maned: {},
    estimert_salgspris: null,
    estimat_begrunnelse: null,
    estimat_usikkerhet: null,
    estimat_oppdatert: null,
    estimat_poster_sum: null,
    opprettet: new Date().toISOString(),
  }
}

export function Oppussingsbudsjett({ prosjekt, onProsjektOppdatert }: { prosjekt: Prosjekt; onProsjektOppdatert?: () => void }) {
  const boligId = prosjekt.id
  // Valuta-helpers — Norge bruker NOK (suffiks), Spania bruker EUR (prefiks)
  const erNorge = prosjekt.marked === 'norge'
  const valSym = erNorge ? 'kr' : '€'
  const valForan = !erNorge
  const fmtVal = (n: number) => valForan ? `${valSym}${Math.round(n).toLocaleString('nb-NO')}` : `${Math.round(n).toLocaleString('nb-NO')} ${valSym}`
  const [budsjett, setBudsjett] = useState<OppussingBudsjett | null>(null)
  const [poster, setPoster] = useState<OppussingPost[]>([])
  const [kvitteringSum, setKvitteringSum] = useState<Record<string, number>>({})
  const [laster, setLaster] = useState(true)
  const [estimerer, setEstimerer] = useState(false)
  const [feil, setFeil] = useState('')
  const [egenPost, setEgenPost] = useState('')
  const [forslagOppussing, setForslagOppussing] = useState<Array<{ bildeId: string; index: number; data: AIForslagOppussing }>>([])
  const [forslagTillegg, setForslagTillegg] = useState<Array<{ bildeId: string; index: number; data: AIForslagTillegg }>>([])
  const [sendModal, setSendModal] = useState<{ apen: boolean; post: OppussingPost | null }>({ apen: false, post: null })

  // Hold siste callback/verdi i refs så laste-effekten IKKE re-trigges når
  // forelderen re-rendrer (ny onProsjektOppdatert-referanse) eller oppdaterer
  // oppussing_faktisk. Ellers oppstår en reload-løkke som flasher «Laster…»
  // og hopper siden til toppen ved hver post-endring.
  const onProsjektOppdatertRef = useRef(onProsjektOppdatert)
  const oppussingFaktiskRef = useRef(prosjekt.oppussing_faktisk)
  useEffect(() => { onProsjektOppdatertRef.current = onProsjektOppdatert }, [onProsjektOppdatert])
  useEffect(() => { oppussingFaktiskRef.current = prosjekt.oppussing_faktisk }, [prosjekt.oppussing_faktisk])

  const hentKvitteringSum = useCallback(async () => {
    const { data } = await supabase
      .from('kvitteringer')
      .select('belop_inkl_mva, oppussing_post_id')
      .eq('prosjekt_id', boligId)
      .not('oppussing_post_id', 'is', null)
    const map: Record<string, number> = {}
    for (const k of (data || []) as Array<{ belop_inkl_mva: number | null; oppussing_post_id: string }>) {
      if (k.belop_inkl_mva && k.oppussing_post_id) {
        map[k.oppussing_post_id] = (map[k.oppussing_post_id] || 0) + k.belop_inkl_mva
      }
    }
    setKvitteringSum(map)
  }, [boligId])

  // Synker sum av poster til prosjekt.oppussing_faktisk så totalberegningene (ROI etc) stemmer.
  async function synkOppussingFaktisk(nyePosters: OppussingPost[]) {
    const sum = nyePosters.reduce((s, p) => s + (p.kostnad || 0), 0)
    if (sum === prosjekt.oppussing_faktisk) return
    await supabase.from('prosjekter').update({ oppussing_faktisk: sum }).eq('id', boligId)
    onProsjektOppdatert?.()
  }

  const hentAIForslag = useCallback(async () => {
    const { data: bilder } = await supabase.from('prosjekt_bilder')
      .select('id, ai_foreslatte_poster, ai_potensielle_tillegg')
      .eq('prosjekt_id', boligId)
      .eq('type', 'original')
      .not('ai_analysert', 'is', null)
    const oppussing: typeof forslagOppussing = []
    const tillegg: typeof forslagTillegg = []
    for (const b of (bilder || []) as Prosjektbilde[]) {
      const opp = (b.ai_foreslatte_poster || []) as AIForslagOppussing[]
      opp.forEach((d, i) => oppussing.push({ bildeId: b.id, index: i, data: d }))
      const till = (b.ai_potensielle_tillegg || []) as AIForslagTillegg[]
      till.forEach((d, i) => tillegg.push({ bildeId: b.id, index: i, data: d }))
    }
    setForslagOppussing(oppussing)
    setForslagTillegg(tillegg)
  }, [boligId])

  const last = useCallback(async () => {
    setLaster(true)
    const { data: bRad } = await supabase
      .from('oppussing_budsjett').select('*').eq('bolig_id', boligId).maybeSingle()
    let b = bRad as OppussingBudsjett | null
    if (!b) {
      b = tomtBudsjett(boligId)
      await supabase.from('oppussing_budsjett').insert([b])
    }
    setBudsjett(b)
    const { data: pRader } = await supabase
      .from('oppussing_poster').select('*').eq('budsjett_id', b.id).order('rekkefolge')
    const lastedePosters = (pRader || []) as OppussingPost[]
    setPoster(lastedePosters)
    await Promise.all([hentAIForslag(), hentKvitteringSum()])

    // Retroaktiv synk: hvis sum ikke matcher lagret oppussing_faktisk, fiks det.
    const sum = lastedePosters.reduce((s, p) => s + (p.kostnad || 0), 0)
    if (sum > 0 && sum !== oppussingFaktiskRef.current) {
      await supabase.from('prosjekter').update({ oppussing_faktisk: sum }).eq('id', boligId)
      onProsjektOppdatertRef.current?.()
    }

    setLaster(false)
  }, [boligId, hentAIForslag, hentKvitteringSum])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void last()
  }, [last])

  async function oppdaterBudsjett(endring: Partial<OppussingBudsjett>) {
    if (!budsjett) return
    const neste = { ...budsjett, ...endring }
    setBudsjett(neste)
    await supabase.from('oppussing_budsjett').update(endring).eq('id', budsjett.id)
  }

  async function settLopende(felt: keyof LopendePerManed, verdi: number) {
    if (!budsjett) return
    const neste = { ...budsjett.lopende_per_maned, [felt]: verdi }
    await oppdaterBudsjett({ lopende_per_maned: neste })
  }

  async function fjernForslag(bildeId: string, kolonne: 'ai_foreslatte_poster' | 'ai_potensielle_tillegg', index: number) {
    const { data: rad } = await supabase.from('prosjekt_bilder').select(kolonne).eq('id', bildeId).single()
    if (!rad) return
    const arr = ((rad as Record<string, unknown>)[kolonne] as unknown[]) || []
    const ny = arr.filter((_, i) => i !== index)
    await supabase.from('prosjekt_bilder').update({ [kolonne]: ny }).eq('id', bildeId)
  }

  async function godtaOppussingForslag(f: { bildeId: string; index: number; data: AIForslagOppussing }, navn: string, kostnad: number) {
    if (!budsjett) return
    const ny: OppussingPost = {
      id: nyId(),
      budsjett_id: budsjett.id,
      navn: navn.trim() || f.data.navn,
      kostnad,
      notat: f.data.begrunnelse || null,
      rekkefolge: poster.length,
      kilde_bilde_id: f.bildeId,
    }
    const nye = [...poster, ny]
    setPoster(nye)
    await supabase.from('oppussing_poster').insert([ny])
    await fjernForslag(f.bildeId, 'ai_foreslatte_poster', f.index)
    await loggAktivitet({ handling: 'godtok AI-forslag (oppussing)', tabell: 'oppussing_poster', rad_id: ny.id, detaljer: { bolig: prosjekt.navn, navn: ny.navn, kilde_bilde_id: f.bildeId } })
    await hentAIForslag()
    await synkOppussingFaktisk(nye)
    visToast(`Lagt til: ${ny.navn}`)
  }

  async function godtaTilleggForslag(f: { bildeId: string; index: number; data: AIForslagTillegg }, navn: string, kostnad: number) {
    const tilleggId = nyId()
    const rad = {
      id: tilleggId,
      bolig_id: boligId,
      navn: navn.trim() || TILLEGG_ETIKETT[f.data.tillegg as TilleggType] || f.data.tillegg,
      tillegg_type: f.data.tillegg,
      kostnad,
      verdiokning_estimat: f.data.verdiokning_estimat || null,
      regulering_vurdering: f.data.regulering_vurdering,
      regulering_begrunnelse: f.data.regulering_begrunnelse || null,
      ma_sjekkes_videre: f.data.ma_sjekkes_videre || null,
      notat: f.data.begrunnelse || null,
      rekkefolge: 0,
      kilde_bilde_id: f.bildeId,
    }
    await supabase.from('oppussing_tillegg').insert([rad])
    await fjernForslag(f.bildeId, 'ai_potensielle_tillegg', f.index)
    await loggAktivitet({ handling: 'godtok AI-forslag (tillegg)', tabell: 'oppussing_tillegg', rad_id: tilleggId, detaljer: { bolig: prosjekt.navn, tillegg_type: f.data.tillegg, navn: rad.navn } })
    await hentAIForslag()
    visToast(`Lagt til tillegg: ${rad.navn}`)
  }

  async function avvisForslag(bildeId: string, index: number, type: 'oppussing' | 'tillegg', beskrivelse: string) {
    const kolonne = type === 'oppussing' ? 'ai_foreslatte_poster' : 'ai_potensielle_tillegg'
    await fjernForslag(bildeId, kolonne, index)
    await loggAktivitet({ handling: 'avviste AI-forslag', tabell: 'prosjekt_bilder', rad_id: bildeId, detaljer: { type, beskrivelse, bolig: prosjekt.navn } })
    await hentAIForslag()
    visToast('Forslag avvist', 'info', 1800)
  }

  async function leggTilPost(navn: string) {
    if (!budsjett || !navn.trim()) return
    const ny: OppussingPost = {
      id: nyId(),
      budsjett_id: budsjett.id,
      navn: navn.trim(),
      kostnad: 0,
      notat: null,
      rekkefolge: poster.length,
    }
    const nye = [...poster, ny]
    setPoster(nye)
    await supabase.from('oppussing_poster').insert([ny])
    await loggAktivitet({ handling: 'la til oppussingspost', tabell: 'oppussing_poster', rad_id: ny.id, detaljer: { bolig: prosjekt.navn, navn: ny.navn } })
    await synkOppussingFaktisk(nye)
  }

  async function oppdaterPost(id: string, endring: Partial<OppussingPost>) {
    const nye = poster.map(p => p.id === id ? { ...p, ...endring } : p)
    setPoster(nye)
    await supabase.from('oppussing_poster').update(endring).eq('id', id)
    if ('kostnad' in endring) await synkOppussingFaktisk(nye)
  }

  async function slettPost(id: string) {
    const p = poster.find(x => x.id === id)
    const nye = poster.filter(p => p.id !== id)
    setPoster(nye)
    await supabase.from('oppussing_poster').delete().eq('id', id)
    await loggAktivitet({ handling: 'slettet oppussingspost', tabell: 'oppussing_poster', rad_id: id, detaljer: { bolig: prosjekt.navn, navn: p?.navn } })
    await synkOppussingFaktisk(nye)
  }

  async function estimerSalgspris() {
    if (!budsjett) return
    setEstimerer(true); setFeil('')
    try {
      const res = await fetch('/api/agent/salgsestimat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boligId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeil(data.error || 'Estimatet feilet')
      } else {
        setBudsjett({
          ...budsjett,
          estimert_salgspris: data.estimert_salgspris,
          estimat_begrunnelse: data.begrunnelse,
          estimat_usikkerhet: data.usikkerhet,
          estimat_oppdatert: new Date().toISOString(),
          estimat_poster_sum: totalPoster(poster),
        })
        await loggAktivitet({ handling: 'kjørte salgsestimat', tabell: 'oppussing_budsjett', rad_id: budsjett.id, detaljer: { bolig: prosjekt.navn, estimert_salgspris: data.estimert_salgspris } })
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Ukjent feil')
    }
    setEstimerer(false)
  }

  // Status- og fremdrifts-aggregat — må være før early return for hooks-regelen
  const fremdrift = useMemo(() => {
    const ferdig = poster.filter(p => p.status === 'ferdig').length
    const pagar  = poster.filter(p => p.status === 'pagar').length
    const sumFaktisk = poster.reduce((s, p) => s + effektivFaktisk(p, kvitteringSum[p.id] || 0), 0)
    const overskridelser = poster.filter(p => {
      const fk = effektivFaktisk(p, kvitteringSum[p.id] || 0)
      return p.kostnad > 0 && fk > p.kostnad * OVERSKRIDELSE_TERSKEL
    }).length
    return { ferdig, pagar, totalt: poster.length, sumFaktisk, overskridelser }
  }, [poster, kvitteringSum])

  if (laster || !budsjett) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>⏳ Laster...</div>
  }

  const tk = totalkostnad(prosjekt, budsjett, poster)
  const bf = bruttoFortjeneste(prosjekt, budsjett, poster)
  const roi = roiOppussing(prosjekt, budsjett, poster)
  const utdatert = erEstimatUtdatert(budsjett, poster)
  const lopendeMnd = lopendePerManed(budsjett.lopende_per_maned)
  const lopendeSum = lopendeTotal(budsjett)
  const posterSum = totalPoster(poster)
  const brukteForslagssett = new Set(poster.map(p => p.navn))

  return (
    <div>
      {(forslagOppussing.length > 0 || forslagTillegg.length > 0) && (
        <div style={{ background: 'linear-gradient(135deg, #fdfcf7 0%, #f0ede5 100%)', border: '1.5px solid #0e172644', borderRadius: 6, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#0f3b6b' }}>
            ✨ AI-forslag fra bildeanalyse
          </div>

          {forslagOppussing.length > 0 && (
            <div style={{ marginBottom: forslagTillegg.length > 0 ? 18 : 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0e1726', marginBottom: 8, letterSpacing: '0.05em' }}>
                OPPUSSING ({forslagOppussing.length})
              </div>
              {forslagOppussing.map(f => (
                <ForslagOppussingKort key={f.bildeId + '-' + f.index} forslag={f}
                  valutaSymbol={prosjekt.marked === 'norge' ? 'kr' : '€'}
                  valutaForan={prosjekt.marked !== 'norge'}
                  onGodta={(navn, kost) => godtaOppussingForslag(f, navn, kost)}
                  onAvvis={() => avvisForslag(f.bildeId, f.index, 'oppussing', f.data.navn)} />
              ))}
            </div>
          )}

          {forslagTillegg.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0e1726', marginBottom: 8, letterSpacing: '0.05em' }}>
                POTENSIAL-TILLEGG ({forslagTillegg.length})
              </div>
              {forslagTillegg.map(f => (
                <ForslagTilleggKort key={f.bildeId + '-' + f.index} forslag={f}
                  valutaSymbol={prosjekt.marked === 'norge' ? 'kr' : '€'}
                  valutaForan={prosjekt.marked !== 'norge'}
                  onGodta={(navn, kost) => godtaTilleggForslag(f, navn, kost)}
                  onAvvis={() => avvisForslag(f.bildeId, f.index, 'tillegg', f.data.tillegg)} />
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🧱 Oppussingsposter</div>
          {poster.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: '#e8f5ed', color: '#1a4d2b', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS.pill }}>
                {fremdrift.ferdig}/{fremdrift.totalt} ferdig
              </span>
              {fremdrift.pagar > 0 && (
                <span style={{ background: '#fff8e1', color: '#7a4a08', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS.pill }}>
                  {fremdrift.pagar} pågår
                </span>
              )}
              {fremdrift.overskridelser > 0 && (
                <span style={{ background: '#fde8ec', color: '#7a0c1e', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS.pill }}>
                  ⚠️ {fremdrift.overskridelser} over budsjett
                </span>
              )}
            </div>
          )}
        </div>

        {poster.length === 0 && (
          <div style={{ fontSize: 13, color: '#888', marginBottom: 12, fontStyle: 'italic' }}>Ingen poster ennå – legg til under.</div>
        )}

        {poster.map(p => {
          const status = (p.status || 'ikke_startet') as PostStatus
          const statusVal = STATUS_VALG.find(s => s.id === status) || STATUS_VALG[0]
          const kvSum = kvitteringSum[p.id] || 0
          const harManuell = typeof p.faktisk_kostnad === 'number' && Number.isFinite(p.faktisk_kostnad)
          const fk = effektivFaktisk(p, kvSum)
          const overskredet = p.kostnad > 0 && fk > p.kostnad * OVERSKRIDELSE_TERSKEL
          const diff = fk - p.kostnad
          return (
            <div key={p.id} style={{
              border: `1px solid ${overskredet ? '#C8102E66' : FARGER.kantLys}`,
              borderRadius: RADIUS.md, padding: 12, marginBottom: 8,
              background: overskredet ? '#fff8f8' : '#fff',
            }}>
              {/* Linje 1: navn / budsjett / notat / slett */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input style={inputStyle} value={p.navn} onChange={e => setPoster(poster.map(pp => pp.id === p.id ? { ...pp, navn: e.target.value } : pp))} onBlur={e => oppdaterPost(p.id, { navn: e.target.value })} placeholder="Navn" />
                <input style={inputStyle} type="number" value={p.kostnad || ''} onChange={e => setPoster(poster.map(pp => pp.id === p.id ? { ...pp, kostnad: Number(e.target.value) } : pp))} onBlur={e => oppdaterPost(p.id, { kostnad: Number(e.target.value) || 0 })} placeholder={`Budsjett ${valSym}`} />
                <input style={inputStyle} value={p.notat || ''} onChange={e => setPoster(poster.map(pp => pp.id === p.id ? { ...pp, notat: e.target.value } : pp))} onBlur={e => oppdaterPost(p.id, { notat: e.target.value || null })} placeholder="Notat (valgfritt)" />
                <button onClick={() => slettPost(p.id)} style={{ background: FARGER.feilBg, color: FARGER.feil, border: 'none', borderRadius: RADIUS.pill, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✕</button>
              </div>

              {/* Linje 2: status / faktisk / frist / ansvarlig */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1.5fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
                <select
                  value={status}
                  onChange={e => oppdaterPost(p.id, {
                    status: e.target.value as PostStatus,
                    // Sett ferdig_dato når posten markeres ferdig (om ikke allerede satt)
                    ...(e.target.value === 'ferdig' && !p.ferdig_dato ? { ferdig_dato: new Date().toISOString().slice(0, 10) } : {}),
                  })}
                  style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, borderRadius: RADIUS.sm, border: 'none', background: statusVal.bg, color: statusVal.tekst, cursor: 'pointer' }}>
                  {STATUS_VALG.map(s => <option key={s.id} value={s.id}>{s.lbl}</option>)}
                </select>

                {/* Faktisk kostnad — manuell verdi eller auto fra kvitteringer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    style={{ ...inputStyle, color: overskredet ? '#7a0c1e' : '#0e1726', fontWeight: harManuell ? 600 : 400 }}
                    type="number"
                    placeholder={kvSum > 0 ? `Auto: ${fmtVal(kvSum)}` : `Faktisk ${valSym}`}
                    defaultValue={p.faktisk_kostnad ?? ''}
                    key={`fk-${p.id}-${p.faktisk_kostnad ?? 'null'}`}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      oppdaterPost(p.id, { faktisk_kostnad: v === '' ? null : Number(v) })
                    }}
                  />
                  {kvSum > 0 && !harManuell && (
                    <span title={`Sum av ${Object.keys(kvitteringSum).length > 0 ? 'koblede ' : ''}kvitteringer`} style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>📎 auto</span>
                  )}
                  {kvSum > 0 && harManuell && Math.abs(kvSum - (p.faktisk_kostnad || 0)) > 1 && (
                    <button
                      onClick={() => oppdaterPost(p.id, { faktisk_kostnad: null })}
                      title={`Bytt til kvittering-sum: ${fmtVal(kvSum)}`}
                      style={{ background: 'none', border: 'none', fontSize: 11, color: FARGER.gull, cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}>
                      ↺ kvitt.
                    </button>
                  )}
                </div>

                <input
                  style={inputStyle} type="date"
                  defaultValue={p.frist || ''}
                  key={`frist-${p.id}-${p.frist ?? 'null'}`}
                  onBlur={e => oppdaterPost(p.id, { frist: e.target.value || null })}
                />

                <input
                  style={inputStyle} placeholder="Ansvarlig"
                  defaultValue={p.ansvarlig || ''}
                  key={`ans-${p.id}-${p.ansvarlig ?? 'null'}`}
                  onBlur={e => oppdaterPost(p.id, { ansvarlig: e.target.value || null })}
                />
              </div>

              {/* Diff-stripe (vises bare hvis det er en faktisk-verdi) */}
              {fk > 0 && p.kostnad > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: overskredet ? '#7a0c1e' : diff > 0 ? '#7a4a08' : '#1a4d2b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    Faktisk: <strong>{fmtVal(fk)}</strong> {' '}
                    vs budsjett {fmtVal(p.kostnad)}
                  </span>
                  <span style={{ fontWeight: 600 }}>
                    {diff > 0 ? '+' : ''}{fmtVal(diff)} ({p.kostnad > 0 ? ((diff / p.kostnad) * 100).toFixed(0) : 0}%)
                    {overskredet && ' ⚠️'}
                  </span>
                </div>
              )}

              {/* Send tilbudsforespørsel til håndverker for denne posten */}
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSendModal({ apen: true, post: p })}
                  title="Be om tilbud på akkurat denne posten fra én eller flere håndverkere"
                  style={{ background: 'transparent', border: `1px solid ${FARGER.gull}`, color: FARGER.gull, padding: '4px 10px', borderRadius: RADIUS.sm, fontSize: 10, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em' }}>
                  📤 Be om tilbud
                </button>
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', marginTop: 6, fontSize: 14, fontWeight: 700 }}>
          <span title="Oppdaterer automatisk 'Oppussing faktisk' på prosjektet">Sum budsjett</span><span>{fmtVal(posterSum)}</span>
        </div>
        {fremdrift.sumFaktisk > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
            <span style={{ color: '#666' }}>Sum faktisk så langt</span>
            <span style={{ fontWeight: 600, color: fremdrift.sumFaktisk > posterSum ? '#7a0c1e' : '#1a4d2b' }}>
              {fmtVal(fremdrift.sumFaktisk)}
              {posterSum > 0 && <span style={{ fontSize: 11, color: '#888', marginLeft: 6 }}>({Math.round((fremdrift.sumFaktisk / posterSum) * 100)}% av budsjett)</span>}
            </span>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#888', textAlign: 'right', marginTop: 4, marginBottom: 4 }}>
          Sum budsjett synkes automatisk til &quot;Oppussing faktisk&quot; i oversikten
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: '#666', marginBottom: 6 }}>Legg til forhåndsdefinert post:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {POSTE_FORSLAG.filter(n => !brukteForslagssett.has(n)).map(n => (
            <button key={n} onClick={() => leggTilPost(n)} style={{
              background: FARGER.hvit, color: FARGER.mork,
              border: `1px solid ${FARGER.kantUltralys}`,
              borderRadius: RADIUS.pill, padding: '6px 14px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}>+ {n}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} value={egenPost} onChange={e => setEgenPost(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && egenPost.trim()) { leggTilPost(egenPost); setEgenPost('') } }} placeholder="Egen post (f.eks. Terrassegulv)" />
          <button onClick={() => { if (egenPost.trim()) { leggTilPost(egenPost); setEgenPost('') } }} className="knapp-hover-loft" style={{
            background: FARGER.mork, color: FARGER.creamLys, border: 'none',
            borderRadius: RADIUS.pill, padding: '10px 18px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '-0.005em',
            boxShadow: SHADOW.sm,
          }}>+ Legg til</button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>⭐ Standard på oppussingen</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['standard', 'bra', 'luksus'] as OppussingStandard[]).map(s => (
            <button key={s} onClick={() => oppdaterBudsjett({ standard: s })}
              style={{
                background: budsjett.standard === s ? FARGER.mork : FARGER.flateLys,
                color: budsjett.standard === s ? FARGER.creamLys : FARGER.tekstMid,
                border: 'none', borderRadius: RADIUS.pill,
                padding: '10px 22px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: budsjett.standard === s ? SHADOW.sm : 'none',
                transition: `background ${MOTION.rask}, box-shadow ${MOTION.rask}`,
              }}>
              {STANDARD_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📅 Prosjektvarighet</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input style={{ ...inputStyle, width: 120 }} type="number" value={budsjett.antall_maneder || ''} onChange={e => setBudsjett({ ...budsjett, antall_maneder: Number(e.target.value) || 0 })} onBlur={e => oppdaterBudsjett({ antall_maneder: Number(e.target.value) || 0 })} />
          <span style={{ fontSize: 14, color: '#666' }}>måneder</span>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>💸 Løpende kostnader i perioden</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 10 }}>
          {LOPENDE_FELTER.map(f => (
            <div key={f.key} style={fieldStyle}>
              <label style={labelStyle}>{f.lbl} ({valSym}/mnd)</label>
              <input style={inputStyle} type="number" value={budsjett.lopende_per_maned[f.key] || ''} onBlur={e => settLopende(f.key, Number(e.target.value) || 0)} onChange={e => setBudsjett({ ...budsjett, lopende_per_maned: { ...budsjett.lopende_per_maned, [f.key]: Number(e.target.value) || 0 } })} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eee', fontSize: 13 }}>
          <span style={{ color: '#666' }}>Per måned</span><span style={{ fontWeight: 600 }}>{fmtVal(lopendeMnd)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eee', fontSize: 14, fontWeight: 700 }}>
          <span>Totalt over {budsjett.antall_maneder} mnd</span><span>{fmtVal(lopendeSum)}</span>
        </div>
      </div>

      <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gull}33`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, boxShadow: SHADOW.sm }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: FARGER.mork, letterSpacing: '-0.015em' }}>🤖 Estimert salgspris fra AI</div>

        {budsjett.estimert_salgspris ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0e1726' }}>{fmtVal(budsjett.estimert_salgspris)}</div>
              {budsjett.estimat_usikkerhet && (
                <span style={{ background: '#fff', border: '1px solid #0e172644', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#0e1726', fontWeight: 600 }}>
                  Usikkerhet: {budsjett.estimat_usikkerhet}
                </span>
              )}
              {budsjett.estimat_oppdatert && (
                <span style={{ fontSize: 12, color: '#888' }}>Oppdatert: {new Date(budsjett.estimat_oppdatert).toLocaleDateString('nb-NO')}</span>
              )}
            </div>
            {budsjett.estimat_begrunnelse && (
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#333', margin: '0 0 12px' }}>{budsjett.estimat_begrunnelse}</p>
            )}
            {utdatert && (
              <div style={{ background: '#fff8e1', border: '1.5px solid #B05E0A44', borderRadius: 8, padding: 10, fontSize: 13, color: '#7a400a', marginBottom: 10 }}>
                ⚠️ Oppussingsposter har endret seg siden siste estimat. Kjør på nytt for oppdatert tall.
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px' }}>Fyll inn poster og standard først, så estimerer AI-agenten salgspris basert på boligen og området.</p>
        )}

        <button onClick={estimerSalgspris} disabled={estimerer || poster.length === 0} className="knapp-hover-loft" style={{
          background: estimerer || poster.length === 0 ? FARGER.tekstLys : FARGER.mork,
          color: FARGER.creamLys, border: 'none',
          borderRadius: RADIUS.pill, padding: '12px 22px',
          fontSize: 14, fontWeight: 600,
          cursor: estimerer || poster.length === 0 ? 'not-allowed' : 'pointer',
          letterSpacing: '-0.005em',
          boxShadow: estimerer || poster.length === 0 ? 'none' : SHADOW.sm,
          transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
        }}>
          {estimerer ? '⏳ Estimerer…' : budsjett.estimert_salgspris ? '🔄 Kjør estimat på nytt' : '🤖 Estimer salgspris med AI'}
        </button>

        {feil && (
          <div className="anim-fade-up" style={{ marginTop: 12, background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, borderRadius: RADIUS.md, padding: 12, fontSize: 13, color: '#7a0c1e' }}>
            ❌ {feil}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: 6, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📊 Beregning</div>
        {[
          { lbl: 'Kjøpesum', val: fmtVal(prosjekt.kjøpesum) },
          { lbl: 'Kjøpskostnader', val: fmtVal(prosjekt.kjøpskostnader) },
          { lbl: 'Sum oppussingsposter (budsjett)', val: fmtVal(posterSum) },
          ...(fremdrift.sumFaktisk > 0 ? [{ lbl: '↳ Faktisk så langt', val: fmtVal(fremdrift.sumFaktisk) }] : []),
          { lbl: `Løpende kostnader (${budsjett.antall_maneder} mnd)`, val: fmtVal(lopendeSum) },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none', fontSize: 13 }}>
            <span style={{ color: '#666' }}>{r.lbl}</span><span style={{ fontWeight: 600 }}>{r.val}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #eee', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
          <span>Totalkostnad</span><span>{fmtVal(tk)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', fontSize: 14 }}>
          <span style={{ color: '#666' }}>Estimert salgspris (AI)</span><span style={{ fontWeight: 600 }}>{budsjett.estimert_salgspris ? fmtVal(budsjett.estimert_salgspris) : '–'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', fontSize: 15, fontWeight: 700 }}>
          <span>Brutto fortjeneste</span>
          <span style={{ color: bf >= 0 ? '#2D7D46' : '#C8102E' }}>{budsjett.estimert_salgspris ? fmtVal(bf) : '–'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #eee', fontSize: 15, fontWeight: 700 }}>
          <span>ROI</span>
          <span style={{ color: roi >= 0 ? '#2D7D46' : '#C8102E' }}>{budsjett.estimert_salgspris ? roi.toFixed(1) + '%' : '–'}</span>
        </div>
      </div>

      <SendForesporselModal
        prosjektId={boligId}
        oppussingPostId={sendModal.post?.id || null}
        forhandsvalgteBildeIds={sendModal.post?.kilde_bilde_id ? [sendModal.post.kilde_bilde_id] : []}
        initialTittel={sendModal.post ? `Tilbud på ${sendModal.post.navn}` : ''}
        initialBeskrivelse={sendModal.post ? `${sendModal.post.navn}\n\n${sendModal.post.notat || ''}\n\nEstimert budsjett: ${fmtVal(sendModal.post.kostnad || 0)}`.trim() : ''}
        apen={sendModal.apen}
        onLukk={() => setSendModal({ apen: false, post: null })}
      />
    </div>
  )
}

function fmtBelop(n: number, sym: string, foran: boolean): string {
  const tall = n.toLocaleString('nb-NO')
  return foran ? `${sym}${tall}` : `${tall} ${sym}`
}

function ForslagOppussingKort({ forslag, valutaSymbol, valutaForan, onGodta, onAvvis }: {
  forslag: { bildeId: string; index: number; data: AIForslagOppussing }
  valutaSymbol: string
  valutaForan: boolean
  onGodta: (navn: string, kostnad: number) => Promise<void>
  onAvvis: () => Promise<void>
}) {
  const d = forslag.data
  const middel = Math.round((d.kostnad_estimat_lav + d.kostnad_estimat_hoy) / 2)
  const [navn, setNavn] = useState(d.navn)
  const [kostnad, setKostnad] = useState<number>(middel)
  const [jobber, setJobber] = useState(false)

  return (
    <div style={{ background: 'white', border: '1px solid #c5d9f4', borderRadius: 6, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
        AI foreslår <strong>{fmtBelop(d.kostnad_estimat_lav, valutaSymbol, valutaForan)} – {fmtBelop(d.kostnad_estimat_hoy, valutaSymbol, valutaForan)}</strong>
      </div>
      {d.begrunnelse && (
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 10 }}>{d.begrunnelse}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
        <input value={navn} onChange={e => setNavn(e.target.value)}
          style={{ padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #ddd' }} />
        <input type="number" value={kostnad || ''} onChange={e => setKostnad(Number(e.target.value) || 0)}
          style={{ padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #ddd' }} />
        <button onClick={async () => { setJobber(true); await onGodta(navn, kostnad); setJobber(false) }} disabled={jobber || !navn.trim()}
          style={{ background: '#2D7D46', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: jobber ? 'not-allowed' : 'pointer' }}>
          {jobber ? '...' : 'Godta'}
        </button>
        <button onClick={async () => { setJobber(true); await onAvvis() }} disabled={jobber}
          style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: jobber ? 'not-allowed' : 'pointer' }}>
          Avvis
        </button>
      </div>
    </div>
  )
}

function ForslagTilleggKort({ forslag, valutaSymbol, valutaForan, onGodta, onAvvis }: {
  forslag: { bildeId: string; index: number; data: AIForslagTillegg }
  valutaSymbol: string
  valutaForan: boolean
  onGodta: (navn: string, kostnad: number) => Promise<void>
  onAvvis: () => Promise<void>
}) {
  const d = forslag.data
  const middel = Math.round(((d.kostnad_estimat_lav || 0) + (d.kostnad_estimat_hoy || 0)) / 2)
  const standardNavn = TILLEGG_ETIKETT[d.tillegg as TilleggType] || d.tillegg
  const [navn, setNavn] = useState(standardNavn)
  const [kostnad, setKostnad] = useState<number>(middel)
  const [jobber, setJobber] = useState(false)

  const reg = d.regulering_vurdering as ReguleringVurdering
  const regF = REGULERING_FARGE[reg] || { bg: '#f0f0f0', border: '#aaa', tekst: '#555' }

  return (
    <div style={{ background: 'white', border: '1px solid #c5d9f4', borderRadius: 6, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0e1726' }}>{standardNavn}</span>
        <span style={{ background: regF.bg, color: regF.tekst, border: `1px solid ${regF.border}44`, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
          {REGULERING_ETIKETT[reg] || reg}
        </span>
        {d.verdiokning_estimat && (
          <span style={{ background: '#e8f5ed', color: '#1a4d2b', fontSize: 11, padding: '2px 8px', borderRadius: 6 }}>
            Verdiøkning: {d.verdiokning_estimat}
          </span>
        )}
      </div>
      {d.beskrivelse && <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 8 }}>{d.beskrivelse}</div>}
      {(d.kostnad_estimat_lav || d.kostnad_estimat_hoy) && (
        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
          Kostnad: <strong>{fmtBelop(d.kostnad_estimat_lav || 0, valutaSymbol, valutaForan)} – {fmtBelop(d.kostnad_estimat_hoy || 0, valutaSymbol, valutaForan)}</strong>
        </div>
      )}
      {d.regulering_begrunnelse && (
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 6 }}>
          <strong>Regulering:</strong> {d.regulering_begrunnelse}
        </div>
      )}
      {d.ma_sjekkes_videre && d.ma_sjekkes_videre.length > 0 && (
        <div style={{ fontSize: 11, color: '#6b3a0a', background: '#fff8e1', borderRadius: 6, padding: 8, marginBottom: 10 }}>
          <strong>Må sjekkes videre:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {d.ma_sjekkes_videre.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
        <input value={navn} onChange={e => setNavn(e.target.value)}
          style={{ padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #ddd' }} />
        <input type="number" value={kostnad || ''} onChange={e => setKostnad(Number(e.target.value) || 0)}
          style={{ padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #ddd' }} />
        <button onClick={async () => { setJobber(true); await onGodta(navn, kostnad); setJobber(false) }} disabled={jobber || !navn.trim()}
          style={{ background: '#2D7D46', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: jobber ? 'not-allowed' : 'pointer' }}>
          {jobber ? '...' : 'Godta'}
        </button>
        <button onClick={async () => { setJobber(true); await onAvvis() }} disabled={jobber}
          style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: jobber ? 'not-allowed' : 'pointer' }}>
          Avvis
        </button>
      </div>
    </div>
  )
}
