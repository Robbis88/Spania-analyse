// Enkel toast-meldingssystem som bruker window CustomEvents.
// Kall visToast('Lagret', 'suksess') fra hvor som helst — <Toaster />
// lytter globalt og rendrer meldingen.
export type ToastType = 'suksess' | 'feil' | 'info'

export type ToastDetalj = {
  melding: string
  type: ToastType
  varighet?: number // ms, default 2500
}

export function visToast(melding: string, type: ToastType = 'suksess', varighet = 2500) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ToastDetalj>('app-toast', {
    detail: { melding, type, varighet },
  }))
}
