'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SUGGESTIONS = [
  'Spiega meglio i 3 punti critici da migliorare',
  'Genera 5 copy CTA alternative basate sull\'analisi',
  'Quali sono i quick wins implementabili oggi?',
  'Dammi un piano di A/B test prioritizzato',
  'Cosa cambia tra desktop e mobile per questa pagina?',
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

export default function ScannerAgent({ scan }) {
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

    try {
      const r = await fetch('/api/scanner-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, scan }),
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

  if (!mounted) return null

  const hasScan = !!scan?.analysis

  const content = (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri Scanner Agent"
          title="Scanner Agent"
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(140deg, #06b6d4 0%, #0e7490 100%)',
            border: '2px solid rgba(255,255,255,0.18)',
            cursor: 'pointer',
            zIndex: 50,
            padding: 0,
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            boxShadow:
              '0 16px 40px rgba(6,182,212,0.4), 0 6px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
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
            background: hasScan ? '#30d158' : '#fbbf24',
            border: '2.5px solid #0a0a14',
          }} />
        </button>
      )}

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

      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(460px, 100vw)',
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
              background: 'linear-gradient(135deg, #06b6d4, #0e7490)',
              display: 'grid', placeItems: 'center',
              fontSize: 16, fontWeight: 900, color: '#fff',
            }}>◎</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Scanner Agent</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Landing page CRO specialist
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
                {timeGreeting()} Marino. {hasScan
                  ? `Sono qui per approfondire l'analisi della pagina che hai scansionato (score ${scan?.analysis?.overallScore ?? '—'}/100). Cosa vuoi capire meglio?`
                  : 'Lancia prima una scansione, poi posso entrare nei dettagli dell\'analisi CRO e suggerire azioni concrete.'}
              </div>
              {hasScan && (
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
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = '#06b6d466'; e.currentTarget.style.color = 'var(--text)' } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%',
                background: m.role === 'user'
                  ? 'linear-gradient(135deg, #06b6d4, #0e7490)'
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
                Analizzo la landing…
              </div>
            </div>
          )}
        </div>

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
              placeholder={hasScan ? "Chiedi approfondimenti, copy, A/B test…" : "Lancia prima una scansione…"}
              disabled={loading || !hasScan}
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
              disabled={loading || !input.trim() || !hasScan}
              style={{
                background: loading || !input.trim() || !hasScan
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #06b6d4, #0e7490)',
                color: loading || !input.trim() || !hasScan ? 'var(--text3)' : '#fff',
                border: 'none',
                borderRadius: 11,
                padding: '0 18px',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: loading || !input.trim() || !hasScan ? 'not-allowed' : 'pointer',
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
      background: '#06b6d4',
      display: 'inline-block',
      animation: 'pa-pulse 1.2s infinite',
      animationDelay: `${delay}ms`,
    }} />
  )
}

function AvatarSvg() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      <defs>
        <radialGradient id="scnBgGlow" cx="0.5" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#cffafe" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#0c2026" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scnSuit" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#06262e" />
        </linearGradient>
        <linearGradient id="scnShirt" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="scnSkin" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#fbd9b8" />
          <stop offset="100%" stopColor="#d4a373" />
        </linearGradient>
        <linearGradient id="scnHair" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#3b2f24" />
          <stop offset="50%" stopColor="#1f1813" />
          <stop offset="100%" stopColor="#0d0a08" />
        </linearGradient>
      </defs>

      <circle cx="30" cy="30" r="30" fill="url(#scnBgGlow)" />
      <path d="M5 60c0-10 10-15 25-15s25 5 25 15v0H5z" fill="url(#scnSuit)" />
      <path d="M22 45l8 8 8-8-3-3h-10z" fill="url(#scnShirt)" />
      <path d="M25 39h10v5l-2 3h-6l-2-3z" fill="url(#scnSkin)" />
      <ellipse cx="30" cy="29" rx="11" ry="13" fill="url(#scnSkin)" />
      <path d="M19 22c0-7 5-12 11-12s11 5 11 12c0 1-.1 2-.3 3-.6-1.5-2-3.5-4-4.5-1.5 1-3.7 1.8-6.7 1.8s-5.2-.8-6.7-1.8c-2 1-3.4 3-4 4.5-.2-1-.3-2-.3-3z" fill="url(#scnHair)" />
      {/* Magnifying glass over eye */}
      <circle cx="34" cy="27.5" r="3.2" fill="none" stroke="#a5f3fc" strokeWidth="1.4" />
      <line x1="36.2" y1="29.7" x2="38.5" y2="32" stroke="#a5f3fc" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="26.2" cy="27.5" rx="1.1" ry="0.7" fill="#1a1410" />
      <circle cx="26.5" cy="27.3" r="0.25" fill="#fff" />
      <path d="M27.5 34.5q2.5 1.5 5 0" stroke="#22d3ee" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  )
}
