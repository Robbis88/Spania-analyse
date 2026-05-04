'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import type { EiendomLeietaker } from '../../../types'
import type { EiendomData } from '../useEiendomData'
import {
  Felt, TomTilstand, inputStil,
  knappStilPrimaer, knappStilSekundaer, knappStilSlett, knappStilNyttElement,
} from './faneUi'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

type Props = { data: EiendomData; onEndret: () => void | Promise<void> }

export function EiendomLeietakere({ data, onEndret }: Props) {
  const [aapen, setAapen] = useState<string | null>(null)  // leietaker-id eller 'nytt'
  const [redigert, setRedigert] = useState<Partial<EiendomLeietaker>>({})

  function startNytt() { setRedigert({}); setAapen('nytt') }
  function startRediger(l: EiendomLeietaker) { setRedigert({ ...l }); setAapen(l.id) }
  function lukk() { setAapen(null); setRedigert({}) }

  async function lagre() {
    const r = redigert
    if (!r.navn?.trim()) { visToast('Navn må fylles inn', 'feil', 3000); return }
    if (aapen === 'nytt') {
      const id = nyId()
      const bruker = hentAktivBruker() || 'ukjent'
      const { error } = await supabase.from('eiendom_leietakere').insert([{
        id, prosjekt_id: data.prosjekt!.id, bruker,
        navn: r.navn.trim(),
        epost: r.epost || null, telefon: r.telefon || null, notat: r.notat || null,
      }])
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Leietaker lagt til', 'suksess', 2500)
    } else if (aapen) {
      const { error } = await supabase.from('eiendom_leietakere').update({
        navn: r.navn.trim(),
        epost: r.epost || null, telefon: r.telefon || null, notat: r.notat || null,
      }).eq('id', aapen)
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Leietaker oppdatert', 'suksess', 2000)
    }
    lukk(); await onEndret()
  }

  async function slett(id: string, navn: string) {
    const koblet = data.inntekter.filter(i => i.leietaker_id === id).length
    const melding = koblet > 0
      ? `«${navn}» er koblet til ${koblet} leiekontrakt${koblet !== 1 ? 'er' : ''}. Kontraktene beholdes (uten leietaker). Slette?`
      : `Slette «${navn}»?`
    if (!confirm(melding)) return
    const { error } = await supabase.from('eiendom_leietakere').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Leietaker slettet', 'suksess', 2000)
    await onEndret()
  }

  return (
    <div>
      {data.leietakere.length === 0 && aapen !== 'nytt' && (
        <TomTilstand tekst="Ingen leietakere registrert ennå. Legg til dem her før du oppretter leiekontrakter." />
      )}

      {data.leietakere.map(l => {
        const erAapen = aapen === l.id
        const koblet = data.inntekter.filter(i => i.leietaker_id === l.id).length
        return (
          <div key={l.id} style={{
            background: '#fff', border: `1.5px solid ${erAapen ? FARGER.gull : FARGER.kantLys}`,
            borderRadius: RADIUS.md, padding: 16, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: erAapen ? 14 : 0 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork }}>{l.navn}</div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {l.epost && <span>📧 {l.epost}</span>}
                  {l.telefon && <span>📱 {l.telefon}</span>}
                  {koblet > 0 && <span>· {koblet} kontrakt{koblet !== 1 ? 'er' : ''}</span>}
                </div>
                {l.notat && <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 6, fontStyle: 'italic' }}>{l.notat}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => erAapen ? lukk() : startRediger(l)} style={knappStilSekundaer}>
                  {erAapen ? 'Lukk' : 'Rediger'}
                </button>
                <button onClick={() => slett(l.id, l.navn)} style={knappStilSlett}>🗑</button>
              </div>
            </div>
            {erAapen && <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />}
          </div>
        )
      })}

      {aapen === 'nytt' ? (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.gull}`, borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, marginBottom: 12 }}>Ny leietaker</div>
          <Skjema redigert={redigert} setRedigert={setRedigert} onLagre={lagre} onAvbryt={lukk} />
        </div>
      ) : (
        <button onClick={startNytt} style={knappStilNyttElement}>+ Ny leietaker</button>
      )}
    </div>
  )
}

function Skjema({ redigert, setRedigert, onLagre, onAvbryt }: {
  redigert: Partial<EiendomLeietaker>
  setRedigert: (r: Partial<EiendomLeietaker>) => void
  onLagre: () => Promise<void>
  onAvbryt: () => void
}) {
  const upd = <K extends keyof EiendomLeietaker>(felt: K, v: EiendomLeietaker[K]) => setRedigert({ ...redigert, [felt]: v })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      <Felt lbl="Navn">
        <input value={redigert.navn || ''} onChange={e => upd('navn', e.target.value)} style={inputStil} placeholder="Fullt navn" />
      </Felt>
      <Felt lbl="E-post">
        <input type="email" value={redigert.epost || ''} onChange={e => upd('epost', e.target.value || null)} style={inputStil} />
      </Felt>
      <Felt lbl="Telefon">
        <input value={redigert.telefon || ''} onChange={e => upd('telefon', e.target.value || null)} style={inputStil} />
      </Felt>
      <Felt lbl="Notat" full>
        <input value={redigert.notat || ''} onChange={e => upd('notat', e.target.value || null)} style={inputStil} placeholder="Valgfritt — antall personer, husdyr, særavtale osv." />
      </Felt>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onLagre} style={knappStilPrimaer}>💾 Lagre</button>
        <button onClick={onAvbryt} style={knappStilSekundaer}>Avbryt</button>
      </div>
    </div>
  )
}
