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
import { createPortal } from 'react-dom'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'

const STORE_KEY = 'lyft_brain_msgs'

// Render leggero del markdown: **grassetto** → bold (niente più ** a schermo).
// Mantiene i newline (il bubble ha whiteSpace pre-wrap).
function renderRich(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

// ── Rilevamento del periodo dalla domanda (IT) ──────────────────────────────
// Permette al Cervello di rispondere su QUALSIASI time frame: una data precisa
// ("8 maggio"), un mese ("a maggio"), un range ("dal 1 al 10 maggio") o un
// preset ("ieri", "ultimi 7 giorni", "mese scorso"). Se non trova nulla → null
// (il chiamante usa il default last_30d).
const MESI = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
}
const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const lastDayOfMonth = (y, m) => new Date(y, m, 0).getDate()

// Anno di default: se la data costruita risultasse nel futuro, usa l'anno prima.
function resolveYear(month, day, explicitYear) {
  if (explicitYear) return explicitYear
  const now = new Date()
  const y = now.getFullYear()
  const candidate = new Date(`${ymd(y, month, day || 1)}T00:00:00`)
  return candidate > now ? y - 1 : y
}

function detectPeriod(raw) {
  const text = ` ${String(raw).toLowerCase()} `

  // 1) ISO esplicita: 2026-05-08
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) { const d = `${iso[1]}-${iso[2]}-${iso[3]}`; return { since: d, until: d, label: d } }

  // 2) Range "dal 1 (maggio) al 10 maggio"
  const range = text.match(/\bdal?\s+(\d{1,2})\s*([a-zà]+)?\s+al?\s+(\d{1,2})\s+([a-zà]+)(?:\s+(\d{4}))?/)
  if (range) {
    const m2 = MESI[range[4]]
    if (m2) {
      const m1 = MESI[range[2]] || m2
      const yr = resolveYear(m2, Number(range[3]), range[5] && Number(range[5]))
      return { since: ymd(yr, m1, Number(range[1])), until: ymd(yr, m2, Number(range[3])), label: `${range[1]} → ${range[3]} ${range[4]}` }
    }
  }

  // 3) Data singola "8 maggio" / "8 maggio 2026"
  const single = text.match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/)
  if (single) {
    const m = MESI[single[2]], day = Number(single[1])
    const yr = resolveYear(m, day, single[3] && Number(single[3]))
    const d = ymd(yr, m, day)
    return { since: d, until: d, label: `${day} ${single[2]} ${yr}` }
  }

  // 4) Data numerica "8/5" o "08/05/2026"
  const num = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (num) {
    const day = Number(num[1]), m = Number(num[2])
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      let yr = num[3] ? Number(num[3]) : resolveYear(m, day)
      if (yr < 100) yr += 2000
      const d = ymd(yr, m, day)
      return { since: d, until: d, label: d }
    }
  }

  // 5) Mese intero "a maggio" / "nel mese di maggio" / "maggio 2026"
  const month = text.match(/\b(?:di\s+|nel mese di\s+|mese di\s+|a\s+|in\s+)?(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?\b/)
  if (month) {
    const m = MESI[month[1]]
    const yr = resolveYear(m, 1, month[2] && Number(month[2]))
    return { since: ymd(yr, m, 1), until: ymd(yr, m, lastDayOfMonth(yr, m)), label: `${month[1]} ${yr}` }
  }

  // 6) Preset a parole
  if (/\boggi\b/.test(text)) return { preset: 'today', label: 'oggi' }
  if (/\bieri\b/.test(text)) return { preset: 'yesterday', label: 'ieri' }
  if (/ultim[io]\s+7\s+giorni|ultima settimana|settimana scorsa/.test(text)) return { preset: 'last_7d', label: 'ultimi 7 giorni' }
  if (/ultim[io]\s+14\s+giorni|due settimane/.test(text)) return { preset: 'last_14d', label: 'ultimi 14 giorni' }
  if (/ultim[io]\s+(28|30)\s+giorni|ultimo mese/.test(text)) return { preset: 'last_30d', label: 'ultimi 30 giorni' }
  if (/ultim[io]\s+90\s+giorni|ultimo trimestre/.test(text)) return { preset: 'last_90d', label: 'ultimi 90 giorni' }
  if (/questo mese|mese corrente|questo mese\b/.test(text)) return { preset: 'this_month', label: 'questo mese' }
  if (/mese scorso|scorso mese|mese passato/.test(text)) return { preset: 'last_month', label: 'mese scorso' }
  if (/quest'anno|quest anno|anno corrente|da inizio anno|ytd/.test(text)) return { preset: 'ytd', label: "quest'anno" }

  return null
}

// Costruisce la query string per /api/agent-context dal periodo rilevato.
function periodToQuery(p) {
  if (!p) return { qs: 'preset=last_30d&days=30', label: 'ultimi 30 giorni' }
  if (p.since && p.until) {
    const days = Math.max(1, Math.round((new Date(`${p.until}T00:00:00`) - new Date(`${p.since}T00:00:00`)) / 86400000) + 1)
    // metrics legge custom_<since>_<until>; meta-detail/creative leggono since/until + preset=custom
    return { qs: `preset=custom_${p.since}_${p.until}&since=${p.since}&until=${p.until}&days=${days}`, label: p.label }
  }
  const daysByPreset = { today: 1, yesterday: 1, last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90, this_month: 31, last_month: 31, ytd: 200 }
  return { qs: `preset=${p.preset}&days=${daysByPreset[p.preset] || 30}`, label: p.label }
}

function loadMsgs() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.slice(-40) : []
  } catch { return [] }
}

export default function FloatingBrain({ currentTab = 'dashboard' }) {
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [actions, setActions] = useState([])      // azioni proposte dalla conversazione
  const [actLoading, setActLoading] = useState(false)
  const [added, setAdded] = useState({})          // indici già aggiunti alla Coda
  // Skills (stile Sidekick): prompt salvati e condivisi nel workspace
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [skills, setSkills] = useState(null)      // null = mai caricate
  const [skillTitle, setSkillTitle] = useState('')
  const [skillBusy, setSkillBusy] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const loadSkills = useCallback(async () => {
    try { const r = await fetch('/api/brain-skills', { cache: 'no-store' }); const j = await r.json(); setSkills(Array.isArray(j?.skills) ? j.skills : []) } catch { setSkills([]) }
  }, [])
  const toggleSkills = () => { setSkillsOpen(v => { const n = !v; if (n && skills === null) loadSkills(); return n }) }
  const useSkill = (s) => {
    setInput(s.prompt); setSkillsOpen(false)
    fetch('/api/brain-skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, used: true }) }).catch(() => {})
    setTimeout(() => inputRef.current?.focus(), 50)
  }
  const saveSkill = async () => {
    const prompt = input.trim(); const title = skillTitle.trim()
    if (!prompt || !title || skillBusy) return
    setSkillBusy(true)
    try {
      const r = await fetch('/api/brain-skills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, prompt }) })
      const j = await r.json()
      if (j?.skill) { setSkills(p => [j.skill, ...(p || [])]); setSkillTitle('') }
    } catch {} finally { setSkillBusy(false) }
  }
  const deleteSkill = async (id) => {
    setSkills(p => (p || []).filter(s => s.id !== id))
    fetch(`/api/brain-skills?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  }

  // Portal su document.body: così la position:fixed è relativa al VIEWPORT e
  // non a un antenato con transform/filter (che la farebbe scrollare).
  useEffect(() => { setMounted(true) }, [])
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
      // Periodo richiesto nella domanda (data precisa, mese, range o preset).
      // Default: ultimi 30 giorni. Così il Cervello risponde su QUALSIASI time frame.
      const period = detectPeriod(text)
      const { qs, label: periodLabel } = periodToQuery(period)
      // Niente più pre-fetch del contesto aggregato (era il collo di bottiglia
      // prima di OGNI messaggio): il cervello ha i tool live e legge da solo
      // ciò che serve. Restano solo tab corrente e periodo (consapevolezza).
      const ctx = { _currentTab: tabLabel, _periodLabel: periodLabel }
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          agentContext: ctx,
          preset: period && period.preset ? period.preset : (period ? `custom_${period.since}_${period.until}` : 'last_30d'),
          periodLabel,
          locale: getClientLocale(),
          stream: true,
        }),
      })
      if (r.ok && (r.headers.get('content-type') || '').includes('text/event-stream') && r.body) {
        // Streaming: i token compaiono appena generati (stile Sidekick)
        setMsgs(m => [...m, { role: 'assistant', content: '' }])
        const reader = r.body.getReader()
        const dec = new TextDecoder()
        let acc = '', buf = ''
        const paint = (text) => setMsgs(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: text }; return c })
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const events = buf.split('\n\n'); buf = events.pop() || ''
          for (const ev of events) {
            if (!ev.startsWith('data: ')) continue
            let j; try { j = JSON.parse(ev.slice(6)) } catch { continue }
            if (j.d) { acc += j.d; paint(acc) }
            if (j.error) { acc = `⚠️ ${j.error}`; paint(acc) }
          }
        }
        if (!acc) paint('…')
      } else {
        const data = await r.json()
        const reply = r.ok ? (data?.reply || '…') : `⚠️ ${data?.error || 'Errore'}`
        setMsgs(m => [...m, { role: 'assistant', content: reply }])
      }
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', content: `⚠️ ${e?.message || 'Errore di rete'}` }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, msgs, tabLabel])

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clear = () => { setMsgs([]); setActions([]); setAdded({}); try { localStorage.removeItem(STORE_KEY) } catch {} }

  // Estrae azioni concrete dalla conversazione (proposte per la Coda Azioni).
  const proposeActions = useCallback(async () => {
    if (actLoading || msgs.length === 0) return
    setActLoading(true); setActions([]); setAdded({})
    try {
      const r = await fetch('/api/actions/from-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs.map(m => ({ role: m.role, content: m.content })), locale: getClientLocale() }),
      })
      const data = await r.json()
      setActions(Array.isArray(data?.actions) ? data.actions : [])
    } catch {} finally { setActLoading(false) }
  }, [actLoading, msgs])

  // Aggiunge un'azione proposta alla Coda Azioni (status 'pending' → approvazione manuale).
  const enqueue = useCallback(async (a, idx) => {
    if (added[idx]) return
    try {
      const r = await fetch('/api/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: a.channel, type: a.type, target_name: a.target_name, summary: a.summary, source: 'brain', payload: {} }),
      })
      const data = await r.json()
      if (data?.ok) setAdded(s => ({ ...s, [idx]: true }))
    } catch {}
  }, [added])

  if (!mounted) return null

  return createPortal(
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
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
          background: '#0f0f16', border: '1px solid var(--border2)', borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #7c5cff, #5b3df0)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-1 6.5V17a3 3 0 0 0 5 2 3 3 0 0 0 5-2v-3.5A3.5 3.5 0 0 0 16 7a4 4 0 0 0-4-4Z" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, lineHeight: 1.1 }}>{t('brain.title', {}, 'Cervello')}</div>
              <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t('brain.context', {}, 'Tutti i dati')} · {tabLabel}
              </div>
            </div>
            {msgs.length > 0 && (
              <button onClick={proposeActions} disabled={actLoading} title={t('brain.createActions', {}, 'Crea azioni dalla conversazione')} style={{ ...iconBtn, color: '#a78bfa' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg>
              </button>
            )}
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
              <div style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
                {t('brain.greeting', {}, 'Ciao, sono il tuo cervello operativo. Vedo tutti i tuoi dati (Shopify, Meta, Klaviyo, GA4, SEO…) e so dove sei. Chiedimi qualsiasi cosa.')}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '10px 13px', borderRadius: 13, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: m.role === 'user' ? 'linear-gradient(135deg, #7c5cff, #5b3df0)' : 'rgba(255,255,255,0.06)',
                  color: m.role === 'user' ? 'var(--text)' : 'var(--text)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                }}>{m.role === 'assistant' ? renderRich(m.content) : m.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text3)', fontSize: 13, padding: '6px 2px' }}>
                {t('brain.thinking', {}, 'Sto ragionando…')}
              </div>
            )}
          </div>

          {/* Azioni proposte dalla conversazione → Coda Azioni */}
          {(actLoading || actions.length > 0) && (
            <div style={{ borderTop: '1px solid var(--border)', padding: 12, maxHeight: 210, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: 'var(--text3)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('brain.actionsTitle', {}, 'Azioni proposte')}
              </div>
              {actLoading && <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('brain.thinking', {}, 'Sto ragionando…')}</div>}
              {!actLoading && actions.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('brain.noActions', {}, 'Nessuna azione concreta emersa.')}</div>}
              {actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text)', fontSize: 12.5, lineHeight: 1.35 }}>{a.summary}</div>
                    <div style={{ color: 'var(--text3)', fontSize: 10.5, marginTop: 2 }}>{a.channel} · {a.type}{a.target_name ? ` · ${a.target_name}` : ''}</div>
                  </div>
                  <button onClick={() => enqueue(a, i)} disabled={!!added[i]} style={{
                    flex: '0 0 auto', fontSize: 11.5, fontWeight: 600, padding: '6px 10px', borderRadius: 8, border: 'none',
                    cursor: added[i] ? 'default' : 'pointer', whiteSpace: 'nowrap',
                    background: added[i] ? 'rgba(48,209,88,0.16)' : 'linear-gradient(135deg, #7c5cff, #5b3df0)',
                    color: added[i] ? '#30d158' : 'var(--text)',
                  }}>{added[i] ? t('brain.added', {}, '✓ Aggiunta') : t('brain.addToQueue', {}, 'Aggiungi')}</button>
                </div>
              ))}
            </div>
          )}

          {/* Skills: prompt salvati del workspace */}
          {skillsOpen && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ color: 'var(--text2)', fontSize: 11, marginBottom: 2 }}>{t('brain.skillsHint', {}, 'Prompt salvati del workspace: riusali in un click.')}</div>
              {skills === null && <div style={{ color: 'var(--text3)', fontSize: 12 }}>…</div>}
              {Array.isArray(skills) && skills.length === 0 && (
                <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('brain.skillsEmpty', {}, 'Nessuna skill salvata. Scrivi il prompt nella casella e premi «Salva prompt attuale».')}</div>
              )}
              {(skills || []).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px' }}>
                  <button onClick={() => useSkill(s)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ color: 'var(--text)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>⚡ {s.title}</div>
                    <div style={{ color: 'var(--text3)', fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.prompt}</div>
                  </button>
                  <button onClick={() => deleteSkill(s.id)} aria-label="delete" style={{ ...iconBtn, width: 24, height: 24 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  value={skillTitle}
                  onChange={e => setSkillTitle(e.target.value)}
                  placeholder={t('brain.skillsSavePh', {}, 'Titolo della skill…')}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 9, background: 'var(--glass)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
                />
                <button onClick={saveSkill} disabled={!input.trim() || !skillTitle.trim() || skillBusy} style={{
                  flex: '0 0 auto', fontSize: 11.5, fontWeight: 600, padding: '7px 11px', borderRadius: 9, border: 'none',
                  cursor: (!input.trim() || !skillTitle.trim() || skillBusy) ? 'default' : 'pointer',
                  opacity: (!input.trim() || !skillTitle.trim() || skillBusy) ? 0.45 : 1,
                  background: 'linear-gradient(135deg, #7c5cff, #5b3df0)', color: 'var(--text)',
                }}>{t('brain.skillsSave', {}, 'Salva prompt attuale')}</button>
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button onClick={toggleSkills} aria-label={t('brain.skills', {}, 'Skills')} title={t('brain.skills', {}, 'Skills')} style={{
              ...iconBtn, width: 40, height: 40, borderRadius: 11,
              border: '1px solid var(--border2)', background: skillsOpen ? 'rgba(124,92,255,0.18)' : 'var(--glass)',
              color: skillsOpen ? '#a78bfa' : 'var(--text3)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" /></svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder={t('brain.placeholder', {}, 'Chiedi qualsiasi cosa…')}
              style={{
                flex: 1, resize: 'none', maxHeight: 120, padding: '10px 12px', borderRadius: 11,
                background: 'var(--glass)', border: '1px solid var(--border2)',
                color: 'var(--text)', fontSize: 13.5, lineHeight: 1.4, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={send} disabled={loading || !input.trim()} style={{
              flex: '0 0 auto', width: 40, height: 40, borderRadius: 11, border: 'none',
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              opacity: loading || !input.trim() ? 0.4 : 1,
              background: 'linear-gradient(135deg, #7c5cff, #5b3df0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}

const iconBtn = {
  flex: '0 0 auto', width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
  background: 'transparent', color: 'var(--text3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
