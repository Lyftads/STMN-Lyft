'use client'

import { useEffect, useState, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'

// Composer: descrivi una campagna in linguaggio naturale → l'AI prepara una
// bozza → la accodi (create_campaign) per l'approvazione. Non crea nulla da solo.
function LaunchComposer({ t, onQueued }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState(null)
  const [queuing, setQueuing] = useState(false)

  const generate = async () => {
    if (!prompt.trim()) return
    setDrafting(true); setErr(null); setDraft(null)
    try {
      const r = await fetch('/api/actions/draft-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, locale: getClientLocale() }),
      })
      const j = await r.json()
      if (j.ok) setDraft(j.draft); else setErr(j.error || 'Errore')
    } catch (e) { setErr(e.message) }
    setDrafting(false)
  }

  const enqueue = async () => {
    if (!draft) return
    setQueuing(true)
    try {
      await fetch('/api/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'meta', source: 'launch', type: 'create_campaign',
          target_name: draft.name,
          payload: draft,
          summary: draft.summary,
        }),
      })
      setDraft(null); setPrompt(''); setOpen(false)
      onQueued && onQueued()
    } catch {}
    setQueuing(false)
  }

  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '4px 0' }}>
      <span style={{ color: 'var(--text3)', minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{value}</span>
    </div>
  )

  return (
    <div className="glass-card-static" style={{ padding: 16, borderRadius: 14, marginBottom: 16, border: '1px solid rgba(123,91,255,0.3)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}>
        <span style={{ color: '#7b5bff', display: 'inline-flex' }}><Icon name="rocket" size={18} /></span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{t('aq.launch.title')}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>{t('aq.launch.hint')}</div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t('aq.launch.placeholder')} rows={3}
            style={{ width: '100%', resize: 'vertical', borderRadius: 10, padding: '10px 12px', background: 'var(--glass2, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={generate} disabled={drafting || !prompt.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: drafting ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', fontSize: 12.5, fontWeight: 800 }}>
              <Icon name="sparkle" size={13} /> {drafting ? t('aq.launch.generating') : t('aq.launch.generate')}
            </button>
          </div>
          {err && <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="warning" size={13} /> {err}</div>}

          {draft && (
            <div className="glass-panel" style={{ marginTop: 12, padding: 14, borderRadius: 12, borderLeft: '3px solid #7b5bff' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{draft.name}</div>
              {row(t('aq.launch.objective'), draft.objective)}
              {row(t('aq.launch.budget'), `€${draft.daily_budget_eur}`)}
              {row(t('aq.launch.audience'), draft.audience || '—')}
              {row(t('aq.launch.goal'), draft.optimization_goal)}
              <div style={{ marginTop: 12 }}>
                <button onClick={enqueue} disabled={queuing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: queuing ? 'wait' : 'pointer', background: '#30d158', color: '#04210f', fontSize: 12.5, fontWeight: 800 }}>
                  <Icon name="bolt" size={13} /> {t('aq.launch.enqueue')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Coda Azioni (Fase 1): raccomandazioni accodate da Budget Advisor / Creative
// Fatigue / agente → workflow di approvazione umana. L'esecuzione è manuale
// finché non arriva l'executor (Fase 2). Admin-gated lato API.

const STATUS_CFG = {
  pending:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: 'clock' },
  approved: { color: '#2997ff', bg: 'rgba(41,151,255,0.12)', icon: 'check' },
  executed: { color: '#30d158', bg: 'rgba(48,209,88,0.12)', icon: 'check-circle' },
  rejected: { color: '#86868b', bg: 'rgba(134,134,139,0.12)', icon: 'close' },
  failed:   { color: '#ff453a', bg: 'rgba(255,69,58,0.12)', icon: 'warning' },
}

const TYPE_ICON = {
  pause_campaign: 'close', resume_campaign: 'check', scale_budget: 'chart-line',
  shift_budget: 'send', refresh_creative: 'image', custom: 'bolt',
}

const FILTER_IDS = ['all', 'pending', 'approved', 'executed', 'rejected']

const PRIO_COLOR = { urgent: '#f87171', high: '#fbbf24', medium: '#2997ff', low: '#86868b' }

// Orchestratore: l'AI legge i dati e propone azioni cross-canale → un clic accoda.
function SuggestPanel({ t, metrics, existing, onQueued }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState(null)
  const [err, setErr] = useState(null)
  const [q, setQ] = useState({})

  const run = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/actions/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, locale: getClientLocale(), exclude: existing || [] }),
      })
      const j = await r.json()
      if (j.ok) setItems(j.suggestions || []); else setErr(j.error || 'Errore')
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const add = async (idx, s, skipReload) => {
    setQ(p => ({ ...p, [idx]: 'busy' }))
    try {
      const r = await fetch('/api/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: s.channel, source: 'orchestrator', type: s.type,
          target_name: s.target_name || null,
          payload: { priority: s.priority, why: s.why || null },
          summary: s.summary,
        }),
      })
      const j = await r.json()
      setQ(p => ({ ...p, [idx]: j.ok ? 'queued' : 'err' }))
      if (j.ok && !skipReload) onQueued && onQueued()
      return j.ok
    } catch { setQ(p => ({ ...p, [idx]: 'err' })); return false }
  }

  const addAll = async () => {
    if (!items) return
    let any = false
    for (let idx = 0; idx < items.length; idx++) {
      if (q[idx] === 'queued') continue
      const ok = await add(idx, items[idx], true)
      any = any || ok
    }
    if (any) onQueued && onQueued()
  }
  const remaining = items ? items.filter((_, idx) => q[idx] !== 'queued').length : 0

  return (
    <div className="glass-card-static" style={{ padding: 16, borderRadius: 14, marginBottom: 16, border: '1px solid rgba(100,210,255,0.28)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#64d2ff', display: 'inline-flex' }}><Icon name="sparkle" size={18} /></span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('aq.suggest.title')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('aq.suggest.hint')}</div>
        </div>
        <button onClick={run} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: loading ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#2997ff,#64d2ff)', color: '#04210f', fontSize: 12.5, fontWeight: 800 }}>
          <Icon name="sparkle" size={13} /> {loading ? t('aq.suggest.generating') : t('aq.suggest.btn')}
        </button>
      </div>

      {err && <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="warning" size={13} /> {err}</div>}

      {items && items.length === 0 && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text3)' }}>{t('aq.suggest.none')}</div>}

      {items && items.length > 1 && remaining > 0 && (
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button onClick={addAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(123,91,255,0.45)', background: 'rgba(123,91,255,0.16)', color: '#c4b5fd', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>
            <Icon name="bolt" size={12} /> {t('aq.suggest.addAll', { n: remaining })}
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {items.map((s, idx) => (
            <div key={idx} className="glass-panel" style={{ borderRadius: 12, padding: 12, borderLeft: `3px solid ${PRIO_COLOR[s.priority] || '#2997ff'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{s.summary}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 5, fontSize: 11, color: 'var(--text3)' }}>
                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#a78bfa' }}>{s.channel}</span>
                    <span style={{ color: PRIO_COLOR[s.priority] || '#2997ff', fontWeight: 700 }}>· {s.priority}</span>
                  </div>
                  {s.why && <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 5 }}>{s.why}</div>}
                </div>
                {q[idx] === 'queued'
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: '#86efac', flexShrink: 0 }}><Icon name="check" size={13} /> {t('aq.inQueue')}</span>
                  : <button onClick={() => add(idx, s)} disabled={q[idx] === 'busy'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '6px 11px', borderRadius: 8, cursor: q[idx] === 'busy' ? 'wait' : 'pointer', background: 'rgba(123,91,255,0.16)', border: '1px solid rgba(123,91,255,0.4)', color: '#c4b5fd', fontSize: 11, fontWeight: 800 }}>
                      <Icon name="bolt" size={12} /> {q[idx] === 'busy' ? '…' : q[idx] === 'err' ? t('aq.retry') : t('aq.suggest.add')}
                    </button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Loop di apprendimento: misura cosa è stato effettivamente eseguito (dai dati
// già in coda). Tasso di azione = eseguite / (eseguite + rifiutate).
function RecapPanel({ t, actions }) {
  const [open, setOpen] = useState(false)
  const history = actions.filter(a => a.status !== 'pending')
  if (history.length === 0) return null

  const executed = actions.filter(a => a.status === 'executed')
  const rejected = actions.filter(a => a.status === 'rejected').length
  const now = new Date()
  const exMonth = executed.filter(a => {
    const d = new Date(a.executed_at || a.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const rate = (executed.length + rejected) > 0 ? Math.round(executed.length / (executed.length + rejected) * 100) : null

  // Tempo medio dalla proposta all'esecuzione
  const decided = executed.filter(a => a.executed_at && a.created_at)
  let avgTime = null
  if (decided.length) {
    const ms = decided.reduce((s, a) => s + (new Date(a.executed_at) - new Date(a.created_at)), 0) / decided.length
    const h = ms / 3_600_000
    avgTime = h < 1 ? `${Math.max(1, Math.round(ms / 60_000))}m` : h < 24 ? `${Math.round(h)}h` : `${Math.floor(h / 24)}g ${Math.round(h % 24)}h`
  }

  const tally = (key) => {
    const m = {}
    for (const a of executed) { const k = a[key] || '—'; m[k] = (m[k] || 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }
  const bySource = tally('source')
  const byChannel = tally('channel')
  const max = Math.max(1, ...bySource.map(([, n]) => n), ...byChannel.map(([, n]) => n))

  const stat = (label, value, sub) => (
    <div className="glass-panel" style={{ borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
  const breakdown = (label, rows) => rows.length > 0 && (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(([k, n]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ minWidth: 96, color: 'var(--text2)', textTransform: 'capitalize' }}>{String(k).replace(/_/g, ' ')}</span>
            <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <span style={{ display: 'block', width: `${Math.max(8, n / max * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#7b5bff,#64d2ff)' }} />
            </span>
            <span style={{ color: 'var(--text3)', fontWeight: 700, minWidth: 18, textAlign: 'right' }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="glass-card-static" style={{ padding: 16, borderRadius: 14, marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 0 }}>
        <span style={{ color: '#64d2ff', display: 'inline-flex' }}><Icon name="chart-bar" size={18} /></span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{t('aq.recap.title')}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{executed.length} · {t('aq.recap.executed').toLowerCase()}</span>
        <span style={{ color: 'var(--text3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>
      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {stat(t('aq.recap.executed'), executed.length, `${exMonth} ${t('aq.recap.thisMonth')}`)}
            {rate != null && <div title={t('aq.recap.rateHint')} style={{ flex: 1, minWidth: 120 }}>{stat(t('aq.recap.actionRate'), `${rate}%`)}</div>}
            {avgTime != null && <div title={t('aq.recap.avgTimeHint')} style={{ flex: 1, minWidth: 120 }}>{stat(t('aq.recap.avgTime'), avgTime)}</div>}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {breakdown(t('aq.recap.bySource'), bySource)}
            {breakdown(t('aq.recap.byChannel'), byChannel)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ActionQueueTab({ metrics }) {
  const { t } = useI18n()
  const [actions, setActions] = useState([])
  const [counts, setCounts] = useState({})
  const [me, setMe] = useState({ isAdmin: false })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/actions')
      const j = await r.json()
      setActions(Array.isArray(j.actions) ? j.actions : [])
      setCounts(j.counts || {})
      if (j.me) setMe(j.me)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const op = async (id, operation) => {
    setBusy(id)
    try {
      await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, op: operation }),
      })
      await load()
    } catch {}
    setBusy(null)
  }

  const remove = async (id) => {
    setBusy(id)
    try { await fetch(`/api/actions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); await load() } catch {}
    setBusy(null)
  }

  const shown = filter === 'all' ? actions : actions.filter(a => a.status === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={load} disabled={loading} style={ghostBtn}>
          <Icon name="scan" size={13} /> {loading ? t('aq.refreshing') : t('aq.refresh')}
        </button>
      </div>

      <RecapPanel t={t} actions={actions} />
      <SuggestPanel t={t} metrics={metrics} existing={actions.filter(a => a.status === 'pending' || a.status === 'approved').map(a => a.summary)} onQueued={load} />
      <LaunchComposer t={t} onQueued={load} />

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTER_IDS.map(id => {
          const n = id === 'all' ? actions.length : (counts[id] || 0)
          const active = filter === id
          return (
            <button key={id} onClick={() => setFilter(id)} style={{
              padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              border: active ? '1px solid #7b5bff' : '1px solid var(--border)',
              background: active ? 'rgba(123,91,255,0.15)' : 'transparent',
              color: active ? '#fff' : 'var(--text3)',
            }}>
              {t('aq.filter.' + id)} {n > 0 && <span style={{ opacity: 0.7 }}>· {n}</span>}
            </button>
          )
        })}
      </div>

      {loading && actions.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20 }}>{t('aq.loading')}</div>
      ) : shown.length === 0 ? (
        <div className="glass-card-static" style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ color: '#7b5bff', marginBottom: 10 }}><Icon name="check-circle" size={30} /></div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {filter === 'all' ? t('aq.emptyTitleAll') : t('aq.emptyTitleFiltered', { status: t('aq.filter.' + filter) })}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>{t('aq.emptyHint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(a => {
            const s = STATUS_CFG[a.status] || STATUS_CFG.pending
            return (
              <div key={a.id} className="glass-panel" style={{ borderRadius: 14, padding: 16, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.05)', color: 'var(--text2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={TYPE_ICON[a.type] || 'bolt'} size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{a.summary}</div>
                    {a.payload?.why && <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.45 }}>{a.payload.why}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7, fontSize: 11, color: 'var(--text3)' }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: '#a78bfa' }}>{a.channel}</span>
                      {a.target_name && <span>· {a.target_name}</span>}
                      {a.source && <span>· {t('aq.bySource', { source: a.source.replace(/_/g, ' ') })}</span>}
                      {a.created_at && <span>· {new Date(a.created_at).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    <Icon name={s.icon} size={12} /> {t('aq.status.' + a.status)}
                  </span>
                </div>

                {me.isAdmin && a.status !== 'executed' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {a.status === 'pending' && <>
                      <button disabled={busy === a.id} onClick={() => op(a.id, 'approve')} style={btn('#30d158')}><Icon name="check" size={13} /> {t('aq.approve')}</button>
                      <button disabled={busy === a.id} onClick={() => op(a.id, 'reject')} style={btnGhost('#ff8095')}><Icon name="close" size={13} /> {t('aq.reject')}</button>
                    </>}
                    {a.status === 'approved' && <>
                      <button disabled={busy === a.id} onClick={() => op(a.id, 'execute')} style={btn('#2997ff')}><Icon name="check-circle" size={13} /> {t('aq.execute')}</button>
                      <button disabled={busy === a.id} onClick={() => op(a.id, 'reopen')} style={btnGhost()}>{t('aq.reopen')}</button>
                    </>}
                    {a.status === 'rejected' && (
                      <button disabled={busy === a.id} onClick={() => op(a.id, 'reopen')} style={btnGhost()}>{t('aq.reopen')}</button>
                    )}
                    <button disabled={busy === a.id} onClick={() => remove(a.id)} style={btnGhost('#86868b')}><Icon name="trash" size={13} /> {t('aq.delete')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 9, cursor: 'pointer',
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
  color: 'var(--text3)', fontSize: 12, fontWeight: 700,
}
const btn = (c) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 9, cursor: 'pointer', border: 'none',
  background: c, color: '#04210f', fontSize: 12, fontWeight: 800,
})
const btnGhost = (c) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 9, cursor: 'pointer',
  background: 'transparent', border: `1px solid ${c ? c + '66' : 'var(--border)'}`,
  color: c || 'var(--text3)', fontSize: 12, fontWeight: 700,
})
