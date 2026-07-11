import type { KontantbevegelseType } from '../types'

// Fakturadrevet kostnad (B12): opplastede kvitteringer + godkjente bilag posteres
// IKKE til hovedboken — de leses live og trekkes fra kontantsaldoen (bruttobeløp
// inkl. mva, siden et boligselskap uten mva-fradrag bærer mva-en som kostnad).
// Read-time-derivering ⇒ ingen dobbeltpostering, oppdaterer seg når faktura lastes opp.

type KvitteringLite = {
  id: string; prosjekt_id: string; ocr_status: string
  belop_inkl_mva: number | null; dato: string | null; leverandor: string | null; oppussing_post_id: string | null
}
type BilagLite = {
  id: string; prosjekt_id: string | null; selskap_id: string | null; status: string
  belop: number | null; faktura_dato: string | null; leverandor: string | null; kategori: string | null; valuta: string | null
}

export type FakturaBevegelse = {
  id: string; selskap_id: string; prosjekt_id: string | null; dato: string
  type: KontantbevegelseType; belop: number; valuta: 'NOK' | 'EUR'
  kilde: 'kvittering' | 'bilag'; kilde_id: string; notat: string | null; syntetisk: true
}

export function fakturaKostnader(
  kvitteringer: KvitteringLite[],
  bilag: BilagLite[],
  prosjektTilSelskap: Map<string, string>,
  selskapValuta: Map<string, 'NOK' | 'EUR'>,
): { rader: FakturaBevegelse[]; perSelskap: Map<string, number> } {
  const rader: FakturaBevegelse[] = []

  for (const k of kvitteringer) {
    if (k.ocr_status !== 'analysert' && k.ocr_status !== 'manuelt') continue
    const brutto = k.belop_inkl_mva || 0
    if (brutto <= 0) continue
    const sid = prosjektTilSelskap.get(k.prosjekt_id)
    if (!sid) continue
    rader.push({
      id: k.id, selskap_id: sid, prosjekt_id: k.prosjekt_id, dato: (k.dato || '').slice(0, 10),
      type: k.oppussing_post_id ? 'oppussing' : 'driftskostnad', belop: -brutto,
      valuta: selskapValuta.get(sid) || 'NOK', kilde: 'kvittering', kilde_id: k.id, notat: k.leverandor, syntetisk: true,
    })
  }

  for (const b of bilag) {
    if (b.status !== 'godkjent' && b.status !== 'laast') continue
    const brutto = b.belop || 0   // fakturabeløp inkl. mva
    if (brutto <= 0) continue
    const sid = b.selskap_id || (b.prosjekt_id ? prosjektTilSelskap.get(b.prosjekt_id) : undefined)
    if (!sid) continue
    rader.push({
      id: b.id, selskap_id: sid, prosjekt_id: b.prosjekt_id, dato: (b.faktura_dato || '').slice(0, 10),
      type: (b.kategori || '').toLowerCase().includes('oppuss') ? 'oppussing' : 'driftskostnad', belop: -brutto,
      valuta: b.valuta === 'EUR' ? 'EUR' : 'NOK', kilde: 'bilag', kilde_id: b.id, notat: b.leverandor, syntetisk: true,
    })
  }

  const perSelskap = new Map<string, number>()
  for (const r of rader) perSelskap.set(r.selskap_id, (perSelskap.get(r.selskap_id) || 0) + r.belop)
  return { rader, perSelskap }
}
