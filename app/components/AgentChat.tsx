'use client'
import { useEffect, useRef, useState } from 'react'
import type { Melding } from '../types'

export function AgentChat() {
  const [apen, setApen] = useState(false)
  const [meldinger, setMeldinger] = useState<Melding[]>([])
  const [input, setInput] = useState('')
  const [laster, setLaster] = useState(false)
  const bunnRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bunnRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [meldinger])

  async function send() {
    if (!input.trim() || laster) return
    const nye: Melding[] = [...meldinger, { role: 'user', content: input }]
    setMeldinger(nye); setInput(''); setLaster(true)
    try {
      const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meldinger: nye }) })
      const data = await res.json()
      setMeldinger([...nye, { role: 'assistant', content: data.svar }])
    } catch {
      setMeldinger([...nye, { role: 'assistant', content: 'Beklager, noe gikk galt.' }])
    }
    setLaster(false)
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
      {apen && (
        <div style={{ position: 'absolute', bottom: 72, right: 0, width: 360, background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#1a1a2e', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>🤖 Eiendomsassistent</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Spør meg om spansk eiendom</div>
            </div>
            <button onClick={() => setMeldinger([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>Tøm</button>
          </div>
          <div style={{ height: 340, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {meldinger.length === 0 && (
              <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏡</div>
                Hei! Spør meg om VFT-lisens, Airbnb, skatt, finansiering eller eiendomsmarkedet i Spania!
              </div>
            )}
            {meldinger.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: m.role === 'user' ? '#C8102E' : '#f0f0f0', color: m.role === 'user' ? 'white' : '#222', borderBottomRightRadius: m.role === 'user' ? 4 : 12, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12, whiteSpace: 'pre-wrap' }}>
                  {m.content}
                </div>
              </div>
            ))}
            {laster && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f0f0f0', borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 13, color: '#666' }}>⏳ Tenker...</div>
              </div>
            )}
            <div ref={bunnRef} />
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Still et spørsmål..."
              style={{ flex: 1, padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1.5px solid #ddd', fontFamily: 'sans-serif' }}
            />
            <button onClick={send} disabled={laster || !input.trim()} style={{ background: laster ? '#ccc' : '#C8102E', color: 'white', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 16, cursor: laster ? 'not-allowed' : 'pointer' }}>→</button>
          </div>
        </div>
      )}
      <button onClick={() => setApen(!apen)} style={{ width: 56, height: 56, borderRadius: '50%', background: '#1a1a2e', border: 'none', cursor: 'pointer', fontSize: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {apen ? '✕' : '🤖'}
      </button>
    </div>
  )
}
