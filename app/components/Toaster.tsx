'use client'
import { useEffect, useState } from 'react'
import type { ToastDetalj, ToastType } from '../lib/toast'
import { FARGER, RADIUS, SHADOW } from '../lib/styles'

type Toast = ToastDetalj & { id: number }

const FARGE_PER_TYPE: Record<ToastType, { bg: string; border: string; tekst: string; ikon: string }> = {
  suksess: { bg: FARGER.suksessBg, border: FARGER.suksess, tekst: '#1a4d2b', ikon: '✅' },
  feil: { bg: FARGER.feilBg, border: FARGER.feil, tekst: '#7a0c1e', ikon: '⚠️' },
  info: { bg: FARGER.infoBg, border: FARGER.sekundar, tekst: '#0f3b6b', ikon: 'ℹ️' },
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<ToastDetalj>
      const id = Date.now() + Math.random()
      setToasts(t => [...t, { ...ce.detail, id }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ce.detail.varighet || 2500)
    }
    window.addEventListener('app-toast', handler)
    return () => window.removeEventListener('app-toast', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const f = FARGE_PER_TYPE[t.type]
        return (
          <div key={t.id} style={{
            background: f.bg, border: `1.5px solid ${f.border}`, color: f.tekst,
            borderRadius: RADIUS.md, padding: '10px 16px', fontSize: 13, fontWeight: 600,
            boxShadow: SHADOW.stor, pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8, minWidth: 220, maxWidth: 440,
            animation: 'toast-inn 0.2s ease-out',
          }}>
            <span style={{ fontSize: 16 }}>{f.ikon}</span>
            <span>{t.melding}</span>
          </div>
        )
      })}
      <style>{`
        @keyframes toast-inn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
