'use client'
import { useState } from 'react'
import { FORMAAL_ETIKETT, type Formaal, type MottakerType } from '../lib/epost'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

export type EpostUtkast = {
  til: string
  mottaker_navn?: string
  mottaker_type?: MottakerType
  sprak: 'no' | 'es' | 'en'
  emne: string
  innhold: string
  formaal: Formaal
  relatert_prosjekt_id?: string
  sporsmal?: string[]
  onsket_mote?: 'telefon' | 'video' | 'fysisk_mote' | 'fleksibelt'
  vedlegg_pdf?: boolean
}

const FORMAAL_FARGE: Record<Formaal, string> = {
  bank_finansieringssamtale: '#0e1726',
  megler_boligsporsmal: '#D4814E',
  megler_befaring: '#D4814E',
  megler_bud: '#C8102E',
  selger_kontakt: '#B08030',
  haandverker_tilbud: '#6b9055',
  annet: '#666',
}

const SPRAK_LABEL: Record<string, string> = { no: 'NO', es: 'ES', en: 'EN' }

const inputStil: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  borderRadius: RADIUS.md,
  border: `1px solid ${FARGER.kant}`,
  background: FARGER.hvit,
  marginBottom: 10,
  fontFamily: 'inherit',
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
  outline: 'none',
}

const tekstAreaStil: React.CSSProperties = {
  width: '100%', padding: 12, fontSize: 13, lineHeight: 1.55,
  borderRadius: RADIUS.md,
  border: `1px solid ${FARGER.kant}`,
  background: FARGER.hvit,
  fontFamily: 'inherit', resize: 'vertical',
  marginBottom: 10,
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
  outline: 'none',
}

export function EpostGodkjenningsKort({
  utkast, prosjektNavn, prosjektId, bruker, sender, onSend, onAvbryt, onBeAIEndre,
}: {
  utkast: EpostUtkast
  prosjektNavn?: string | null
  prosjektId?: string
  bruker: string
  sender: boolean
  onSend: (endret: EpostUtkast & { bruker_endret: boolean }) => Promise<void>
  onAvbryt: () => void
  onBeAIEndre: (instruks: string) => void
}) {
  const effektivProsjektId = utkast.relatert_prosjekt_id || prosjektId
  const [emne, setEmne] = useState(utkast.emne)
  const [innhold, setInnhold] = useState(utkast.innhold)
  const [sporsmal, setSporsmal] = useState<string[]>(utkast.sporsmal || [])
  const [vedleggPdf, setVedleggPdf] = useState(!!utkast.vedlegg_pdf)
  const [endreFelt, setEndreFelt] = useState(false)
  const [endreInstruks, setEndreInstruks] = useState('')

  const harSporsmal = utkast.formaal === 'megler_boligsporsmal' || utkast.formaal === 'selger_kontakt'
  const erBud = utkast.formaal === 'megler_bud'
  const etikett = FORMAAL_ETIKETT[utkast.formaal]
  const farge = FORMAAL_FARGE[utkast.formaal]
  const brukerEndret = emne !== utkast.emne || innhold !== utkast.innhold

  const endreSporsmal = (i: number, v: string) => setSporsmal(sporsmal.map((s, j) => j === i ? v : s))
  const leggTilSporsmal = () => setSporsmal([...sporsmal, ''])
  const fjernSporsmal = (i: number) => setSporsmal(sporsmal.filter((_, j) => j !== i))

  const sendUtkast = async () => {
    const rensetSporsmal = sporsmal.map(s => s.trim()).filter(Boolean)
    let endeligInnhold = innhold
    if (harSporsmal && rensetSporsmal.length > 0 && innhold === utkast.innhold) {
      const listeTekst = rensetSporsmal.map((s, i) => `${i + 1}. ${s}`).join('\n')
      if (!utkast.innhold.includes(rensetSporsmal[0])) {
        endeligInnhold = innhold + '\n\n' + listeTekst
      }
    }
    await onSend({
      ...utkast,
      emne,
      innhold: endeligInnhold,
      sporsmal: rensetSporsmal.length > 0 ? rensetSporsmal : utkast.sporsmal,
      vedlegg_pdf: vedleggPdf,
      relatert_prosjekt_id: effektivProsjektId,
      bruker_endret: brukerEndret,
    })
  }

  const signaturForhandsvisning =
    `---\n${bruker.charAt(0).toUpperCase() + bruker.slice(1)}\nLeganger & Osvaag Eiendom\npost@loeiendom.com\nloeiendom.com`

  return (
    <div className="anim-fade-up" style={{
      background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg, padding: 18, marginTop: 10,
      boxShadow: SHADOW.md,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ background: farge, color: FARGER.creamLys, padding: '4px 12px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>{etikett}</span>
        <span style={{ background: FARGER.flateLys, color: FARGER.tekstMid, padding: '4px 12px', borderRadius: RADIUS.pill, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>{SPRAK_LABEL[utkast.sprak] || utkast.sprak.toUpperCase()}</span>
        {prosjektNavn && <span style={{ fontSize: 12, color: FARGER.tekstMid }}>📁 {prosjektNavn}</span>}
      </div>

      {erBud && (
        <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}44`, borderRadius: RADIUS.md, padding: 12, marginBottom: 12, fontSize: 12.5, color: '#7a0c1e', lineHeight: 1.55 }}>
          ⚠️ Dette er et <strong>bud</strong>. Les grundig og kontroller alle tall og betingelser før du sender.
        </div>
      )}

      <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Til</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, color: FARGER.mork, letterSpacing: '-0.005em' }}>
        {utkast.mottaker_navn && <span>{utkast.mottaker_navn} </span>}
        <span style={{ color: FARGER.tekstMid }}>&lt;{utkast.til}&gt;</span>
      </div>

      <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Emne</div>
      <input
        value={emne}
        onChange={e => setEmne(e.target.value)}
        style={inputStil}
      />

      <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Innhold</div>
      <textarea
        value={innhold}
        onChange={e => setInnhold(e.target.value)}
        rows={8}
        style={tekstAreaStil}
      />

      {harSporsmal && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Spørsmål (redigerbare)</div>
          {sporsmal.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: FARGER.tekstMid, minWidth: 18, lineHeight: '32px' }}>{i + 1}.</span>
              <input value={s} onChange={e => endreSporsmal(i, e.target.value)}
                style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.md, border: `1px solid ${FARGER.kant}`, fontFamily: 'inherit', outline: 'none', background: FARGER.hvit }} />
              <button onClick={() => fjernSporsmal(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: FARGER.tekstLys, fontSize: 14 }}>✕</button>
            </div>
          ))}
          <button onClick={leggTilSporsmal} style={{
            background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.pill, padding: '6px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            color: FARGER.tekstMid, letterSpacing: '-0.005em',
          }}>+ Spørsmål</button>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 12, cursor: effektivProsjektId ? 'pointer' : 'not-allowed', color: FARGER.tekstMid }}>
        <input type="checkbox" checked={vedleggPdf} onChange={e => setVedleggPdf(e.target.checked)} disabled={!effektivProsjektId} style={{ accentColor: FARGER.gull }} />
        <span>Vedlegg prosjektanalyse som PDF (med før/etter-bilder)
          {!effektivProsjektId && <span style={{ color: FARGER.tekstLys }}> (krever prosjekt-kontekst)</span>}
          {effektivProsjektId && !utkast.relatert_prosjekt_id && <span style={{ color: FARGER.tekstLys }}> – bruker valgt prosjekt fra dropdown</span>}
        </span>
      </label>

      <div style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 12, fontSize: 11.5, color: FARGER.tekstMid, fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: 14, border: `1px solid ${FARGER.kantUltralys}` }}>
        {signaturForhandsvisning}
      </div>

      {!endreFelt && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={sendUtkast} disabled={sender} className="knapp-hover-loft"
            style={{
              flex: 1, background: sender ? FARGER.tekstLys : '#2D7D46',
              color: FARGER.creamLys, border: 'none',
              borderRadius: RADIUS.pill, padding: '11px 18px',
              fontSize: 13, fontWeight: 600, cursor: sender ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: sender ? 'none' : SHADOW.sm,
            }}>
            {sender ? '⏳ Sender…' : '📤 Send'}
          </button>
          <button onClick={() => setEndreFelt(true)} disabled={sender}
            style={{
              background: FARGER.hvit, color: FARGER.tekstMid,
              border: `1px solid ${FARGER.kantUltralys}`,
              borderRadius: RADIUS.pill, padding: '11px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}>
            Be AI endre
          </button>
          <button onClick={onAvbryt} disabled={sender}
            style={{
              background: FARGER.feilBg, color: FARGER.feil, border: 'none',
              borderRadius: RADIUS.pill, padding: '11px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}>
            Avbryt
          </button>
        </div>
      )}

      {endreFelt && (
        <div className="anim-fade-up">
          <textarea value={endreInstruks} onChange={e => setEndreInstruks(e.target.value)}
            placeholder="Hva skal endres? F.eks. 'gjør mer formell' eller 'be også om energiattest'"
            rows={2}
            style={tekstAreaStil} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { onBeAIEndre(endreInstruks.trim() || 'Endre utkastet'); setEndreFelt(false); setEndreInstruks('') }} className="knapp-hover-loft"
              style={{
                flex: 1, background: FARGER.mork, color: FARGER.creamLys, border: 'none',
                borderRadius: RADIUS.pill, padding: '11px 18px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: SHADOW.sm,
              }}>
              Send til AI
            </button>
            <button onClick={() => { setEndreFelt(false); setEndreInstruks('') }}
              style={{
                background: FARGER.hvit, color: FARGER.tekstMid,
                border: `1px solid ${FARGER.kantUltralys}`,
                borderRadius: RADIUS.pill, padding: '11px 16px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}>
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
