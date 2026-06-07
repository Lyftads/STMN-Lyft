'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import Icon from './ui/Icon'

const ACCENT = '#bf5af2'

const PRIORITY_CONFIG = {
  urgent: { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.40)', label: 'URGENT', icon: <Icon name="warning" size={11} /> },
  high:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)', label: 'HIGH',   icon: '▲' },
  medium: { color: '#2997ff', bg: 'rgba(41,151,255,0.10)', border: 'rgba(41,151,255,0.25)', label: 'MEDIUM', icon: '◆' },
  low:    { color: '#86868b', bg: 'rgba(134,134,139,0.08)', border: 'rgba(134,134,139,0.20)', label: 'LOW',    icon: '·' },
}

const CATEGORY_LABELS = {
  meta_ads: 'Meta Ads', shopify_product: 'Prodotto', pricing: 'Pricing',
  creative: 'Creative', audience: 'Audience', klaviyo: 'Klaviyo',
  cro: 'CRO', other: 'Altro',
}

export default function RecommendationsFeed({ metrics, preset }) {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [generatedAt, setGeneratedAt] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = sessionStorage.getItem('lyft_dismissed_recs')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch { return new Set() }
  })

  const load = useCallback(async () => {
    if (!metrics) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: getClientLocale(), metrics, preset }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      setRecs(Array.isArray(j.recommendations) ? j.recommendations : [])
      setGeneratedAt(j.generatedAt ? new Date(j.generatedAt) : null)
    } catch (e) {
      setError(e?.message)
    } finally {
      setLoading(false)
    }
  }, [metrics, preset])

  useEffect(() => { load() }, [load])

  const dismiss = (id) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    try { sessionStorage.setItem('lyft_dismissed_recs', JSON.stringify([...next])) } catch {}
  }

  const visibleRecs = recs.filter(r => !dismissed.has(r.id))
  const urgentCount = visibleRecs.filter(r => r.priority === 'urgent').length

  if (!loading && visibleRecs.length === 0 && !error) return null

  return (
    <div className="glass-card-static" style={{ padding: 22, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: collapsed ? 0 : 16 }}>
        <span style={{
          width: 40, height: 40, borderRadius: 11,
          background: `${ACCENT}20`, color: ACCENT,
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
          flexShrink: 0,
        }}><Icon name="sparkle" size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Raccomandazioni proattive
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginTop: 3, letterSpacing: '-0.01em' }}>
            {loading ? 'Sto analizzando i dati…'
              : visibleRecs.length === 0 ? 'Nessuna raccomandazione attiva'
              : `${visibleRecs.length} azione${visibleRecs.length === 1 ? '' : 'i'} suggerit${visibleRecs.length === 1 ? 'a' : 'e'}${urgentCount > 0 ? ` · ${urgentCount} urgent` : ''}`}
          </div>
          {generatedAt && (
            <div style={{ fontSize: 11, color: 'var(--text4, #666)', marginTop: 4 }}>
              Aggiornato {generatedAt.toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: '7px 11px', borderRadius: 9,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text3)', fontSize: 11, fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '…' : '↻'}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          style={{
            padding: '7px 12px', borderRadius: 9,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--text3)', fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {collapsed ? 'Mostra' : 'Nascondi'}
        </button>
      </div>

      {!collapsed && (
        <>
          {error && (
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 10,
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.30)',
              color: '#fca5a5', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Icon name="warning" size={13} /> {error}
            </div>
          )}

          {visibleRecs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleRecs.map(rec => (
                <RecCard key={rec.id} rec={rec} onDismiss={() => dismiss(rec.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RecCard({ rec, onDismiss }) {
  const cfg = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium
  const catLabel = CATEGORY_LABELS[rec.category] || rec.category

  return (
    <div className="glass-panel" style={{
      borderRadius: 14, padding: 16,
      borderLeft: `3px solid ${cfg.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '4px 10px', borderRadius: 6, minWidth: 64,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          fontSize: 9.5, color: cfg.color, fontWeight: 800, letterSpacing: '0.04em',
          flexShrink: 0,
        }}>
          {cfg.icon} {cfg.label}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', flex: 1, lineHeight: 1.3 }}>
              {rec.title}
            </div>
            <span style={{
              fontSize: 9.5, color: 'var(--text3)',
              padding: '3px 8px', borderRadius: 5,
              background: 'rgba(255,255,255,0.04)',
              fontWeight: 600,
            }}>
              {catLabel}
            </span>
          </div>

          <div style={{ fontSize: 12.5, color: '#e5e5e7', lineHeight: 1.5 }}>
            {rec.action}
          </div>

          {(rec.why || rec.expected_impact) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10, fontSize: 11 }}>
              {rec.why && (
                <div style={{ color: 'var(--text3)' }}>
                  <span style={{ color: 'var(--text4, #666)', fontWeight: 700 }}>Perché: </span>{rec.why}
                </div>
              )}
              {rec.expected_impact && (
                <div style={{ color: '#86efac' }}>
                  <span style={{ color: 'rgba(134,239,172,0.7)', fontWeight: 700 }}>Impatto: </span>{rec.expected_impact}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          title="Ignora questa raccomandazione (riapparirà al prossimo refresh)"
          style={{
            padding: '4px 8px', borderRadius: 6,
            background: 'transparent', border: 'none',
            color: 'var(--text4, #555)', fontSize: 14, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
