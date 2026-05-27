'use client'

import { useEffect, useRef, useState } from 'react'

const PRESETS = [
  { value: 'today', label: 'Oggi' },
  { value: 'yesterday', label: 'Ieri' },
  { value: 'last_7d', label: 'Ultimi 7 giorni' },
  { value: 'last_14d', label: 'Ultimi 14 giorni' },
  { value: 'last_28d', label: 'Ultimi 28 giorni' },
  { value: 'last_90d', label: 'Ultimi 90 giorni' },
  { value: 'current_month', label: 'Mese corrente' },
  { value: 'last_month', label: 'Mese scorso' },
]

const SUGGESTIONS = [
  'Fammi un check-up generale: cosa va bene, cosa preoccupa.',
  'Quali campagne Meta dovrei scalare e quali tagliare?',
  'Il mio MER sta peggiorando: aiutami a capire perché.',
  'Quali 3 azioni mi danno il maggior impatto sul revenue nei prossimi 14 giorni?',
  'Come stanno andando le email su Klaviyo? Open rate, click, revenue.',
  'Confronta la revenue da email vs Meta Ads — dove sto crescendo di più?',
  'Analizza i prezzi dei competitor: come mi posiziono rispetto a Velites, Picsil e Frog Grips?',
  'Che promozioni stanno facendo i competitor? Devo reagire?',
]

const palette = {
  bg: 'var(--bg2)',
  panel: 'var(--glass)',
  border: 'var(--border)',
  bubbleUser: 'linear-gradient(135deg, #6d28d9, #2a1746)',
  bubbleAgent: 'var(--glass)',
  text: 'var(--text)',
  muted: 'var(--text2)',
  accent: 'var(--accent2)',
}

function formatMessage(text) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return (
          <strong key={j} style={{ color: 'var(--text)' }}>
            {seg.slice(2, -2)}
          </strong>
        )
      }
      return <span key={j}>{seg}</span>
    })
    return (
      <div key={i} style={{ minHeight: line ? undefined : 8 }}>
        {parts}
      </div>
    )
  })
}

export default function PerformanceAgentTab({ cfg, preset: globalPreset }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const preset = globalPreset || 'last_28d'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dataSummary, setDataSummary] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    setError(null)
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)

    let agentContext = null
    try {
      const ctxRes = await fetch(`/api/agent-context?preset=${encodeURIComponent(preset)}&days=30`, { cache: 'no-store' })
      if (ctxRes.ok) agentContext = await ctxRes.json()
    } catch (e) {
      console.log('Agent context fetch error:', e?.message)
    }

    try {
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          preset,
          cfg: cfg || null,
          agentContext,
        }),
      })

      const json = await r.json()

      if (!r.ok) {
        setError(json?.error || `Errore ${r.status}`)
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `⚠️ ${json?.error || `Errore ${r.status}`}`,
            isError: true,
          },
        ])
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: json.reply || '(risposta vuota)' },
        ])
        if (json?.summary) setDataSummary(json.summary)
      }
    } catch (err) {
      setError(err?.message || 'Errore di rete')
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ ${err?.message || 'Errore di rete'}`,
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const reset = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div
      className="glass-section"
      style={{
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100vh - 200px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '20px 24px',
          borderBottom: `1px solid var(--border)`,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ff7a45, #ec4899, #8b5cf6)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              color: '#fff',
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--text)', fontSize: 16 }}>
              Performance Agent
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              Performance · CMO · CRO · Ads · Klaviyo · usa i dati live di Shopify + Meta + Email
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              disabled={loading}
              style={{
                background: 'transparent',
                color: 'var(--text2)',
                border: `1px solid var(--border)`,
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Reset chat
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 24px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.5, maxWidth: 640 }}>
              Ehi Marino, chiedimi quello che vuoi — Shopify, Meta, Klaviyo, ho tutto sotto mano. Trend, campagne da scalare o tagliare, email che funzionano e quelle che no. Sparami la domanda.
            </div>
            <div style={{ display: 'grid', gap: 8, width: '100%' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={loading}
                  style={{
                    textAlign: 'left',
                    background: 'var(--glass)',
                    border: `1px solid var(--border)`,
                    color: 'var(--text)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '78%',
                background: m.role === 'user' ? palette.bubbleUser : palette.bubbleAgent,
                border:
                  m.role === 'user'
                    ? 'none'
                    : m.isError
                    ? '1px solid #ef444455'
                    : `1px solid var(--border)`,
                color: m.isError ? '#fecaca' : 'var(--text)',
                borderRadius: 14,
                padding: '12px 16px',
                fontSize: 14,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {formatMessage(m.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                background: palette.bubbleAgent,
                border: `1px solid var(--border)`,
                borderRadius: 14,
                padding: '12px 16px',
                color: 'var(--text2)',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Dot delay={0} />
                <Dot delay={150} />
                <Dot delay={300} />
              </span>
              Sto analizzando i dati…
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: `1px solid var(--border)`,
          padding: '16px 24px 20px',
        }}
      >
        {error && (
          <div
            style={{
              marginBottom: 10,
              padding: '8px 12px',
              background: '#ef444415',
              border: '1px solid #ef444455',
              borderRadius: 10,
              color: '#fecaca',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={e => {
            e.preventDefault()
            send()
          }}
          style={{ display: 'flex', gap: 10 }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Marino, chiedi pure…"
            disabled={loading}
            style={{
              flex: 1,
              background: 'var(--glass)',
              border: `1px solid var(--border)`,
              color: 'var(--text)',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 14,
              outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent2)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim()
                ? 'var(--glass)'
                : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '0 22px',
              fontWeight: 900,
              fontSize: 14,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Invia
          </button>
        </form>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>Dati live da tutte le piattaforme collegate. Niente è inventato.</span>
          {dataSummary && (
            <span style={{ color: 'var(--text2)' }}>
              {(dataSummary.activeSources || []).map(s => `${s} ✓`).join(' · ') || 'nessuna fonte'} — {dataSummary.activeCount || 0} integrazion{dataSummary.activeCount === 1 ? 'e' : 'i'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Dot({ delay }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--accent2)',
        display: 'inline-block',
        animation: 'pa-pulse 1.2s infinite',
        animationDelay: `${delay}ms`,
      }}
    />
  )
}
