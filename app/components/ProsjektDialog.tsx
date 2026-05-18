'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

type DialogType = 'megler_svar' | 'bank_svar' | 'selger_svar' | 'haandverker_svar' | 'beslutning' | 'notat'

type DialogRad = {
  id: string
  prosjekt_id: string
  bruker: string
  opprettet: string
  type: DialogType
  innhold: string
  notat: string | null
  relatert_epost_id: string | null
}

type EpostKortInfo = {
  id: string
  emne: string
  formaal: string
  sendt_tidspunkt: string | null
  opprettet: string
}

const TYPE_ETIKETT: Record<DialogType, string> = {
  megler_svar: '🏠 Megler — svar',
  bank_svar: '🏦 Bank — svar',
  selger_svar: '👤 Selger — svar',
  haandverker_svar: '🔧 Håndverker — svar',
  beslutning: '✅ Beslutning',
  notat: '📝 Notat',
}

const TYPE_FARGE: Record<DialogType, { bg: string; tekst: string }> = {
  megler_svar:      { bg: '#fef3e8', tekst: '#7a4a08' },
  bank_svar:        { bg: '#e8f0fe', tekst: '#1a3a6e' },
  selger_svar:      { bg: '#f3e8fe', tekst: '#5a1a8e' },
  haandverker_svar: { bg: '#e8f5ed', tekst: '#1a4d2b' },
  beslutning:       { bg: '#fef9e8', tekst: '#7a6a08' },
  notat:            { bg: '#f0ede5', tekst: '#5a6171' },
}

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

function formaterTid(iso: string) {
  const d = new Date(iso)
  const idag = new Date()
  const igår = new Date(idag)
  igår.setDate(idag.getDate() - 1)
  const klokke = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === idag.toDateString()) return `I dag ${klokke}`
  if (d.toDateString() === igår.toDateString()) return `I går ${klokke}`
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + klokke
}

export function ProsjektDialog({ prosjektId }: { prosjektId: string }) {
  const [rader, setRader] = useState<DialogRad[]>([])
  const [laster, setLaster] = useState(true)
  const [aktiveEposter, setAktiveEposter] = useState<EpostKortInfo[]>([])

  const [visSkjema, setVisSkjema] = useState(false)
  const [type, setType] = useState<DialogType>('megler_svar')
  const [innhold, setInnhold] = useState('')
  const [notat, setNotat] = useState('')
  const [relatertEpostId, setRelatertEpostId] = useState<string>('')
  const [lagrer, setLagrer] = useState(false)

  const aktivBruker = (typeof window !== 'undefined' ? hentAktivBruker() : null) || 'ukjent'

  const hent = useCallback(async () => {
    setLaster(true)
    const [dRes, eRes] = await Promise.all([
      supabase.from('dialog_logg')
        .select('id, prosjekt_id, bruker, opprettet, type, innhold, notat, relatert_epost_id')
        .eq('prosjekt_id', prosjektId)
        .order('opprettet', { ascending: false }),
      supabase.from('eposter')
        .select('id, emne, formaal, sendt_tidspunkt, opprettet')
        .eq('relatert_prosjekt_id', prosjektId)
        .order('opprettet', { ascending: false })
        .limit(50),
    ])
    setRader((dRes.data || []) as DialogRad[])
    setAktiveEposter((eRes.data || []) as EpostKortInfo[])
    setLaster(false)
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  // Forhåndsvelg type basert på siste sendte epost — om megleren ble kontaktet
  // sist er det mest sannsynlig at det er megleren som svarer nå.
  useEffect(() => {
    if (aktiveEposter.length === 0 || visSkjema) return
    const siste = aktiveEposter[0]
    if (siste.formaal.startsWith('megler_')) setType('megler_svar')
    else if (siste.formaal === 'bank_finansieringssamtale') setType('bank_svar')
    else if (siste.formaal === 'selger_kontakt') setType('selger_svar')
    else if (siste.formaal === 'haandverker_tilbud') setType('haandverker_svar')
  }, [aktiveEposter, visSkjema])

  function nullstill() {
    setInnhold(''); setNotat(''); setRelatertEpostId(''); setVisSkjema(false)
  }

  async function lagre() {
    if (!innhold.trim()) { visToast('Innhold må fylles inn', 'feil', 2500); return }
    setLagrer(true)
    try {
      const id = nyId()
      const { error } = await supabase.from('dialog_logg').insert([{
        id,
        prosjekt_id: prosjektId,
        bruker: aktivBruker,
        type,
        innhold: innhold.trim(),
        notat: notat.trim() || null,
        relatert_epost_id: relatertEpostId || null,
      }])
      if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
      visToast('Lagret', 'suksess', 2000)
      nullstill()
      await hent()
    } finally {
      setLagrer(false)
    }
  }

  async function slett(id: string) {
    if (!confirm('Slette dette innslaget?')) return
    const { error } = await supabase.from('dialog_logg').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await hent()
  }

  const epostMap = useMemo(() => {
    const m: Record<string, EpostKortInfo> = {}
    for (const e of aktiveEposter) m[e.id] = e
    return m
  }, [aktiveEposter])

  return (
    <div>
      {/* Topp-knapp: nytt innslag */}
      {!visSkjema && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setVisSkjema(true)} className="knapp-hover-loft"
            style={{
              background: FARGER.mork, color: FARGER.creamLys, border: 'none',
              borderRadius: RADIUS.pill, padding: '11px 22px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: SHADOW.sm,
              transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
            }}>
            + Loggfør svar eller beslutning
          </button>
        </div>
      )}

      {/* Skjema */}
      {visSkjema && (
        <div className="anim-fade-up" style={{
          background: FARGER.hvit,
          border: `1px solid ${FARGER.kantUltralys}`,
          borderRadius: RADIUS.lg, padding: 22, marginBottom: 18,
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Nytt dialog-innslag</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lblStil}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as DialogType)} style={inputStil}>
                {(Object.keys(TYPE_ETIKETT) as DialogType[]).map(t => (
                  <option key={t} value={t}>{TYPE_ETIKETT[t]}</option>
                ))}
              </select>
            </div>
            {aktiveEposter.length > 0 && (
              <div>
                <label style={lblStil}>Svar på epost (valgfri)</label>
                <select value={relatertEpostId} onChange={e => setRelatertEpostId(e.target.value)} style={inputStil}>
                  <option value="">— Ikke knyttet —</option>
                  {aktiveEposter.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.emne.slice(0, 50)}{e.emne.length > 50 ? '…' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lblStil}>Innhold *</label>
            <textarea value={innhold} onChange={e => setInnhold(e.target.value)} rows={6}
              placeholder={
                type === 'beslutning'
                  ? 'F.eks. «Bestemte oss for å gå videre med befaring 21. mai. Budsjett opp til €520k.»'
                  : type === 'notat'
                  ? 'F.eks. «Sjekk om naboen selger — Maria nevnte det på telefon.»'
                  : 'Lim inn svaret du fikk her — eller skriv et sammendrag.'
              }
              style={{ ...inputStil, resize: 'vertical', fontFamily: 'inherit', minHeight: 100 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lblStil}>Min vurdering / neste handling (valgfri)</label>
            <textarea value={notat} onChange={e => setNotat(e.target.value)} rows={3}
              placeholder="F.eks. «Megler vil ha bud innen mandag — vi diskuterer med banken først.»"
              style={{ ...inputStil, resize: 'vertical', fontFamily: 'inherit', minHeight: 60 }} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={lagre} disabled={lagrer || !innhold.trim()} className="knapp-hover-loft"
              style={{
                background: lagrer || !innhold.trim() ? FARGER.tekstLys : FARGER.mork,
                color: FARGER.creamLys, border: 'none',
                borderRadius: RADIUS.pill, padding: '11px 22px',
                fontSize: 13, fontWeight: 600,
                cursor: lagrer || !innhold.trim() ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: lagrer || !innhold.trim() ? 'none' : SHADOW.sm,
              }}>
              {lagrer ? '⏳ Lagrer…' : '💾 Lagre'}
            </button>
            <button onClick={nullstill} disabled={lagrer}
              style={{
                background: FARGER.hvit, color: FARGER.tekstMid,
                border: `1px solid ${FARGER.kantUltralys}`,
                padding: '11px 20px', borderRadius: RADIUS.pill,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {laster && (
        <div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 18, marginBottom: 10, boxShadow: SHADOW.xs }}>
              <div className="skimmer" style={{ height: 14, width: '40%', marginBottom: 10, borderRadius: 4 }} />
              <div className="skimmer" style={{ height: 12, width: '90%', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {!laster && rader.length === 0 && (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 40, textAlign: 'center', color: FARGER.tekstMid }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Ingen dialog loggført ennå</div>
          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>
            Når du får svar fra megler, bank eller selger — eller tar en beslutning — logg det her. Da ligger hele dialogen samlet for prosjektet.
          </div>
        </div>
      )}

      {!laster && rader.map((r, i) => {
        const f = TYPE_FARGE[r.type]
        const koblet = r.relatert_epost_id ? epostMap[r.relatert_epost_id] : null
        return (
          <div key={r.id} className="anim-fade-up" style={{
            background: FARGER.hvit,
            border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.lg, padding: 18, marginBottom: 12,
            boxShadow: SHADOW.sm,
            animationDelay: `${Math.min(i, 8) * 30}ms`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ background: f.bg, color: f.tekst, fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS.pill, letterSpacing: '0.02em' }}>
                {TYPE_ETIKETT[r.type]}
              </span>
              <span style={{ fontSize: 12, color: FARGER.tekstLys }}>{formaterTid(r.opprettet)}</span>
              <span style={{ fontSize: 12, color: FARGER.tekstLys }}>· {r.bruker.charAt(0).toUpperCase() + r.bruker.slice(1)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => slett(r.id)} style={{
                background: 'none', border: 'none',
                color: FARGER.tekstLys, cursor: 'pointer',
                fontSize: 14, padding: 4, opacity: 0.5,
                transition: `opacity ${MOTION.rask}`,
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                🗑
              </button>
            </div>

            {koblet && (
              <div style={{ fontSize: 12, color: FARGER.tekstMid, marginBottom: 10, padding: '6px 10px', background: FARGER.flateLys, borderRadius: RADIUS.md, borderLeft: `3px solid ${FARGER.gull}` }}>
                Svar på epost: <strong style={{ color: FARGER.mork }}>{koblet.emne}</strong>
              </div>
            )}

            <div style={{ fontSize: 14, color: FARGER.mork, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {r.innhold}
            </div>

            {r.notat && (
              <div style={{
                marginTop: 12, padding: 12,
                background: FARGER.creamLys,
                borderRadius: RADIUS.md,
                border: `1px solid ${FARGER.gull}22`,
              }}>
                <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Min vurdering
                </div>
                <div style={{ fontSize: 13.5, color: FARGER.tekstMid, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {r.notat}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const lblStil: React.CSSProperties = {
  display: 'block',
  fontSize: 11, color: FARGER.tekstMid,
  marginBottom: 6, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  borderRadius: RADIUS.md,
  border: `1px solid ${FARGER.kant}`,
  background: FARGER.hvit,
  fontFamily: 'inherit', boxSizing: 'border-box',
  outline: 'none',
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
}
