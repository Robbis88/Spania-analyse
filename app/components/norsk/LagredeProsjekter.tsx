'use client'
import { useState } from 'react'
import { FARGER, RADIUS } from '../../lib/styles'

type LagretProsjekt = {
  id: string
  navn: string
  opprettet: string
  bolig_data?: { beliggenhet?: string }
  norsk_kalkulator_data?: Record<string, unknown> | null
  skjult_for?: string[] | null
  off_market?: boolean
}

type Props = {
  prosjekter: LagretProsjekt[]
  onLastInn: (p: { id: string; norsk_kalkulator_data?: Record<string, unknown> | null }) => void
  onSlett: (id: string, navn: string) => void
  aktivId: string | null
  adminBrukere: string[]
  aktivBruker: string
  onOppdaterSkjult: (prosjektId: string, skjultFor: string[]) => Promise<void>
  onMarkerSomKjopt: (prosjektId: string, navn: string) => Promise<void>
}

export function LagredeProsjekter({ prosjekter, onLastInn, onSlett, aktivId, adminBrukere, aktivBruker, onOppdaterSkjult, onMarkerSomKjopt }: Props) {
  const [synligPopover, setSynligPopover] = useState<string | null>(null)
  // Andre admin-brukere = alle utenom meg selv
  const andreBrukere = adminBrukere.filter(b => b !== aktivBruker)

  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 20, marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>📂 Dine norske prosjekter</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {prosjekter.map(p => {
          const erAktiv = aktivId === p.id
          const beliggenhet = p.bolig_data?.beliggenhet || ''
          const dato = new Date(p.opprettet).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
          const skjultFor = p.skjult_for || []
          const antallSkjult = skjultFor.filter(b => andreBrukere.includes(b)).length
          const popoverApen = synligPopover === p.id
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', borderRadius: RADIUS.sm,
              background: erAktiv ? FARGER.creamLys : 'transparent',
              border: erAktiv ? `1px solid ${FARGER.gull}` : `1px solid transparent`,
              position: 'relative',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: FARGER.mork, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {erAktiv && '★ '}{p.navn}
                  {p.off_market && (
                    <span title="Off-market vurdering" style={{ fontSize: 10, background: FARGER.creamLys, border: `1px solid ${FARGER.gull}`, color: FARGER.gull, padding: '2px 6px', borderRadius: RADIUS.pill, fontWeight: 700, letterSpacing: '0.06em' }}>
                      🔍 OFF-MARKET
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 2 }}>
                  {beliggenhet ? beliggenhet + ' · ' : ''}Lagret {dato}
                  {antallSkjult > 0 && <span style={{ marginLeft: 8, color: FARGER.advarsel }}>· 🔒 skjult for {antallSkjult}</span>}
                </div>
              </div>
              <button onClick={() => onLastInn(p)} disabled={erAktiv}
                style={{ background: erAktiv ? FARGER.flateLys : FARGER.mork, color: erAktiv ? FARGER.tekstMid : 'white', border: 'none', borderRadius: RADIUS.sm, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: erAktiv ? 'default' : 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {erAktiv ? 'Aktiv' : 'Åpne'}
              </button>
              <button onClick={() => onMarkerSomKjopt(p.id, p.navn)}
                title="Marker som kjøpt og flytt til Min portefølje"
                style={{ background: FARGER.suksessBg, color: FARGER.suksess, border: 'none', borderRadius: RADIUS.sm, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em' }}>
                ✓ Kjøpt
              </button>
              {andreBrukere.length > 0 && (
                <button onClick={() => setSynligPopover(popoverApen ? null : p.id)}
                  title="Velg hvem som skal se prosjektet"
                  style={{ background: antallSkjult > 0 ? FARGER.flateMid : 'transparent', border: 'none', color: antallSkjult > 0 ? FARGER.advarsel : FARGER.tekstLys, cursor: 'pointer', fontSize: 13, padding: '6px 10px', borderRadius: RADIUS.sm }}>
                  {antallSkjult > 0 ? '🔒' : '👁️'}
                </button>
              )}
              <button onClick={() => onSlett(p.id, p.navn)}
                title="Slett prosjekt"
                style={{ background: 'transparent', border: 'none', color: FARGER.tekstLys, cursor: 'pointer', fontSize: 14, padding: '4px 8px' }}>
                🗑
              </button>

              {popoverApen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 12, marginTop: 4,
                  background: '#fff', border: `1px solid ${FARGER.kantLys}`,
                  borderRadius: RADIUS.sm, boxShadow: '0 6px 24px rgba(14,23,38,0.15)',
                  padding: 12, minWidth: 240, zIndex: 10,
                }}>
                  <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Skjul for
                  </div>
                  {andreBrukere.map(b => {
                    const erSkjult = skjultFor.includes(b)
                    return (
                      <label key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, color: FARGER.mork }}>
                        <input type="checkbox" checked={erSkjult}
                          onChange={() => {
                            const ny = erSkjult ? skjultFor.filter(x => x !== b) : [...skjultFor, b]
                            void onOppdaterSkjult(p.id, ny)
                          }}
                          style={{ accentColor: FARGER.advarsel }} />
                        <span>{b.charAt(0).toUpperCase() + b.slice(1)}</span>
                      </label>
                    )
                  })}
                  <div style={{ fontSize: 10, color: FARGER.tekstLys, marginTop: 8, fontStyle: 'italic' }}>
                    Skjuler kun i listene — alle admin-brukere har samme tilgang under panseret.
                  </div>
                  <button onClick={() => setSynligPopover(null)}
                    style={{ width: '100%', marginTop: 8, background: FARGER.flateMid, border: 'none', padding: '6px 10px', borderRadius: RADIUS.sm, fontSize: 11, color: FARGER.tekstMid, cursor: 'pointer' }}>
                    Lukk
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
