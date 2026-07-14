'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { loggAktivitet } from '../lib/logg'
import { visToast } from '../lib/toast'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'
import type { GeonorgeAdresse, OffmarketInnhenting, OffmarketLenker } from '../lib/offmarket'

type SelgerInfo = {
  navn: string
  telefon: string
  epost: string
  prisindikasjon_nok: number
  bakgrunn: string  // hvorfor selger de, hvordan kom tilbudet
}

// Kjente fakta — det selger nesten alltid forteller før vi går videre.
// Sendes til AI så spørsmålslisten ikke fyller seg med ting vi vet.
type KjenteFakta = {
  boligtype: string         // Leilighet / Enebolig / Tomannsbolig / Rekkehus / Hytte
  eierform: string          // Selveier / Andel / Aksje / Obligasjon
  bra_m2: number            // bruksareal
  p_rom_m2: number          // primærrom (boareal)
  byggear: number
  soverom: number
  bad: number
  etasje: string
  energimerke: string       // A-G
  fellesgjeld_nok: number
  fellesutg_mnd_nok: number
  kommunale_avg_aar_nok: number
  tomt_m2: number
  tomt_type: string         // Eier / Festet
  oppussingsgrad: string    // Original / Delvis pusset / Helt renovert / Trenger total
  notater: string           // alt annet selger har sagt
}

type Props = {
  onLagret: () => void  // refresh-hook for parent (oppdater prosjekt-liste)
}

const tomSelger: SelgerInfo = {
  navn: '', telefon: '', epost: '',
  prisindikasjon_nok: 0, bakgrunn: '',
}

const tomFakta: KjenteFakta = {
  boligtype: '', eierform: '',
  bra_m2: 0, p_rom_m2: 0, byggear: 0, soverom: 0, bad: 0,
  etasje: '', energimerke: '',
  fellesgjeld_nok: 0, fellesutg_mnd_nok: 0, kommunale_avg_aar_nok: 0,
  tomt_m2: 0, tomt_type: '',
  oppussingsgrad: '', notater: '',
}

export function Offmarket({ onLagret }: Props) {
  const [adresse, setAdresse] = useState('')
  const [selger, setSelger] = useState<SelgerInfo>(tomSelger)
  const [fakta, setFakta] = useState<KjenteFakta>(tomFakta)
  const [innhenting, setInnhenting] = useState<OffmarketInnhenting | null>(null)
  const [henter, setHenter] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)
  const [valgtIdx, setValgtIdx] = useState(0)
  const [visDetaljer, setVisDetaljer] = useState(false)

  async function hentOffentligData() {
    if (!adresse.trim()) { setFeil('Adresse mangler'); return }
    setHenter(true); setFeil(null)
    try {
      const res = await fetch('/api/offmarket/innhent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adresse }),
      })
      const data = await res.json()
      if (!res.ok || data.feil) {
        setFeil(data.feil || 'Henting feilet')
        setHenter(false)
        return
      }
      setInnhenting(data as OffmarketInnhenting)
      setValgtIdx(0)
    } catch (e) {
      setFeil(e instanceof Error ? e.message : String(e))
    }
    setHenter(false)
  }

  async function lagreSomProsjekt() {
    if (!adresse.trim() && !innhenting?.valgt) { setFeil('Trenger adresse før lagring'); return }
    setLagrer(true)
    const bruker = hentAktivBruker() || 'ukjent'
    const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8)
    const valgt = innhenting?.treff[valgtIdx] || innhenting?.valgt || null
    const visningsadresse = valgt?.adressetekst || adresse
    const navn = `Off-market: ${visningsadresse}`
    const { error } = await supabase.from('prosjekter').insert([{
      id,
      bruker,
      navn,
      marked: 'norge',
      kategori: 'flipp',
      eieretappe: 'analyse',
      off_market: true,
      off_market_data: {
        adresse_input: adresse,
        selger,
        kjente_fakta: fakta,
        innhenting: innhenting || null,
        valgt_treff_idx: valgtIdx,
        opprettet: new Date().toISOString(),
      },
      bolig_data: { beliggenhet: visningsadresse },
      forventet_salgsverdi: selger.prisindikasjon_nok || 0,
      kjøpesum: selger.prisindikasjon_nok || 0,
      kjøpskostnader: 0,
      oppussingsbudsjett: 0,
      oppussing_faktisk: 0,
      møblering: 0,
      leieinntekt_mnd: 0,
      lån_mnd: 0,
      fellesutgifter_mnd: fakta.fellesutg_mnd_nok || 0,
      strøm_mnd: 0,
      forsikring_mnd: 0,
      forvaltning_mnd: 0,
      måneder: [],
    }])
    if (error) {
      visToast('Lagring feilet: ' + error.message, 'feil', 5000)
      setLagrer(false)
      return
    }
    await loggAktivitet({
      handling: 'opprettet off-market vurdering',
      tabell: 'prosjekter', rad_id: id,
      detaljer: { adresse: visningsadresse, prisindikasjon: selger.prisindikasjon_nok },
    })
    visToast('Off-market prosjekt lagret', 'suksess', 3000)
    setAdresse(''); setSelger(tomSelger); setFakta(tomFakta); setInnhenting(null); setValgtIdx(0)
    setLagrer(false)
    onLagret()
  }

  const valgt: GeonorgeAdresse | null = innhenting?.treff[valgtIdx] || innhenting?.valgt || null
  const lenker: OffmarketLenker | null = innhenting?.lenker || null

  return (
    <div style={{
      background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
      borderRadius: RADIUS.lg, padding: 22, marginBottom: 22, boxShadow: SHADOW.sm,
    }}>
      <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
        🔍 Off-market vurdering
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.01em' }}>
        Fått tilbud utenfor markedet?
      </h3>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '6px 0 18px', lineHeight: 1.5 }}>
        Lim inn det du vet. Vi slår opp offentlige eiendomsdata (Kartverket/Geonorge) og bygger en sjekkliste
        med spørsmål til selger — selv om du ikke har takstrapport eller annonse.
      </p>

      {/* Adresse + søk */}
      <div style={{ marginBottom: 14 }}>
        <label style={lblStil}>Adresse</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={adresse} onChange={e => setAdresse(e.target.value)}
            placeholder="f.eks. Storgata 15, 5003 Bergen"
            style={{ ...inputStil, flex: 1 }} />
          <button onClick={hentOffentligData} disabled={henter || !adresse.trim()}
            style={{
              background: henter || !adresse.trim() ? FARGER.tekstLys : FARGER.mork,
              color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.sm,
              padding: '0 18px', fontSize: 12, fontWeight: 600,
              cursor: henter || !adresse.trim() ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              transition: `background ${MOTION.rask}`,
            }}>
            {henter ? '⏳ Henter…' : '🔍 Hent data'}
          </button>
        </div>
      </div>

      {feil && (
        <div style={{ background: FARGER.feilBg, border: `1px solid ${FARGER.feil}33`, padding: 10, borderRadius: RADIUS.sm, color: '#7a0c1e', fontSize: 12, marginBottom: 14 }}>
          {feil}
        </div>
      )}

      {/* Resultat: treff-liste hvis > 1 */}
      {innhenting && innhenting.treff.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <div style={lblStil}>Flere treff — velg riktig</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {innhenting.treff.map((t, i) => (
              <label key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: RADIUS.sm, cursor: 'pointer',
                background: i === valgtIdx ? FARGER.creamLys : 'transparent',
                border: `1px solid ${i === valgtIdx ? FARGER.gull : FARGER.kantUltralys}`,
              }}>
                <input type="radio" name="treff" checked={i === valgtIdx}
                  onChange={() => setValgtIdx(i)} style={{ accentColor: FARGER.gull }} />
                <span style={{ fontSize: 13, color: FARGER.mork }}>
                  {t.adressetekst}
                  {t.postnummer && ` · ${t.postnummer} ${t.poststed || ''}`}
                  {t.gardsnummer != null && ` · gnr ${t.gardsnummer}/bnr ${t.bruksnummer}`}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Resultat-blokk */}
      {valgt && (
        <div style={{
          background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`,
          borderRadius: RADIUS.md, padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            📍 Offentlige data
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
            <Fakta lbl="Adresse" val={valgt.adressetekst} />
            <Fakta lbl="Postnr" val={`${valgt.postnummer || '–'} ${valgt.poststed || ''}`} />
            <Fakta lbl="Kommune" val={valgt.kommunenavn || '–'} />
            <Fakta lbl="Matrikkel" val={valgt.gardsnummer != null ? `gnr ${valgt.gardsnummer}/bnr ${valgt.bruksnummer}${valgt.festenummer ? `/fnr ${valgt.festenummer}` : ''}${valgt.seksjonsnummer ? `/snr ${valgt.seksjonsnummer}` : ''}` : '–'} />
            <Fakta lbl="Koordinater" val={valgt.lat != null ? `${valgt.lat.toFixed(5)}, ${valgt.lon?.toFixed(5)}` : '–'} />
          </div>
          {lenker && (
            <div>
              <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, marginBottom: 6 }}>
                Slå opp i offentlige portaler:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {lenker.seeiendom && <LenkeChip url={lenker.seeiendom} lbl="🗺️ SeEiendom" />}
                {lenker.nve_faresoner && <LenkeChip url={lenker.nve_faresoner} lbl="⚠️ NVE faresoner" />}
                {lenker.enova_sok && <LenkeChip url={lenker.enova_sok} lbl="⚡ Enova energiattest" />}
                {lenker.bergen_planinnsyn && <LenkeChip url={lenker.bergen_planinnsyn} lbl="📐 Bergen planinnsyn" />}
                {lenker.bergen_byggesak && <LenkeChip url={lenker.bergen_byggesak} lbl="🏗️ Bergen byggesaker" />}
                {lenker.finn_sold_sok && <LenkeChip url={lenker.finn_sold_sok} lbl="💰 Finn — sammenlignbare salg" />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selger-info */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...lblStil, marginBottom: 10 }}>Selger / tilbud</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <Input lbl="Navn på selger" val={selger.navn} onChange={v => setSelger({ ...selger, navn: v })} placeholder="Navn" />
          <Input lbl="Telefon" val={selger.telefon} onChange={v => setSelger({ ...selger, telefon: v })} placeholder="+47 …" />
          <Input lbl="E-post" val={selger.epost} onChange={v => setSelger({ ...selger, epost: v })} placeholder="navn@…" />
          <InputTall lbl="Prisindikasjon (NOK)" val={selger.prisindikasjon_nok} onChange={v => setSelger({ ...selger, prisindikasjon_nok: v })} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={lblStil}>Bakgrunn — hvordan kom tilbudet, hvorfor selger de</label>
          <textarea value={selger.bakgrunn} onChange={e => setSelger({ ...selger, bakgrunn: e.target.value })}
            rows={3}
            placeholder="f.eks. Kjent gjennom megler X, ønsker rask handel grunnet flytting"
            style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>
      </div>

      {/* Om boligen — minimal som standard, detaljer valgfritt */}
      <div style={{ marginBottom: 14, padding: 14, background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.md }}>
        <div style={{ ...lblStil, marginBottom: 4 }}>📋 Om boligen</div>
        <p style={{ fontSize: 11, color: FARGER.tekstMid, margin: '0 0 12px', lineHeight: 1.5 }}>
          Adressen over henter offentlige data automatisk, og AI leser fritt fra feltet under. Du trenger ikke fylle inn detaljene for hånd — men du kan.
        </p>
        <div>
          <label style={lblStil}>Hva vet du om boligen? (oppussing utført, dokumentasjon, hva selger har fortalt)</label>
          <textarea value={fakta.notater} onChange={e => setFakta({ ...fakta, notater: e.target.value })}
            rows={3}
            placeholder="f.eks. enebolig fra 1962, 148 m², bad rehabilitert 2018, nytt tak 2020, original standard ellers, seksjonerbar"
            style={{ ...inputStil, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        <button type="button" onClick={() => setVisDetaljer(v => !v)}
          style={{ marginTop: 12, background: 'none', border: `1px dashed ${FARGER.gullSvak}`, color: FARGER.gull, padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: RADIUS.pill, cursor: 'pointer' }}>
          {visDetaljer ? 'Skjul detaljer ▲' : 'Flere detaljer (valgfritt) ▾'}
        </button>

        {visDetaljer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
            <Velg lbl="Boligtype" val={fakta.boligtype} onChange={v => setFakta({ ...fakta, boligtype: v })}
              valg={['', 'Leilighet', 'Enebolig', 'Tomannsbolig', 'Rekkehus', 'Hytte', 'Annet']} />
            <Velg lbl="Eierform" val={fakta.eierform} onChange={v => setFakta({ ...fakta, eierform: v })}
              valg={['', 'Selveier', 'Andel', 'Aksje', 'Obligasjon']} />
            <InputTall lbl="BRA (m²)" val={fakta.bra_m2} onChange={v => setFakta({ ...fakta, bra_m2: v })} />
            <InputTall lbl="P-rom (m²)" val={fakta.p_rom_m2} onChange={v => setFakta({ ...fakta, p_rom_m2: v })} />
            <InputTall lbl="Byggeår" val={fakta.byggear} onChange={v => setFakta({ ...fakta, byggear: v })} />
            <InputTall lbl="Soverom" val={fakta.soverom} onChange={v => setFakta({ ...fakta, soverom: v })} />
            <InputTall lbl="Bad" val={fakta.bad} onChange={v => setFakta({ ...fakta, bad: v })} />
            <Input lbl="Etasje" val={fakta.etasje} onChange={v => setFakta({ ...fakta, etasje: v })} placeholder="f.eks. 2. etg" />
            <Velg lbl="Energimerke" val={fakta.energimerke} onChange={v => setFakta({ ...fakta, energimerke: v })}
              valg={['', 'A', 'B', 'C', 'D', 'E', 'F', 'G']} />
            <InputTall lbl="Fellesgjeld (NOK)" val={fakta.fellesgjeld_nok} onChange={v => setFakta({ ...fakta, fellesgjeld_nok: v })} />
            <InputTall lbl="Fellesutg/mnd (NOK)" val={fakta.fellesutg_mnd_nok} onChange={v => setFakta({ ...fakta, fellesutg_mnd_nok: v })} />
            <InputTall lbl="Komm. avg/år (NOK)" val={fakta.kommunale_avg_aar_nok} onChange={v => setFakta({ ...fakta, kommunale_avg_aar_nok: v })} />
            <InputTall lbl="Tomt (m²)" val={fakta.tomt_m2} onChange={v => setFakta({ ...fakta, tomt_m2: v })} />
            <Velg lbl="Tomt-type" val={fakta.tomt_type} onChange={v => setFakta({ ...fakta, tomt_type: v })}
              valg={['', 'Eier', 'Festet']} />
            <Velg lbl="Oppussingsgrad" val={fakta.oppussingsgrad} onChange={v => setFakta({ ...fakta, oppussingsgrad: v })}
              valg={['', 'Original', 'Delvis pusset', 'Helt renovert', 'Trenger total renovering']} />
          </div>
        )}
      </div>

      {/* Lagre */}
      <button onClick={lagreSomProsjekt} disabled={lagrer || (!adresse.trim() && !innhenting?.valgt)}
        style={{
          background: lagrer ? FARGER.tekstLys : FARGER.mork,
          color: FARGER.creamLys, border: 'none', borderRadius: RADIUS.sm,
          padding: '12px 22px', fontSize: 13, fontWeight: 600, cursor: lagrer ? 'not-allowed' : 'pointer',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
        {lagrer ? '⏳ Lagrer…' : '💾 Lagre som prosjekt'}
      </button>
      <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '10px 0 0', fontStyle: 'italic' }}>
        Prosjektet havner i listen «Dine norske prosjekter» med 🔍-merke. AI-vurdering, bilde-analyse og PDF-rapport kommer i neste steg.
      </p>
    </div>
  )
}

function Fakta({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: FARGER.tekstLys, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</div>
      <div style={{ fontSize: 13, color: FARGER.mork, fontWeight: 500, marginTop: 2 }}>{val}</div>
    </div>
  )
}

function LenkeChip({ url, lbl }: { url: string; lbl: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-block', background: FARGER.hvit,
        border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.pill,
        padding: '6px 12px', fontSize: 12, color: FARGER.mork,
        textDecoration: 'none', fontWeight: 500,
        transition: `border-color ${MOTION.rask}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = FARGER.gull }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = FARGER.kantLys }}>
      {lbl} ↗
    </a>
  )
}

function Input({ lbl, val, onChange, placeholder }: { lbl: string; val: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={lblStil}>{lbl}</label>
      <input value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={inputStil} />
    </div>
  )
}

function InputTall({ lbl, val, onChange }: { lbl: string; val: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label style={lblStil}>{lbl}</label>
      <input type="number" value={val || ''} onChange={e => onChange(Number(e.target.value) || 0)}
        style={inputStil} />
    </div>
  )
}

function Velg({ lbl, val, onChange, valg }: { lbl: string; val: string; onChange: (v: string) => void; valg: string[] }) {
  return (
    <div>
      <label style={lblStil}>{lbl}</label>
      <select value={val} onChange={e => onChange(e.target.value)} style={{ ...inputStil, fontFamily: 'inherit' }}>
        {valg.map(v => <option key={v} value={v}>{v || '— velg —'}</option>)}
      </select>
    </div>
  )
}

const lblStil: React.CSSProperties = {
  fontSize: 10, color: FARGER.tekstMid, marginBottom: 4, display: 'block',
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
}

const inputStil: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff',
  boxSizing: 'border-box',
}
