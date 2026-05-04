'use client'
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import {
  KOSTNAD_KATEGORIER, KOSTNAD_ETIKETT, kostnadPerMnd, sumKostnaderPerMnd,
} from '../../../lib/portefolje'
import type { EiendomKostnad } from '../../../types'
import type { EiendomData } from '../useEiendomData'
import {
  Felt, SumKort, TomTilstand, fmtNok, fmtDato, numOrNull, inputStil,
  knappStilPrimaer, knappStilSekundaer, knappStilSlett, knappStilNyttElement,
} from './faneUi'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const FREKVENS_ETIKETT: Record<string, string> = {
  mnd: 'Per måned',
  aar: 'Per år',
  engangs: 'Engangs',
}

type Props = { data: EiendomData; onEndret: () => void | Promise<void> }

export function EiendomKostnader({ data, onEndret }: Props) {
  const [aapen, setAapen] = useState<string | null>(null)
  const [redigert, setRedigert] = useState<Partial<EiendomKostnad>>({})

  const sumMnd = useMemo(() => sumKostnaderPerMnd(data.kostnader), [data.kostnader])
  const sumAr = sumMnd * 12

  // Sum engangs i inneværende år
  const aaretIDag = new Date().getFullYear()
  const sumEngangsIaar = useMemo(() => {
    return data.kostnader
      .filter(k => k.frekvens === 'engangs' && k.startdato && new Date(k.startdato).getFullYear() === aaretIDag)
      .reduce((s, k) => s + (k.belop || 0), 0)
  }, [data.kostnader, aaretIDag])

  // Sum per kategori (månedlig normalisert)
  const sumPerKategori = useMemo(() => {
    const map: Record<string, number> = {}
    for (const k of data.kostnader) {
      if (!k.kategori) continue
      map[k.kategori] = (map[k.kategori] || 0) + kostnadPerMnd(k)
    }
    return map
  }, [data.kostnader])

  function startNytt() { setRedigert({ frekvens: 'mnd', kategori: 'kommunale' }); setAapen('nytt') }
  function startRediger(k: EiendomKostnad) { setRedigert({ ...k }); setAapen(k.id) }
  function lukk() { setAapen(null); setRedigert({}) }

  async function lagre() {
    const r = redigert
    const belop = numOrNull(r.belop)
    if (belop === null) { visToast('Beløp må fylles inn', 'feil', 3000); return }
    if (aapen === 'nytt') {
      const id = nyId()
      const bruker = hentAktivBruker() || 'ukjent'
      const { error } = await supabase.from('eiendom_kostnader').insert([{
        id, prosjekt_id: data.prosjekt!.id, bruker,
        kategori: r.kategori || 'annet',
        beskrivelse: r.beskrivelse || null,
        belop,
        frekvens: r.frekvens || 'mnd',
        startdato: r.startdato || null,
        sluttdato: r.sluttdato || null,
        notat: r.notat || null,
      }])
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Kostnad lagt til', 'suksess', 2500)
    } else if (aapen) {
      const { error } = await supabase.from('eiendom_kostnader').update({
        kategori: r.kategori, beskrivelse: r.beskrivelse || null,
        belop, frekvens: r.frekvens,
        startdato: r.startdato || null, sluttdato: r.sluttdato || null,
        notat: r.notat || null,
      }).eq('id', aapen)
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Oppdatert', 'suksess', 2000)
    }
    lukk(); await onEndret()
  }

  async function slett(id: string, kat: string | null) {
    if (!confirm(`Slette ${kat ? KOSTNAD_ETIKETT[kat] || 'kostnad' : 'kostnaden'}?`)) return
    const { error } = await supabase.from('eiendom_kostnader').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await onEndret()
  }

  // Sortér kostnader: aktive først (ingen sluttdato eller fremtidig), så avsluttet
  const naa = new Date()
  const sortert = [...data.kostnader].sort((a, b) => {
    const aAktiv = !a.sluttdato || new Date(a.sluttdato) >= naa
    const bAktiv = !b.sluttdato || new Date(b.sluttdato) >= naa
    if (aAktiv !== bAktiv) return aAktiv ? -1 : 1
    return (a.kategori || 'zzz').localeCompare(b.kategori || 'zzz')
  })

  return (
    <div>
      {data.kostnader.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
            <SumKort lbl="Drift / mnd" verdi={fmtNok(sumMnd)} farge={FARGER.feil} />
            <SumKort lbl="Drift / år" verdi={fmtNok(sumAr)} />
            {sumEngangsIaar > 0 && (
              <SumKort lbl={`Engangs ${aaretIDag}`} verdi={fmtNok(sumEngangsIaar)} />
            )}
          </div>

          {/* Per-kategori-sammendrag */}
          {Object.keys(sumPerKategori).length > 0 && (
            <div style={{ background: '#fff', border: `1.5px solid ${FARGER.kantLys}`, borderRadius: RADIUS.md, padding: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                Sum per kategori (månedlig normalisert)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {KOSTNAD_KATEGORIER
                  .filter(k => sumPerKategori[k] > 0)
                  .sort((a, b) => sumPerKategori[b] - sumPerKategori[a])
                  .map(k => (
                    <div key={k} style={{ background: FARGER.creamLys, padding: 8, borderRadius: RADIUS.sm }}>
                      <div style={{ fontSize: 10, color: FARGER.tekstLys }}>{KOSTNAD_ETIKETT[k]}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork }}>{fmtNok(sumPerKategori[k])}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {data.kostnader.length === 0 && aapen !== 'nytt' && (
        <TomTilstand tekst="Ingen kostnader registrert ennå. Legg til kommunale avgifter, forsikring, fellesutgifter osv." />
      )}

      {sortert.map(k => {
        const erAapen = aapen === k.id
        const aktiv = !k.sluttdato || new Date(k.sluttdato) >= naa
        const mndNorm = kostnadPerMnd(k)
        return (
          <div key={k.id} style={{
            background: '#fff', border: `1.5px solid ${erAapen ? FARGER.gull : FARGER.kantLys}`,
            borderRadius: RADIUS.md, padding: 16, marginBottom: 10, opacity: aktiv ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: erAapen ? 14 : 0 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork }}>
                  {k.kategori ? KOSTNAD_ETIKETT[k.kategori] || k.kategori : 'Ukategorisert'}
                  {!aktiv && <span style={{ marginLeft: 8, fontSize: 10, color: FARGER.tekstLys, fontWeight: 500 }}>· avsluttet</span>}
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span>{FREKVENS_ETIKETT[k.frekvens]}</span>
                  {k.startdato && <span>· Fra {fmtDato(k.startdato)}</span>}
                  {k.sluttdato && <span>· Til {fmtDato(k.sluttdato)}</span>}
                </div>
                {k.beskrivelse && <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 4 }}>{k.beskrivelse}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.mork }}>{fmtNok(k.belop)}</div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys }}>
                  {k.frekvens === 'engangs' ? 'engangs' : k.frekvens === 'aar' ? `≈ ${fmtNok(mndNorm)}/mnd` : '/mnd'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => erAapen ? lukk() : startRediger(k)} style={knappStilSekundaer}>
                  {erAapen ? 'Lukk' : 'Rediger'}
                </button>
                <button onClick={() => slett(k.id, k.kategori)} style={knappStilSlett}>🗑</button>
              </div>
            </div>
            {erAapen && <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />}
          </div>
        )
      })}

      {aapen === 'nytt' ? (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.gull}`, borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, marginBottom: 12 }}>Ny kostnad</div>
          <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />
        </div>
      ) : (
        <button onClick={startNytt} style={knappStilNyttElement}>+ Ny kostnad</button>
      )}
    </div>
  )
}

function Skjema({ redigert, setRedigert, onLagre, onAvbryt }: {
  redigert: Partial<EiendomKostnad>
  setRedigert: (r: Partial<EiendomKostnad>) => void
  onLagre: () => Promise<void>
  onAvbryt: () => void
}) {
  const upd = <K extends keyof EiendomKostnad>(felt: K, v: EiendomKostnad[K]) => setRedigert({ ...redigert, [felt]: v })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      <Felt lbl="Kategori">
        <select value={redigert.kategori || 'kommunale'} onChange={e => upd('kategori', e.target.value as EiendomKostnad['kategori'])} style={inputStil}>
          {KOSTNAD_KATEGORIER.map(k => <option key={k} value={k}>{KOSTNAD_ETIKETT[k]}</option>)}
        </select>
      </Felt>
      <Felt lbl="Beløp (kr)">
        <input type="number" value={redigert.belop ?? ''} onChange={e => upd('belop', e.target.value === '' ? 0 : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Frekvens">
        <select value={redigert.frekvens || 'mnd'} onChange={e => upd('frekvens', e.target.value as EiendomKostnad['frekvens'])} style={inputStil}>
          <option value="mnd">Per måned</option>
          <option value="aar">Per år</option>
          <option value="engangs">Engangs</option>
        </select>
      </Felt>
      <Felt lbl={redigert.frekvens === 'engangs' ? 'Dato' : 'Startdato'}>
        <input type="date" value={redigert.startdato || ''} onChange={e => upd('startdato', e.target.value || null)} style={inputStil} />
      </Felt>
      {redigert.frekvens !== 'engangs' && (
        <Felt lbl="Sluttdato (valgfri)">
          <input type="date" value={redigert.sluttdato || ''} onChange={e => upd('sluttdato', e.target.value || null)} style={inputStil} />
        </Felt>
      )}
      <Felt lbl="Beskrivelse" full>
        <input value={redigert.beskrivelse || ''} onChange={e => upd('beskrivelse', e.target.value || null)} style={inputStil} placeholder="F.eks. «Tryg innbo + bygning», «BKK strøm»" />
      </Felt>
      <Felt lbl="Notat" full>
        <input value={redigert.notat || ''} onChange={e => upd('notat', e.target.value || null)} style={inputStil} placeholder="Valgfritt" />
      </Felt>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onLagre} style={knappStilPrimaer}>💾 Lagre</button>
        <button onClick={onAvbryt} style={knappStilSekundaer}>Avbryt</button>
      </div>
    </div>
  )
}
