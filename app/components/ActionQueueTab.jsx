'use client'

import { useEffect, useState, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

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

export default function ActionQueueTab() {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(123,91,255,0.18)', color: '#7b5bff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="bolt" size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.01em' }}>{t('tab.actionQueue', null, 'Coda Azioni')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('aq.subtitle')}</div>
        </div>
        <button onClick={load} disabled={loading} style={ghostBtn}>
          <Icon name="scan" size={13} /> {loading ? t('aq.refreshing') : t('aq.refresh')}
        </button>
      </div>

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
