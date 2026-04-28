'use client'
import { useState } from 'react'
import { FORMAAL_ETIKETT, type Formaal, type MottakerType } from '../lib/epost'

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
    // Hvis spørsmål endret og formålet støtter dem, flett dem inn i innholdet
    let endeligInnhold = innhold
    if (harSporsmal && rensetSporsmal.length > 0 && innhold === utkast.innhold) {
      const listeTekst = rensetSporsmal.map((s, i) => `${i + 1}. ${s}`).join('\n')
      // Bare legg til hvis AI sin tekst ikke allerede inneholder listen
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
    <div style={{ background: '#fff', border: '1.5px solid #ddd', borderRadius: 6, padding: 14, marginTop: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ background: farge, color: 'white', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{etikett}</span>
        <span style={{ background: '#f0f0f0', color: '#444', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{SPRAK_LABEL[utkast.sprak] || utkast.sprak.toUpperCase()}</span>
        {prosjektNavn && <span style={{ fontSize: 11, color: '#666' }}>📁 {prosjektNavn}</span>}
      </div>

      {erBud && (
        <div style={{ background: '#fde8ec', border: '1.5px solid #C8102E', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: '#7a0c1e' }}>
          ⚠️ Dette er et <strong>bud</strong>. Les grundig og kontroller alle tall og betingelser før du sender.
        </div>
      )}

      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>Til</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        {utkast.mottaker_navn && <span>{utkast.mottaker_navn} </span>}
        <span style={{ color: '#666' }}>&lt;{utkast.til}&gt;</span>
      </div>

      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>Emne</div>
      <input
        value={emne}
        onChange={e => setEmne(e.target.value)}
        style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #ddd', marginBottom: 10 }}
      />

      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>Innhold</div>
      <textarea
        value={innhold}
        onChange={e => setInnhold(e.target.value)}
        rows={8}
        style={{ width: '100%', padding: '8px', fontSize: 12, lineHeight: 1.5, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'sans-serif', resize: 'vertical', marginBottom: 10 }}
      />

      {harSporsmal && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Spørsmål (redigerbare)</div>
          {sporsmal.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#666', minWidth: 16, lineHeight: '28px' }}>{i + 1}.</span>
              <input value={s} onChange={e => endreSporsmal(i, e.target.value)}
                style={{ flex: 1, padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #ddd' }} />
              <button onClick={() => fjernSporsmal(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 14 }}>✕</button>
            </div>
          ))}
          <button onClick={leggTilSporsmal} style={{ background: '#f0f0f0', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: '#444' }}>+ Spørsmål</button>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8, cursor: effektivProsjektId ? 'pointer' : 'not-allowed' }}>
        <input type="checkbox" checked={vedleggPdf} onChange={e => setVedleggPdf(e.target.checked)} disabled={!effektivProsjektId} />
        <span>Vedlegg prosjektanalyse som PDF (med før/etter-bilder)
          {!effektivProsjektId && <span style={{ color: '#aaa' }}> (krever prosjekt-kontekst)</span>}
          {effektivProsjektId && !utkast.relatert_prosjekt_id && <span style={{ color: '#888' }}> – bruker valgt prosjekt fra dropdown</span>}
        </span>
      </label>

      <div style={{ background: '#f8f8f8', borderRadius: 6, padding: 8, fontSize: 11, color: '#666', fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: 10 }}>
        {signaturForhandsvisning}
      </div>

      {!endreFelt && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={sendUtkast} disabled={sender}
            style={{ flex: 1, background: sender ? '#999' : '#2D7D46', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: sender ? 'not-allowed' : 'pointer' }}>
            {sender ? '⏳ Sender...' : '📤 Send'}
          </button>
          <button onClick={() => setEndreFelt(true)} disabled={sender}
            style={{ background: '#f0f0f0', color: '#444', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Be AI endre
          </button>
          <button onClick={onAvbryt} disabled={sender}
            style={{ background: '#fde8ec', color: '#C8102E', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Avbryt
          </button>
        </div>
      )}

      {endreFelt && (
        <div>
          <textarea value={endreInstruks} onChange={e => setEndreInstruks(e.target.value)}
            placeholder="Hva skal endres? F.eks. 'gjør mer formell' eller 'be også om energiattest'"
            rows={2}
            style={{ width: '100%', padding: 8, fontSize: 12, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'sans-serif', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onBeAIEndre(endreInstruks.trim() || 'Endre utkastet'); setEndreFelt(false); setEndreInstruks('') }}
              style={{ flex: 1, background: '#0e1726', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Send til AI
            </button>
            <button onClick={() => { setEndreFelt(false); setEndreInstruks('') }}
              style={{ background: '#f0f0f0', color: '#444', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
