'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import { HANDVERKER_FAG_ETIKETT, type Handverker, type HandverkerFag } from '../types'

type Props = {
  /** Eiendommen/prosjektet vi sender om — bildevalg filtreres til denne hvis satt */
  prosjektId?: string | null
  /** Hvis vi sender om en konkret oppussingspost */
  oppussingPostId?: string | null
  /** Forhåndsvalgte bilder (f.eks. hvis utløst fra et spesifikt bilde) */
  forhandsvalgteBildeIds?: string[]
  /** Forhåndsutfylt tittel */
  initialTittel?: string
  /** Forhåndsutfylt beskrivelse */
  initialBeskrivelse?: string
  apen: boolean
  onLukk: () => void
}

type Bilde = { id: string; storage_sti: string; filnavn: string | null; kategori: string | null; signert_url?: string }

const SPRAK_ETIKETT: Record<'no' | 'en' | 'es', string> = { no: '🇳🇴', en: '🇬🇧', es: '🇪🇸' }

export function SendForesporselModal({
  prosjektId, oppussingPostId, forhandsvalgteBildeIds,
  initialTittel, initialBeskrivelse, apen, onLukk,
}: Props) {
  const [handverkere, setHandverkere] = useState<Handverker[]>([])
  const [valgte, setValgte] = useState<Set<string>>(new Set())
  const [filterFag, setFilterFag] = useState<'alle' | HandverkerFag>('alle')

  const [tittel, setTittel] = useState(initialTittel || '')
  const [beskrivelse, setBeskrivelse] = useState(initialBeskrivelse || '')
  const [tittelOversatt, setTittelOversatt] = useState('')
  const [beskrivelseOversatt, setBeskrivelseOversatt] = useState('')
  const [oversetterTil, setOversetterTil] = useState<'no' | 'en' | 'es' | null>(null)
  const [oversetter, setOversetter] = useState(false)

  const [bilder, setBilder] = useState<Bilde[]>([])
  const [valgteBilder, setValgteBilder] = useState<Set<string>>(new Set(forhandsvalgteBildeIds || []))
  const [lasterData, setLasterData] = useState(true)
  const [sender, setSender] = useState(false)

  // Hent håndverkere og prosjekt-bilder ved åpning
  const last = useCallback(async () => {
    setLasterData(true)
    const [hRes, bRes] = await Promise.all([
      supabase.from('handverkere').select('*').eq('aktiv', true).order('navn'),
      prosjektId
        ? supabase.from('prosjekt_bilder').select('id, storage_sti, filnavn, kategori, type').eq('prosjekt_id', prosjektId).eq('type', 'original').order('opprettet', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    setHandverkere((hRes.data || []) as Handverker[])

    const bilderRaw = (bRes.data || []) as Array<{ id: string; storage_sti: string; filnavn: string | null; kategori: string | null }>
    setBilder(bilderRaw)
    setLasterData(false)

    // Hent signerte URL-er for thumbnails
    if (bilderRaw.length > 0) {
      try {
        const res = await fetch('/api/bilder/signert-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bilde_ids: bilderRaw.map(b => b.id) }),
        })
        const d = await res.json().catch(() => ({}))
        const urler: Record<string, string> = d?.urler || {}
        setBilder(bilderRaw.map(b => ({ ...b, signert_url: urler[b.id] })))
      } catch { /* thumbnails er kun for valg-UI; ikke kritisk */ }
    }
  }, [prosjektId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (apen) void last()
  }, [apen, last])

  // Hvis brukeren endrer norsk tekst etter en oversetting, viser vi det med
  // en advarselsmelding ("oversettelsen er utdatert") i stedet for å nullstille
  // automatisk i useEffect (krasjer med React-Compiler-regelen).
  const tittelEndret = oversetterTil !== null && tittel !== ''  // forenkling — bruker oversetterTil som markør
  void tittelEndret  // ikke brukt foreløpig — UI viser oversettelsen som er, brukeren trykker «oversett på nytt»

  const valgteHandverkere = useMemo(() => handverkere.filter(h => valgte.has(h.id)), [handverkere, valgte])
  const malspraak = useMemo(() => {
    // Hvis flere håndverkere har samme språk, velg det. Default es.
    if (valgteHandverkere.length === 0) return 'es' as const
    const teller: Record<string, number> = {}
    for (const h of valgteHandverkere) teller[h.sprak] = (teller[h.sprak] || 0) + 1
    const flest = Object.entries(teller).sort((a, b) => b[1] - a[1])[0]?.[0]
    return (flest === 'no' || flest === 'en' || flest === 'es') ? flest : 'es'
  }, [valgteHandverkere])

  const filtrert = useMemo(
    () => filterFag === 'alle' ? handverkere : handverkere.filter(h => h.fag.includes(filterFag)),
    [handverkere, filterFag],
  )
  const tilgjengeligeFag = useMemo(() => {
    const set = new Set<HandverkerFag>()
    for (const h of handverkere) for (const f of h.fag) set.add(f as HandverkerFag)
    return Array.from(set)
  }, [handverkere])

  function toggleHandverker(id: string) {
    setValgte(prev => { const ny = new Set(prev); if (ny.has(id)) ny.delete(id); else ny.add(id); return ny })
  }
  function toggleBilde(id: string) {
    setValgteBilder(prev => { const ny = new Set(prev); if (ny.has(id)) ny.delete(id); else ny.add(id); return ny })
  }

  async function oversett() {
    if (!beskrivelse.trim() || malspraak === 'no') return
    setOversetter(true)
    try {
      const res = await fetch('/api/handverker/oversett', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tekst: beskrivelse, tittel, sprak: malspraak }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { visToast(d?.feil || 'Oversetting feilet', 'feil', 4000); return }
      setTittelOversatt(d.tittel_oversatt || tittel)
      setBeskrivelseOversatt(d.tekst_oversatt || beskrivelse)
      setOversetterTil(malspraak)
      visToast(`Oversatt til ${SPRAK_ETIKETT[malspraak]}`, 'suksess', 2000)
    } finally { setOversetter(false) }
  }

  async function send() {
    if (valgte.size === 0) { visToast('Velg minst én håndverker', 'feil', 3000); return }
    if (!tittel.trim() || !beskrivelse.trim()) { visToast('Tittel og beskrivelse må fylles inn', 'feil', 3000); return }
    setSender(true)
    try {
      const res = await fetch('/api/handverker/send-foresporsel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handverker_ids: Array.from(valgte),
          prosjekt_id: prosjektId || null,
          oppussing_post_id: oppussingPostId || null,
          tittel_no: tittel,
          tittel_sendt: tittelOversatt || tittel,
          beskrivelse_no: beskrivelse,
          beskrivelse_sendt: beskrivelseOversatt || beskrivelse,
          bilde_ids: Array.from(valgteBilder),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { visToast(d?.feil || 'Sending feilet', 'feil', 5000); return }
      const ok = (d.resultater || []).filter((r: { status: string }) => r.status === 'sendt').length
      const feilet = (d.resultater || []).length - ok
      if (feilet === 0) {
        visToast(`Sendt til ${ok} håndverker${ok !== 1 ? 'e' : ''}`, 'suksess', 4000)
        onLukk()
      } else {
        visToast(`${ok} sendt, ${feilet} feilet — sjekk historikk`, 'feil', 5000)
      }
    } finally { setSender(false) }
  }

  // WhatsApp-link for én håndverker (åpner i ny fane med ferdig tekst og bilde-lenker)
  function whatsappLink(h: Handverker): string | null {
    if (!h.whatsapp) return null
    const tekst = (beskrivelseOversatt || beskrivelse).trim()
    const bildeLenker = bilder
      .filter(b => valgteBilder.has(b.id) && b.signert_url)
      .map(b => b.signert_url!)
      .join('\n')
    const full = `${tittelOversatt || tittel}\n\n${tekst}${bildeLenker ? '\n\n' + bildeLenker : ''}\n\n— Leganger & Osvaag Eiendom`
    const nummer = h.whatsapp.replace(/[^0-9]/g, '')
    return `https://wa.me/${nummer}?text=${encodeURIComponent(full)}`
  }

  if (!apen) return null

  return (
    <div onClick={onLukk} className="anim-fade-in"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14, 23, 38, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 20, overflowY: 'auto',
      }}>
      <div onClick={e => e.stopPropagation()} className="anim-scale-in"
        style={{
          background: FARGER.creamLys, borderRadius: RADIUS.xl, maxWidth: 820, width: '100%',
          padding: 'clamp(24px, 4vw, 36px)', marginTop: 20, marginBottom: 40,
          boxShadow: SHADOW.xl,
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.28em', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
              📤 Tilbudsforespørsel
            </div>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 26px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Send til håndverkere
            </h2>
            <p style={{ fontSize: 13.5, color: FARGER.tekstMid, margin: '8px 0 0', lineHeight: 1.55 }}>
              Velg én eller flere håndverkere fra nettverket, skriv hva du vil ha gjort, og send.
            </p>
          </div>
          <button onClick={onLukk} disabled={sender}
            aria-label="Lukk"
            style={{
              background: FARGER.flateLys, border: 'none',
              width: 36, height: 36, fontSize: 18, color: FARGER.tekstMid,
              cursor: sender ? 'not-allowed' : 'pointer',
              lineHeight: 1, padding: 0,
              borderRadius: RADIUS.pill,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>×</button>
        </div>

        {lasterData ? (
          <div style={{ textAlign: 'center', padding: 48, color: FARGER.tekstLys }}>⏳ Laster…</div>
        ) : handverkere.length === 0 ? (
          <div style={{ background: FARGER.hvit, border: `1px dashed ${FARGER.gull}55`, borderRadius: RADIUS.lg, padding: 36, textAlign: 'center', color: FARGER.tekstMid, fontSize: 13.5 }}>
            Du har ingen håndverkere i nettverket ennå. Legg til i «🔧 Håndverkere»-fanen først.
          </div>
        ) : (
          <>
            {/* Tittel + beskrivelse */}
            <div style={{ marginBottom: 14 }}>
              <Lbl>Tittel</Lbl>
              <input value={tittel} onChange={e => setTittel(e.target.value)}
                placeholder="F.eks. Tilbud på bad-renovering"
                style={inputStil} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <Lbl>Beskrivelse (norsk)</Lbl>
              <textarea value={beskrivelse} onChange={e => setBeskrivelse(e.target.value)} rows={6}
                placeholder="Beskriv hva du ønsker tilbud på — rom, omfang, ønsket utførelse, tidsfrist. Bildene legges ved automatisk."
                style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>

            {/* AI-oversetting */}
            {malspraak !== 'no' && beskrivelse.trim() && (
              <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.gull}33`, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, boxShadow: SHADOW.xs }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                    🤖 Oversettelse til {SPRAK_ETIKETT[malspraak]} {malspraak === 'es' ? 'spansk' : 'engelsk'}
                  </span>
                  <button onClick={oversett} disabled={oversetter} className="knapp-hover-loft"
                    style={{
                      background: oversetter ? FARGER.tekstLys : FARGER.mork,
                      color: FARGER.creamLys, border: 'none',
                      padding: '7px 14px', borderRadius: RADIUS.pill,
                      fontSize: 12, fontWeight: 600,
                      cursor: oversetter ? 'wait' : 'pointer',
                      letterSpacing: '-0.005em',
                      boxShadow: oversetter ? 'none' : SHADOW.sm,
                    }}>
                    {oversetter ? '⏳ Oversetter…' : oversetterTil ? '🔄 Oversett på nytt' : '✨ Oversett'}
                  </button>
                </div>
                {oversetterTil && (
                  <>
                    <input value={tittelOversatt} onChange={e => setTittelOversatt(e.target.value)}
                      style={{ ...inputStil, marginBottom: 8 }} />
                    <textarea value={beskrivelseOversatt} onChange={e => setBeskrivelseOversatt(e.target.value)} rows={6}
                      style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />
                    <div style={{ fontSize: 10, color: FARGER.tekstLys, marginTop: 6, fontStyle: 'italic' }}>
                      Du kan redigere oversettelsen før sending. Hvis du endrer den norske teksten, må du oversette på nytt.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Bilder */}
            {bilder.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <Lbl>Bilder ({valgteBilder.size} av {bilder.length} valgt — maks 5 vedlegges)</Lbl>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                  {bilder.map(b => {
                    const valgt = valgteBilder.has(b.id)
                    return (
                      <button key={b.id} type="button" onClick={() => toggleBilde(b.id)}
                        style={{
                          background: FARGER.hvit, border: valgt ? `2px solid ${FARGER.gull}` : `1px solid ${FARGER.kantUltralys}`,
                          borderRadius: RADIUS.md, padding: 0, cursor: 'pointer',
                          aspectRatio: '4 / 3', overflow: 'hidden', position: 'relative',
                          opacity: valgt ? 1 : 0.7,
                          boxShadow: valgt ? SHADOW.sm : SHADOW.xs,
                          transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                        }}>
                        {b.signert_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.signert_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: FARGER.flateMid, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📷</div>
                        )}
                        {valgt && (
                          <div style={{ position: 'absolute', top: 4, right: 4, background: FARGER.gull, color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>✓</div>
                        )}
                        {b.kategori && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, padding: '2px 4px', textAlign: 'center' }}>
                            {b.kategori}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Håndverker-velger */}
            <div style={{ marginBottom: 14 }}>
              <Lbl>Velg håndverkere ({valgte.size} valgt)</Lbl>
              {tilgjengeligeFag.length > 0 && (
                <select value={filterFag} onChange={e => setFilterFag(e.target.value as 'alle' | HandverkerFag)}
                  style={{ ...inputStil, marginBottom: 8 }}>
                  <option value="alle">Alle fag</option>
                  {tilgjengeligeFag.map(f => <option key={f} value={f}>{HANDVERKER_FAG_ETIKETT[f]}</option>)}
                </select>
              )}
              <div style={{ maxHeight: 280, overflowY: 'auto', border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, background: FARGER.hvit }}>
                {filtrert.length === 0 && (
                  <div style={{ padding: 16, fontSize: 12, color: FARGER.tekstLys, textAlign: 'center', fontStyle: 'italic' }}>
                    Ingen håndverkere i dette filteret.
                  </div>
                )}
                {filtrert.map(h => {
                  const valgt = valgte.has(h.id)
                  const wa = whatsappLink(h)
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${FARGER.kantUltralys}`, background: valgt ? FARGER.creamLys : FARGER.hvit, transition: `background ${MOTION.rask}` }}>
                      <input type="checkbox" checked={valgt} onChange={() => toggleHandverker(h.id)}
                        style={{ width: 18, height: 18, accentColor: FARGER.gull }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: FARGER.mork, letterSpacing: '-0.005em' }}>
                          {h.navn} {SPRAK_ETIKETT[h.sprak]}
                          {!h.epost && <span style={{ marginLeft: 8, fontSize: 11, color: FARGER.feil }}>(mangler e-post)</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: FARGER.tekstLys, marginTop: 2 }}>
                          {h.fag.map(f => HANDVERKER_FAG_ETIKETT[f as HandverkerFag] || f).join(', ')}
                          {h.omrade && ` · 📍 ${h.omrade}`}
                        </div>
                      </div>
                      {wa && valgt && (
                        <a href={wa} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          title="Åpne WhatsApp med ferdig tekst og bilde-lenker"
                          style={{ background: '#25d366', color: FARGER.creamLys, padding: '5px 12px', borderRadius: RADIUS.pill, fontSize: 11, fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.005em' }}>
                          💬 WA
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Send-knapp */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={send} disabled={sender || valgte.size === 0 || !tittel.trim() || !beskrivelse.trim()} className="knapp-hover-loft"
                style={{
                  flex: 1, background: sender || valgte.size === 0 ? FARGER.tekstLys : FARGER.mork,
                  color: FARGER.creamLys, border: 'none', padding: 14, borderRadius: RADIUS.pill,
                  fontSize: 14, fontWeight: 600,
                  cursor: sender || valgte.size === 0 ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.005em',
                  boxShadow: sender || valgte.size === 0 ? 'none' : SHADOW.sm,
                  transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
                }}>
                {sender ? '⏳ Sender…' : `📧 Send via e-post til ${valgte.size} ${valgte.size === 1 ? 'håndverker' : 'håndverkere'}`}
              </button>
              <button onClick={onLukk} disabled={sender}
                style={{
                  background: FARGER.hvit, color: FARGER.tekstMid,
                  border: `1px solid ${FARGER.kantUltralys}`,
                  padding: '14px 22px', borderRadius: RADIUS.pill,
                  fontSize: 14, fontWeight: 500,
                  cursor: sender ? 'not-allowed' : 'pointer',
                  letterSpacing: '-0.005em',
                }}>
                Avbryt
              </button>
            </div>

            <div style={{ fontSize: 10, color: FARGER.tekstLys, marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>
              Maks 5 bilder vedlegges som filer. Eventuelle ekstra bilder sendes som signerte lenker (gyldige 14 dager).
              WhatsApp-meldingen kan ikke vedlegge bilder — den får bilde-lenker i stedet.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 10, color: FARGER.tekstMid, marginBottom: 6, display: 'block', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
      {children}
    </label>
  )
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  border: `1px solid ${FARGER.kant}`, borderRadius: RADIUS.md, background: FARGER.hvit,
  boxSizing: 'border-box', fontFamily: 'inherit',
  outline: 'none',
  transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`,
}
