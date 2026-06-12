'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Icon from './ui/Icon'

const ACCENT = '#bf5af2'

const SEV_CFG = {
  urgent:  { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.40)', icon: <Icon name="warning" size={13} /> },
  warning: { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)', icon: '▲' },
  info:    { color: '#2997ff', bg: 'rgba(41,151,255,0.10)', border: 'rgba(41,151,255,0.25)', icon: 'ⓘ' },
}

export default function AlertsBell() {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [counts, setCounts] = useState({ urgent: 0, warning: 0, info: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)

  const load = useCallback(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(j => {
        if (!j?.error) {
          setAlerts(Array.isArray(j.alerts) ? j.alerts : [])
          setCounts(j.counts || { urgent: 0, warning: 0, info: 0, total: 0 })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5 * 60_000) // refresh ogni 5 min
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const dismiss = async (id) => {
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'dismiss' }),
    })
    setAlerts(prev => prev.filter(a => a.id !== id))
    setCounts(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
  }

  const totalBadge = counts.total
  const hasUrgent = counts.urgent > 0
  const badgeColor = hasUrgent ? '#f87171' : counts.warning > 0 ? '#fbbf24' : '#2997ff'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={totalBadge > 0 ? `${totalBadge} alert non visualizzati` : 'Nessun alert'}
        style={{
          position: 'relative',
          width: 38, height: 38, borderRadius: 11,
          background: open ? `${ACCENT}1f` : 'rgba(255,255,255,0.04)',
          border: open ? `1px solid ${ACCENT}66` : '1px solid var(--border)',
          color: 'var(--text)', fontSize: 16, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
          transition: 'all .15s',
        }}
      >
        <Icon name="warning" size={18} />
        {totalBadge > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9,
            background: badgeColor,
            color: 'var(--text)', fontSize: 10, fontWeight: 800,
            display: 'grid', placeItems: 'center',
            border: '1.5px solid #000',
          }}>
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 420, maxHeight: 540, overflowY: 'auto',
          background: 'rgba(10,10,22,0.98)',
          backdropFilter: 'blur(40px) saturate(2.5)',
          WebkitBackdropFilter: 'blur(40px) saturate(2.5)',
          border: '1.5px solid var(--border2)',
          borderRadius: 16,
          boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.55)',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, paddingBottom: 12,
            borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: 9.5, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Alert center
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                {totalBadge === 0 ? 'Tutto sotto controllo' : `${totalBadge} alert attivi`}
              </div>
            </div>
            {totalBadge > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {counts.urgent > 0 && <SeverityBadge sev="urgent" count={counts.urgent} />}
                {counts.warning > 0 && <SeverityBadge sev="warning" count={counts.warning} />}
                {counts.info > 0 && <SeverityBadge sev="info" count={counts.info} />}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '30px 0', fontSize: 12 }}>
              Caricamento…
            </div>
          ) : alerts.length === 0 ? (
            <div style={{
              color: 'var(--text4, #555)', textAlign: 'center', padding: '30px 0',
              fontSize: 12, fontStyle: 'italic',
            }}>
              Nessun alert attivo.<br />Il cron notturno scrive insight ogni mattina.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map(a => (
                <AlertItem key={a.id} alert={a} onDismiss={() => dismiss(a.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SeverityBadge({ sev, count }) {
  const cfg = SEV_CFG[sev]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: 10, color: cfg.color, fontWeight: 800,
    }}>
      {cfg.icon} {count}
    </span>
  )
}

function AlertItem({ alert, onDismiss }) {
  const cfg = SEV_CFG[alert.severity] || SEV_CFG.info
  const created = new Date(alert.createdAt)
  const diffH = Math.floor((Date.now() - created.getTime()) / 3600_000)
  const timeLabel = diffH < 24 ? `${diffH}h fa` : `${Math.floor(diffH / 24)}gg fa`

  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: 'var(--glass)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${cfg.color}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 7px', borderRadius: 5,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          fontSize: 9, color: cfg.color, fontWeight: 800,
        }}>
          {cfg.icon} {alert.severity.toUpperCase()}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text4, #666)' }}>{timeLabel}</span>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '2px 6px', borderRadius: 4,
            background: 'transparent', border: 'none',
            color: 'var(--text4, #555)', fontSize: 14, cursor: 'pointer',
          }}
        >×</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
        {alert.content}
      </div>
    </div>
  )
}
