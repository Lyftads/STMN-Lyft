'use client'

import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

// Avviso mostrato quando il cliente non ha configurato competitor in Brand
// Identity. Usato da Competitor Intel e Prezzi vs Competitor (stessa logica).
export default function CompetitorsEmptyNotice({ onNavigate }) {
  const { t } = useI18n()
  return (
    <div
      style={{
        background: 'var(--glass)', border: '1px solid var(--border)',
        borderRadius: 18, padding: '40px 32px', textAlign: 'center',
        maxWidth: 560, margin: '24px auto',
      }}
    >
      <div style={{ display: 'inline-flex', padding: 14, borderRadius: 14, background: 'rgba(124,92,255,0.12)', marginBottom: 16 }}>
        <Icon name="target" size={26} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
        {t('ci.emptyTitle', null, 'Nessun competitor configurato')}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 22 }}>
        {t('ci.emptyDesc', null, 'Per vedere i prodotti e le creatività dei competitor, compila la sezione dedicata in Brand Identity.')}
      </div>
      <button
        onClick={() => onNavigate && onNavigate('brandIdentity')}
        style={{
          background: 'linear-gradient(135deg,#7c5cff,#5b3df0)', border: 'none',
          borderRadius: 10, padding: '11px 22px', color: '#fff', fontSize: 14,
          fontWeight: 800, cursor: 'pointer',
        }}
      >
        {t('ci.emptyCta', null, 'Vai a Brand Identity')}
      </button>
    </div>
  )
}
