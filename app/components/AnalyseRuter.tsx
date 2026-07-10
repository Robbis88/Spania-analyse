'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

// Begge motorene lastes lazy — bare den brukeren faktisk lander på havner i JS.
const laster = () => <div style={{ textAlign: 'center', padding: 60, color: FARGER.tekstLys }}>Laster…</div>
const Boliganalyse = dynamic(() => import('./Boliganalyse').then(m => m.Boliganalyse), { ssr: false, loading: laster })
const NorskeBoliger = dynamic(() => import('./NorskeBoliger').then(m => m.NorskeBoliger), { ssr: false, loading: laster })

type Land = 'norge' | 'spania'

// Oppdager om en annonse/tekst gjelder en norsk eller spansk bolig.
// Returnerer null når vi ikke har nok signaler — da faller ruteren tilbake til
// Spania (appens primærmarked), men brukeren kan alltid overstyre manuelt.
export function detektLand(tekst: string): Land | null {
  const s = tekst.toLowerCase()
  if (!s.trim()) return null

  // 1) Lenke-domener er de sterkeste signalene
  if (/finn\.no/.test(s)) return 'norge'
  if (/idealista|fotocasa|kyero|habitaclia|pisos\.com|spainhouses|thinkspain/.test(s)) return 'spania'

  // 2) Tekst-heuristikk (valuta, fagord, stedsnavn, bokstaver)
  let norge = 0
  let spania = 0
  if (/\bnok\b|\bkr\b|kroner/.test(s)) norge += 1
  if (/€|\beur\b|euro/.test(s)) spania += 1
  if (/fellesgjeld|prisantydning|borettslag|sameie|kommunale avg|felleskostnad|bydel|finnkode|andelsbolig|selveier/.test(s)) norge += 2
  if (/catastro|referencia catastral|piscina|marbella|málaga|malaga|costa del sol|alicante|estepona|torrevieja|provincia/.test(s)) spania += 2
  if (/[æøå]/.test(s)) norge += 1
  if (/\b(oslo|bergen|trondheim|stavanger|drammen|fredrikstad|kristiansand|tromsø|sandnes)\b/.test(s)) norge += 1

  if (norge === 0 && spania === 0) return null
  return norge >= spania ? 'norge' : 'spania'
}

const LAND_META: Record<Land, { flagg: string; navn: string }> = {
  norge: { flagg: '🇳🇴', navn: 'Norsk bolig' },
  spania: { flagg: '🇪🇸', navn: 'Spansk bolig' },
}

export function AnalyseRuter({ onTilbake }: { onTilbake: () => void }) {
  const [raw, setRaw] = useState('')
  const [overstyr, setOverstyr] = useState<Land | 'auto'>('auto')
  const [aktiv, setAktiv] = useState<{ land: Land; input: string } | null>(null)

  const detektert = useMemo(() => detektLand(raw), [raw])
  const forhandsvalgt: Land = overstyr !== 'auto' ? overstyr : (detektert ?? 'spania')

  function start(medInput: boolean) {
    setAktiv({ land: forhandsvalgt, input: medInput ? raw : '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function nyAnalyse() {
    setAktiv(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function byttLand() {
    setAktiv(a => (a ? { ...a, land: a.land === 'norge' ? 'spania' : 'norge' } : a))
  }

  // === Aktiv motor: kontekstlinje + valgt komponent ===
  if (aktiv) {
    const meta = LAND_META[aktiv.land]
    const annenLand: Land = aktiv.land === 'norge' ? 'spania' : 'norge'
    const annen = LAND_META[annenLand]
    return (
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
          borderRadius: RADIUS.pill, padding: '8px 10px 8px 16px', marginBottom: 20,
          boxShadow: SHADOW.xs,
        }}>
          <span style={{ fontSize: 13, color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '-0.005em' }}>
            Analyserer som <strong style={{ color: FARGER.mork }}>{meta.flagg} {meta.navn}</strong>
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={byttLand} className="nav-lenke" style={{
            background: 'transparent', border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.pill, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer',
            color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '-0.005em',
          }}>Bytt til {annen.flagg} {annenLand}</button>
          <button onClick={nyAnalyse} className="nav-lenke" style={{
            background: FARGER.mork, border: 'none',
            borderRadius: RADIUS.pill, padding: '7px 16px', fontSize: 12.5, cursor: 'pointer',
            color: FARGER.creamLys, fontWeight: 600, letterSpacing: '-0.005em',
          }}>Ny analyse</button>
        </div>
        {aktiv.land === 'norge'
          ? <NorskeBoliger key="norge" onTilbake={nyAnalyse} initialInput={aktiv.input} autoRun={!!aktiv.input} />
          : <Boliganalyse key="spania" onTilbake={nyAnalyse} initialInput={aktiv.input} autoRun={!!aktiv.input} />}
      </div>
    )
  }

  // === Inngang: ett felt, auto-deteksjon, manuell overstyring ===
  return (
    <div>
      <button onClick={onTilbake} className="nav-lenke" style={{
        background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
        borderRadius: RADIUS.pill, padding: '8px 16px 8px 12px',
        fontSize: 13, cursor: 'pointer', marginBottom: 22,
        color: FARGER.tekstMid, fontWeight: 500, boxShadow: SHADOW.xs,
        display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '-0.005em',
      }}><span aria-hidden>←</span> Tilbake</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ fontSize: 40 }}>🔍</div>
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 500, margin: 0, color: FARGER.mork, letterSpacing: '-0.02em' }}>Boliganalyse</h2>
          <p style={{ color: FARGER.tekstMid, margin: '4px 0 0', fontSize: 14 }}>Lim inn en annonse — vi ser selv om den er norsk eller spansk</p>
        </div>
      </div>

      <div style={{ background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`, borderRadius: RADIUS.lg, padding: 24, marginBottom: 24, boxShadow: SHADOW.sm }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.18em' }}>Lim inn bolig-info</div>
        <textarea
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder="Lim inn Finn.no- eller Idealista-lenke, eller beskriv eiendommen&#10;&#10;Norsk eks: Finn.no-lenke, eller «3-roms, 78 m², Bergenhus, prisantydning 4 900 000 kr»&#10;Spansk eks: «Villa 4 soverom, 180 m², privat pool, €650 000, Marbella»"
          style={{
            width: '100%', height: 150, padding: 14, fontSize: 14,
            borderRadius: RADIUS.md, border: `1px solid ${FARGER.kant}`,
            resize: 'vertical', fontFamily: 'inherit', background: FARGER.creamLys,
            transition: `border-color ${MOTION.rask}, box-shadow ${MOTION.rask}`, outline: 'none',
          }}
        />

        {/* Deteksjons-status + manuell overstyring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ fontSize: 13, color: FARGER.tekstMid, letterSpacing: '-0.005em' }}>
            {overstyr !== 'auto'
              ? <>Valgt manuelt: <strong style={{ color: FARGER.mork }}>{LAND_META[overstyr].flagg} {LAND_META[overstyr].navn}</strong></>
              : detektert
                ? <>Oppdaget: <strong style={{ color: FARGER.mork }}>{LAND_META[detektert].flagg} {LAND_META[detektert].navn}</strong></>
                : <span style={{ color: FARGER.tekstLys }}>Landet oppdages automatisk fra lenken/teksten</span>}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'inline-flex', gap: 4, background: FARGER.creamLys, padding: 4, borderRadius: RADIUS.pill, border: `1px solid ${FARGER.kantUltralys}` }}>
            {([
              ['auto', 'Auto'] as const,
              ['norge', '🇳🇴 Norge'] as const,
              ['spania', '🇪🇸 Spania'] as const,
            ]).map(([id, lbl]) => {
              const valgt = overstyr === id
              return (
                <button key={id} onClick={() => setOverstyr(id)} style={{
                  background: valgt ? FARGER.mork : 'transparent',
                  color: valgt ? FARGER.creamLys : FARGER.tekstMid,
                  border: 'none', cursor: 'pointer',
                  padding: '7px 14px', borderRadius: RADIUS.pill,
                  fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em',
                  transition: `background ${MOTION.rask}, color ${MOTION.rask}`,
                }}>{lbl}</button>
              )
            })}
          </div>
        </div>

        <button onClick={() => start(true)} disabled={!raw.trim()} className="knapp-hover-loft" style={{
          width: '100%', marginTop: 16,
          background: !raw.trim() ? FARGER.tekstLys : FARGER.mork,
          color: FARGER.creamLys, border: 'none', padding: 14, borderRadius: RADIUS.pill,
          fontSize: 14, fontWeight: 600, cursor: !raw.trim() ? 'not-allowed' : 'pointer',
          letterSpacing: '-0.005em', boxShadow: !raw.trim() ? 'none' : SHADOW.sm,
          transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}`,
        }}>
          🚀 Analyser {LAND_META[forhandsvalgt].flagg} {forhandsvalgt === 'norge' ? 'norsk' : 'spansk'} bolig
        </button>
      </div>

      {/* Snarveier — åpne en motor direkte uten annonse (f.eks. for å se lagrede prosjekter) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: FARGER.tekstLys, letterSpacing: '0.02em' }}>Eller åpne uten annonse:</span>
        <button onClick={() => { setOverstyr('norge'); setAktiv({ land: 'norge', input: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="nav-lenke" style={{
            background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.pill, padding: '9px 16px', fontSize: 13, cursor: 'pointer',
            color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '-0.005em', boxShadow: SHADOW.xs,
          }}>🇳🇴 Norske boliger</button>
        <button onClick={() => { setOverstyr('spania'); setAktiv({ land: 'spania', input: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="nav-lenke" style={{
            background: FARGER.hvit, border: `1px solid ${FARGER.kantUltralys}`,
            borderRadius: RADIUS.pill, padding: '9px 16px', fontSize: 13, cursor: 'pointer',
            color: FARGER.tekstMid, fontWeight: 500, letterSpacing: '-0.005em', boxShadow: SHADOW.xs,
          }}>🇪🇸 Spansk analyse</button>
      </div>
    </div>
  )
}
