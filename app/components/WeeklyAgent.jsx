'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'
import { createPortal } from 'react-dom'

const SUGGESTIONS = [
  'Come è andata la settimana scorsa vs la precedente?',
  'Qual è stata la settimana migliore del periodo?',
  'Vedi anomalie nelle ultime 4 settimane?',
  'Il MER settimana per settimana: trend?',
]

function timeGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Buongiorno'
  if (h >= 12 && h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function formatMessage(text) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={j} style={{ color: 'var(--text)' }}>{seg.slice(2, -2)}</strong>
      }
      return <span key={j}>{seg}</span>
    })
    return <div key={i} style={{ minHeight: line ? undefined : 8 }}>{parts}</div>
  })
}

export default function WeeklyAgent({ weeks = [], preset }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200)
  }, [open])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    setError(null)
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)

    let metrics = null
    try {
      const presetParam = preset || 'last_7d'
      const mRes = await fetch(`/api/metrics?preset=${encodeURIComponent(presetParam)}`, { cache: 'no-store' })
      if (mRes.ok) metrics = await mRes.json()
    } catch {}

    try {
      const r = await fetch('/api/weekly-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, weeks, metrics }),
      })
      const json = await r.json()
      if (!r.ok || json.error) {
        setError(json?.error || `Errore ${r.status}`)
        setMessages(prev => [...prev, { role: 'assistant', content: `${json?.error || `Errore ${r.status}`}`, isError: true }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply || '(vuoto)' }])
      }
    } catch (e) {
      setError(e?.message || 'Errore di rete')
      setMessages(prev => [...prev, { role: 'assistant', content: `${e?.message || 'Errore di rete'}`, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  const content = (
    <>
      {/* Floating sticky avatar — bottom right, always visible */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri Weekly Agent"
          title="Weekly Agent"
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(140deg, #1e3a8a 0%, #2997ff 100%)',
            border: '2px solid rgba(255,255,255,0.18)',
            cursor: 'pointer',
            zIndex: 50,
            padding: 0,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            boxShadow:
              '0 16px 40px rgba(41,151,255,0.4), 0 6px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
            transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease',
            animation: 'card-pulse 3.5s ease-in-out infinite',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <AvatarSvg />
          <span style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#30d158',
            border: '2.5px solid #0a0a14',
          }} />
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 49,
            animation: 'fadeUp .25s ease',
          }}
        />
      )}

      {/* Slide-out panel */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(440px, 100vw)',
          background: 'rgba(8,8,15,0.85)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          borderLeft: '1.5px solid rgba(255,255,255,0.08)',
          boxShadow: '-12px 0 60px rgba(0,0,0,0.7)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #2997ff, #bf5af2)',
              display: 'grid', placeItems: 'center',
              fontSize: 16, fontWeight: 900, color: '#fff',
            }}><Icon name="sparkle" size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Weekly Agent</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Confronto settimanale · Trend · Anomalie
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              borderRadius: 10,
              width: 32, height: 32,
              display: 'grid', placeItems: 'center',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >×</button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '12px 16px',
                color: 'var(--text)',
                fontSize: 14,
                lineHeight: 1.5,
                maxWidth: '88%',
              }}>
                {timeGreeting()} Marino. Come posso aiutarti oggi?
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={loading}
                    style={{
                      textAlign: 'left',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      color: 'var(--text2)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: 12.5,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'border-color .15s, color .15s',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = '#2997ff66'; e.currentTarget.style.color = 'var(--text)' } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%',
                background: m.role === 'user'
                  ? 'linear-gradient(135deg, #2997ff, #6366f1)'
                  : 'rgba(255,255,255,0.04)',
                border: m.role === 'user' ? 'none' : (m.isError ? '1px solid #ef444455' : '1px solid var(--border)'),
                color: m.isError ? '#fecaca' : (m.role === 'user' ? '#fff' : 'var(--text)'),
                borderRadius: 14,
                padding: '11px 15px',
                fontSize: 13.5,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {formatMessage(m.content)}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '11px 15px',
                color: 'var(--text2)',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <Dot delay={0} /><Dot delay={150} /><Dot delay={300} />
                </span>
                Analizzo…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px 18px' }}>
          {error && (
            <div style={{
              marginBottom: 10,
              padding: '8px 12px',
              background: 'rgba(239,68,58,0.08)',
              border: '1px solid #ef444455',
              borderRadius: 10,
              color: '#fecaca',
              fontSize: 11,
            }}>{error}</div>
          )}
          <form onSubmit={e => { e.preventDefault(); send() }} style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Chiedi qualcosa sui dati settimanali…"
              disabled={loading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: 11,
                padding: '11px 14px',
                fontSize: 13.5,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim()
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #2997ff, #bf5af2)',
                color: loading || !input.trim() ? 'var(--text3)' : '#fff',
                border: 'none',
                borderRadius: 11,
                padding: '0 18px',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >↑</button>
          </form>
        </div>
      </aside>
    </>
  )

  return createPortal(content, document.body)
}

function Dot({ delay }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: 'var(--accent)',
      display: 'inline-block',
      animation: 'pa-pulse 1.2s infinite',
      animationDelay: `${delay}ms`,
    }} />
  )
}

function AvatarSvg() {
  // Refined, semi-realistic consultant portrait — subtle features, depth, no cartoon eyes
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      <defs>
        <radialGradient id="bgGlow" cx="0.5" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="suit" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="shirt" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="skin" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#fbd9b8" />
          <stop offset="100%" stopColor="#d4a373" />
        </linearGradient>
        <linearGradient id="skinShade" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="hair" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#3b2f24" />
          <stop offset="50%" stopColor="#1f1813" />
          <stop offset="100%" stopColor="#0d0a08" />
        </linearGradient>
        <linearGradient id="hairHi" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#6b5a47" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3b2f24" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* background glow */}
      <circle cx="30" cy="30" r="30" fill="url(#bgGlow)" />

      {/* suit shoulders */}
      <path d="M5 60c0-10 10-15 25-15s25 5 25 15v0H5z" fill="url(#suit)" />

      {/* white shirt collar v */}
      <path d="M22 45l8 8 8-8-3-3h-10z" fill="url(#shirt)" />

      {/* dark collar tips */}
      <path d="M22 45l-2 4 5-1 5 5 5-5 5 1-2-4-8 5z" fill="url(#suit)" />

      {/* neck */}
      <path d="M25 39h10v5l-2 3h-6l-2-3z" fill="url(#skin)" />
      <rect x="25" y="44" width="10" height="3" fill="url(#skinShade)" />

      {/* face — slightly elongated, realistic proportion */}
      <ellipse cx="30" cy="29" rx="11" ry="13" fill="url(#skin)" />
      {/* face shading on bottom (chin/jaw) */}
      <ellipse cx="30" cy="34" rx="10" ry="6" fill="url(#skinShade)" opacity="0.6" />

      {/* hair — short professional cut */}
      <path d="M19 22c0-7 5-12 11-12s11 5 11 12c0 1-.1 2-.3 3-.6-1.5-2-3.5-4-4.5-1.5 1-3.7 1.8-6.7 1.8s-5.2-.8-6.7-1.8c-2 1-3.4 3-4 4.5-.2-1-.3-2-.3-3z" fill="url(#hair)" />
      {/* hair highlight */}
      <path d="M22 19c1.5-3 4.5-5 8-5s6.5 2 8 5c-2-1.5-4.5-2.5-8-2.5s-6 1-8 2.5z" fill="url(#hairHi)" />

      {/* subtle eyebrows */}
      <path d="M24.5 24.5q1.5-0.8 3 0" stroke="#1f1813" strokeWidth="0.7" strokeLinecap="round" fill="none" />
      <path d="M32.5 24.5q1.5-0.8 3 0" stroke="#1f1813" strokeWidth="0.7" strokeLinecap="round" fill="none" />

      {/* eyes — small almond, subtle, realistic */}
      <ellipse cx="26.2" cy="27.5" rx="1.1" ry="0.7" fill="#1a1410" />
      <ellipse cx="33.8" cy="27.5" rx="1.1" ry="0.7" fill="#1a1410" />
      {/* tiny eye highlight */}
      <circle cx="26.5" cy="27.3" r="0.25" fill="#fff" />
      <circle cx="34.1" cy="27.3" r="0.25" fill="#fff" />

      {/* nose — minimal shadow only */}
      <path d="M30 28.5q-0.3 2 -0.8 3.2" stroke="#a37b50" strokeWidth="0.4" strokeLinecap="round" fill="none" opacity="0.7" />

      {/* mouth — soft confident smile */}
      <path d="M27.5 34.5q2.5 1.5 5 0" stroke="#7a4a30" strokeWidth="0.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}
