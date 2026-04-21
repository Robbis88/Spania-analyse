const NOKKEL = 'leganger_aktiv_bruker'

export function settAktivBruker(navn: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOKKEL, navn)
}

export function hentAktivBruker(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(NOKKEL)
}

export function fjernAktivBruker() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(NOKKEL)
}
