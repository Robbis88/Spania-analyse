import type { LopendePerManed, OppussingBudsjett, OppussingPost, Prosjekt } from '../types'

export const POSTE_FORSLAG = [
  'Bad', 'Kjøkken', 'Soverom', 'Stue', 'Gang/entré',
  'Uteplass/terrasse', 'Basseng', 'Hage', 'Fasade', 'Tak',
  'Vinduer', 'El-anlegg', 'VVS', 'Gulv', 'Maling innvendig',
]

export const STANDARD_LABEL: Record<OppussingBudsjett['standard'], string> = {
  standard: 'Standard',
  bra: 'Bra',
  luksus: 'Luksus',
}

export const LOPENDE_FELTER: { key: keyof LopendePerManed; lbl: string }[] = [
  { key: 'renter_avdrag', lbl: 'Renter + avdrag' },
  { key: 'strom', lbl: 'Strøm' },
  { key: 'forsikring', lbl: 'Forsikring' },
  { key: 'felleskost', lbl: 'Felleskost / comunidad' },
  { key: 'ibi', lbl: 'IBI' },
  { key: 'annet', lbl: 'Annet' },
]

export const totalPoster = (poster: OppussingPost[]) =>
  poster.reduce((s, p) => s + (Number(p.kostnad) || 0), 0)

export const lopendePerManed = (l: LopendePerManed) =>
  (l.renter_avdrag || 0) + (l.strom || 0) + (l.forsikring || 0) +
  (l.felleskost || 0) + (l.ibi || 0) + (l.annet || 0)

export const lopendeTotal = (b: OppussingBudsjett) =>
  lopendePerManed(b.lopende_per_maned) * (b.antall_maneder || 0)

export const totalkostnad = (p: Prosjekt, b: OppussingBudsjett, poster: OppussingPost[]) =>
  (p.kjøpesum || 0) + (p.kjøpskostnader || 0) + totalPoster(poster) + lopendeTotal(b)

export const bruttoFortjeneste = (p: Prosjekt, b: OppussingBudsjett, poster: OppussingPost[]) =>
  (b.estimert_salgspris || 0) - totalkostnad(p, b, poster)

export const roiOppussing = (p: Prosjekt, b: OppussingBudsjett, poster: OppussingPost[]) => {
  const tk = totalkostnad(p, b, poster)
  return tk > 0 ? (bruttoFortjeneste(p, b, poster) / tk) * 100 : 0
}

export const erEstimatUtdatert = (b: OppussingBudsjett, poster: OppussingPost[]) => {
  if (!b.estimert_salgspris || b.estimat_poster_sum === null) return false
  return Math.abs(totalPoster(poster) - (b.estimat_poster_sum || 0)) > 0.5
}
