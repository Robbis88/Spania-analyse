// C1 — strategi (hva eiendommen SKAL brukes til) er adskilt fra eieretappe
// (hvor i livssyklusen den er). Settes av bruker; beslutningsmotoren (B4)
// anbefaler. VFT = spansk turistlisens for korttidsutleie.

export const STRATEGIER = ['flipp', 'langtid', 'korttid', 'uavklart'] as const
export type Strategi = typeof STRATEGIER[number]

export const STRATEGI_ETIKETT: Record<Strategi, string> = {
  flipp: 'Flipp / selges',
  langtid: 'Langtidsleie',
  korttid: 'Korttidsleie',
  uavklart: 'Uavklart',
}

// Mapper beslutningsmotorens scenariotype til strategi (for "Følg anbefaling").
export const SCENARIO_TIL_STRATEGI: Record<string, Strategi> = {
  flipp: 'flipp',
  langtid: 'langtid',
  korttid: 'korttid',
  refinansier: 'langtid',
}

export const VFT_STATUS = ['har', 'sokt', 'mangler'] as const
export type VftStatus = typeof VFT_STATUS[number]

export const VFT_ETIKETT: Record<VftStatus, string> = {
  har: 'Har lisens',
  sokt: 'Søkt',
  mangler: 'Mangler',
}

// Kombinert badge-tekst ("Under oppussing · Flipp") — dimensjonene holdes adskilt
// i data, men kan vises sammen.
export function statusBadge(eieretappeEtikett: string, strategi?: Strategi | null): string {
  const s = strategi && strategi !== 'uavklart' ? STRATEGI_ETIKETT[strategi] : null
  return s ? `${eieretappeEtikett} · ${s}` : eieretappeEtikett
}
