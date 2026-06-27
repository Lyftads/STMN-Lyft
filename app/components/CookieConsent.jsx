'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Banner consenso cookie (ePrivacy/GDPR). Memorizza la scelta in localStorage.
// 'all' = accetta cookie non essenziali (analytics/preferenze); 'essential' =
// solo cookie tecnici necessari. La scelta è leggibile da altri moduli via
// window.localStorage.getItem('lyft_cookie_consent').
const KEY = 'lyft_cookie_consent'

export default function CookieConsent() {
  const { t } = useI18n()
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY)
      if (!v) setShow(true)
    } catch {}
  }, [])

  const choose = (value) => {
    try {
      localStorage.setItem(KEY, value)
      localStorage.setItem(KEY + '_at', new Date().toISOString())
    } catch {}
    setShow(false)
    // Evento per chi vuole attivare/disattivare i tracker in base al consenso.
    try { window.dispatchEvent(new CustomEvent('cookie-consent', { detail: value })) } catch {}
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 9999,
      maxWidth: 720, margin: '0 auto',
      background: 'rgba(12,12,20,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
      boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
      padding: '16px 18px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 240, fontSize: 12.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>
        {t('cc.text', null, 'Usiamo cookie tecnici necessari al funzionamento e, con il tuo consenso, cookie di preferenza/analitici per migliorare il servizio.')}{' '}
        <Link href="/privacy" style={{ color: '#2997ff', textDecoration: 'underline' }}>{t('cc.privacy', null, 'Privacy Policy')}</Link>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => choose('essential')} style={btnGhost}>{t('cc.essential', null, 'Solo essenziali')}</button>
        <button onClick={() => choose('all')} style={btnPrimary}>{t('cc.acceptAll', null, 'Accetta tutto')}</button>
      </div>
    </div>
  )
}

const btnGhost = {
  padding: '9px 16px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff',
}
const btnPrimary = {
  padding: '9px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
  background: 'linear-gradient(135deg, #7b5bff, #2997ff)', border: 'none', color: '#fff',
}
