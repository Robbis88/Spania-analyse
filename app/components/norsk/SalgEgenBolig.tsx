'use client'
import { FARGER, RADIUS } from '../../lib/styles'
import { KalkInput } from './KalkInput'
import { fmtNokKalk as fmtNok, type EksisterendeBolig, type Paakostning, type Sammenligning } from './types'

type NettoData = {
  meglerhonorar: number; salgskostnader: number; skatt: number; nettoTilDisposisjon: number
  brutto_leie_mnd: number; drift_mnd: number; skatt_leie_mnd: number; netto_leie_mnd: number
  netto_belastning_mnd: number; verdi_etter_horisont: number; verdiokning_total: number
  leie_total: number; total_bidrag_behold: number
  sum_paakostninger: number; inngangsverdi: number
  fremtidig_kapitalgevinst: number; fremtidig_skatt: number
  fremtidig_skatt_uten_paakost: number; skatt_spart_paakost: number; horisont_aar: number
  sum_vedlikehold_i_horisont: number; vedlikehold_fradrag_per_mnd: number
}

type Props = {
  eks: EksisterendeBolig
  setEks: React.Dispatch<React.SetStateAction<EksisterendeBolig>>
  netto: NettoData
  sammenligning: Sammenligning | null
  botidAar: number
  portefoljeListe: Array<{ id: string; navn: string; bolig_data?: { beliggenhet?: string } | null }>
  onAutofyllFraPortefolje: (prosjektId: string) => Promise<void>
}

export function SalgEgenBolig({ eks, setEks, netto, sammenligning, botidAar, portefoljeListe, onAutofyllFraPortefolje }: Props) {
  void botidAar
  function leggTilPaakost() {
    setEks({ ...eks, paakostninger: [...eks.paakostninger, { beskrivelse: '', aar: new Date().getFullYear(), belop: 0, type: 'paakostning' }] })
  }
  function fjernPaakost(i: number) {
    setEks({ ...eks, paakostninger: eks.paakostninger.filter((_, idx) => idx !== i) })
  }
  function oppdaterPaakost(i: number, felt: keyof Paakostning, verdi: string | number) {
    setEks({ ...eks, paakostninger: eks.paakostninger.map((p, idx) => idx === i ? { ...p, [felt]: verdi } : p) })
  }
  return (
    <div style={{ background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: FARGER.gull, letterSpacing: '0.32em', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>🏠 Steg 1 — Eksisterende bolig</div>
      <p style={{ fontSize: 13, color: FARGER.tekstMid, margin: '0 0 14px', fontWeight: 300 }}>
        Velg om du vil selge eller beholde og leie ut. Sammenligningen viser hva som lønner seg over bo-tiden.
      </p>

      {/* Auto-utfylling fra Min portefølje — slipper å taste samme bolig om og om igjen */}
      {portefoljeListe.length > 0 && (
        <div style={{ background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: FARGER.tekstMid, fontWeight: 600 }}>📂 Hent fra Min portefølje:</span>
          <select
            defaultValue=""
            onChange={e => {
              const id = e.target.value
              if (!id) return
              void onAutofyllFraPortefolje(id)
              e.target.value = ''  // tilbakestill så samme valg kan brukes igjen
            }}
            style={{ flex: 1, minWidth: 200, padding: '8px 10px', fontSize: 13, border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm, background: '#fff', cursor: 'pointer' }}>
            <option value="">— Velg eiet eiendom —</option>
            {portefoljeListe.map(p => (
              <option key={p.id} value={p.id}>
                {p.navn}{p.bolig_data?.beliggenhet ? ` · ${p.bolig_data.beliggenhet}` : ''}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: FARGER.tekstLys, fontStyle: 'italic' }}>
            Fyller verdi, restgjeld, lånebetaling og kjøpspris automatisk
          </span>
        </div>
      )}

      {/* MODUS-TOGGLE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 18 }}>
        <button onClick={() => setEks({ ...eks, modus: 'selg' })}
          style={{
            background: eks.modus === 'selg' ? FARGER.mork : 'transparent',
            color: eks.modus === 'selg' ? 'white' : FARGER.mork,
            border: `1px solid ${eks.modus === 'selg' ? FARGER.mork : FARGER.gullSvak}`,
            padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.06em', textAlign: 'left',
          }}>
          <div>💰 SELG</div>
          <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 4, letterSpacing: 'normal' }}>Frigjør egenkapital til kjøp</div>
        </button>
        <button onClick={() => setEks({ ...eks, modus: 'behold' })}
          style={{
            background: eks.modus === 'behold' ? FARGER.mork : 'transparent',
            color: eks.modus === 'behold' ? 'white' : FARGER.mork,
            border: `1px solid ${eks.modus === 'behold' ? FARGER.mork : FARGER.gullSvak}`,
            padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.06em', textAlign: 'left',
          }}>
          <div>🔑 BEHOLD OG LEIE UT</div>
          <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75, marginTop: 4, letterSpacing: 'normal' }}>Få leieinntekt + verdivekst</div>
        </button>
      </div>

      {/* SELG-MODUS */}
      {eks.modus === 'selg' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            <KalkInput lbl="Forventet salgssum" val={eks.salgssum} onChange={v => setEks({ ...eks, salgssum: v })} />
            <KalkInput lbl="Restgjeld på lån" val={eks.restgjeld} onChange={v => setEks({ ...eks, restgjeld: v })} />
            <KalkInput lbl="Meglerhonorar %" val={eks.meglerhonorar_pst} onChange={v => setEks({ ...eks, meglerhonorar_pst: v })} step={0.1} />
            <KalkInput lbl="Markedsføring/takst" val={eks.marknadsforing} onChange={v => setEks({ ...eks, marknadsforing: v })} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', padding: '6px 0', marginBottom: 10 }}>
            <input type="checkbox" checked={eks.skattefri} onChange={e => setEks({ ...eks, skattefri: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span>Skattefritt salg (har bodd 12 av siste 24 mnd — vanlig for primærbolig)</span>
          </label>

          <div style={{ background: FARGER.creamLys, padding: 16, borderRadius: RADIUS.sm }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 13 }}>
              <span style={{ color: FARGER.tekstMid }}>Forventet salgssum</span>
              <span style={{ textAlign: 'right' }}>{fmtNok(eks.salgssum)}</span>
              <span style={{ color: FARGER.tekstMid }}>− Meglerhonorar ({eks.meglerhonorar_pst} %)</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(netto.meglerhonorar)}</span>
              <span style={{ color: FARGER.tekstMid }}>− Markedsføring/takst</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(eks.marknadsforing)}</span>
              <span style={{ color: FARGER.tekstMid }}>− Restgjeld</span>
              <span style={{ textAlign: 'right' }}>− {fmtNok(eks.restgjeld)}</span>
              {!eks.skattefri && netto.skatt > 0 && (
                <>
                  <span style={{ color: FARGER.tekstMid }}>− Skatt (22 %)</span>
                  <span style={{ textAlign: 'right' }}>− {fmtNok(netto.skatt)}</span>
                </>
              )}
              <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
                = Netto til disposisjon (egenkapital)
              </span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: FARGER.mork, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
                {fmtNok(netto.nettoTilDisposisjon)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* BEHOLD-MODUS */}
      {eks.modus === 'behold' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <KalkInput lbl="Markedsverdi i dag" val={eks.verdi_naa} onChange={v => setEks({ ...eks, verdi_naa: v })} />
            <KalkInput lbl="Opprinnelig kjøpspris" val={eks.opprinnelig_kjopspris} onChange={v => setEks({ ...eks, opprinnelig_kjopspris: v })} />
            <KalkInput lbl="Restgjeld på lån" val={eks.restgjeld} onChange={v => setEks({ ...eks, restgjeld: v })} />
            <KalkInput lbl="Mnd-betaling lån (renter+avdrag)" val={eks.mnd_lan_betaling} onChange={v => setEks({ ...eks, mnd_lan_betaling: v })} />
            <KalkInput lbl="Rente på gammelt lån %" val={eks.rente_pst_gammel} onChange={v => setEks({ ...eks, rente_pst_gammel: v })} step={0.1} />
            <KalkInput lbl="Restløpetid lån (år, valgfri)" val={eks.restlopetid_aar_gammel} onChange={v => setEks({ ...eks, restlopetid_aar_gammel: v })} step={1} />
            <KalkInput lbl="Utleie-horisont (år)" val={eks.utleie_horisont_aar} onChange={v => setEks({ ...eks, utleie_horisont_aar: v })} step={1} />
            <KalkInput lbl="Forventet leie/mnd (brutto)" val={eks.utleie_mnd_brutto} onChange={v => setEks({ ...eks, utleie_mnd_brutto: v })} />
            <KalkInput lbl="Belegg %" val={eks.utleie_belegg_pst} onChange={v => setEks({ ...eks, utleie_belegg_pst: v })} step={1} />
            <KalkInput lbl="Drift %" val={eks.utleie_drift_pst} onChange={v => setEks({ ...eks, utleie_drift_pst: v })} step={1} />
            <KalkInput lbl="Årlig prisvekst %" val={eks.arlig_prisvekst_pst} onChange={v => setEks({ ...eks, arlig_prisvekst_pst: v })} step={0.1} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: FARGER.tekstMork, cursor: 'pointer', padding: '6px 0', marginBottom: 10 }}>
            <input type="checkbox" checked={eks.utleie_skattepliktig}
              onChange={e => setEks({ ...eks, utleie_skattepliktig: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span>Leieinntekt er skattepliktig (ikke primærbolig — typisk 22 % av netto)</span>
          </label>

          {eks.verdi_naa > 0 && (
            <div style={{ background: FARGER.creamLys, padding: 16, borderRadius: RADIUS.sm }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 13 }}>
                <span style={{ color: FARGER.tekstMid, fontWeight: 600 }}>Månedlig:</span>
                <span></span>
                <span style={{ color: FARGER.tekstMid }}>Brutto leie ({eks.utleie_belegg_pst} % belegg)</span>
                <span style={{ textAlign: 'right' }}>{fmtNok(netto.brutto_leie_mnd)}</span>
                <span style={{ color: FARGER.tekstMid }}>− Drift ({eks.utleie_drift_pst} %)</span>
                <span style={{ textAlign: 'right' }}>− {fmtNok(netto.drift_mnd)}</span>
                {netto.vedlikehold_fradrag_per_mnd > 0 && (
                  <>
                    <span style={{ color: FARGER.tekstMid }}>− Vedlikehold (skattefradrag)</span>
                    <span style={{ textAlign: 'right', color: '#1a4d2b' }}>− {fmtNok(netto.vedlikehold_fradrag_per_mnd)}</span>
                  </>
                )}
                {netto.skatt_leie_mnd > 0 && (
                  <>
                    <span style={{ color: FARGER.tekstMid }}>− Skatt på netto leie (22 %)</span>
                    <span style={{ textAlign: 'right' }}>− {fmtNok(netto.skatt_leie_mnd)}</span>
                  </>
                )}
                <span style={{ color: FARGER.mork, fontWeight: 600 }}>= Netto leieinntekt</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: FARGER.suksess }}>{fmtNok(netto.netto_leie_mnd)}</span>
                <span style={{ color: FARGER.tekstMid }}>− Mnd-betaling lån</span>
                <span style={{ textAlign: 'right' }}>− {fmtNok(eks.mnd_lan_betaling)}</span>
                <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
                  Netto cashflow / mnd
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: netto.netto_belastning_mnd <= 0 ? FARGER.suksess : '#7a0c1e', borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 8, marginTop: 4 }}>
                  {netto.netto_belastning_mnd <= 0 ? '+ ' : '− '}{fmtNok(Math.abs(netto.netto_belastning_mnd))}
                </span>

                <span style={{ color: FARGER.tekstMid, fontWeight: 600, marginTop: 12 }}>Over {netto.horisont_aar.toFixed(0)} år (utleie-horisont):</span>
                <span style={{ marginTop: 12 }}></span>
                <span style={{ color: FARGER.tekstMid }}>Verdi-vekst (boligen øker)</span>
                <span style={{ textAlign: 'right', color: FARGER.suksess, fontWeight: 600 }}>+ {fmtNok(netto.verdiokning_total)}</span>
                <span style={{ color: FARGER.tekstMid }}>Netto leieinntekt totalt</span>
                <span style={{ textAlign: 'right', color: FARGER.suksess, fontWeight: 600 }}>+ {fmtNok(netto.leie_total)}</span>
                <span style={{ color: FARGER.tekstMid }}>Verdi etter {netto.horisont_aar.toFixed(0)} år</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNok(netto.verdi_etter_horisont)}</span>
              </div>
            </div>
          )}

          {/* PÅKOSTNINGER — øker inngangsverdi → mindre skatt ved fremtidig salg */}
          <div style={{ marginTop: 14, padding: 14, background: 'white', border: `1px solid ${FARGER.kantLys}`, borderRadius: RADIUS.sm }}>
            <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>📋 Tidligere kostnader på boligen</div>
            <p style={{ fontSize: 12, color: FARGER.tekstMid, margin: '0 0 6px', lineHeight: 1.5 }}>
              Marker hver post som <strong>påkostning</strong> (hever standard — øker inngangsverdi) eller <strong>vedlikehold</strong> (gjenoppretter standard — fradrag i leieinntekt under utleie).
            </p>
            <p style={{ fontSize: 11, color: FARGER.tekstLys, margin: '0 0 12px', lineHeight: 1.5, fontStyle: 'italic' }}>
              Eksempler påkostning: nytt bad, kjøkken, tilbygg, ny pipe.<br />
              Eksempler vedlikehold: maling, bytte slitt parkett, reparere takstein, oppgradere rør (når gammelt var slitt).
            </p>

            {eks.paakostninger.length === 0 && (
              <div style={{ fontSize: 12, color: FARGER.tekstLys, fontStyle: 'italic', padding: '6px 0' }}>Ingen kostnader registrert.</div>
            )}
            {eks.paakostninger.map((p, i) => {
              const erVedlikehold = p.type === 'vedlikehold'
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 110px auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: i < eks.paakostninger.length - 1 ? `1px solid ${FARGER.kantLys}` : 'none' }}>
                  <input value={p.beskrivelse} onChange={e => oppdaterPaakost(i, 'beskrivelse', e.target.value)}
                    placeholder="F.eks. Nytt bad"
                    style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', background: 'white' }} />
                  <select value={p.type ?? 'paakostning'} onChange={e => oppdaterPaakost(i, 'type', e.target.value)}
                    style={{ padding: '6px 8px', fontSize: 12, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, background: erVedlikehold ? '#e8f5ed' : '#fdfcf7', color: FARGER.mork, cursor: 'pointer' }}>
                    <option value="paakostning">Påkostning</option>
                    <option value="vedlikehold">Vedlikehold</option>
                  </select>
                  <input type="number" min={1990} max={new Date().getFullYear() + 30} value={p.aar || ''}
                    onChange={e => oppdaterPaakost(i, 'aar', Number(e.target.value) || new Date().getFullYear())}
                    placeholder="År"
                    style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
                  <input type="number" min={0} step={10000} value={p.belop || ''}
                    onChange={e => oppdaterPaakost(i, 'belop', Number(e.target.value) || 0)}
                    placeholder="kr"
                    style={{ padding: '6px 10px', fontSize: 13, borderRadius: RADIUS.sm, border: `1px solid ${FARGER.kant}`, fontFamily: 'sans-serif', textAlign: 'right', background: 'white' }} />
                  <button onClick={() => fjernPaakost(i)} title="Fjern"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '4px 8px' }}>✕</button>
                </div>
              )
            })}
            <button onClick={leggTilPaakost}
              style={{ marginTop: 10, background: FARGER.creamLys, border: `1px solid ${FARGER.gullSvak}`, borderRadius: RADIUS.sm, padding: '8px 14px', fontSize: 12, color: FARGER.mork, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              + Legg til kostnad
            </button>

            {netto.sum_vedlikehold_i_horisont > 0 && (
              <div style={{ marginTop: 12, padding: 12, background: '#e8f5ed', borderRadius: RADIUS.sm, fontSize: 12, color: '#1a4d2b', lineHeight: 1.6 }}>
                💡 Sum vedlikehold innen utleie-horisonten: <strong>{fmtNok(netto.sum_vedlikehold_i_horisont)}</strong>.
                Det gir <strong>{fmtNok(netto.vedlikehold_fradrag_per_mnd)}/mnd</strong> i fradrag mot leieinntekten — sparer deg ca. <strong>{fmtNok(netto.sum_vedlikehold_i_horisont * 0.22)}</strong> i skatt over perioden.
              </div>
            )}

            {netto.sum_paakostninger > 0 && eks.opprinnelig_kjopspris > 0 && (
              <div style={{ marginTop: 12, padding: 12, background: '#e8f5ed', borderRadius: RADIUS.sm }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 12 }}>
                  <span style={{ color: FARGER.tekstMid }}>Opprinnelig kjøpspris</span>
                  <span style={{ textAlign: 'right' }}>{fmtNok(eks.opprinnelig_kjopspris)}</span>
                  <span style={{ color: FARGER.tekstMid }}>+ Sum påkostninger ({eks.paakostninger.length} st.)</span>
                  <span style={{ textAlign: 'right', color: FARGER.suksess }}>+ {fmtNok(netto.sum_paakostninger)}</span>
                  <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 2 }}>
                    = Inngangsverdi
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 2 }}>
                    {fmtNok(netto.inngangsverdi)}
                  </span>
                </div>
                {netto.skatt_spart_paakost > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.7)', borderRadius: RADIUS.sm, fontSize: 12, color: '#1a4d2b', lineHeight: 1.5 }}>
                    💡 Påkostningene sparer deg <strong>{fmtNok(netto.skatt_spart_paakost)}</strong> i kapitalgevinst-skatt ved salg om {netto.horisont_aar.toFixed(0)} år
                    (skatt med påkostninger: {fmtNok(netto.fremtidig_skatt)} vs uten: {fmtNok(netto.fremtidig_skatt_uten_paakost)})
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* SAMMENLIGNING SELG vs BEHOLD */}
      {sammenligning && (
        <div style={{
          marginTop: 16,
          background: sammenligning.anbefaling === 'behold' ? '#e8f5ed' : sammenligning.anbefaling === 'selg' ? '#f0f7ff' : FARGER.creamLys,
          border: `1.5px solid ${sammenligning.anbefaling === 'behold' ? '#2D7D46' : sammenligning.anbefaling === 'selg' ? FARGER.gull : FARGER.gullSvak}`,
          borderRadius: RADIUS.sm, padding: 16,
        }}>
          <div style={{ fontSize: 11, color: FARGER.gull, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
            ⚖️ Selg vs Behold over {sammenligning.aar.toFixed(1)} år
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: FARGER.tekstLys, fontWeight: 600, marginBottom: 4 }}>💰 SELG-SCENARIO</div>
              <div style={{ fontSize: 13, color: FARGER.tekstMid, marginBottom: 6 }}>Frigjort EK brukes som EK i ny bolig</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: FARGER.mork }}>{fmtNok(sammenligning.selgTotalt)}</div>
              <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 4 }}>Netto formue-bidrag</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: FARGER.tekstLys, fontWeight: 600, marginBottom: 4 }}>🔑 BEHOLD-SCENARIO</div>
              <div style={{ fontSize: 13, color: FARGER.tekstMid, marginBottom: 6 }}>EK-vekst + nedbetaling + leie</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: FARGER.mork }}>{fmtNok(sammenligning.beholdTotalt)}</div>
              <div style={{ fontSize: 11, color: FARGER.tekstLys, marginTop: 4 }}>Netto formue-bidrag</div>
            </div>
          </div>

          {/* Detaljert oppstilling for behold-scenariet */}
          <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: RADIUS.sm, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: FARGER.tekstMid, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Behold — slik bygges formuen over {sammenligning.aar.toFixed(1)} år</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 13 }}>
              <span style={{ color: FARGER.tekstMid }}>+ Verdivekst på gammel bolig</span>
              <span style={{ textAlign: 'right', color: FARGER.suksess, fontWeight: 600 }}>+ {fmtNok(sammenligning.beholdVerdivekst)}</span>
              <span style={{ color: FARGER.tekstMid }}>+ Nedbetaling av lån (avdrag)</span>
              <span style={{ textAlign: 'right', color: FARGER.suksess, fontWeight: 600 }}>+ {fmtNok(sammenligning.beholdAvdragSum)}</span>
              <span style={{ color: FARGER.tekstMid }}>+ Netto leieinntekt</span>
              <span style={{ textAlign: 'right', color: FARGER.suksess, fontWeight: 600 }}>+ {fmtNok(sammenligning.beholdNettoLeie)}</span>
              <span style={{ color: FARGER.tekstMid }}>− Ekstra rentekostnad på ny bolig</span>
              <span style={{ textAlign: 'right', color: '#7a0c1e' }}>- {fmtNok(sammenligning.beholdEkstraRente)}</span>
              <span style={{ color: FARGER.mork, fontWeight: 700, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 4 }}>= Netto formue-bidrag</span>
              <span style={{ textAlign: 'right', fontWeight: 700, color: FARGER.mork, borderTop: `1px solid ${FARGER.kantLys}`, paddingTop: 6, marginTop: 4 }}>{fmtNok(sammenligning.beholdTotalt)}</span>
              <span style={{ color: FARGER.tekstLys, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>EK i gammel bolig om {sammenligning.aar.toFixed(0)} år</span>
              <span style={{ textAlign: 'right', color: FARGER.tekstLys, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>{fmtNok(sammenligning.beholdEKGammel)}</span>
            </div>
          </div>

          <div style={{ paddingTop: 10, borderTop: `1px solid ${FARGER.kantLys}`, fontSize: 14, fontWeight: 600 }}>
            {sammenligning.anbefaling === 'behold' && (
              <span style={{ color: '#1a4d2b' }}>🟢 Behold lønner seg med +{fmtNok(sammenligning.differanse)} over {sammenligning.aar.toFixed(1)} år</span>
            )}
            {sammenligning.anbefaling === 'selg' && (
              <span style={{ color: FARGER.tekstMork }}>💰 Selg lønner seg — behold-scenariet gir {fmtNok(sammenligning.differanse)} mindre</span>
            )}
            {sammenligning.anbefaling === 'likt' && <span>⚖️ Tilnærmet likt — andre faktorer (risiko, fleksibilitet) blir avgjørende</span>}
          </div>
        </div>
      )}
    </div>
  )
}
