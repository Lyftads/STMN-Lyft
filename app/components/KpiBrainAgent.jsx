'use client'

import { useEffect, useRef, useState } from 'react'

const SUGGESTIONS = [
  'Cosa mi dicono i numeri di questo periodo?',
  'Il mio LTV:CAC ratio è sano?',
  'Repeat rate basso: cosa posso fare nelle prossime 2 settimane?',
  'MER in calo: cosa controllo per primo?',
  'Quale KPI dovrei migliorare per primo per impatto?',
  'AOV vs LTV: dove ho margine?',
]

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

export default function KpiBrainAgent({ tf, preset }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

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
      const presetParam = preset || 'last_28d'
      const mRes = await fetch(`/api/metrics?preset=${encodeURIComponent(presetParam)}`, { cache: 'no-store' })
      if (mRes.ok) metrics = await mRes.json()
    } catch {}

    try {
      const r = await fetch('/api/kpi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, metrics, tf }),
      })
      const json = await r.json()
      if (!r.ok || json.error) {
        setError(json?.error || `Errore ${r.status}`)
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${json?.error || `Errore ${r.status}`}`, isError: true }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply || '(vuoto)' }])
      }
    } catch (e) {
      setError(e?.message || 'Errore di rete')
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e?.message || 'Errore di rete'}`, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating sticky avatar icon — visible from page load, middle-right */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri KPI Brain Agent"
          title="KPI Brain Agent"
          style={{
            position: 'fixed',
            top: '40%',
            right: 24,
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2997ff 0%, #6366f1 50%, #bf5af2 100%)',
            border: '2px solid rgba(255,255,255,0.22)',
            cursor: 'pointer',
            zIndex: 50,
            padding: 0,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            boxShadow:
              '0 16px 40px rgba(41,151,255,0.45), 0 6px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease',
            animation: 'card-pulse 3s ease-in-out infinite',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <AvatarSvg />
          <span style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 18,
            height: 18,
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
            }}>✦</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>KPI Brain Agent</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Unit economics · MER · CAC · LTV
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55 }}>
                Sono specializzato sui KPI di STMN: unit economics, MER, CAC, LTV, repeat rate. Chiedimi tutto quello che vuoi sulla performance dei numeri che vedi qui sopra.
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
              placeholder="Chiedi qualcosa sui KPI…"
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
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="avBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id="avHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <linearGradient id="avSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde7d3" />
          <stop offset="100%" stopColor="#f0c19f" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r="22" fill="url(#avBg)" />
      <path d="M22 39c-4.6 0-8.8-1.7-12-4.5C11.2 30.1 16.2 27 22 27s10.8 3.1 12 7.5C30.8 37.3 26.6 39 22 39z" fill="#e0e7ff" />
      <ellipse cx="22" cy="18.5" rx="7" ry="8" fill="url(#avSkin)" />
      <path d="M15.5 14.3c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6c0 1-.2 1.9-.6 2.7-.4-.6-1.3-1.7-2.6-2.2-.6.7-1.8 1.6-3.3 1.6s-2.7-.9-3.3-1.6c-1.3.5-2.2 1.6-2.6 2.2-.4-.8-.6-1.7-.6-2.7z" fill="url(#avHair)" />
      <circle cx="19.5" cy="19" r="1" fill="#1f2937" />
      <circle cx="24.5" cy="19" r="1" fill="#1f2937" />
      <path d="M20.5 22.2c.5.5 1 .8 1.5.8s1-.3 1.5-.8" stroke="#a16f57" strokeWidth="0.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}
