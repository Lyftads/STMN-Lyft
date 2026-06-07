'use client'

import { useEffect, useRef, useState } from 'react'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import Icon from './ui/Icon'
import { createPortal } from 'react-dom'

// ─────────────────────────────────────────────────────────────
//  SeoAgent — Esperto SEO floating (FAB + drawer da destra).
//  Pattern identico a MetaAdsAgent/PerformanceAgent.
//  Prop audit (oggetto): contesto dell'audit corrente; se null
//  l'agent risponde su SEO generale ma invita ad eseguire l'audit.
// ─────────────────────────────────────────────────────────────

const SUGGESTIONS_WITH_AUDIT = [
  'Riscrivi title e meta description ottimizzati',
  'Quali keyword dovrei targetizzare e perché?',
  'Genera lo JSON-LD adatto a questa pagina',
  'Dammi una roadmap SEO prioritizzata (impatto/sforzo)',
  'Quali sono i 3 fix prioritari da fare adesso?',
]

const SUGGESTIONS_NO_AUDIT = [
  'Cosa controlla l\'audit SEO?',
  'Come scelgo le keyword giuste?',
  'Quali sono gli errori SEO più comuni?',
  'Come scrivo un title tag efficace?',
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

const ACCENT = '#ff9f0a'   // arancio (matcha il gruppo Website nella sidebar)
const ACCENT2 = '#f97316'

export default function SeoAgent({ audit, context, hint, suggestions: customSug }) {
  // Backward-compat: se passano `audit` lo wrappiamo come context.
  const ctx = context || (audit ? { type: audit.mode === 'site' ? 'site-audit' : 'page-audit', data: audit } : null)
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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
      const r = await fetch('/api/seo-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: getClientLocale(), messages: next, context: ctx, audit }),
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

  const suggestions = customSug || (ctx ? SUGGESTIONS_WITH_AUDIT : SUGGESTIONS_NO_AUDIT)
  const subtitle = hint || (ctx
    ? 'Conosce i dati di questa scheda · chiedi azioni concrete'
    : 'Consulente SEO senior · esegui un audit per consigli specifici')

  const content = (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri Esperto SEO"
          title="Esperto SEO"
          style={{
            position: 'fixed',
            bottom: 28,
            right: 28,
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: `linear-gradient(140deg, ${ACCENT} 0%, ${ACCENT2} 100%)`,
            border: '2px solid rgba(255,255,255,0.18)',
            cursor: 'pointer',
            zIndex: 50,
            padding: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontSize: 24,
            fontWeight: 900,
            boxShadow: '0 16px 40px rgba(0,0,0,0.45), 0 6px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)',
            transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)',
            animation: 'card-pulse 3.5s ease-in-out infinite',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <Icon name="sparkle" size={20} />
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

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
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
          top: 0, right: 0,
          height: '100vh',
          width: 'min(460px, 100vw)',
          background: 'rgba(8,8,15,0.85)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          borderLeft: '1.5px solid rgba(255,255,255,0.08)',
          boxShadow: '-12px 0 60px rgba(0,0,0,0.7)',
          zIndex: 50,
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
              display: 'grid', placeItems: 'center',
              fontSize: 16, fontWeight: 900, color: '#fff',
            }}><Icon name="sparkle" size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Esperto SEO</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {subtitle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text2)', borderRadius: 10,
              width: 32, height: 32,
              display: 'grid', placeItems: 'center',
              cursor: 'pointer', fontSize: 16,
            }}
          >×</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 14, padding: '12px 16px',
                color: 'var(--text)', fontSize: 14, lineHeight: 1.5,
                maxWidth: '88%',
              }}>
                {timeGreeting()} Marino. {ctx ? 'I dati di questa scheda sono già nel mio contesto. Su cosa vuoi lavorare?' : 'Apri una sezione con dati (audit, keyword, GSC...) o chiedimi consigli generali.'}
              </div>
              <div style={{ display: 'grid', gap: 7 }}>
                {suggestions.map(s => (
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
                      borderRadius: 10, padding: '10px 14px', fontSize: 12.5,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'border-color .15s, color .15s',
                    }}
                    onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = `${ACCENT}66`; e.currentTarget.style.color = 'var(--text)' } }}
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
                background: m.role === 'user' ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` : 'rgba(255,255,255,0.04)',
                border: m.role === 'user' ? 'none' : (m.isError ? '1px solid #ef444455' : '1px solid var(--border)'),
                color: m.isError ? '#fecaca' : (m.role === 'user' ? '#fff' : 'var(--text)'),
                borderRadius: 14, padding: '11px 15px',
                fontSize: 13.5, lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
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
                borderRadius: 14, padding: '11px 15px',
                color: 'var(--text2)', fontSize: 13,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <Dot delay={0} /><Dot delay={150} /><Dot delay={300} />
                </span>
                L'esperto sta elaborando…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px 18px' }}>
          {error && (
            <div style={{
              marginBottom: 10, padding: '8px 12px',
              background: 'rgba(239,68,58,0.08)',
              border: '1px solid #ef444455',
              borderRadius: 10, color: '#fecaca', fontSize: 11,
            }}>{error}</div>
          )}
          <form onSubmit={e => { e.preventDefault(); send() }} style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Chiedi all'esperto SEO…"
              disabled={loading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: 11, padding: '11px 14px', fontSize: 13.5,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim()
                  ? 'rgba(255,255,255,0.05)'
                  : `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                color: loading || !input.trim() ? 'var(--text3)' : '#fff',
                border: 'none',
                borderRadius: 11, padding: '0 18px',
                fontSize: 13.5, fontWeight: 700,
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
      background: ACCENT,
      display: 'inline-block',
      animation: 'pa-pulse 1.2s infinite',
      animationDelay: `${delay}ms`,
    }} />
  )
}
