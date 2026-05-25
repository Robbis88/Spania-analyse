'use client'
import { useEffect, useState } from 'react'
import { FARGER, RADIUS } from '../../lib/styles'
import { visToast } from '../../lib/toast'
import { regnLivsopphold, type AnnetLan } from '../../lib/norskBankScore'
import { KalkInput } from './KalkInput'
import { fmtNokKalk as fmtNok, type Husholdning } from './types'

type Props = {
  husholdning: Husholdning
  setHusholdning: React.Dispatch<React.SetStateAction<Husholdning>>
  harLagretProsjekt: boolean
}

export function HusholdningPanel({ husholdning, setHusholdning, harLagretProsjekt }: Props) {
  const [lagretDefaultDato, setLagretDefaultDato] = useState<string | null>(null)
  const [lagrer, setLagrer] = useState(false)

  // Sjekk om bruker har en standard lagret (for å vise dato + "Hent standard"-knapp)
  useEffect(() => {
    fetch('/api/husholdning-default')
      .then(r => r.json())
      .then((d: { oppdatert?: string }) => { if (d?.oppdatert) setLagretDefaultDato(d.oppdatert) })
      .catch(() => { /* ikke kritisk */ })
  }, [])

  async function lagreSomStandard() {
    setLagrer(true)
    const res = await fetch('/api/husholdning-default', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: husholdning }),
    })
    setLagrer(false)
    if (res.ok) {
      setLagretDefaultDato(new Date().toISOString())
      visToast('Husholdning lagret som din standard', 'suksess', 3000)
    } else {
      visToast('Kunne ikke lagre', 'feil', 4000)
    }
  }

  async function hentStandard() {
    if (harLagretProsjekt && !confirm('Du jobber på et lagret prosjekt — overskrive husholdningen med din standard?')) return
    const res = await fetch('/api/husholdning-default')
    const d = await res.json().catch(() => ({}))
    if (!res.ok || !d?.data) {
      visToast('Ingen standard lagret ennå', 'feil', 3000); return
    }
    setHusholdning(d.data as Husholdning)
    visToast('Hentet din standard husholdning', 'suksess', 2500)
  }

  const sumInntekt = husholdning.inntekter.reduce((s, i) => s + (i.belop_mnd || 0), 0)
  const livsopphold = regnLivsopphold(husholdning.antall_voksne, husholdning.antall_barn)
  const sumAndreLanMnd = husholdning.andre_lan.reduce((s, l) => s + (l.mnd_betaling || 0), 0)
  const annenSikkerhet = husholdning.annen_sikkerhet_aktiv
    ? Math.max(0, husholdning.annen_bolig_verdi - husholdning.annen_bolig_lan) : 0

  function leggTilInntekt() {
    setHusholdning({ ...husholdning, inntekter: [...husholdning.inntekter, { beskrivelse: '', belop_mnd: 0 }] })
  }
  function fjernInntekt(i: number) {
    setHusholdning({ ...husholdning, inntekter: husholdning.inntekter.filter((_, idx) => idx !== i) })
  }
  function oppdaterInntekt(i: number, felt: 'beskrivelse' | 'belop_mnd', verdi: string | number) {
    setHusholdning({
      ...husholdning,
      inntekter: husholdning.inntekter.map((inn, idx) => idx === i ? { ...inn, [felt]: verdi } : inn),
    })
  }

  function leggTilLan() {
    setHusholdning({ ...husholdning, andre_lan: [...husholdning.andre_lan, { beskrivelse: '', type: 'annet', saldo: 0, mnd_betaling: 0 }] })
  }
  function fjernLan(i: number) {
    setHusholdning({ ...husholdning, andre_lan: husholdning.andre_lan.filter((_, idx) => idx !== i) })
  }
  function oppdaterLan(i: number, felt: keyof AnnetLan, verdi: string | number) {
    setHusholdning({
      ...husholdning,
      andre_lan: husholdning.andre_lan.map((l, idx) => idx === i ? { ...l, [felt]: verdi } : l),
    })
  }

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, textTransform: 'uppercase' }}>👨‍👩‍👧 Steg 4 — Husholdning og sikkerhet</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lagretDefaultDato && (
            <button onClick={hentStandard}
              title="Henter inntekter, lån og skattesats fra din lagrede standard"
              style={{ background: FARGER.flateMid, color: FARGER.tekstMid, border: 'none', padding: '6px 12px', borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              📂 Hent min standard
            </button>
          )}
          <button onClick={lagreSomStandard} disabled={lagrer}
            title="Lagrer dagens utfylling som din personlige standard for fremtidige analyser"
            style={{ background: lagrer ? FARGER.tekstLys : FARGER.mork, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 600, cursor: lagrer ? 'wait' : 'pointer' }}>
            {lagrer ? '⏳' : '💾 Lagre som standard'}
          </button>
        </div>
      </div>
      {lagretDefaultDato && (
        <div style={{ fontSize: 10, color: FARGER.tekstLys, marginBottom: 8 }}>
          Din standard ble sist oppdatert {new Date(lagretDefaultDato).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )}
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 18px', fontWeight: 300 }}>
        Inntekter, husholdningssammensetning, andre lån og evt. ekstra sikkerhet. Brukes til bank-vurdering nedenfor.
      </p>

      {/* Husholdning + skattesats */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.tekstMid, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Husholdning</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 10 }}>
          <KalkInput lbl="Antall voksne" val={husholdning.antall_voksne}
            onChange={v => setHusholdning({ ...husholdning, antall_voksne: Math.max(1, Math.min(2, v)) })} step={1} />
          <KalkInput lbl="Barn under 18" val={husholdning.antall_barn}
            onChange={v => setHusholdning({ ...husholdning, antall_barn: Math.max(0, v) })} step={1} />
          <KalkInput lbl="Skattesats % (lønn)" val={husholdning.skattesats_pst}
            onChange={v => setHusholdning({ ...husholdning, skattesats_pst: v })} step={1} />
        </div>
        <div style={{ background: FARGER.creamLys, padding: 10, borderRadius: RADIUS.sm, fontSize: 12, color: FARGER.tekstMid, lineHeight: 1.6 }}>
          📊 Estimert SIFO-livsopphold: <strong>{fmtNok(livsopphold)}/mnd</strong>
          {husholdning.antall_barn > 0 && ` (${fmtNok(livsopphold - regnLivsopphold(husholdning.antall_voksne, 0))} av dette går til barn)`}
        </div>
      </div>

      {/* Inntekter */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.tekstMid, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Brutto månedlige inntekter</div>
        {husholdning.inntekter.length === 0 && (
          <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', padding: '8px 0' }}>Ingen inntekter lagt inn ennå.</div>
        )}
        {husholdning.inntekter.map((inn, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: i < husholdning.inntekter.length - 1 ? `1px solid ${FARGER.kantLys}` : 'none' }}>
            <input value={inn.beskrivelse} onChange={e => oppdaterInntekt(i, 'beskrivelse', e.target.value)}
              placeholder="F.eks. Person 1 - Lønn fast jobb"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white' }} />
            <input type="number" min={0} step={1000} value={inn.belop_mnd || ''}
              onChange={e => oppdaterInntekt(i, 'belop_mnd', Number(e.target.value) || 0)}
              placeholder="kr/mnd"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
            <button onClick={() => fjernInntekt(i)} title="Fjern"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '4px 8px' }}>✕</button>
          </div>
        ))}
        <button onClick={leggTilInntekt}
          style={{ marginTop: 10, background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: '8px 14px', fontSize: 12, color: FARGER.mork, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          + Legg til inntektskilde
        </button>
        {sumInntekt > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: FARGER.creamLys, borderRadius: RADIUS.sm, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: FARGER.tekstMid }}>Sum brutto</span>
            <span style={{ fontWeight: 700, color: FARGER.mork }}>{fmtNok(sumInntekt)}/mnd ({fmtNok(sumInntekt * 12)}/år)</span>
          </div>
        )}
      </div>

      {/* Andre lån */}
      <div style={{ marginBottom: 18, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.tekstMid, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Andre eksisterende lån (billån, studielån, kreditt osv.)</div>
        {husholdning.andre_lan.length === 0 && (
          <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', padding: '8px 0' }}>Ingen andre lån lagt inn.</div>
        )}
        {husholdning.andre_lan.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 110px auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: i < husholdning.andre_lan.length - 1 ? `1px solid ${FARGER.kantLys}` : 'none' }}>
            <input value={l.beskrivelse} onChange={e => oppdaterLan(i, 'beskrivelse', e.target.value)}
              placeholder="F.eks. Billån VW Golf"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white' }} />
            <select value={l.type} onChange={e => oppdaterLan(i, 'type', e.target.value)}
              style={{ padding: '6px 8px', fontSize: 12, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, background: 'white' }}>
              <option value="billan">Billån</option>
              <option value="studielan">Studielån</option>
              <option value="kreditt">Kreditt</option>
              <option value="annet_boliglan">Boliglån</option>
              <option value="annet">Annet</option>
            </select>
            <input type="number" min={0} step={10000} value={l.saldo || ''}
              onChange={e => oppdaterLan(i, 'saldo', Number(e.target.value) || 0)}
              placeholder="Saldo"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
            <input type="number" min={0} step={500} value={l.mnd_betaling || ''}
              onChange={e => oppdaterLan(i, 'mnd_betaling', Number(e.target.value) || 0)}
              placeholder="kr/mnd"
              style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
            <button onClick={() => fjernLan(i)} title="Fjern"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '4px 8px' }}>✕</button>
          </div>
        ))}
        <button onClick={leggTilLan}
          style={{ marginTop: 10, background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: '8px 14px', fontSize: 12, color: FARGER.mork, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          + Legg til lån
        </button>
        {sumAndreLanMnd > 0 && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: FARGER.creamLys, borderRadius: RADIUS.sm, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: FARGER.tekstMid }}>Sum andre lån — månedlig</span>
            <span style={{ fontWeight: 700, color: FARGER.mork }}>{fmtNok(sumAndreLanMnd)}/mnd</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={husholdning.annen_sikkerhet_aktiv}
            onChange={e => setHusholdning({ ...husholdning, annen_sikkerhet_aktiv: e.target.checked })}
            style={{ width: 18, height: 18 }} />
          <span style={{ fontWeight: 600 }}>🏦 Vi kan stille sikkerhet i en annen bolig</span>
        </label>

        {husholdning.annen_sikkerhet_aktiv && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: FARGER.tekstMid, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6, fontWeight: 600 }}>Beskrivelse</label>
              <input value={husholdning.annen_bolig_beskrivelse}
                onChange={e => setHusholdning({ ...husholdning, annen_bolig_beskrivelse: e.target.value })}
                placeholder="F.eks. Hytte i Hemsedal, fritidsbolig, sokkelleilighet"
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', boxSizing: 'border-box', background: 'white' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <KalkInput lbl="Verdi (markedstakst)" val={husholdning.annen_bolig_verdi}
                onChange={v => setHusholdning({ ...husholdning, annen_bolig_verdi: v })} />
              <KalkInput lbl="Eksisterende lån" val={husholdning.annen_bolig_lan}
                onChange={v => setHusholdning({ ...husholdning, annen_bolig_lan: v })} />
            </div>
            <div style={{ background: FARGER.creamLys, padding: 12, borderRadius: RADIUS.sm, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: FARGER.tekstMid }}>Tilgjengelig sikkerhet</span>
              <span style={{ fontWeight: 700, color: FARGER.mork }}>{fmtNok(annenSikkerhet)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
