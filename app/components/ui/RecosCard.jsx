'use client'

import Icon from './Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

const LEVEL = {
  urgent: { c: '#ef4444', i: 'warning' },
  high: { c: '#f59e0b', i: 'bolt' },
  info: { c: '#2997ff', i: 'info' },
}
const ORDER = { urgent: 0, high: 1, info: 2 }

// recos: [{ level: 'urgent'|'high'|'info', text }]
export default function RecosCard({ recos }) {
  const { t } = useI18n()
  if (!recos?.length) return null
  const sorted = [...recos].sort((a, b) => (ORDER[a.level] ?? 9) - (ORDER[b.level] ?? 9))
  return (
    <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 16 }}>
      <div className="label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={14} /> {t('reco.title', null, 'Proactive actions & to-dos')}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {sorted.map((r, i) => {
          const L = LEVEL[r.level] || LEVEL.info
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${L.c}` }}>
              <span style={{ color: L.c, marginTop: 1, flexShrink: 0 }}><Icon name={L.i} size={14} /></span>
              <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{r.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
