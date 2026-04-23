'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hentAktivBruker } from '../lib/aktivBruker'
import { byggProsjektPdf } from '../lib/pdf'
import { EpostGodkjenningsKort, type EpostUtkast } from './EpostGodkjenningsKort'

type TekstBlokk = { type: 'text'; text: string }
type VerktoyKallBlokk = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
type VerktoyResultatBlokk = { type: 'tool_result'; tool_use_id: string; content: string }
type ContentBlock = TekstBlokk | VerktoyKallBlokk | VerktoyResultatBlokk

type ChatMelding =
  | { role: 'user'; content: string | ContentBlock[] }
  | { role: 'assistant'; content: ContentBlock[] }

type ProsjektValg = { id: string; navn: string }

function harTextFra(c: string | ContentBlock[]): string {
  if (typeof c === 'string') return c
  return c.filter(b => b.type === 'text').map(b => (b as TekstBlokk).text).join('\n')
}

function finnPendingToolUse(meldinger: ChatMelding[]): VerktoyKallBlokk | null {
  // Finn siste assistant-tool_use som ikke har noen påfølgende tool_result
  for (let i = meldinger.length - 1; i >= 0; i--) {
    const m = meldinger[i]
    if (m.role !== 'assistant') continue
    if (typeof m.content === 'string') continue
    const tu = [...m.content].reverse().find(b => b.type === 'tool_use') as VerktoyKallBlokk | undefined
    if (!tu) continue
    // Sjekk om noen senere user-melding har tool_result for denne id
    const loest = meldinger.slice(i + 1).some(senere => {
      if (senere.role !== 'user') return false
      if (typeof senere.content === 'string') return false
      return senere.content.some(b => b.type === 'tool_result' && b.tool_use_id === tu.id)
    })
    if (!loest) return tu
  }
  return null
}

export function AgentChat() {
  const [apen, setApen] = useState(false)
  const [meldinger, setMeldinger] = useState<ChatMelding[]>([])
  const [input, setInput] = useState('')
  const [laster, setLaster] = useState(false)
  const [sender, setSender] = useState(false)
  const [prosjekter, setProsjekter] = useState<ProsjektValg[]>([])
  const [prosjektId, setProsjektId] = useState<string>('')
  const bunnRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bunnRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger])

  useEffect(() => {
    let avbrutt = false
    supabase.from('prosjekter').select('id, navn').order('opprettet', { ascending: false }).then(({ data }) => {
      if (!avbrutt && data) setProsjekter(data as ProsjektValg[])
    })
    return () => { avbrutt = true }
  }, [])

  const pendingToolUse = finnPendingToolUse(meldinger)
  const prosjektNavn = prosjektId ? prosjekter.find(p => p.id === prosjektId)?.navn : undefined

  async function kallAgent(oppdaterte: ChatMelding[]) {
    setLaster(true)
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meldinger: oppdaterte, relatert_prosjekt_id: prosjektId || undefined }),
      })
      const data = await res.json()
      if (data.error) {
        setMeldinger([...oppdaterte, { role: 'assistant', content: [{ type: 'text', text: 'Beklager, noe gikk galt: ' + data.error }] }])
      } else if (data.content) {
        setMeldinger([...oppdaterte, { role: 'assistant', content: data.content }])
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Ukjent feil'
      setMeldinger([...oppdaterte, { role: 'assistant', content: [{ type: 'text', text: 'Beklager, noe gikk galt: ' + m }] }])
    }
    setLaster(false)
  }

  async function send() {
    if (!input.trim() || laster || pendingToolUse) return
    const ny: ChatMelding = { role: 'user', content: input.trim() }
    const oppdaterte = [...meldinger, ny]
    setMeldinger(oppdaterte); setInput('')
    await kallAgent(oppdaterte)
  }

  async function sendEpost(endret: EpostUtkast & { bruker_endret: boolean }) {
    if (!pendingToolUse) return
    const bruker = hentAktivBruker() || 'ukjent'
    setSender(true)
    let pdfFeil: string | null = null
    try {
      let vedlegg_pdf_base64: string | undefined
      let vedlegg_filnavn: string | undefined
      if (endret.vedlegg_pdf && endret.relatert_prosjekt_id) {
        try {
          const pdfData = await byggProsjektPdf(endret.relatert_prosjekt_id, supabase)
          if (pdfData) {
            vedlegg_pdf_base64 = pdfData.base64
            vedlegg_filnavn = pdfData.filnavn
          } else {
            pdfFeil = 'PDF-data ble ikke generert (ukjent grunn)'
          }
        } catch (e) {
          pdfFeil = e instanceof Error ? e.message : String(e)
          console.error('PDF-bygging feilet:', e)
        }
      } else if (endret.vedlegg_pdf && !endret.relatert_prosjekt_id) {
        pdfFeil = 'Mangler prosjekt-kontekst – velg prosjekt i dropdown øverst'
      }

      const res = await fetch('/api/epost/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          til: endret.til,
          emne: endret.emne,
          innhold: endret.innhold,
          formaal: endret.formaal,
          mottaker_navn: endret.mottaker_navn,
          mottaker_type: endret.mottaker_type,
          sprak: endret.sprak,
          relatert_prosjekt_id: endret.relatert_prosjekt_id,
          sendt_av: bruker,
          bruker_endret: endret.bruker_endret,
          vedlegg_pdf_base64,
          vedlegg_filnavn,
        }),
      })
      const data = await res.json()
      let resultatTekst: string
      if (data.suksess) {
        if (vedlegg_filnavn) {
          resultatTekst = `E-post sendt til ${endret.til} med PDF-vedlegg (${vedlegg_filnavn}).`
        } else if (pdfFeil) {
          resultatTekst = `E-post sendt til ${endret.til}, MEN UTEN PDF-vedlegg: ${pdfFeil}`
        } else {
          resultatTekst = `E-post sendt til ${endret.til}.`
        }
      } else {
        resultatTekst = `Sending feilet: ${data.feil || 'ukjent'}`
      }
      const nyeMeldinger: ChatMelding[] = [
        ...meldinger,
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: pendingToolUse.id, content: resultatTekst }] },
        { role: 'assistant', content: [{ type: 'text', text: data.suksess ? `✅ ${resultatTekst}` : `❌ ${resultatTekst}` }] },
      ]
      setMeldinger(nyeMeldinger)
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Ukjent feil'
      setMeldinger([
        ...meldinger,
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: pendingToolUse.id, content: 'Sending feilet: ' + m }] },
        { role: 'assistant', content: [{ type: 'text', text: '❌ Sending feilet: ' + m }] },
      ])
    }
    setSender(false)
  }

  function avbrytEpost() {
    if (!pendingToolUse) return
    setMeldinger([
      ...meldinger,
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: pendingToolUse.id, content: 'Bruker avbrøt – ikke send.' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'OK, avbrutt. Gi beskjed hvis du vil prøve på nytt.' }] },
    ])
  }

  async function beAIEndre(instruks: string) {
    if (!pendingToolUse) return
    const oppdaterte: ChatMelding[] = [
      ...meldinger,
      { role: 'user', content: [
        { type: 'tool_result', tool_use_id: pendingToolUse.id, content: 'Bruker vil endre utkastet: ' + instruks },
        { type: 'text', text: instruks },
      ]},
    ]
    setMeldinger(oppdaterte)
    await kallAgent(oppdaterte)
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
      {apen && (
        <div style={{ position: 'absolute', bottom: 72, right: 0, width: 420, maxWidth: '95vw', background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#1a2a3e', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>🤖 Eiendomsassistent</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Spør, be om hjelp med e-poster</div>
            </div>
            <button onClick={() => setMeldinger([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11 }}>Tøm</button>
          </div>

          <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee', background: '#faf7f0' }}>
            <div style={{ fontSize: 10, color: '#666', fontWeight: 600, marginBottom: 4, letterSpacing: '0.05em' }}>PROSJEKT-KONTEKST</div>
            <select value={prosjektId} onChange={e => setProsjektId(e.target.value)}
              style={{ width: '100%', padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #ddd' }}>
              <option value="">Ingen – generell samtale</option>
              {prosjekter.map(p => <option key={p.id} value={p.id}>{p.navn}</option>)}
            </select>
          </div>

          <div style={{ height: 400, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meldinger.length === 0 && (
              <div style={{ textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏡</div>
                Hei! Spør meg om eiendom, eller be meg lage et e-postutkast.
              </div>
            )}
            {meldinger.map((m, i) => {
              const tekst = harTextFra(m.content)
              const harToolUse = Array.isArray(m.content) && m.content.some(b => b.type === 'tool_use')
              const erSistePending = i === meldinger.length - 1 && harToolUse && pendingToolUse
              if (!tekst && !harToolUse) return null
              return (
                <div key={i}>
                  {tekst && (
                    <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: erSistePending ? 4 : 0 }}>
                      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.6, background: m.role === 'user' ? '#1a2a3e' : '#f0f0f0', color: m.role === 'user' ? 'white' : '#222', borderBottomRightRadius: m.role === 'user' ? 4 : 12, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12, whiteSpace: 'pre-wrap' }}>
                        {tekst}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {pendingToolUse && (
              <EpostGodkjenningsKort
                utkast={pendingToolUse.input as EpostUtkast}
                prosjektNavn={prosjektNavn}
                prosjektId={prosjektId || undefined}
                bruker={hentAktivBruker() || 'ukjent'}
                sender={sender}
                onSend={sendEpost}
                onAvbryt={avbrytEpost}
                onBeAIEndre={beAIEndre}
              />
            )}
            {laster && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f0f0f0', borderRadius: 12, borderBottomLeftRadius: 4, padding: '8px 12px', fontSize: 12, color: '#666' }}>⏳ Tenker...</div>
              </div>
            )}
            <div ref={bunnRef} />
          </div>

          <div style={{ padding: 10, borderTop: '1px solid #eee', display: 'flex', gap: 6 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={pendingToolUse ? 'Godkjenn eller avbryt utkastet først' : 'Still et spørsmål eller be om e-post...'}
              disabled={!!pendingToolUse || laster}
              style={{ flex: 1, padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'sans-serif', background: pendingToolUse ? '#f5f5f5' : 'white' }}
            />
            <button onClick={send} disabled={laster || !input.trim() || !!pendingToolUse}
              style={{ background: laster || pendingToolUse ? '#ccc' : '#1a2a3e', color: 'white', border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 16, cursor: laster || pendingToolUse ? 'not-allowed' : 'pointer' }}>
              →
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setApen(!apen)} style={{ width: 56, height: 56, borderRadius: '50%', background: '#1a2a3e', border: 'none', cursor: 'pointer', fontSize: 22, color: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {apen ? '✕' : '🤖'}
      </button>
    </div>
  )
}

