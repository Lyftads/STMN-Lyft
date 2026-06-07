'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Banner Dashboard: se ci sono azioni in attesa nella Coda Azioni, le mostra
// con una CTA per rivederle. Best-effort, si nasconde se 0.
export default function PendingActionsBanner({ onOpen }) {
  const { t } = useI18n()
  const [n, setN] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/actions?status=pending')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) setN((j.actions || []).length) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (n === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: '12px 18px', marginBottom: 18, borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(123,91,255,0.14), rgba(100,210,255,0.12))',
      border: '1px solid rgba(123,91,255,0.4)',
    }}>
      <span style={{ color: '#7b5bff', display: 'inline-flex' }}><Icon name="bolt" size={20} /></span>
      <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)' }}>
        <b>{n === 1 ? t('aqbanner.textOne') : t('aqbanner.textMany', { n })}</b>
      </div>
      <button onClick={onOpen} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', fontSize: 12.5, fontWeight: 800,
      }}>
        {t('aqbanner.cta')} <span style={{ fontWeight: 900 }}>→</span>
      </button>
    </div>
  )
}
