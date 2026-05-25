'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { fmtEur } from '../lib/format'
import { HANDVERKER_FAG_ETIKETT, type Handverker, type HandverkerFag, type Tilbudsforesporsel } from '../types'

const STATUS_VALG: Array<{ id: Tilbudsforesporsel['status']; lbl: string; bg: string; tekst: string }> = [
  { id: 'utkast',  lbl: 'Utkast',           bg: '#f0ede5', tekst: '#5a6171' },
  { id: 'sendt',   lbl: 'Sendt',            bg: '#faf7ee', tekst: '#7a4a08' },
  { id: 'svart',   lbl: 'Svart',            bg: '#fff8e1', tekst: '#7a4a08' },
  { id: 'avtalt',  lbl: 'Avtalt',           bg: '#e8f5ed', tekst: '#1a4d2b' },
  { id: 'avvist',  lbl: 'Avvist',           bg: '#fde8ec', tekst: '#7a0c1e' },
  { id: 'utlopt',  lbl: 'Utløpt',           bg: '#f0ede5', tekst: '#5a6171' },
]

const fmtDato = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

type Props = { prosjektId: string }

export function TilbudHistorikk({ prosjektId }: Props) {
  const [rader, setRader] = useState<Tilbudsforesporsel[]>([])
  const [handverkere, setHandverkere] = useState<Record<string, Handverker>>({})
  const [laster, setLaster] = useState(true)
  const [utvidet, setUtvidet] = useState<string | null>(null)
  const [filter, setFilter] = useState<'alle' | Tilbudsforesporsel['status']>('alle')

  const hent = useCallback(async () => {
    setLaster(true)
    const { data: tRader } = await supabase
      .from('tilbudsforesporsler')
      .select('*')
      .eq('prosjekt_id', prosjektId)
      .order('opprettet', { ascending: false })
    const liste = (tRader || []) as Tilbudsforesporsel[]
    setRader(liste)

    // Hent håndverkere som er involvert
    const hIds = Array.from(new Set(liste.map(r => r.handverker_id)))
    if (hIds.length > 0) {
      const { data: hRader } = await supabase.from('handverkere').select('*').in('id', hIds)
      const map: Record<string, Handverker> = {}
      for (const h of (hRader || []) as Handverker[]) map[h.id] = h
      setHandverkere(map)
    } else {
      setHandverkere({})
    }
    setLaster(false)
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  async function oppdaterStatus(id: string, status: Tilbudsforesporsel['status']) {
    setRader(r => r.map(x => x.id === id ? { ...x, status } : x))
    const { error } = await supabase.from('tilbudsforesporsler').update({ status }).eq('id', id)
    if (error) { visToast('Kunne ikke endre status', 'feil', 3500); void hent() }
  }

  async function oppdaterFelt(id: string, felt: Partial<Tilbudsforesporsel>) {
    setRader(r => r.map(x => x.id === id ? { ...x, ...felt } : x))
    const { error } = await supabase.from('tilbudsforesporsler').update(felt).eq('id', id)
    if (error) { visToast('Kunne ikke lagre', 'feil', 3500); void hent() }
  }

  async function slett(id: string) {
    if (!confirm('Slette denne forespørselen? Historikken blir borte.')) return
    const { error } = await supabase.from('tilbudsforesporsler').delete().eq('id', id)
    if (error) { visToast('Kunne ikke slette: ' + error.message, 'feil', 4000); return }
    visToast('Slettet', 'suksess', 2000)
    await hent()
  }

  const filtrert = filter === 'alle' ? rader : rader.filter(r => r.status === filter)

  // Aggregater
  const statusTeller: Record<string, number> = {}
  for (const r of rader) statusTeller[r.status] = (statusTeller[r.status] || 0) + 1
  const sumTilbud = rader.filter(r => r.tilbud_belop_eur).reduce((s, r) => s + (r.tilbud_belop_eur || 0), 0)

  if (laster) return <div style={{ textAlign: 'center', padding: 30, color: FARGER.tekstLys }}>⏳ Laster…</div>

  if (rader.length === 0) {
    return (
      <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 40, textAlign: 'center', color: FARGER.tekstMid }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>📤</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Ingen tilbudsforespørsler ennå</div>
        <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>
          Bruk «📤 Send tilbudsforespørsel»-knappen fra Bilder- eller Oppussings-fanen for å sende første.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Sammendrag */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Kort lbl="Sendt totalt" stor={String(rader.length)} />
        {statusTeller.svart > 0 && <Kort lbl="Svart" stor={String(statusTeller.svart)} farge={FARGER.advarsel} />}
        {statusTeller.avtalt > 0 && <Kort lbl="Avtalt" stor={String(statusTeller.avtalt)} farge={FARGER.suksess} />}
        {sumTilbud > 0 && <Kort lbl="Sum tilbud (EUR)" stor={fmtEur(sumTilbud)} />}
      </div>

      {/* Filter */}
      <div style={{
        display: 'inline-flex', gap: 4, flexWrap: 'wrap',
        background: FARGER.hvit, padding: 5, marginBottom: 14,
        borderRadius: RADIUS.pill,
        boxShadow: SHADOW.sm,
        border: `1px solid ${FARGER.kantUltralys}`,
      }}>
        <button onClick={() => setFilter('alle')}
          style={{
            background: filter === 'alle' ? FARGER.mork : 'transparent',
            color: filter === 'alle' ? FARGER.creamLys : FARGER.tekstMid,
            border: 'none', padding: '7px 14px', borderRadius: RADIUS.pill,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '-0.005em',
            transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
          }}>
          Alle ({rader.length})
        </button>
        {STATUS_VALG.map(s => {
          const antall = statusTeller[s.id] || 0
          if (antall === 0) return null
          return (
            <button key={s.id} onClick={() => setFilter(s.id)}
              style={{
                background: filter === s.id ? FARGER.mork : 'transparent',
                color: filter === s.id ? FARGER.creamLys : FARGER.tekstMid,
                border: 'none', padding: '7px 14px', borderRadius: RADIUS.pill,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '-0.005em',
                transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
              }}>
              {s.lbl} ({antall})
            </button>
          )
        })}
      </div>

      {filtrert.map(r => {
        const h = handverkere[r.handverker_id]
        const sv = STATUS_VALG.find(s => s.id === r.status) || STATUS_VALG[0]
        const erApen = utvidet === r.id
        return (
          <div key={r.id} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, marginBottom: 10, overflow: 'hidden', boxShadow: SHADOW.xs }}>
            <div onClick={() => setUtvidet(erApen ? null : r.id)}
              style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 12, padding: 14, cursor: 'pointer', alignItems: 'center' }}>
              <span style={{ background: sv.bg, color: sv.tekst, padding: '4px 12px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                {sv.lbl}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.tittel}
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2 }}>
                  {h ? `${h.navn}${h.firma ? ' / ' + h.firma : ''}` : '(håndverker slettet)'}
                  {r.sendt_tidspunkt && ` · sendt ${fmtDato(r.sendt_tidspunkt)}`}
                  {r.bilde_ids.length > 0 && ` · 📎 ${r.bilde_ids.length}`}
                </div>
              </div>
              {r.tilbud_belop_eur && (
                <span style={{ fontSize: 14, fontWeight: 700, color: FARGER.mork, whiteSpace: 'nowrap' }}>
                  {fmtEur(r.tilbud_belop_eur)}
                </span>
              )}
              <span style={{ fontSize: 11, color: FARGER.tekstLys }}>{erApen ? '▲' : '▼'}</span>
            </div>

            {erApen && (
              <div className="anim-fade-down" style={{ borderTop: `1px solid ${FARGER.kantUltralys}`, padding: 18, background: FARGER.creamLys }}>
                {/* Håndverker-info */}
                {h && (
                  <div style={{ marginBottom: 12, fontSize: 12, color: FARGER.tekstMid }}>
                    <strong>{h.navn}</strong>{h.firma ? ` · ${h.firma}` : ''}
                    {h.fag.length > 0 && <span> · {h.fag.map(f => HANDVERKER_FAG_ETIKETT[f as HandverkerFag] || f).join(', ')}</span>}
                    <div style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {h.telefon && <a href={`tel:${h.telefon}`} style={{ color: FARGER.mork, textDecoration: 'none' }}>📱 {h.telefon}</a>}
                      {h.whatsapp && <a href={`https://wa.me/${h.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#25d366', textDecoration: 'none' }}>💬 WhatsApp</a>}
                      {h.epost && <a href={`mailto:${h.epost}`} style={{ color: FARGER.mork, textDecoration: 'none' }}>✉️ {h.epost}</a>}
                    </div>
                  </div>
                )}

                {/* Status-velger og felter */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <Felt lbl="Status">
                    <select value={r.status} onChange={e => oppdaterStatus(r.id, e.target.value as Tilbudsforesporsel['status'])} style={inputStil}>
                      {STATUS_VALG.map(s => <option key={s.id} value={s.id}>{s.lbl}</option>)}
                    </select>
                  </Felt>
                  <Felt lbl="Tilbudsbeløp (EUR)">
                    <input type="number" defaultValue={r.tilbud_belop_eur ?? ''} key={`belop-${r.id}-${r.tilbud_belop_eur ?? 'null'}`}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        oppdaterFelt(r.id, { tilbud_belop_eur: v === '' ? null : Number(v) })
                      }}
                      style={inputStil} />
                  </Felt>
                  <Felt lbl="Oppfølging">
                    <input type="date" defaultValue={r.oppfolging_dato || ''} key={`opp-${r.id}-${r.oppfolging_dato || ''}`}
                      onBlur={e => oppdaterFelt(r.id, { oppfolging_dato: e.target.value || null })}
                      style={inputStil} />
                  </Felt>
                </div>

                {/* Beskrivelse */}
                <div style={{ marginBottom: 10 }}>
                  <Felt lbl="Beskrivelse (norsk)">
                    <div style={{ background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 10, fontSize: 12, color: FARGER.mork, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {r.beskrivelse_no}
                    </div>
                  </Felt>
                </div>
                {r.beskrivelse_sendt && r.beskrivelse_sendt !== r.beskrivelse_no && (
                  <div style={{ marginBottom: 10 }}>
                    <Felt lbl={`Sendt versjon (${r.sendt_sprak || '?'})`}>
                      <div style={{ background: '#fff', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 10, fontSize: 12, color: FARGER.tekstMid, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {r.beskrivelse_sendt}
                      </div>
                    </Felt>
                  </div>
                )}

                {/* Intern notat */}
                <Felt lbl="Internt notat (svar fra håndverker, vilkår, osv.)">
                  <textarea defaultValue={r.intern_notat || ''} key={`notat-${r.id}-${r.intern_notat || ''}`}
                    onBlur={e => oppdaterFelt(r.id, { intern_notat: e.target.value || null })}
                    rows={2}
                    style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />
                </Felt>

                {/* Feilmelding ved feilet sending */}
                {r.feilmelding && (
                  <div style={{ marginTop: 10, background: FARGER.feilBg, border: `1px solid ${FARGER.feil}66`, borderRadius: RADIUS.sm, padding: 10, fontSize: 11, color: '#7a0c1e' }}>
                    ❌ E-postsending feilet: {r.feilmelding}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => slett(r.id)}
                    style={{
                      background: FARGER.feilBg, color: FARGER.feil, border: 'none',
                      padding: '8px 16px', borderRadius: RADIUS.pill,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      letterSpacing: '-0.005em',
                    }}>
                    🗑 Slett forespørsel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
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

function Kort({ lbl, stor, farge }: { lbl: string; stor: string; farge?: string }) {
  return (
    <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 14, boxShadow: SHADOW.sm }}>
      <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: farge || FARGER.mork, letterSpacing: '-0.02em' }}>{stor}</div>
    </div>
  )
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: `1px solid ${FARGER.kant}`, borderRadius: RADIUS.md, background: FARGER.hvit,
  boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none',
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
}
