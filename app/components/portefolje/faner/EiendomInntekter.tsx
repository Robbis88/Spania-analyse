'use client'
import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { hentAktivBruker } from '../../../lib/aktivBruker'
import { visToast } from '../../../lib/toast'
import { FARGER, RADIUS } from '../../../lib/styles'
import { gjeldendeLeieMnd } from '../../../lib/portefolje'
import type { EiendomInntekt } from '../../../types'
import type { EiendomData } from '../useEiendomData'
import {
  Felt, SumKort, TomTilstand, fmtNok, fmtDato, numOrNull, inputStil,
  knappStilPrimaer, knappStilSekundaer, knappStilSlett, knappStilNyttElement,
} from './faneUi'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const TYPE_ETIKETT: Record<string, string> = {
  langtidsleie: 'Langtidsleie',
  korttidsleie: 'Korttidsleie',
  annet: 'Annet',
}

type Props = { data: EiendomData; onEndret: () => void | Promise<void> }

export function EiendomInntekter({ data, onEndret }: Props) {
  const [aapen, setAapen] = useState<string | null>(null)
  const [redigert, setRedigert] = useState<Partial<EiendomInntekt>>({})

  const aktivLeieMnd = useMemo(() => gjeldendeLeieMnd(data.inntekter), [data.inntekter])
  const naa = new Date()
  const aktiveAntall = data.inntekter.filter(i => {
    if (i.startdato && new Date(i.startdato) > naa) return false
    if (i.sluttdato && new Date(i.sluttdato) < naa) return false
    return true
  }).length

  function startNytt() { setRedigert({ type: 'langtidsleie' }); setAapen('nytt') }
  function startRediger(i: EiendomInntekt) { setRedigert({ ...i }); setAapen(i.id) }
  function lukk() { setAapen(null); setRedigert({}) }

  async function lagre() {
    const r = redigert
    if (aapen === 'nytt') {
      const id = nyId()
      const bruker = hentAktivBruker() || 'ukjent'
      const { error } = await supabase.from('eiendom_inntekter').insert([{
        id, prosjekt_id: data.prosjekt!.id, bruker,
        type: r.type || 'langtidsleie',
        leietaker_id: r.leietaker_id || null,
        belop_mnd: numOrNull(r.belop_mnd),
        depositum: numOrNull(r.depositum),
        startdato: r.startdato || null,
        sluttdato: r.sluttdato || null,
        notat: r.notat || null,
      }])
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Inntekt lagt til', 'suksess', 2500)
    } else if (aapen) {
      const { error } = await supabase.from('eiendom_inntekter').update({
        type: r.type, leietaker_id: r.leietaker_id || null,
        belop_mnd: numOrNull(r.belop_mnd), depositum: numOrNull(r.depositum),
        startdato: r.startdato || null, sluttdato: r.sluttdato || null,
        notat: r.notat || null,
      }).eq('id', aapen)
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Oppdatert', 'suksess', 2000)
    }
    lukk(); await onEndret()
  }

  async function slett(id: string) {
    if (!confirm('Slette denne inntekten / leiekontrakten?')) return
    const { error } = await supabase.from('eiendom_inntekter').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await onEndret()
  }

  function leietakerNavn(id: string | null): string {
    if (!id) return 'Ingen leietaker'
    return data.leietakere.find(l => l.id === id)?.navn || '(slettet)'
  }

  function statusEtikett(i: EiendomInntekt): { tekst: string; farge: string } {
    if (i.startdato && new Date(i.startdato) > naa) return { tekst: 'Fremtidig', farge: FARGER.tekstLys }
    if (i.sluttdato && new Date(i.sluttdato) < naa) return { tekst: 'Avsluttet', farge: FARGER.tekstLys }
    return { tekst: 'Aktiv', farge: FARGER.suksess }
  }

  return (
    <div>
      {data.inntekter.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
          <SumKort lbl="Aktiv leie / mnd" verdi={fmtNok(aktivLeieMnd)} farge={FARGER.suksess} />
          <SumKort lbl="Aktiv leie / år" verdi={fmtNok(aktivLeieMnd * 12)} />
          <SumKort lbl="Aktive kontrakter" verdi={String(aktiveAntall)} />
        </div>
      )}

      {data.inntekter.length === 0 && aapen !== 'nytt' && (
        <TomTilstand tekst="Ingen leiekontrakter / inntekter registrert ennå." />
      )}

      {data.inntekter.map(i => {
        const erAapen = aapen === i.id
        const status = statusEtikett(i)
        return (
          <div key={i.id} style={{
            background: '#fff', border: `1.5px solid ${erAapen ? FARGER.gull : FARGER.kantLys}`,
            borderRadius: RADIUS.md, padding: 16, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: erAapen ? 14 : 0 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork }}>{leietakerNavn(i.leietaker_id)}</span>
                  <span style={{ fontSize: 10, color: status.farge, fontWeight: 700, padding: '2px 8px', background: FARGER.flateLys, borderRadius: 12 }}>{status.tekst}</span>
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span>{TYPE_ETIKETT[i.type || 'annet']}</span>
                  {i.startdato && <span>· {fmtDato(i.startdato)} → {fmtDato(i.sluttdato)}</span>}
                  {i.depositum && <span>· Depositum {fmtNok(i.depositum)}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: FARGER.mork }}>{fmtNok(i.belop_mnd)}</div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys }}>per måned</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => erAapen ? lukk() : startRediger(i)} style={knappStilSekundaer}>
                  {erAapen ? 'Lukk' : 'Rediger'}
                </button>
                <button onClick={() => slett(i.id)} style={knappStilSlett}>🗑</button>
              </div>
            </div>
            {erAapen && <Skjema redigert={redigert} setRedigert={setRedigert} leietakere={data.leietakere} onLagre={lagre} onAvbryt={lukk} />}
          </div>
        )
      })}

      {aapen === 'nytt' ? (
        <div style={{ background: '#fff', border: `1.5px solid ${FARGER.gull}`, borderRadius: RADIUS.md, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, marginBottom: 12 }}>Ny inntekt / leiekontrakt</div>
          <Skjema redigert={redigert} setRedigert={setRedigert} leietakere={data.leietakere} onLagre={lagre} onAvbryt={lukk} />
        </div>
      ) : (
        <button onClick={startNytt} style={knappStilNyttElement}>+ Ny inntekt</button>
      )}

      {data.leietakere.length === 0 && (
        <div style={{ fontSize: 11, color: FARGER.tekstLys, fontStyle: 'italic', marginTop: 8 }}>
          💡 Tips: Legg leietakere i «Leietakere»-fanen først, så kan du koble dem til kontraktene her.
        </div>
      )}
    </div>
  )
}

function Skjema({ redigert, setRedigert, leietakere, onLagre, onAvbryt }: {
  redigert: Partial<EiendomInntekt>
  setRedigert: (r: Partial<EiendomInntekt>) => void
  leietakere: EiendomData['leietakere']
  onLagre: () => Promise<void>
  onAvbryt: () => void
}) {
  const upd = <K extends keyof EiendomInntekt>(felt: K, v: EiendomInntekt[K]) => setRedigert({ ...redigert, [felt]: v })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      <Felt lbl="Type">
        <select value={redigert.type || 'langtidsleie'} onChange={e => upd('type', e.target.value as EiendomInntekt['type'])} style={inputStil}>
          <option value="langtidsleie">Langtidsleie</option>
          <option value="korttidsleie">Korttidsleie</option>
          <option value="annet">Annet</option>
        </select>
      </Felt>
      <Felt lbl="Leietaker">
        <select value={redigert.leietaker_id || ''} onChange={e => upd('leietaker_id', e.target.value || null)} style={inputStil}>
          <option value="">— Ingen / ikke koblet —</option>
          {leietakere.map(l => <option key={l.id} value={l.id}>{l.navn}</option>)}
        </select>
      </Felt>
      <Felt lbl="Beløp / måned (kr)">
        <input type="number" value={redigert.belop_mnd ?? ''} onChange={e => upd('belop_mnd', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Depositum (kr)">
        <input type="number" value={redigert.depositum ?? ''} onChange={e => upd('depositum', e.target.value === '' ? null : Number(e.target.value))} style={inputStil} />
      </Felt>
      <Felt lbl="Startdato">
        <input type="date" value={redigert.startdato || ''} onChange={e => upd('startdato', e.target.value || null)} style={inputStil} />
      </Felt>
      <Felt lbl="Sluttdato (valgfri)">
        <input type="date" value={redigert.sluttdato || ''} onChange={e => upd('sluttdato', e.target.value || null)} style={inputStil} />
      </Felt>
      <Felt lbl="Notat" full>
        <input value={redigert.notat || ''} onChange={e => upd('notat', e.target.value || null)} style={inputStil} placeholder="Tomgangsperiode, ferielukket, refinansiering osv." />
      </Felt>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onLagre} style={knappStilPrimaer}>💾 Lagre</button>
        <button onClick={onAvbryt} style={knappStilSekundaer}>Avbryt</button>
      </div>
    </div>
  )
}
