'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

// Zero colori decorativi: l'occhiello e l'icona seguono il testo, il giudizio resta nelle etichette.
const ACCENT = 'var(--text3)'

const PRIORITY_CONFIG = {
  urgent: { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.40)', label: 'URGENT', icon: <Icon name="warning" size={11} /> },
  high:   { color: '#f59e0b', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)', label: 'HIGH',   icon: '▲' },
  medium: { color: '#2997ff', bg: 'var(--neutro-bg)', border: 'var(--neutro-bg)', label: 'MEDIUM', icon: '◆' },
  low:    { color: 'var(--text2)', bg: 'rgba(134,134,139,0.08)', border: 'rgba(134,134,139,0.20)', label: 'LOW',    icon: '·' },
}

// categoria della raccomandazione → canale della Coda Azioni
const CAT_CHANNEL = {
  meta_ads: 'meta', creative: 'meta', audience: 'meta', klaviyo: 'klaviyo',
  pricing: 'shopify', shopify_product: 'shopify', cro: 'other', other: 'other',
}


// I consigli gia' letti, per periodo: tornando sulla Dashboard non si richiedono.
const __recsMemoria = new Map()

export default function RecommendationsFeed({ metrics, preset }) {
  const { t, intlLocale } = useI18n()
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

  const load = useCallback(async (force = false) => {
    if (!metrics) return
    const gia = !force && __recsMemoria.get(preset)
    if (gia) { setRecs(gia.recs); setGeneratedAt(gia.at); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: getClientLocale(), metrics, preset, force }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      setRecs(Array.isArray(j.recommendations) ? j.recommendations : [])
      setGeneratedAt(j.generatedAt ? new Date(j.generatedAt) : null)
      __recsMemoria.set(preset, { recs: Array.isArray(j.recommendations) ? j.recommendations : [], at: j.generatedAt ? new Date(j.generatedAt) : null })
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
    <div className="glass-card-static rec-riquadro" style={{ padding: 22, marginBottom: 22 }}>
      <div className="rec-testa" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: collapsed ? 0 : 16 }}>
        <span className="rec-testa-icona" style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--neutro-bg)', color: 'var(--text2)',
          display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 640,
          flexShrink: 0,
        }}><Icon name="sparkle" size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: ACCENT, fontWeight: 640, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {t('rec.eyebrow')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', marginTop: 3, letterSpacing: '-0.01em' }}>
            {loading ? t('rec.analyzing')
              : visibleRecs.length === 0 ? t('rec.none')
              : (visibleRecs.length === 1 ? t('rec.countOne', { n: visibleRecs.length }) : t('rec.countMany', { n: visibleRecs.length })) + (urgentCount > 0 ? t('rec.urgentSuffix', { n: urgentCount }) : '')}
          </div>
          {generatedAt && (
            <div style={{ fontSize: 11.5, color: 'var(--text4, #666)', marginTop: 4 }}>
              {t('rec.updated', { time: generatedAt.toLocaleString(intlLocale, { hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="senza-tocco"
          style={{
            padding: '7px 11px', borderRadius: 8,
            background: 'var(--glass)',
            border: '1px solid var(--border2)',
            color: 'var(--text3)', fontSize: 11.5, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '…' : '↻'}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="senza-tocco"
          style={{
            padding: '7px 12px', borderRadius: 8,
            background: 'transparent',
            border: '1px solid var(--border2)',
            color: 'var(--text3)', fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {collapsed ? t('rec.show') : t('rec.hide')}
        </button>
      </div>

      {!collapsed && (
        <>
          {error && (
            <div style={{
              padding: 12, borderRadius: 12, marginBottom: 10,
              background: 'rgba(248,113,113,0.10)',
              border: '1px solid rgba(248,113,113,0.30)',
              color: '#fca5a5', fontSize: 13,
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
  const { t } = useI18n()
  const cfg = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.medium
  const catLabel = t('reccat.' + rec.category, null, rec.category)


  return (
    <div className="glass-panel" style={{
      borderRadius: 16, padding: 16,
      borderLeft: `3px solid ${cfg.color}`,
    }}>
      {/* Su computer: etichetta | testo | ×. Su telefono le tre colonne lasciavano al
          testo ~130px (una parola per riga): li' etichetta e × stanno in una riga,
          il testo sotto a tutta larghezza (classi rec-* in lyft-system.css). */}
      <div className="rec-scheda">
        <span className="rec-etichetta" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '4px 10px', borderRadius: 8, minWidth: 64,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          fontSize: 10, color: cfg.color, fontWeight: 640, letterSpacing: '0.04em',
          flexShrink: 0,
        }}>
          {cfg.icon} {cfg.label}
        </span>

        <div className="rec-corpo">
          <div className="rec-titolo-riga">
            <div className="rec-titolo" style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', lineHeight: 1.3 }}>
              {rec.title}
            </div>
            <span style={{
              fontSize: 10, color: 'var(--text3)',
              padding: '3px 8px', borderRadius: 6,
              background: 'var(--glass)',
              fontWeight: 600,
            }}>
              {catLabel}
            </span>
          </div>

          <div style={{ fontSize: 13, color: '#e5e5e5', lineHeight: 1.5 }}>
            {rec.action}
          </div>

          {(rec.why || rec.expected_impact) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10, fontSize: 11.5 }}>
              {rec.why && (
                <div style={{ color: 'var(--text3)' }}>
                  <span style={{ color: 'var(--text4, #666)', fontWeight: 600 }}>{t('rec.why')} </span>{rec.why}
                </div>
              )}
              {rec.expected_impact && (
                <div style={{ color: '#86efac' }}>
                  <span style={{ color: 'rgba(134,239,172,0.7)', fontWeight: 600 }}>{t('rec.impact')} </span>{rec.expected_impact}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          title={t('rec.dismissTitle')}
          className="rec-chiudi senza-tocco"
          style={{
            padding: '4px 8px', borderRadius: 8,
            background: 'transparent', border: 'none',
            color: 'var(--text4, #555)', fontSize: 15, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
