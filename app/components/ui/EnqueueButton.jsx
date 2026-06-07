'use client'

import { useState } from 'react'
import Icon from './Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Bottone riutilizzabile: accoda un'azione nella Coda Azioni (Fase 1).
// `build` è una funzione che ritorna il body dell'azione { channel, type, ... }.
// `label` opzionale (default "Applica"). Gestisce stati busy/queued/err.
export default function EnqueueButton({ build, label, compact, style }) {
  const { t } = useI18n()
  const [q, setQ] = useState(null)

  const go = async () => {
    setQ('busy')
    try {
      const r = await fetch('/api/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(build()),
      })
      const j = await r.json()
      setQ(j.ok ? 'queued' : 'err')
    } catch { setQ('err') }
  }

  if (q === 'queued') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--green, #86efac)', flexShrink: 0, ...style }}>
      <Icon name="check" size={13} /> {t('aq.inQueue')}
    </span>
  )

  return (
    <button onClick={go} disabled={q === 'busy'} title={t('aq.applyTitle')} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
      padding: compact ? '5px 10px' : '7px 12px', borderRadius: compact ? 8 : 9,
      cursor: q === 'busy' ? 'wait' : 'pointer',
      background: 'rgba(123,91,255,0.16)', border: '1px solid rgba(123,91,255,0.4)',
      color: '#c4b5fd', fontSize: compact ? 11 : 11.5, fontWeight: 800, ...style,
    }}>
      <Icon name="bolt" size={compact ? 12 : 13} /> {q === 'busy' ? '…' : q === 'err' ? t('aq.retry') : (label || t('aq.apply'))}
    </button>
  )
}
