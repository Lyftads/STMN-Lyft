'use client'

// ============================================================================
//  FloatingBrain — il "cervello unico" di LyftAI, presente in OGNI tab.
//
//  Un solo assistente, una sola memoria, consapevole di dove sei (tab corrente)
//  e con accesso a TUTTI i dati cross-dominio (via /api/agent-context, che
//  aggrega Shopify+Meta+Klaviyo+GA4+SEO+competitor…). Backend: /api/agent (il
//  Performance Agent, ora sul gateway callBrain) → stessa identità e memoria
//  ovunque. La conversazione persiste in localStorage tra le tab e i reload.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'

const STORE_KEY = 'lyft_brain_msgs'

function loadMsgs() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.slice(-40) : []
  } catch { return [] }
}

export default function FloatingBrain({ currentTab = 'dashboard' }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { setMsgs(loadMsgs()) }, [])
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-40))) } catch {}
  }, [msgs])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs, loading, open])
  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  const tabLabel = t(`tab.${currentTab}`, {}, currentTab)

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    const next = [...msgs, { role: 'user', content: text }]
    setMsgs(next)
    setInput('')
    setLoading(true)
    try {
      // Dati cross-dominio (tutte le piattaforme collegate)
      let agentContext = null
      try {
        const ctxRes = await fetch('/api/agent-context?preset=last_30d&days=30', { cache: 'no-store' })
        if (ctxRes.ok) agentContext = await ctxRes.json()
      } catch {}
      // Consapevolezza della tab: il cervello sa dove sei.
      const ctx = { ...(agentContext || {}), _currentTab: tabLabel }
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          agentContext: ctx,
          preset: 'last_30d',
          locale: getClientLocale(),
        }),
      })
      const data = await r.json()
      const reply = r.ok ? (data?.reply || '…') : `⚠️ ${data?.error || 'Errore'}`
      setMsgs(m => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', content: `⚠️ ${e?.message || 'Errore di rete'}` }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, msgs, tabLabel])

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clear = () => { setMsgs([]); try { localStorage.removeItem(STORE_KEY) } catch {} }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t('brain.title', {}, 'Cervello')}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c5cff 0%, #5b3df0 100%)',
            boxShadow: '0 8px 28px rgba(124,92,255,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-1 6.5V17a3 3 0 0 0 5 2 3 3 0 0 0 5-2v-3.5A3.5 3.5 0 0 0 16 7a4 4 0 0 0-4-4Z" />
            <path d="M12 7v12M9 10h6M9 14h6" />
          </svg>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 'min(420px, calc(100vw - 32px))', height: 'min(640px, calc(100vh - 48px))',
          background: '#0f0f16', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #7c5cff, #5b3df0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-1 6.5V17a3 3 0 0 0 5 2 3 3 0 0 0 5-2v-3.5A3.5 3.5 0 0 0 16 7a4 4 0 0 0-4-4Z" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, lineHeight: 1.1 }}>{t('brain.title', {}, 'Cervello')}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t('brain.context', {}, 'Tutti i dati')} · {tabLabel}
              </div>
            </div>
            <button onClick={clear} title={t('brain.clear', {}, 'Pulisci')} style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </button>
            <button onClick={() => setOpen(false)} title={t('brain.close', {}, 'Chiudi')} style={iconBtn}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msgs.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                {t('brain.greeting', {}, 'Ciao, sono il tuo cervello operativo. Vedo tutti i tuoi dati (Shopify, Meta, Klaviyo, GA4, SEO…) e so dove sei. Chiedimi qualsiasi cosa.')}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '10px 13px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user' ? 'linear-gradient(135deg, #7c5cff, #5b3df0)' : 'rgba(255,255,255,0.06)',
                  color: m.role === 'user' ? '#fff' : 'rgba(255,255,255,0.92)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '6px 2px' }}>
                {t('brain.thinking', {}, 'Sto ragionando…')}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder={t('brain.placeholder', {}, 'Chiedi qualsiasi cosa…')}
              style={{
                flex: 1, resize: 'none', maxHeight: 120, padding: '10px 12px', borderRadius: 11,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 13.5, lineHeight: 1.4, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={send} disabled={loading || !input.trim()} style={{
              flex: '0 0 auto', width: 40, height: 40, borderRadius: 11, border: 'none',
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              opacity: loading || !input.trim() ? 0.4 : 1,
              background: 'linear-gradient(135deg, #7c5cff, #5b3df0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const iconBtn = {
  flex: '0 0 auto', width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'transparent', color: 'rgba(255,255,255,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
