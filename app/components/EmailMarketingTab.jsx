'use client'

import { useEffect, useState } from 'react'
import KlaviyoTab from './KlaviyoTab'
import EmailProviderView from './EmailProviderView'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Wrapper della tab "Email Marketing": sceglie la vista in base al provider
// email collegato dal tenant.
//  - klaviyo / nessuno → KlaviyoTab originale (INVARIATA, chiama /api/klaviyo)
//  - omnisend / mailchimp → vista normalizzata (/api/email-marketing)
export default function EmailMarketingTab() {
  const { t } = useI18n()
  const [provider, setProvider] = useState(undefined) // undefined = loading

  useEffect(() => {
    let active = true
    fetch('/api/email-marketing?probe=1', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      .then(r => r.json())
      .then(j => { if (active) setProvider(j?.provider || null) })
      .catch(() => { if (active) setProvider(null) })
    return () => { active = false }
  }, [])

  if (provider === undefined) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('em.loading', null, 'Carico i dati…')}</div>
  }
  if (provider === 'omnisend' || provider === 'mailchimp') {
    return <EmailProviderView provider={provider} />
  }
  // klaviyo o nessun provider → comportamento originale invariato
  return <KlaviyoTab />
}
