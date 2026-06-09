'use client'

import { useEffect, useRef, useState } from 'react'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  VISTA SQUADRA AI — griglia degli 8 agenti (C-suite + specialisti) con chat
//  1:1. Selezioni un agente → ci parli in privato. Ognuno risponde dalla sua
//  prospettiva citando i DATI LIVE reali (passa agentContext a /api/team-agent).
//  Lo storico è per-agente (cambiando agente non si perde la conversazione).
// ============================================================================

function Avatar({ a, size = 44 }) {
  const [err, setErr] = useState(false)
  if (a.avatar && !err) {
    return <img src={a.avatar} alt={a.name} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${a.color}55` }} />
  }
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45,
      background: `${a.color}22`, border: `2px solid ${a.color}55` }}>{a.emoji || '🤖'}</span>
  )
}

function bubbleText(t) {
  // grassetto **...** → <strong>
  const parts = String(t || '').split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => p.startsWith('**') && p.endsWith('**')
    ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)
}

export default function TeamTab() {
  const { t } = useI18n()
  const [roster, setRoster] = useState([])
  const [sel, setSel] = useState(null)            // agentId selezionato
  const [byAgent, setByAgent] = useState({})       // { agentId: [{role,content}] }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const ctxRef = useRef(null)                       // agent-context (dati reali), caricato una volta
  const ctxPromRef = useRef(null)                    // promise condivisa del fetch (no doppioni)
  const scrollRef = useRef(null)

  // Carica i dati reali una volta sola; ritorna sempre la stessa promise così
  // un send() che parte prima del pre-load aspetta lo stesso fetch (niente
  // risposte "senza dati").
  function ensureContext() {
    if (ctxRef.current) return Promise.resolve(ctxRef.current)
    if (!ctxPromRef.current) {
      ctxPromRef.current = fetch('/api/agent-context?preset=last_30d&days=30', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).then(d => { if (d) ctxRef.current = d; return d }).catch(() => null)
    }
    return ctxPromRef.current
  }

  useEffect(() => {
    fetch('/api/team-agent').then(r => r.json()).then(d => setRoster(d.team || [])).catch(() => {})
    ensureContext() // pre-load in background
  }, [])

  const agent = roster.find(a => a.id === sel) || null
  const msgs = (sel && byAgent[sel]) || []

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [msgs.length, busy])

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || !sel || busy) return
    setInput('')
    const next = [...msgs, { role: 'user', content: q }]
    setByAgent(p => ({ ...p, [sel]: next }))
    setBusy(true)
    try {
      const ctx = await ensureContext() // garantisce i dati reali anche al primo messaggio
      const res = await fetch('/api/team-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: sel, messages: next, agentContext: ctx, preset: 'last_30d', locale: getClientLocale() }),
      })
      const d = await res.json()
      const reply = d.reply || d.error || '…'
      setByAgent(p => ({ ...p, [sel]: [...next, { role: 'assistant', content: reply }] }))
    } catch {
      setByAgent(p => ({ ...p, [sel]: [...next, { role: 'assistant', content: t('team.error', null, 'Ops, errore. Riprova.') }] }))
    } finally { setBusy(false) }
  }

  // ── Griglia agenti (nessuno selezionato) ─────────────────────────────────
  if (!agent) {
    return (
      <div style={{ padding: '8px 0 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {roster.map(a => (
            <button key={a.id} type="button" onClick={() => setSel(a.id)}
              style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 13, alignItems: 'center',
                padding: 16, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--glass)',
                transition: 'transform .15s, border-color .15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${a.color}88` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              <Avatar a={a} size={52} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ color: 'var(--text)', fontSize: 15 }}>{a.name}</strong>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#30d158', boxShadow: '0 0 6px #30d158' }} />
                </span>
                <span style={{ display: 'block', color: a.color, fontSize: 12.5, fontWeight: 600 }}>{a.role}</span>
                <span style={{ display: 'block', color: 'var(--text2)', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tagline}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Chat 1:1 con l'agente selezionato ────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 460,
      border: '1px solid var(--border)', borderRadius: 16, background: 'var(--surface)', overflow: 'hidden' }}>
      {/* Header agente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--glass)' }}>
        <button type="button" onClick={() => setSel(null)}
          style={{ cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}>←</button>
        <Avatar a={agent} size={40} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: 'var(--text)' }}>{agent.name}</strong>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#30d158', boxShadow: '0 0 6px #30d158' }} />
            <span style={{ color: 'var(--text2)', fontSize: 11 }}>online</span>
          </span>
          <span style={{ display: 'block', color: agent.color, fontSize: 12.5, fontWeight: 600 }}>{agent.role}</span>
        </span>
      </div>

      {/* Messaggi */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!msgs.length && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 420, color: 'var(--text2)' }}>
            <Avatar a={agent} size={64} />
            <p style={{ marginTop: 12, fontSize: 14 }}>{t('team.intro', { name: agent.name, role: agent.role }, `Parla con ${agent.name}, ${agent.role}. Risponde sui tuoi dati reali.`)}</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant' && <Avatar a={agent} size={30} />}
            <div style={{ padding: '10px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              background: m.role === 'user' ? 'linear-gradient(135deg, #6d28d9, #2a1746)' : 'var(--glass)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)' }}>
              {bubbleText(m.content)}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'flex', gap: 9, alignSelf: 'flex-start' }}>
            <Avatar a={agent} size={30} />
            <div style={{ padding: '10px 14px', borderRadius: 14, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: 14 }}>…</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)', background: 'var(--glass)' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={t('team.placeholder', { name: agent.name }, `Scrivi a ${agent.name}…`)}
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
        <button type="button" onClick={() => send()} disabled={busy || !input.trim()}
          style={{ cursor: busy || !input.trim() ? 'default' : 'pointer', border: 'none', borderRadius: 10, padding: '0 18px',
            background: busy || !input.trim() ? 'var(--border)' : agent.color, color: '#fff', fontWeight: 700, fontSize: 14 }}>
          {t('team.send', null, 'Invia')}
        </button>
      </div>
    </div>
  )
}
