'use client'
import type { Prosjekt } from '../types'
import { FARGER, RADIUS, SHADOW, MOTION } from '../lib/styles'

type Steg = {
  ikon: string
  lbl: string
  /** Tekst som pre-fylles i chat-roboten — chat-roboten ser også prosjekt-konteksten. */
  prompt: string
}

// Anbefalte handlinger per status. Hver knapp åpner chat-roboten med
// boligen pre-valgt og en ferdig prompt — du kan redigere før du sender.
const STEG_PER_STATUS: Record<string, Steg[]> = {
  'Under vurdering': [
    { ikon: '🔎', lbl: 'Spør megler om detaljer', prompt: 'Lag e-postutkast til megler med spørsmål om denne boligen — fokuser på: status på dokumenter (escritura, IBI, energiattest), kjente skjulte feil, hvor lenge har den vært på markedet, og om det er rom for forhandling.' },
    { ikon: '🗓️', lbl: 'Avtal befaring', prompt: 'Lag e-postutkast til megler for å avtale befaring av boligen. Foreslå to-tre tidsalternativer de neste 14 dagene, og spør om jeg kan ta med en lokal håndverker for å vurdere oppussingsbehov.' },
    { ikon: '🏦', lbl: 'Hent finansiering', prompt: 'Lag e-postutkast til banken for finansieringssamtale om denne boligen. Inkluder kjøpesum, egenkapitalsplan og spør om indikativt rentenivå og hva som trengs for å få lånetilsagn.' },
    { ikon: '💰', lbl: 'Legg inn bud', prompt: 'Lag e-postutkast til megler med formelt bud på boligen. Begrunn budsummen ut fra markedsanalysen, sett gyldighetsfrist 48 timer, og spør om aksept før jeg fortsetter prosessen.' },
  ],
  'Kjøpt': [
    { ikon: '🔧', lbl: 'Be om håndverkertilbud', prompt: 'Lag e-postutkast til håndverkere i nettverket for å be om tilbud på oppussing av boligen. Beskriv rom, omfang og ønsket tidsramme.' },
    { ikon: '📄', lbl: 'Sjekk dokumenter', prompt: 'Lag liste over alle dokumenter jeg burde sikre nå som boligen er kjøpt: escritura, nota simple, IBI-kvittering, suministros, energiattest, VFT-lisens. For hvert dokument: hvem henter det, hvor leveres det, og hva er konsekvensen hvis det mangler.' },
    { ikon: '🏖️', lbl: 'Start utleie-prep', prompt: 'Lag plan for å gjøre boligen utleieklar: møblering, fotografering, listing på Airbnb/Booking, prising, og hva som må være på plass juridisk (VFT) før første gjest.' },
  ],
  'Under oppussing': [
    { ikon: '📸', lbl: 'Logg fremdrift', prompt: 'Be meg om bilder eller status fra håndverkerne for å oppdatere fremdriften i oppussings-budsjettet. Lag en kort sjekkliste over hva som mangler for at jeg skal kunne markere ferdige poster i loggen.' },
    { ikon: '💸', lbl: 'Sjekk overskridelser', prompt: 'Gå gjennom oppussingsposter og varsle om budsjett-overskridelser. For hver post over budsjett: hva er årsaken, hva er totalkostnaden, og hva betyr det for prosjektets ROI?' },
    { ikon: '🔧', lbl: 'Ny tilbudsforespørsel', prompt: 'Jeg trenger et nytt tilbud på en oppgave i oppussingen. Hjelp meg å formulere forespørselen til håndverker — vi velger detaljene sammen.' },
  ],
  'Utleie': [
    { ikon: '📊', lbl: 'Vurder pris', prompt: 'Vurder dagens nattpris og belegg mot markedet og sammenlignbare boliger i området. Anbefal eventuelle prisjusteringer for høysesong/lavsesong, og hvor mye det vil bety i økt cashflow.' },
    { ikon: '🏖️', lbl: 'Optimer listing', prompt: 'Gå gjennom Airbnb/Booking-listingen vår og foreslå konkrete forbedringer på bilder, tekst, fasiliteter og prising for å øke konverteringen.' },
    { ikon: '💰', lbl: 'Vurder salg', prompt: 'Vurder om vi bør selge boligen nå eller fortsette utleien. Sammenlign forventet salgspris (etter kostnader og skatt) med fremtidig cashflow over 2-5 år.' },
  ],
  'Solgt': [
    { ikon: '📄', lbl: 'Lag salgsrapport', prompt: 'Lag en oppsummering av hele prosjektet: kjøpesum, totalinvesteringer, oppussingskostnader, leieinntekter (om noen), salgssum, skatt og endelig fortjeneste. Inkluder ROI og hva som drev resultatet.' },
    { ikon: '🏦', lbl: 'Sjekk skatteoppgjør', prompt: 'Gå gjennom skattekonsekvensene av salget: CGT, plusvalía, 3% retention og Modelo 210. Hva må jeg passe på, og hvilke dokumenter trenger gestoren for å levere?' },
  ],
}

export function NesteSteg({ prosjekt }: { prosjekt: Prosjekt }) {
  const steg = STEG_PER_STATUS[prosjekt.status] || []
  if (steg.length === 0) return null

  function aapneChatMed(prompt: string) {
    window.dispatchEvent(new CustomEvent<{ prosjektId: string; prompt?: string }>('app-open-chat', {
      detail: { prosjektId: prosjekt.id, prompt },
    }))
  }

  return (
    <div className="anim-fade-up" style={{
      background: FARGER.creamLys,
      border: `1px solid ${FARGER.gull}33`,
      borderRadius: RADIUS.lg,
      padding: 18, marginBottom: 22,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FARGER.gull, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          🎯 Neste steg
        </div>
        <div style={{ fontSize: 12, color: FARGER.tekstMid }}>
          ({prosjekt.status})
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {steg.map((s, i) => (
          <button key={i} onClick={() => aapneChatMed(s.prompt)} className="knapp-hover-loft"
            style={{
              background: FARGER.hvit,
              color: FARGER.mork,
              border: `1px solid ${FARGER.kantUltralys}`,
              borderRadius: RADIUS.pill,
              padding: '10px 18px',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '-0.005em',
              boxShadow: SHADOW.xs,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: `transform ${MOTION.rask}, box-shadow ${MOTION.rask}, background ${MOTION.rask}`,
            }}>
            <span aria-hidden style={{ fontSize: 15 }}>{s.ikon}</span>
            {s.lbl}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: FARGER.tekstLys, marginTop: 12, fontStyle: 'italic', lineHeight: 1.55 }}>
        Hver knapp åpner chat-roboten med boligen pre-valgt og en ferdig forespørsel — du kan redigere før du sender.
      </div>
    </div>
  )
}
