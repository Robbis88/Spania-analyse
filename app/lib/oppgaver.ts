import type { Oppgave } from '../types'

export function beregnEffektivPrioritet(o: Oppgave): 'hast' | 'normal' | 'lav' {
  if (o.status === 'ferdig') return o.prioritet
  if (!o.frist) return o.prioritet
  const idag = new Date(); idag.setHours(0, 0, 0, 0)
  const frist = new Date(o.frist); frist.setHours(0, 0, 0, 0)
  const dager = Math.ceil((frist.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))
  if (o.prioritet === 'hast') return 'hast'
  if (o.prioritet === 'normal') return dager <= 1 ? 'hast' : 'normal'
  if (o.prioritet === 'lav') return dager <= 1 ? 'hast' : dager <= 2 ? 'normal' : 'lav'
  return o.prioritet
}

export function fristTekst(frist: string): string {
  if (!frist) return ''
  const idag = new Date(); idag.setHours(0, 0, 0, 0)
  const fristDato = new Date(frist); fristDato.setHours(0, 0, 0, 0)
  const dager = Math.ceil((fristDato.getTime() - idag.getTime()) / (1000 * 60 * 60 * 24))
  if (dager < 0) return `⚠️ ${Math.abs(dager)} dag${Math.abs(dager) !== 1 ? 'er' : ''} over frist`
  if (dager === 0) return '🔴 Frist i dag!'
  if (dager === 1) return '🔴 Frist i morgen'
  if (dager === 2) return '🟡 Frist om 2 dager'
  return `📅 Frist om ${dager} dager`
}
