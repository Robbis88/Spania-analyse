// Felles beløp-formatering for skjerm-visning. PDF-filer bruker egne
// helpers fordi de skriver «NOK 1 000» / «EUR 1 000» med ord-prefiks
// for bedre lesbarhet i utskrift.
//
// Konvensjon:
//   - 0, null, undefined, NaN → '–'
//   - Heltall, mellomrom som tusenskille (nb-NO)
//   - NOK: suffiks (1 000 kr)
//   - EUR: symbol-prefiks (€1 000)

export const fmtNok = (n: number | null | undefined): string =>
  (n == null || !Number.isFinite(n) || n === 0) ? '–' : Math.round(n).toLocaleString('nb-NO') + ' kr'

export const fmtEur = (n: number | null | undefined): string =>
  (n == null || !Number.isFinite(n) || n === 0) ? '–' : '€' + Math.round(n).toLocaleString('nb-NO')

export const fmtBelop = (n: number | null | undefined, valuta: 'EUR' | 'NOK'): string =>
  valuta === 'EUR' ? fmtEur(n) : fmtNok(n)
