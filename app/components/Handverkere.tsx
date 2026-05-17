'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { HANDVERKER_FAG_ETIKETT, type Handverker, type HandverkerFag } from '../types'

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const ALLE_FAG: HandverkerFag[] = [
  'rorlegger', 'rorlegger_avlop', 'elektriker', 'flislegger', 'maler',
  'snekker', 'mur_betong', 'maskin', 'tak_fasade', 'vvs',
  'vinduer', 'hage_uteplass', 'oppvarming', 'annet',
]

const SPRAK_ETIKETT: Record<'no' | 'en' | 'es', string> = {
  no: '🇳🇴 Norsk',
  en: '🇬🇧 Engelsk',
  es: '🇪🇸 Spansk',
}

const tomHandverker = (): Partial<Handverker> => ({
  navn: '', firma: null, fag: [], omrade: null,
  telefon: null, epost: null, whatsapp: null,
  sprak: 'es', timepris_eur: null, evaluering: null, notat: null, aktiv: true,
})

type Props = { onTilbake: () => void }

export function Handverkere({ onTilbake }: Props) {
  const [liste, setListe] = useState<Handverker[]>([])
  const [laster, setLaster] = useState(true)
  const [filterFag, setFilterFag] = useState<'alle' | HandverkerFag>('alle')
  const [filterOmrade, setFilterOmrade] = useState<string>('alle')
  const [visInaktive, setVisInaktive] = useState(false)
  const [redigerer, setRedigerer] = useState<string | 'ny' | null>(null)
  const [skjema, setSkjema] = useState<Partial<Handverker>>(tomHandverker())
  const [lagrer, setLagrer] = useState(false)
  const aktivBruker = (typeof window !== 'undefined' ? hentAktivBruker() : null) || 'ukjent'

  const hent = useCallback(async () => {
    setLaster(true)
    const { data } = await supabase
      .from('handverkere')
      .select('*')
      .order('aktiv', { ascending: false })
      .order('navn', { ascending: true })
    setListe((data || []) as Handverker[])
    setLaster(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  function startNy() { setSkjema(tomHandverker()); setRedigerer('ny') }
  function startRediger(h: Handverker) { setSkjema({ ...h }); setRedigerer(h.id) }
  function lukk() { setRedigerer(null); setSkjema(tomHandverker()) }

  async function lagre() {
    if (!skjema.navn?.trim()) { visToast('Navn må fylles inn', 'feil', 3000); return }
    if (!skjema.fag || skjema.fag.length === 0) { visToast('Velg minst ett fag', 'feil', 3000); return }
    setLagrer(true)
    try {
      const data = {
        navn: skjema.navn.trim(),
        firma: skjema.firma || null,
        fag: skjema.fag,
        omrade: skjema.omrade || null,
        telefon: skjema.telefon || null,
        epost: skjema.epost || null,
        whatsapp: skjema.whatsapp || null,
        sprak: skjema.sprak || 'es',
        timepris_eur: typeof skjema.timepris_eur === 'number' ? skjema.timepris_eur : null,
        evaluering: typeof skjema.evaluering === 'number' ? skjema.evaluering : null,
        notat: skjema.notat || null,
        aktiv: skjema.aktiv !== false,
      }
      if (redigerer === 'ny') {
        const id = nyId()
        const { error } = await supabase.from('handverkere').insert([{ id, bruker: aktivBruker, ...data }])
        if (error) { visToast('Kunne ikke lagre: ' + error.message, 'feil', 4000); return }
        await loggAktivitet({ handling: 'la til håndverker', tabell: 'handverkere', rad_id: id, detaljer: { navn: data.navn, fag: data.fag } })
        visToast(`${data.navn} lagt til`, 'suksess', 2500)
      } else if (redigerer) {
        const { error } = await supabase.from('handverkere').update(data).eq('id', redigerer)
        if (error) { visToast('Kunne ikke oppdatere: ' + error.message, 'feil', 4000); return }
        visToast('Oppdatert', 'suksess', 2000)
      }
      lukk()
      await hent()
    } finally {
      setLagrer(false)
    }
  }

  async function toggleAktiv(h: Handverker) {
    const { error } = await supabase.from('handverkere').update({ aktiv: !h.aktiv }).eq('id', h.id)
    if (error) { visToast('Kunne ikke endre: ' + error.message, 'feil', 4000); return }
    visToast(h.aktiv ? `${h.navn} skjult` : `${h.navn} aktivert`, 'suksess', 2000)
    await hent()
  }

  async function slett(h: Handverker) {
    if (!confirm(`Slette ${h.navn} permanent? Historikken over tilbudsforespørsler blir også slettet.`)) return
    const { error } = await supabase.from('handverkere').delete().eq('id', h.id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await hent()
  }

  const omrader = useMemo(() => {
    const set = new Set<string>()
    for (const h of liste) if (h.omrade) set.add(h.omrade)
    return Array.from(set).sort()
  }, [liste])

  const filtrert = useMemo(() => liste.filter(h => {
    if (!visInaktive && !h.aktiv) return false
    if (filterFag !== 'alle' && !h.fag.includes(filterFag)) return false
    if (filterOmrade !== 'alle' && h.omrade !== filterOmrade) return false
    return true
  }), [liste, visInaktive, filterFag, filterOmrade])

  function toggleFag(fag: HandverkerFag) {
    const naa = skjema.fag || []
    setSkjema({ ...skjema, fag: naa.includes(fag) ? naa.filter(f => f !== fag) : [...naa, fag] })
  }

  return (
    <div>
      <button onClick={onTilbake} className="nav-lenke"
        style={{
          background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
          borderRadius: RADIUS.pill, padding: '8px 16px 8px 12px',
          fontSize: 13, cursor: 'pointer', marginBottom: 22,
          color: FARGER.tekstMid, fontWeight: 500,
          boxShadow: SHADOW.xs,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          letterSpacing: '-0.005em',
        }}>
        <span aria-hidden>←</span> Tilbake
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Nettverk</div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.025em' }}>Håndverkere</h2>
          <p style={{ color: FARGER.tekstMid, margin: '8px 0 0', fontSize: 14.5, fontWeight: 300, lineHeight: 1.55 }}>
            Bygg opp et nettverk av rørleggere, elektrikere, flisleggere osv. — i Spania og Norge.
          </p>
        </div>
        {redigerer === null && (
          <button onClick={startNy} className="knapp-hover-loft"
            style={{
              background: FARGER.mork, color: FARGER.creamLys, border: 'none',
              padding: '11px 22px', borderRadius: RADIUS.pill,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: SHADOW.sm,
              transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
            }}>
            + Ny håndverker
          </button>
        )}
      </div>

      {/* Skjema */}
      {redigerer !== null && (
        <div className="anim-fade-up" style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 24, marginBottom: 22, boxShadow: SHADOW.sm }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: FARGER.mork, marginBottom: 16 }}>
            {redigerer === 'ny' ? '➕ Ny håndverker' : '✏️ Rediger håndverker'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <Felt lbl="Navn *">
              <input value={skjema.navn || ''} onChange={e => setSkjema({ ...skjema, navn: e.target.value })} style={inputStil} placeholder="Fornavn etternavn" />
            </Felt>
            <Felt lbl="Firma (valgfri)">
              <input value={skjema.firma || ''} onChange={e => setSkjema({ ...skjema, firma: e.target.value || null })} style={inputStil} />
            </Felt>
            <Felt lbl="Område">
              <input value={skjema.omrade || ''} onChange={e => setSkjema({ ...skjema, omrade: e.target.value || null })} style={inputStil} placeholder="Marbella, Estepona, Bergen…" />
            </Felt>
            <Felt lbl="Foretrukket språk">
              <select value={skjema.sprak || 'es'} onChange={e => setSkjema({ ...skjema, sprak: e.target.value as 'no' | 'en' | 'es' })} style={inputStil}>
                <option value="es">🇪🇸 Spansk</option>
                <option value="en">🇬🇧 Engelsk</option>
                <option value="no">🇳🇴 Norsk</option>
              </select>
            </Felt>
          </div>

          <Felt lbl="Fag (kan velge flere) *">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {ALLE_FAG.map(f => {
                const valgt = (skjema.fag || []).includes(f)
                return (
                  <button key={f} type="button" onClick={() => toggleFag(f)}
                    style={{
                      background: valgt ? FARGER.mork : FARGER.hvit,
                      color: valgt ? FARGER.creamLys : FARGER.tekstMid,
                      border: `1px solid ${valgt ? FARGER.mork : FARGER.kantUltralys}`,
                      borderRadius: RADIUS.pill, padding: '7px 14px', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer',
                      letterSpacing: '-0.005em',
                      transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
                    }}>
                    {HANDVERKER_FAG_ETIKETT[f]}
                  </button>
                )
              })}
            </div>
          </Felt>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14, marginBottom: 14 }}>
            <Felt lbl="Telefon">
              <input value={skjema.telefon || ''} onChange={e => setSkjema({ ...skjema, telefon: e.target.value || null })} style={inputStil} placeholder="+34 6XX XX XX XX" />
            </Felt>
            <Felt lbl="WhatsApp (valgfri)">
              <input value={skjema.whatsapp || ''} onChange={e => setSkjema({ ...skjema, whatsapp: e.target.value || null })} style={inputStil} placeholder="+34 6XX XX XX XX" />
            </Felt>
            <Felt lbl="E-post">
              <input type="email" value={skjema.epost || ''} onChange={e => setSkjema({ ...skjema, epost: e.target.value || null })} style={inputStil} />
            </Felt>
            <Felt lbl="Timepris (EUR, valgfri)">
              <input type="number" step="1" value={skjema.timepris_eur ?? ''} onChange={e => setSkjema({ ...skjema, timepris_eur: e.target.value === '' ? null : Number(e.target.value) })} style={inputStil} />
            </Felt>
            <Felt lbl="Evaluering (1-5 stjerner)">
              <div style={{ display: 'flex', gap: 4, paddingTop: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setSkjema({ ...skjema, evaluering: skjema.evaluering === n ? null : n })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 0, color: (skjema.evaluering || 0) >= n ? '#f5b400' : FARGER.kantLys }}>
                    ★
                  </button>
                ))}
              </div>
            </Felt>
          </div>

          <Felt lbl="Notat (valgfri)">
            <textarea value={skjema.notat || ''} onChange={e => setSkjema({ ...skjema, notat: e.target.value || null })} rows={2}
              style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Spesialitet, referanser, prosjekter jobbet på før osv." />
          </Felt>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: FARGER.tekstMid, cursor: 'pointer' }}>
            <input type="checkbox" checked={skjema.aktiv !== false} onChange={e => setSkjema({ ...skjema, aktiv: e.target.checked })} />
            <span>Aktiv (vises i nettverket — fjern haken for å skjule uten å slette)</span>
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={lagre} disabled={lagrer} className="knapp-hover-loft"
              style={{
                background: lagrer ? FARGER.tekstLys : FARGER.mork, color: FARGER.creamLys,
                border: 'none', padding: '11px 22px', borderRadius: RADIUS.pill,
                fontSize: 13, fontWeight: 600, cursor: lagrer ? 'wait' : 'pointer',
                letterSpacing: '-0.005em',
                boxShadow: lagrer ? 'none' : SHADOW.sm,
              }}>
              {lagrer ? '⏳' : '💾 Lagre'}
            </button>
            <button onClick={lukk} disabled={lagrer}
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

      {/* Filter */}
      {liste.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterFag} onChange={e => setFilterFag(e.target.value as 'alle' | HandverkerFag)} style={{ ...inputStil, width: 'auto', flex: '0 0 auto' }}>
            <option value="alle">Alle fag</option>
            {ALLE_FAG.filter(f => liste.some(h => h.fag.includes(f))).map(f => (
              <option key={f} value={f}>{HANDVERKER_FAG_ETIKETT[f]}</option>
            ))}
          </select>
          {omrader.length > 0 && (
            <select value={filterOmrade} onChange={e => setFilterOmrade(e.target.value)} style={{ ...inputStil, width: 'auto', flex: '0 0 auto' }}>
              <option value="alle">Alle områder</option>
              {omrader.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: FARGER.tekstMid, cursor: 'pointer' }}>
            <input type="checkbox" checked={visInaktive} onChange={e => setVisInaktive(e.target.checked)} />
            <span>Vis inaktive</span>
          </label>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: FARGER.tekstLys }}>{filtrert.length} av {liste.length}</span>
        </div>
      )}

      {laster && <div style={{ textAlign: 'center', padding: 40, color: FARGER.tekstLys }}>⏳ Laster…</div>}

      {!laster && liste.length === 0 && (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔧</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Nettverket er tomt</div>
          <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 6 }}>
            Trykk «+ Ny håndverker» for å legge til den første kontakten.
          </div>
        </div>
      )}

      {!laster && liste.length > 0 && filtrert.length === 0 && (
        <div style={{ fontSize: 13, color: FARGER.tekstLys, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
          Ingen treff i filteret.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
        {filtrert.map(h => <HandverkerKort key={h.id} h={h}
          onRediger={() => startRediger(h)}
          onToggleAktiv={() => toggleAktiv(h)}
          onSlett={() => slett(h)} />)}
      </div>
    </div>
  )
}

function HandverkerKort({ h, onRediger, onToggleAktiv, onSlett }: {
  h: Handverker
  onRediger: () => void
  onToggleAktiv: () => void
  onSlett: () => void
}) {
  return (
    <div className="kort-loft" style={{
      background: FARGER.hvit,
      border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg, padding: 18, opacity: h.aktiv ? 1 : 0.6,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.015em' }}>
            {h.navn}
          </div>
          <div style={{ fontSize: 11.5, color: FARGER.tekstLys, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {h.firma && <span>{h.firma}</span>}
            {h.omrade && <span>· 📍 {h.omrade}</span>}
            <span>· {SPRAK_ETIKETT[h.sprak]}</span>
          </div>
        </div>
        {!h.aktiv && (
          <span style={{ background: FARGER.flateMid, color: FARGER.tekstMid, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: RADIUS.pill, letterSpacing: '0.06em' }}>
            INAKTIV
          </span>
        )}
        {h.evaluering && (
          <span style={{ fontSize: 12, color: '#f5b400', whiteSpace: 'nowrap' }}>
            {'★'.repeat(h.evaluering)}<span style={{ color: FARGER.kantUltralys }}>{'★'.repeat(5 - h.evaluering)}</span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {h.fag.map(f => (
          <span key={f} style={{ background: FARGER.flateLys, color: FARGER.tekstMid, padding: '3px 10px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 600 }}>
            {HANDVERKER_FAG_ETIKETT[f as HandverkerFag] || f}
          </span>
        ))}
      </div>

      {(h.telefon || h.epost || h.whatsapp) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: FARGER.mork, marginBottom: 10 }}>
          {h.telefon && <a href={`tel:${h.telefon}`} style={{ color: FARGER.mork, textDecoration: 'none' }}>📱 {h.telefon}</a>}
          {h.whatsapp && (
            <a href={`https://wa.me/${h.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#25d366', textDecoration: 'none' }}>
              💬 WhatsApp: {h.whatsapp}
            </a>
          )}
          {h.epost && <a href={`mailto:${h.epost}`} style={{ color: FARGER.mork, textDecoration: 'none' }}>✉️ {h.epost}</a>}
        </div>
      )}

      {typeof h.timepris_eur === 'number' && h.timepris_eur > 0 && (
        <div style={{ fontSize: 12, color: FARGER.tekstMid, marginBottom: 8 }}>
          Timepris: <strong>{h.timepris_eur}€</strong>
        </div>
      )}

      {h.notat && <div style={{ fontSize: 12, color: FARGER.tekstMid, fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>{h.notat}</div>}

      <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${FARGER.kantUltralys}`, paddingTop: 12 }}>
        <button onClick={onRediger}
          style={{ flex: 1, background: FARGER.flateLys, color: FARGER.tekstMid, border: 'none', padding: '8px 12px', borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.005em' }}>
          ✏️ Rediger
        </button>
        <button onClick={onToggleAktiv}
          style={{ background: FARGER.flateLys, color: FARGER.tekstMid, border: 'none', padding: '8px 12px', borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.005em' }}>
          {h.aktiv ? '🚫 Skjul' : '✓ Aktiver'}
        </button>
        <button onClick={onSlett}
          style={{ background: FARGER.feilBg, color: FARGER.feil, border: 'none', padding: '8px 12px', borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          🗑
        </button>
      </div>
    </div>
  )
}

function Felt({ lbl, children }: { lbl: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</label>
      {children}
    </div>
  )
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
