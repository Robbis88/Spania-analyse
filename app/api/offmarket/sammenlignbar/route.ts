import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/requireAuth'

// Skraper én Finn-annonse (eller en hvilken som helst nettside) for ren tekst.
// Brukes til å bygge "sammenlignbare salg"-lista i off-market vurdering.
async function hentNettside(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req)
  if (!auth.ok) return auth.respons
  try {
    const { url } = await req.json()
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return NextResponse.json({ feil: 'Ugyldig URL' }, { status: 400 })
    }
    const tekst = await hentNettside(url)
    if (tekst.length < 100) {
      return NextResponse.json({ feil: 'Nettsiden returnerte for lite innhold — er den blokkert?' }, { status: 422 })
    }
    return NextResponse.json({ ok: true, url, tekst })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ feil: 'Henting feilet: ' + m }, { status: 500 })
  }
}
