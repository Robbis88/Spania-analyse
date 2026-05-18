'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import {
  STORRELSE_ETIKETT, TJENESTE_ETIKETT,
  BESTILLING_STATUS_ETIKETT,
  SJEKK_KATEGORIER, STATUS_FARGE,
  type BestillingStatus, type Storrelse, type TjenesteType,
  type Sjekkliste, type SjekkpunktStatus,
} from '../lib/inspeksjon'

type Bestilling = {
  id: string
  opprettet: string
  kunde_navn: string
  kunde_epost: string
  kunde_telefon: string | null
  adresse: string
  kompleks: string | null
  leilighet_nr: string | null
  storrelse: Storrelse
  bra_m2: number | null
  tjeneste_type: TjenesteType
  pris_eur: number
  onsket_dato: string | null
  fleksibel: boolean
  melding: string | null
  status: BestillingStatus
  planlagt_tidspunkt: string | null
  intern_notat: string | null
}

type Rapport = {
  id: string
  bestilling_id: string
  opprettet: string
  inspektor: string
  besokt_dato: string
  sjekkliste: Sjekkliste
  bilde_stier: string[]
  oppsummering: string | null
  anbefalinger: string | null
  intern_notat: string | null
}

type Tilbud = {
  id: string
  rapport_id: string
  bestilling_id: string
  opprettet: string
  tittel: string
  beskrivelse: string
  pris_eur: number
  estimert_dager: number | null
  status: 'utkast' | 'sendt' | 'akseptert' | 'avvist' | 'utfort'
  sendt_tidspunkt: string | null
}

const nyId = () => Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)

const fmtDato = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function Inspeksjon({ onTilbake }: { onTilbake: () => void }) {
  const [bestillinger, setBestillinger] = useState<Bestilling[]>([])
  const [rapporter, setRapporter] = useState<Record<string, Rapport>>({})  // by bestilling_id
  const [tilbud, setTilbud] = useState<Record<string, Tilbud[]>>({})  // by rapport_id
  const [laster, setLaster] = useState(true)
  const [filter, setFilter] = useState<'alle' | BestillingStatus>('ny')
  const [utvidet, setUtvidet] = useState<string | null>(null)
  const [rapportFor, setRapportFor] = useState<string | null>(null)  // bestilling_id
  const [tilbudFor, setTilbudFor] = useState<string | null>(null)    // bestilling_id

  const aktivBruker = (typeof window !== 'undefined' ? hentAktivBruker() : null) || 'inspektor'

  const hent = useCallback(async () => {
    setLaster(true)
    const [bRes, rRes, tRes] = await Promise.all([
      supabase.from('inspeksjon_bestillinger').select('*').order('opprettet', { ascending: false }),
      supabase.from('inspeksjon_rapporter').select('*').order('opprettet', { ascending: false }),
      supabase.from('inspeksjon_tilbud').select('*').order('opprettet', { ascending: false }),
    ])
    setBestillinger((bRes.data || []) as Bestilling[])
    const rMap: Record<string, Rapport> = {}
    for (const r of (rRes.data || []) as Rapport[]) rMap[r.bestilling_id] = r
    setRapporter(rMap)
    const tMap: Record<string, Tilbud[]> = {}
    for (const t of (tRes.data || []) as Tilbud[]) {
      if (!tMap[t.rapport_id]) tMap[t.rapport_id] = []
      tMap[t.rapport_id].push(t)
    }
    setTilbud(tMap)
    setLaster(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void hent()
  }, [hent])

  async function settStatus(id: string, status: BestillingStatus, ekstra: Partial<Bestilling> = {}) {
    setBestillinger(b => b.map(x => x.id === id ? { ...x, status, ...ekstra } : x))
    const { error } = await supabase.from('inspeksjon_bestillinger').update({ status, ...ekstra }).eq('id', id)
    if (error) { visToast('Kunne ikke oppdatere status', 'feil'); void hent() }
    else visToast(`Status: ${BESTILLING_STATUS_ETIKETT[status].lbl}`, 'suksess', 2000)
  }

  async function settPlanlagt(b: Bestilling) {
    const dato = prompt('Planlagt tidspunkt (ÅÅÅÅ-MM-DD HH:MM)', b.planlagt_tidspunkt?.slice(0, 16).replace('T', ' ') || '')
    if (!dato) return
    const iso = new Date(dato.replace(' ', 'T')).toISOString()
    void settStatus(b.id, 'planlagt', { planlagt_tidspunkt: iso })
  }

  const filtrert = useMemo(
    () => filter === 'alle' ? bestillinger : bestillinger.filter(b => b.status === filter),
    [bestillinger, filter],
  )

  const statusTeller = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of bestillinger) map[b.status] = (map[b.status] || 0) + 1
    return map
  }, [bestillinger])

  return (
    <div>
      <button onClick={onTilbake} className="nav-lenke" style={{
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

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Tjeneste — separat fra portalen</div>
        <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 300, margin: 0, color: FARGER.mork, letterSpacing: '-0.025em' }}>🔍 Boliginspeksjon</h2>
        <p style={{ color: FARGER.tekstMid, margin: '8px 0 0', fontSize: 14.5, fontWeight: 300, lineHeight: 1.55 }}>
          Bestillinger fra kunder, planlagte besøk, rapporter og utbedrings-tilbud.
        </p>
        <a href="/inspeksjon" target="_blank" rel="noreferrer" className="nav-lenke" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginTop: 10, fontSize: 12, color: FARGER.tekstMid,
          textDecoration: 'none', fontWeight: 500, letterSpacing: '-0.005em',
        }}>
          ↗ Åpne kundens bestillings-side
        </a>
      </div>

      {/* Status-teller-kort */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
        {(['ny', 'planlagt', 'utfort', 'tilbud_sendt'] as BestillingStatus[]).map(s => {
          const f = BESTILLING_STATUS_ETIKETT[s]
          const antall = statusTeller[s] || 0
          return (
            <button key={s} onClick={() => setFilter(s)}
              className="kort-loft"
              style={{
                background: filter === s ? FARGER.mork : FARGER.hvit,
                color: filter === s ? FARGER.creamLys : FARGER.mork,
                border: `1px solid ${filter === s ? FARGER.mork : FARGER.kantUltralys}`,
                borderRadius: RADIUS.lg, padding: 16,
                boxShadow: SHADOW.sm, cursor: 'pointer',
                textAlign: 'left',
              }}>
              <div style={{ fontSize: 11, color: filter === s ? `${FARGER.creamLys}99` : f.tekst, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{f.lbl}</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{antall}</div>
            </button>
          )
        })}
      </div>

      {/* Filter */}
      <div style={{
        display: 'inline-flex', gap: 4, flexWrap: 'wrap',
        background: FARGER.hvit, padding: 5, marginBottom: 18,
        borderRadius: RADIUS.pill,
        boxShadow: SHADOW.sm,
        border: `1px solid ${FARGER.kantUltralys}`,
      }}>
        <button onClick={() => setFilter('alle')}
          style={pillTab(filter === 'alle')}>Alle ({bestillinger.length})</button>
        {(['ny', 'planlagt', 'utfort', 'tilbud_sendt', 'avsluttet', 'avlyst'] as BestillingStatus[]).map(s => (
          <button key={s} onClick={() => setFilter(s)} style={pillTab(filter === s)}>
            {BESTILLING_STATUS_ETIKETT[s].lbl} ({statusTeller[s] || 0})
          </button>
        ))}
      </div>

      {laster && (
        <div>
          {[0, 1].map(i => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 14, boxShadow: SHADOW.sm }}>
              <div className="skimmer" style={{ height: 18, width: '40%', marginBottom: 14, borderRadius: 4 }} />
              <div className="skimmer" style={{ height: 50, borderRadius: RADIUS.md }} />
            </div>
          ))}
        </div>
      )}

      {!laster && filtrert.length === 0 && (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 48, textAlign: 'center', color: FARGER.tekstMid }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Ingen bestillinger i dette filteret</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Kunder kan booke på <code>/inspeksjon</code>.</div>
        </div>
      )}

      {!laster && filtrert.map((b, i) => {
        const rapport = rapporter[b.id]
        const tilbudListe = rapport ? (tilbud[rapport.id] || []) : []
        const f = BESTILLING_STATUS_ETIKETT[b.status]
        const apen = utvidet === b.id
        return (
          <div key={b.id} className="anim-fade-up" style={{
            background: FARGER.hvit,
            border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.lg, padding: 22, marginBottom: 14,
            boxShadow: SHADOW.sm,
            animationDelay: `${Math.min(i, 8) * 40}ms`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.015em' }}>{b.kunde_navn}</div>
                <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 4 }}>
                  📍 {b.adresse}{b.leilighet_nr ? ` · ${b.leilighet_nr}` : ''}{b.kompleks ? ` · ${b.kompleks}` : ''}
                </div>
                <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 4 }}>
                  {STORRELSE_ETIKETT[b.storrelse]} · {TJENESTE_ETIKETT[b.tjeneste_type]} · €{b.pris_eur}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ background: f.bg, color: f.tekst, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: RADIUS.pill, letterSpacing: '0.02em' }}>
                  {f.lbl}
                </span>
                <span style={{ fontSize: 11, color: FARGER.tekstLys }}>
                  {b.planlagt_tidspunkt ? `🗓 ${new Date(b.planlagt_tidspunkt).toLocaleString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : `Bestilt ${fmtDato(b.opprettet)}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setUtvidet(apen ? null : b.id)} style={lenkeTab}>
                {apen ? '▲ Skjul detaljer' : '▼ Vis detaljer'}
              </button>
              {b.status === 'ny' && (
                <button onClick={() => settPlanlagt(b)} style={primerKnapp}>🗓 Plan­legg besøk</button>
              )}
              {b.status === 'planlagt' && (
                <button onClick={() => setRapportFor(b.id)} style={primerKnapp}>📋 Lag rapport</button>
              )}
              {rapport && b.status !== 'avlyst' && (
                <>
                  <button onClick={() => setRapportFor(b.id)} style={sekundærKnapp}>📋 Rediger rapport</button>
                  <button onClick={() => setTilbudFor(b.id)} style={primerKnapp}>📧 Skriv tilbud</button>
                </>
              )}
              <button onClick={() => settStatus(b.id, 'avlyst')} style={faretab}>Avlys</button>
            </div>

            {apen && (
              <div className="anim-fade-down" style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${FARGER.kantUltralys}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginBottom: 14 }}>
                  <Detalj lbl="E-post" val={<a href={`mailto:${b.kunde_epost}`} style={{ color: FARGER.mork }}>{b.kunde_epost}</a>} />
                  {b.kunde_telefon && <Detalj lbl="Telefon" val={<a href={`tel:${b.kunde_telefon}`} style={{ color: FARGER.mork }}>{b.kunde_telefon}</a>} />}
                  {b.bra_m2 && <Detalj lbl="BRA" val={`${b.bra_m2} m²`} />}
                  {b.onsket_dato && <Detalj lbl="Ønsket dato" val={fmtDato(b.onsket_dato)} />}
                  <Detalj lbl="Fleksibel" val={b.fleksibel ? 'Ja' : 'Nei'} />
                </div>
                {b.melding && (
                  <div style={{ background: FARGER.flateLys, borderRadius: RADIUS.md, padding: 14, marginTop: 8, borderLeft: `3px solid ${FARGER.gull}` }}>
                    <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Kundens melding</div>
                    <div style={{ fontSize: 13.5, color: FARGER.tekstMid, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{b.melding}</div>
                  </div>
                )}

                {rapport && (
                  <div style={{ marginTop: 16, background: '#e8f5ed', border: `1px solid #2D7D4633`, borderRadius: RADIUS.md, padding: 14 }}>
                    <div style={{ fontSize: 11, color: '#1a4d2b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Rapport ferdig</div>
                    <div style={{ fontSize: 13, color: FARGER.tekstMid }}>
                      Besøkt {fmtDato(rapport.besokt_dato)} av {rapport.inspektor}.
                      {tilbudListe.length > 0 && <span> {tilbudListe.length} tilbud knyttet.</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {rapportFor && (
        <RapportModal
          bestilling={bestillinger.find(x => x.id === rapportFor)!}
          eksisterende={rapporter[rapportFor]}
          inspektor={aktivBruker}
          onLukk={() => setRapportFor(null)}
          onLagret={async () => { setRapportFor(null); await hent() }}
        />
      )}

      {tilbudFor && (() => {
        const b = bestillinger.find(x => x.id === tilbudFor)!
        const r = rapporter[tilbudFor]
        if (!r) return null
        return (
          <TilbudModal
            bestilling={b}
            rapport={r}
            onLukk={() => setTilbudFor(null)}
            onLagret={async () => { setTilbudFor(null); await hent() }}
          />
        )
      })()}
    </div>
  )
}

// ============================================================================
// RAPPORT-MODAL — fyll ut sjekkliste, oppsummering og anbefalinger
// ============================================================================

function RapportModal({
  bestilling, eksisterende, inspektor, onLukk, onLagret,
}: {
  bestilling: Bestilling
  eksisterende: Rapport | undefined
  inspektor: string
  onLukk: () => void
  onLagret: () => Promise<void>
}) {
  const [besokt, setBesokt] = useState(eksisterende?.besokt_dato || new Date().toISOString().slice(0, 10))
  const [sjekkliste, setSjekkliste] = useState<Sjekkliste>(eksisterende?.sjekkliste || {})
  const [oppsummering, setOppsummering] = useState(eksisterende?.oppsummering || '')
  const [anbefalinger, setAnbefalinger] = useState(eksisterende?.anbefalinger || '')
  const [internNotat, setInternNotat] = useState(eksisterende?.intern_notat || '')
  const [lagrer, setLagrer] = useState(false)

  function settSjekk(felt: string, status: SjekkpunktStatus, notat?: string) {
    setSjekkliste(s => ({ ...s, [felt]: { status, notat: notat ?? s[felt]?.notat } }))
  }

  async function lagre() {
    setLagrer(true)
    try {
      if (eksisterende) {
        const { error } = await supabase.from('inspeksjon_rapporter').update({
          besokt_dato: besokt, sjekkliste, oppsummering, anbefalinger, intern_notat: internNotat,
        }).eq('id', eksisterende.id)
        if (error) { visToast('Kunne ikke oppdatere rapport', 'feil'); return }
      } else {
        const id = nyId()
        const { error } = await supabase.from('inspeksjon_rapporter').insert([{
          id, bestilling_id: bestilling.id, inspektor,
          besokt_dato: besokt, sjekkliste, oppsummering, anbefalinger, intern_notat: internNotat,
        }])
        if (error) { visToast('Kunne ikke lagre rapport', 'feil'); return }
        await supabase.from('inspeksjon_bestillinger').update({ status: 'utfort' }).eq('id', bestilling.id)
      }
      visToast('Rapport lagret', 'suksess', 2000)
      await onLagret()
    } finally {
      setLagrer(false)
    }
  }

  const merknader = Object.values(sjekkliste).filter(v => v.status === 'merknad').length
  const kritiske = Object.values(sjekkliste).filter(v => v.status === 'kritisk').length

  return (
    <div onClick={onLukk} className="anim-fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.45)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 20, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in" style={{
        background: FARGER.creamLys, borderRadius: RADIUS.xl, maxWidth: 920, width: '100%',
        padding: 'clamp(24px, 4vw, 36px)', marginTop: 20, marginBottom: 40, boxShadow: SHADOW.xl,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>📋 Inspeksjonsrapport</div>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>
              {bestilling.kunde_navn}
            </h2>
            <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 6 }}>
              📍 {bestilling.adresse}{bestilling.leilighet_nr ? ` · ${bestilling.leilighet_nr}` : ''}
            </div>
          </div>
          <button onClick={onLukk} aria-label="Lukk" style={lukkKnapp}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          {merknader > 0 && (
            <span style={{ background: '#fff8e1', color: '#7a4a08', padding: '6px 14px', borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>
              ⚠️ {merknader} merknader
            </span>
          )}
          {kritiske > 0 && (
            <span style={{ background: FARGER.feilBg, color: '#7a0c1e', padding: '6px 14px', borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>
              ⛔ {kritiske} kritiske funn
            </span>
          )}
        </div>

        <Felt lbl="Besøkt dato">
          <input type="date" value={besokt} onChange={e => setBesokt(e.target.value)} style={{ ...inputStil, maxWidth: 220 }} />
        </Felt>

        {/* SJEKKLISTE */}
        <div style={{ marginTop: 18 }}>
          {SJEKK_KATEGORIER.map(kat => (
            <div key={kat.id} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 18, marginBottom: 12, boxShadow: SHADOW.xs }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, marginBottom: 12, letterSpacing: '-0.005em' }}>{kat.lbl}</div>
              {kat.felter.map(felt => {
                const key = `${kat.id}.${felt}`
                const v = sjekkliste[key] || { status: 'ok' as SjekkpunktStatus }
                return (
                  <div key={felt} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${FARGER.kantUltralys}` }}>
                    <div style={{ fontSize: 13.5, color: FARGER.mork }}>{felt}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['ok', 'merknad', 'kritisk', 'ikke_aktuelt'] as SjekkpunktStatus[]).map(st => {
                        const aktiv = v.status === st
                        const stf = STATUS_FARGE[st]
                        return (
                          <button key={st} onClick={() => settSjekk(key, st)}
                            title={st}
                            style={{
                              background: aktiv ? stf.bg : 'transparent',
                              color: aktiv ? stf.tekst : FARGER.tekstLys,
                              border: `1px solid ${aktiv ? stf.tekst + '33' : FARGER.kantUltralys}`,
                              borderRadius: RADIUS.pill,
                              padding: '5px 10px',
                              fontSize: 13, fontWeight: 700,
                              cursor: 'pointer',
                              transition: `background ${MOTION.rask}`,
                            }}>
                            {stf.ikon}
                          </button>
                        )
                      })}
                    </div>
                    {(v.status === 'merknad' || v.status === 'kritisk') && (
                      <input
                        value={v.notat || ''}
                        onChange={e => settSjekk(key, v.status, e.target.value)}
                        placeholder="Beskriv funnet kort..."
                        style={{ ...inputStil, gridColumn: '1 / -1', marginTop: 4, fontSize: 13 }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <Felt lbl="Oppsummering (vises kunden)">
            <textarea value={oppsummering} onChange={e => setOppsummering(e.target.value)} rows={4}
              placeholder="F.eks. «Leiligheten er i god stand. Fant noe slitasje på fugemasse i dusjen og en mindre lekkasje under kjøkkenbenken som bør utbedres snart.»"
              style={{ ...inputStil, resize: 'vertical', minHeight: 90 }} />
          </Felt>
        </div>

        <div style={{ marginTop: 14 }}>
          <Felt lbl="Anbefalinger / prioritert handling (vises kunden)">
            <textarea value={anbefalinger} onChange={e => setAnbefalinger(e.target.value)} rows={4}
              placeholder={'1. Tett fugemasse i dusj (akutt — fare for fukt)\n2. Bytte slange under kjøkkenvask (innen 3 mnd)\n3. Olje terrasse-tre til neste år'}
              style={{ ...inputStil, resize: 'vertical', minHeight: 90, fontFamily: 'inherit' }} />
          </Felt>
        </div>

        <div style={{ marginTop: 14 }}>
          <Felt lbl="Internt notat (vises ikke kunden)">
            <textarea value={internNotat} onChange={e => setInternNotat(e.target.value)} rows={2}
              placeholder="Egen vurdering, adgangsinfo, neste-besøk..."
              style={{ ...inputStil, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }} />
          </Felt>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
          <button onClick={lagre} disabled={lagrer} className="knapp-hover-loft" style={{
            flex: 1, minWidth: 200,
            background: lagrer ? FARGER.tekstLys : FARGER.mork,
            color: FARGER.creamLys, border: 'none',
            padding: 14, borderRadius: RADIUS.pill,
            fontSize: 14, fontWeight: 600,
            cursor: lagrer ? 'wait' : 'pointer',
            letterSpacing: '-0.005em',
            boxShadow: lagrer ? 'none' : SHADOW.md,
          }}>
            {lagrer ? '⏳ Lagrer…' : eksisterende ? '💾 Oppdater rapport' : '💾 Lagre rapport og marker utført'}
          </button>
          <button onClick={onLukk} style={avbrytKnapp}>Avbryt</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// TILBUD-MODAL — utbedrings-tilbud fra rapport
// ============================================================================

function TilbudModal({
  bestilling, rapport, onLukk, onLagret,
}: {
  bestilling: Bestilling
  rapport: Rapport
  onLukk: () => void
  onLagret: () => Promise<void>
}) {
  const [tittel, setTittel] = useState('')
  const [beskrivelse, setBeskrivelse] = useState('')
  const [pris, setPris] = useState<string>('')
  const [dager, setDager] = useState<string>('')
  const [lagrer, setLagrer] = useState(false)

  async function lagreOgKopier() {
    if (!tittel.trim() || !beskrivelse.trim() || !pris) {
      visToast('Tittel, beskrivelse og pris må fylles inn', 'feil', 3000)
      return
    }
    setLagrer(true)
    try {
      const id = nyId()
      const prisN = Number(pris)
      const { error } = await supabase.from('inspeksjon_tilbud').insert([{
        id, rapport_id: rapport.id, bestilling_id: bestilling.id,
        tittel: tittel.trim(), beskrivelse: beskrivelse.trim(),
        pris_eur: prisN, estimert_dager: dager ? Number(dager) : null,
        status: 'sendt', sendt_tidspunkt: new Date().toISOString(),
      }])
      if (error) { visToast('Kunne ikke lagre tilbud: ' + error.message, 'feil', 4000); return }
      await supabase.from('inspeksjon_bestillinger').update({ status: 'tilbud_sendt' }).eq('id', bestilling.id)

      // Kopier som ferdig e-post til utklippstavle
      const emne = `Tilbud — ${tittel}`
      const kropp = `Hei ${bestilling.kunde_navn.split(' ')[0]},\n\nEtter inspeksjonen av ${bestilling.adresse}${bestilling.leilighet_nr ? `, ${bestilling.leilighet_nr}` : ''} sender jeg som avtalt tilbud på utbedringen.\n\n${tittel.toUpperCase()}\n${beskrivelse}\n\nPris: €${prisN}${dager ? `\nEstimert tid: ${dager} ${Number(dager) === 1 ? 'dag' : 'dager'}` : ''}\n\nGi beskjed om vi går videre, så avtaler vi tidspunkt.\n\nMvh,\nLeganger & Osvaag Eiendom`
      const fulltekst = `Til: ${bestilling.kunde_epost}\nEmne: ${emne}\n\n${kropp}`
      try {
        await navigator.clipboard.writeText(fulltekst)
        visToast('Tilbud lagret og kopiert til utklippstavle', 'suksess', 3500)
      } catch {
        visToast('Tilbud lagret. Kopiering til utklippstavle feilet — kopier manuelt.', 'suksess', 4000)
      }
      await onLagret()
    } finally {
      setLagrer(false)
    }
  }

  return (
    <div onClick={onLukk} className="anim-fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.45)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 20, overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in" style={{
        background: FARGER.creamLys, borderRadius: RADIUS.xl, maxWidth: 640, width: '100%',
        padding: 'clamp(24px, 4vw, 36px)', marginTop: 20, marginBottom: 40, boxShadow: SHADOW.xl,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>📧 Utbedrings-tilbud</div>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>
              Tilbud til {bestilling.kunde_navn.split(' ')[0]}
            </h2>
            <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 6 }}>
              {bestilling.kunde_epost}
            </div>
          </div>
          <button onClick={onLukk} aria-label="Lukk" style={lukkKnapp}>×</button>
        </div>

        <Felt lbl="Tittel">
          <input value={tittel} onChange={e => setTittel(e.target.value)} style={inputStil}
            placeholder="F.eks. «Fugemasse + slange under kjøkken»" />
        </Felt>

        <div style={{ marginTop: 14 }}>
          <Felt lbl="Beskrivelse">
            <textarea value={beskrivelse} onChange={e => setBeskrivelse(e.target.value)} rows={6}
              placeholder={'Beskriv jobben kort:\n• Hva som skal gjøres\n• Hvilke materialer er inkludert\n• Estimat på tidsbruk'}
              style={{ ...inputStil, resize: 'vertical', minHeight: 130 }} />
          </Felt>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <Felt lbl="Pris (€)">
            <input type="number" value={pris} onChange={e => setPris(e.target.value)} style={inputStil} placeholder="350" />
          </Felt>
          <Felt lbl="Estimerte dager">
            <input type="number" step="0.5" value={dager} onChange={e => setDager(e.target.value)} style={inputStil} placeholder="0.5" />
          </Felt>
        </div>

        <div style={{ marginTop: 16, padding: 14, background: FARGER.flateLys, borderRadius: RADIUS.md, border: `1px solid ${FARGER.kantUltralys}` }}>
          <div style={{ fontSize: 12, color: FARGER.tekstMid, lineHeight: 1.55 }}>
            💡 Når du lagrer, kopieres et ferdig formattert e-post-utkast (mottaker, emne og kropp) til utklippstavlen — lim inn i din vanlige e-postklient og send.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <button onClick={lagreOgKopier} disabled={lagrer} className="knapp-hover-loft" style={{
            flex: 1, minWidth: 200,
            background: lagrer ? FARGER.tekstLys : FARGER.mork,
            color: FARGER.creamLys, border: 'none',
            padding: 14, borderRadius: RADIUS.pill,
            fontSize: 14, fontWeight: 600,
            cursor: lagrer ? 'wait' : 'pointer',
            letterSpacing: '-0.005em',
            boxShadow: lagrer ? 'none' : SHADOW.md,
          }}>
            {lagrer ? '⏳ Lagrer…' : '📋 Lagre og kopier som e-post'}
          </button>
          <button onClick={onLukk} style={avbrytKnapp}>Avbryt</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SMÅ HELPERS
// ============================================================================

function Felt({ lbl, children }: { lbl: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 6, display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</label>
      {children}
    </div>
  )
}

function Detalj({ lbl, val }: { lbl: string; val: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: FARGER.tekstLys, marginBottom: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 13.5, color: FARGER.mork, letterSpacing: '-0.005em' }}>{val}</div>
    </div>
  )
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

const lukkKnapp: React.CSSProperties = {
  background: FARGER.flateLys, border: 'none',
  width: 36, height: 36, fontSize: 18, color: FARGER.tekstMid,
  cursor: 'pointer', lineHeight: 1, padding: 0,
  borderRadius: RADIUS.pill,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}

const avbrytKnapp: React.CSSProperties = {
  background: FARGER.hvit, color: FARGER.tekstMid,
  border: `1px solid ${FARGER.kantUltralys}`,
  padding: '14px 22px', borderRadius: RADIUS.pill,
  fontSize: 14, fontWeight: 500, cursor: 'pointer',
  letterSpacing: '-0.005em',
}

const primerKnapp: React.CSSProperties = {
  background: FARGER.mork, color: FARGER.creamLys, border: 'none',
  padding: '8px 16px', borderRadius: RADIUS.pill,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  letterSpacing: '-0.005em', boxShadow: SHADOW.sm,
}

const sekundærKnapp: React.CSSProperties = {
  background: FARGER.hvit, color: FARGER.tekstMid,
  border: `1px solid ${FARGER.kantUltralys}`,
  padding: '8px 16px', borderRadius: RADIUS.pill,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  letterSpacing: '-0.005em',
}

const faretab: React.CSSProperties = {
  background: FARGER.feilBg, color: FARGER.feil, border: 'none',
  padding: '8px 16px', borderRadius: RADIUS.pill,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
  letterSpacing: '-0.005em',
}

const lenkeTab: React.CSSProperties = {
  background: 'none', border: 'none',
  color: FARGER.tekstMid, padding: '8px 0',
  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  letterSpacing: '-0.005em', marginRight: 12,
}

function pillTab(aktiv: boolean): React.CSSProperties {
  return {
    background: aktiv ? FARGER.mork : 'transparent',
    color: aktiv ? FARGER.creamLys : FARGER.tekstMid,
    border: 'none', padding: '7px 14px', borderRadius: RADIUS.pill,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    letterSpacing: '-0.005em',
    transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
  }
}
