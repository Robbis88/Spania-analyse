'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  abonnement_rot_id: string | null
  kunde_token: string | null
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

const TILLATTE_BILDE_MIME = 'image/jpeg,image/png,image/webp,image/heic'

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
  const [visning, setVisning] = useState<'liste' | 'kalender'>('liste')
  const [kalenderMnd, setKalenderMnd] = useState(() => new Date())
  const [planleggFor, setPlanleggFor] = useState<string | null>(null)

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

  function settPlanlagt(b: Bestilling) {
    setPlanleggFor(b.id)
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

      {/* Visning-toggle: liste vs kalender */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', gap: 4,
          background: FARGER.hvit, padding: 5,
          borderRadius: RADIUS.pill, boxShadow: SHADOW.sm,
          border: `1px solid ${FARGER.kantUltralys}`,
        }}>
          <button onClick={() => setVisning('liste')} style={pillTab(visning === 'liste')}>📋 Liste</button>
          <button onClick={() => setVisning('kalender')} style={pillTab(visning === 'kalender')}>🗓 Kalender</button>
        </div>
        {visning === 'liste' && (
          <div style={{
            display: 'inline-flex', gap: 4, flexWrap: 'wrap',
            background: FARGER.hvit, padding: 5,
            borderRadius: RADIUS.pill, boxShadow: SHADOW.sm,
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
        )}
      </div>

      {visning === 'kalender' && (
        <KalenderVisning
          bestillinger={bestillinger}
          mnd={kalenderMnd}
          settMnd={setKalenderMnd}
          onKlikk={id => { setVisning('liste'); setUtvidet(id) }}
        />
      )}

      {visning === 'kalender' && (
        <KommendeAbonnementer
          bestillinger={bestillinger}
          rapporter={rapporter}
          onPlanlegg={async (kilde) => {
            // Lag ny bestilling for kilde-kunden basert på abonnementstype
            const id = nyId()
            const erKvartalsvis = kilde.tjeneste_type === 'kvartalsvis_grundig'
            const dagerFrem = erKvartalsvis ? 90 : 30
            const neste = new Date()
            neste.setDate(neste.getDate() + dagerFrem)

            const { error } = await supabase.from('inspeksjon_bestillinger').insert([{
              id,
              kunde_navn: kilde.kunde_navn, kunde_epost: kilde.kunde_epost,
              kunde_telefon: kilde.kunde_telefon, kunde_sprak: 'no',
              adresse: kilde.adresse, kompleks: kilde.kompleks, leilighet_nr: kilde.leilighet_nr,
              storrelse: kilde.storrelse, bra_m2: kilde.bra_m2,
              tjeneste_type: kilde.tjeneste_type, pris_eur: kilde.pris_eur,
              onsket_dato: neste.toISOString().slice(0, 10), fleksibel: true,
              status: 'ny',
              abonnement_rot_id: kilde.abonnement_rot_id || kilde.id,
              kunde_token: kilde.kunde_token,
            }])
            if (error) { visToast('Kunne ikke lage neste besøk: ' + error.message, 'feil', 4000); return }
            visToast('Neste besøk opprettet', 'suksess', 2500)
            await hent()
          }}
        />
      )}

      {visning === 'liste' && null}

      {visning === 'liste' && laster && (
        <div>
          {[0, 1].map(i => (
            <div key={i} style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 22, marginBottom: 14, boxShadow: SHADOW.sm }}>
              <div className="skimmer" style={{ height: 18, width: '40%', marginBottom: 14, borderRadius: 4 }} />
              <div className="skimmer" style={{ height: 50, borderRadius: RADIUS.md }} />
            </div>
          ))}
        </div>
      )}

      {visning === 'liste' && !laster && filtrert.length === 0 && (
        <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 48, textAlign: 'center', color: FARGER.tekstMid }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>Ingen bestillinger i dette filteret</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Kunder kan booke på <code>/inspeksjon</code>.</div>
        </div>
      )}

      {visning === 'liste' && !laster && filtrert.map((b, i) => {
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
                <>
                  <button onClick={() => setRapportFor(b.id)} style={primerKnapp}>📋 Lag rapport</button>
                  <button onClick={() => settPlanlagt(b)} style={sekundærKnapp}>🗓 Endre tidspunkt</button>
                </>
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

      {planleggFor && (() => {
        const b = bestillinger.find(x => x.id === planleggFor)
        if (!b) return null
        return (
          <PlanleggModal
            bestilling={b}
            onLukk={() => setPlanleggFor(null)}
            onLagret={async (iso) => {
              await settStatus(b.id, 'planlagt', { planlagt_tidspunkt: iso })
              setPlanleggFor(null)
            }}
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
  // Hvis vi har en eksisterende rapport, bruker vi dens id. Hvis ikke,
  // genererer vi en ny id med en gang slik at bilde-opplastinger får
  // stabile storage-stier under `rapport/<id>/`.
  const [rapportId] = useState(() => eksisterende?.id || nyId())
  const [besokt, setBesokt] = useState(eksisterende?.besokt_dato || new Date().toISOString().slice(0, 10))
  const [sjekkliste, setSjekkliste] = useState<Sjekkliste>(eksisterende?.sjekkliste || {})
  const [oppsummering, setOppsummering] = useState(eksisterende?.oppsummering || '')
  const [anbefalinger, setAnbefalinger] = useState(eksisterende?.anbefalinger || '')
  const [internNotat, setInternNotat] = useState(eksisterende?.intern_notat || '')
  const [bildeStier, setBildeStier] = useState<string[]>(eksisterende?.bilde_stier || [])
  const [bildeUrler, setBildeUrler] = useState<Record<string, string>>({})
  const [laster, setLaster] = useState(false)
  const [draggar, setDraggar] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const filInputRef = useRef<HTMLInputElement>(null)

  // Hent signerte URL-er for bilder hver gang lista endrer seg
  useEffect(() => {
    if (bildeStier.length === 0) { setBildeUrler({}); return }
    let avbrutt = false
    fetch('/api/inspeksjon/rapport/signert-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stier: bildeStier }),
    })
      .then(r => r.json())
      .then(d => { if (!avbrutt && d.urler) setBildeUrler(d.urler) })
      .catch(() => {})
    return () => { avbrutt = true }
  }, [bildeStier])

  async function lastOpp(filer: File[]) {
    if (filer.length === 0) return
    setLaster(true)
    const nyeStier: string[] = []
    for (const f of filer) {
      try {
        const fd = new FormData()
        fd.append('rapport_id', rapportId)
        fd.append('fil', f)
        const res = await fetch('/api/inspeksjon/rapport/last-opp', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || !data.ok || !data.sti) {
          visToast(`Opplasting feilet: ${data.feil || 'ukjent feil'}`, 'feil', 4000)
          continue
        }
        nyeStier.push(data.sti as string)
      } catch (e) {
        visToast(`Opplasting feilet: ${e instanceof Error ? e.message : 'ukjent feil'}`, 'feil', 4000)
      }
    }
    if (nyeStier.length > 0) setBildeStier(s => [...s, ...nyeStier])
    setLaster(false)
  }

  async function slettBilde(sti: string) {
    if (!confirm('Slette dette bildet?')) return
    setBildeStier(s => s.filter(x => x !== sti))
    // Fjern fra storage. Hvis storage-slett feiler er det ikke kritisk —
    // referansen er fjernet fra rapporten, så bildet er glemt funksjonelt.
    try {
      await fetch('/api/inspeksjon/rapport/signert-url', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sti }),
      })
    } catch {/* ignorer */}
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDraggar(false)
    const filer = Array.from(e.dataTransfer.files)
    if (filer.length > 0) void lastOpp(filer)
  }

  function settSjekk(felt: string, status: SjekkpunktStatus, notat?: string) {
    setSjekkliste(s => ({ ...s, [felt]: { status, notat: notat ?? s[felt]?.notat } }))
  }

  async function lagre() {
    setLagrer(true)
    try {
      if (eksisterende) {
        const { error } = await supabase.from('inspeksjon_rapporter').update({
          besokt_dato: besokt, sjekkliste, oppsummering, anbefalinger, intern_notat: internNotat, bilde_stier: bildeStier,
        }).eq('id', eksisterende.id)
        if (error) { visToast('Kunne ikke oppdatere rapport', 'feil'); return }
      } else {
        const { error } = await supabase.from('inspeksjon_rapporter').insert([{
          id: rapportId, bestilling_id: bestilling.id, inspektor,
          besokt_dato: besokt, sjekkliste, oppsummering, anbefalinger, intern_notat: internNotat, bilde_stier: bildeStier,
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

        {/* BILDER */}
        <div style={{ marginTop: 18, background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 18, boxShadow: SHADOW.xs }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, marginBottom: 12, letterSpacing: '-0.005em', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>📸 Bilder fra inspeksjonen</span>
            {bildeStier.length > 0 && <span style={{ fontSize: 12, color: FARGER.tekstLys, fontWeight: 400 }}>{bildeStier.length} bilder</span>}
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDraggar(true) }}
            onDragLeave={() => setDraggar(false)}
            onDrop={onDrop}
            onClick={() => filInputRef.current?.click()}
            style={{
              border: `1.5px dashed ${draggar ? FARGER.advarsel : FARGER.gull + '66'}`,
              background: draggar ? '#fff8e1' : FARGER.flateLys,
              borderRadius: RADIUS.lg, padding: 24, textAlign: 'center',
              cursor: 'pointer', marginBottom: bildeStier.length > 0 ? 14 : 0,
              transition: `background ${MOTION.rask}, border-color ${MOTION.rask}`,
            }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{laster ? '⏳' : '📥'}</div>
            <div style={{ fontSize: 13.5, color: FARGER.tekstMid, fontWeight: 500 }}>
              {laster ? 'Laster opp…' : 'Dra-og-slipp eller klikk for å legge til'}
            </div>
            <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 4 }}>
              JPEG, PNG, WebP eller HEIC · maks 15 MB per bilde
            </div>
            <input ref={filInputRef} type="file" accept={TILLATTE_BILDE_MIME} multiple
              onChange={e => {
                const filer = Array.from(e.target.files || [])
                if (filer.length > 0) void lastOpp(filer)
                if (filInputRef.current) filInputRef.current.value = ''
              }}
              style={{ display: 'none' }} />
          </div>

          {bildeStier.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {bildeStier.map(sti => {
                const url = bildeUrler[sti]
                return (
                  <div key={sti} style={{ position: 'relative', background: FARGER.flateMid, borderRadius: RADIUS.md, overflow: 'hidden', aspectRatio: '4/3', boxShadow: SHADOW.xs }}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: FARGER.tekstLys, fontSize: 20 }}>⏳</div>
                    )}
                    <button onClick={() => slettBilde(sti)} title="Slett bilde" style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(200, 16, 46, 0.92)', color: '#fff',
                      border: 'none', borderRadius: RADIUS.pill,
                      width: 26, height: 26, fontSize: 13,
                      cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
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
// PLANLEGG-MODAL — sett dato + klokkeslett for besøket
// ============================================================================

function PlanleggModal({
  bestilling, onLukk, onLagret,
}: {
  bestilling: Bestilling
  onLukk: () => void
  onLagret: (isoTidspunkt: string) => Promise<void>
}) {
  // Init: hvis allerede planlagt, bruk det. Ellers default til i morgen kl 10:00 lokal tid.
  const init = useMemo(() => {
    if (bestilling.planlagt_tidspunkt) {
      // Konverter ISO til lokal datetime-local-format (YYYY-MM-DDTHH:MM)
      const d = new Date(bestilling.planlagt_tidspunkt)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    const m = new Date()
    m.setDate(m.getDate() + 1); m.setHours(10, 0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}T${pad(m.getHours())}:${pad(m.getMinutes())}`
  }, [bestilling.planlagt_tidspunkt])

  const [tidspunkt, setTidspunkt] = useState(init)
  const [lagrer, setLagrer] = useState(false)

  // Hurtigvalg — gjør planlegging på sekunder for vanlige tidspunkter
  const hurtigvalg = useMemo(() => {
    const lag = (dager: number, time: number, min: number) => {
      const d = new Date()
      d.setDate(d.getDate() + dager); d.setHours(time, min, 0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    return [
      { lbl: 'I morgen kl 09', val: lag(1, 9, 0) },
      { lbl: 'I morgen kl 14', val: lag(1, 14, 0) },
      { lbl: 'Om 2 dager kl 10', val: lag(2, 10, 0) },
      { lbl: 'Om 1 uke kl 10', val: lag(7, 10, 0) },
    ]
  }, [])

  async function lagre() {
    if (!tidspunkt) { visToast('Velg dato og klokkeslett', 'feil', 2500); return }
    setLagrer(true)
    try {
      const iso = new Date(tidspunkt).toISOString()
      await onLagret(iso)
    } finally {
      setLagrer(false)
    }
  }

  const valgtFormatert = useMemo(() => {
    if (!tidspunkt) return ''
    try {
      return new Date(tidspunkt).toLocaleString('nb-NO', {
        weekday: 'long', day: '2-digit', month: 'long',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return '' }
  }, [tidspunkt])

  return (
    <div onClick={onLukk} className="anim-fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.45)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in" style={{
        background: FARGER.creamLys, borderRadius: RADIUS.xl, maxWidth: 520, width: '100%',
        padding: 'clamp(24px, 4vw, 36px)', boxShadow: SHADOW.xl,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>🗓 Planlegg besøk</div>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>
              {bestilling.kunde_navn}
            </h2>
            <div style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 6 }}>
              📍 {bestilling.adresse}{bestilling.leilighet_nr ? ` · ${bestilling.leilighet_nr}` : ''}
            </div>
          </div>
          <button onClick={onLukk} aria-label="Lukk" style={lukkKnapp}>×</button>
        </div>

        {/* Hurtigvalg */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Hurtigvalg</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hurtigvalg.map(h => {
              const aktiv = tidspunkt === h.val
              return (
                <button key={h.lbl} onClick={() => setTidspunkt(h.val)} style={{
                  background: aktiv ? FARGER.mork : FARGER.hvit,
                  color: aktiv ? FARGER.creamLys : FARGER.tekstMid,
                  border: `1px solid ${aktiv ? FARGER.mork : FARGER.kantUltralys}`,
                  borderRadius: RADIUS.pill, padding: '7px 14px',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '-0.005em',
                  boxShadow: aktiv ? SHADOW.sm : 'none',
                  transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
                }}>
                  {h.lbl}
                </button>
              )
            })}
          </div>
        </div>

        {/* Native dato/tid-velger */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Eller velg dato og klokkeslett</div>
          <input
            type="datetime-local"
            value={tidspunkt}
            onChange={e => setTidspunkt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            step={300}  // 5-min granularitet
            style={{
              width: '100%', padding: '14px 16px', fontSize: 16,
              borderRadius: RADIUS.md,
              border: `1px solid ${FARGER.kant}`,
              background: FARGER.hvit,
              fontFamily: 'inherit', boxSizing: 'border-box',
              outline: 'none',
              transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
            }}
          />
        </div>

        {/* Bekreftelse */}
        {valgtFormatert && (
          <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.gull}33`, borderRadius: RADIUS.md, padding: 14, marginBottom: 22, fontSize: 14, color: FARGER.mork, letterSpacing: '-0.005em' }}>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Bekreftet tidspunkt</div>
            {valgtFormatert.charAt(0).toUpperCase() + valgtFormatert.slice(1)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={lagre} disabled={lagrer || !tidspunkt} className="knapp-hover-loft" style={{
            flex: 1,
            background: lagrer || !tidspunkt ? FARGER.tekstLys : FARGER.mork,
            color: FARGER.creamLys, border: 'none',
            padding: 14, borderRadius: RADIUS.pill,
            fontSize: 14, fontWeight: 600,
            cursor: lagrer || !tidspunkt ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.005em',
            boxShadow: lagrer || !tidspunkt ? 'none' : SHADOW.md,
          }}>
            {lagrer ? '⏳ Lagrer…' : bestilling.planlagt_tidspunkt ? '💾 Oppdater tidspunkt' : '💾 Bekreft og planlegg'}
          </button>
          <button onClick={onLukk} disabled={lagrer} style={avbrytKnapp}>Avbryt</button>
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

// ============================================================================
// KALENDER-VISNING — månedlig grid med planlagte besøk
// ============================================================================

function KalenderVisning({
  bestillinger, mnd, settMnd, onKlikk,
}: {
  bestillinger: Bestilling[]
  mnd: Date
  settMnd: (d: Date) => void
  onKlikk: (id: string) => void
}) {
  // Bygg en 6-uker grid for valgt måned (alltid 42 celler)
  const aar = mnd.getFullYear()
  const mndIndex = mnd.getMonth()
  const forsteDag = new Date(aar, mndIndex, 1)
  // Mandag-først: 0=man, 6=søn
  const startDag = (forsteDag.getDay() + 6) % 7
  const dager: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(aar, mndIndex, 1 - startDag + i)
    dager.push(d)
  }

  // Indekser bestillinger på dato-key (YYYY-MM-DD)
  const planlagtePerDag: Record<string, Bestilling[]> = {}
  for (const b of bestillinger) {
    if (!b.planlagt_tidspunkt || b.status === 'avlyst') continue
    const key = b.planlagt_tidspunkt.slice(0, 10)
    if (!planlagtePerDag[key]) planlagtePerDag[key] = []
    planlagtePerDag[key].push(b)
  }

  const ukedagNavn = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
  const mndNavn = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember']
  const idag = new Date(); idag.setHours(0, 0, 0, 0)

  return (
    <div style={{
      background: FARGER.hvit,
      border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg, padding: 22, marginBottom: 18,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.015em' }}>
          {mndNavn[mndIndex]} {aar}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => settMnd(new Date(aar, mndIndex - 1, 1))} style={pilKnapp}>←</button>
          <button onClick={() => settMnd(new Date())} style={navKnapp}>I dag</button>
          <button onClick={() => settMnd(new Date(aar, mndIndex + 1, 1))} style={pilKnapp}>→</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {ukedagNavn.map(u => (
          <div key={u} style={{ fontSize: 11, color: FARGER.tekstLys, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, textAlign: 'center', padding: 8 }}>
            {u}
          </div>
        ))}
        {dager.map((d, i) => {
          const erFraMnd = d.getMonth() === mndIndex
          const erIdag = d.getTime() === idag.getTime()
          const key = d.toISOString().slice(0, 10)
          const besok = planlagtePerDag[key] || []
          return (
            <div key={i} style={{
              background: erIdag ? FARGER.creamLys : (erFraMnd ? FARGER.hvit : FARGER.flateLys),
              border: erIdag ? `1.5px solid ${FARGER.gull}` : `1px solid ${FARGER.kantUltralys}`,
              borderRadius: RADIUS.md, padding: 8,
              minHeight: 90, opacity: erFraMnd ? 1 : 0.45,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 12, fontWeight: erIdag ? 700 : 500, color: FARGER.mork, letterSpacing: '-0.005em' }}>
                {d.getDate()}
              </div>
              {besok.slice(0, 3).map(b => {
                const f = BESTILLING_STATUS_ETIKETT[b.status]
                const tid = b.planlagt_tidspunkt
                  ? new Date(b.planlagt_tidspunkt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                  : ''
                return (
                  <button key={b.id} onClick={() => onKlikk(b.id)} style={{
                    background: f.bg, color: f.tekst, border: 'none',
                    borderRadius: RADIUS.sm,
                    padding: '3px 6px', fontSize: 10.5, fontWeight: 600,
                    cursor: 'pointer', textAlign: 'left',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    letterSpacing: '-0.005em',
                  }}>
                    {tid} {b.kunde_navn.split(' ')[0]}
                  </button>
                )
              })}
              {besok.length > 3 && (
                <div style={{ fontSize: 10, color: FARGER.tekstLys, padding: '2px 6px' }}>
                  +{besok.length - 3} til
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// KOMMENDE ABONNEMENTER — viser abo-kunder som mangler neste-besøk
// ============================================================================

function KommendeAbonnementer({
  bestillinger, rapporter, onPlanlegg,
}: {
  bestillinger: Bestilling[]
  rapporter: Record<string, Rapport>
  onPlanlegg: (kilde: Bestilling) => Promise<void>
}) {
  // For hver abo-rot: finn nyeste bestilling. Hvis den er utført/avsluttet og
  // det ikke finnes en ny ufullført bestilling etter den, så er det på tide
  // å planlegge neste.
  const aboBestillinger = bestillinger.filter(b =>
    b.tjeneste_type === 'manedlig_visuell' || b.tjeneste_type === 'kvartalsvis_grundig'
  )

  // Grupper per kunde-epost + adresse (samme leilighet)
  const grupper: Record<string, Bestilling[]> = {}
  for (const b of aboBestillinger) {
    const key = `${b.kunde_epost}|${b.adresse}`
    if (!grupper[key]) grupper[key] = []
    grupper[key].push(b)
  }

  // For hver gruppe, finn siste utførte uten åpen oppfølger
  const trengerNytt: Array<{ kilde: Bestilling; siste_besokt: string | null }> = []
  for (const liste of Object.values(grupper)) {
    const sortert = [...liste].sort((a, b) => b.opprettet.localeCompare(a.opprettet))
    const nyeste = sortert[0]
    const harAapen = nyeste && nyeste.status !== 'avsluttet' && nyeste.status !== 'avlyst' && nyeste.status !== 'utfort' && nyeste.status !== 'tilbud_sendt'
    const nyligUtfort = nyeste && (nyeste.status === 'utfort' || nyeste.status === 'tilbud_sendt' || nyeste.status === 'avsluttet')
    if (!harAapen && nyligUtfort) {
      const r = rapporter[nyeste.id]
      trengerNytt.push({ kilde: nyeste, siste_besokt: r?.besokt_dato || null })
    }
  }

  if (trengerNytt.length === 0) return null

  return (
    <div style={{
      background: FARGER.creamLys,
      border: `1px solid ${FARGER.gull}33`,
      borderRadius: RADIUS.lg, padding: 22, marginBottom: 18,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
        🔁 Abonnement — klare for neste besøk
      </div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, marginTop: 0, marginBottom: 16, lineHeight: 1.55 }}>
        Disse kundene har avsluttet en runde og venter på neste planlagte besøk. Klikk «Planlegg neste» for å lage en ny bestilling med passende dato fremover.
      </p>
      {trengerNytt.map(({ kilde, siste_besokt }) => (
        <div key={kilde.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, padding: '12px 0', borderTop: `1px solid ${FARGER.kantUltralys}`, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>{kilde.kunde_navn}</div>
            <div style={{ fontSize: 12, color: FARGER.tekstMid, marginTop: 2 }}>
              {kilde.adresse}{kilde.leilighet_nr ? ` · ${kilde.leilighet_nr}` : ''} · {TJENESTE_ETIKETT[kilde.tjeneste_type]}
            </div>
            {siste_besokt && (
              <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2 }}>
                Sist besøkt {fmtDato(siste_besokt)}
              </div>
            )}
          </div>
          <button onClick={() => onPlanlegg(kilde)} className="knapp-hover-loft" style={{
            background: FARGER.mork, color: FARGER.creamLys, border: 'none',
            borderRadius: RADIUS.pill, padding: '9px 18px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '-0.005em', boxShadow: SHADOW.sm,
          }}>
            🗓 Planlegg neste
          </button>
        </div>
      ))}
    </div>
  )
}

const pilKnapp: React.CSSProperties = {
  background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
  borderRadius: RADIUS.pill, padding: '7px 14px', fontSize: 14,
  cursor: 'pointer', color: FARGER.tekstMid, fontWeight: 500,
  boxShadow: SHADOW.xs,
}

const navKnapp: React.CSSProperties = {
  background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
  borderRadius: RADIUS.pill, padding: '7px 16px', fontSize: 13,
  cursor: 'pointer', color: FARGER.tekstMid, fontWeight: 500,
  boxShadow: SHADOW.xs, letterSpacing: '-0.005em',
}
