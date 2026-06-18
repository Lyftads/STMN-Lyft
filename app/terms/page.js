'use client'

import Link from 'next/link'
import { useI18n } from '../../lib/i18n/I18nProvider'

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'
const h2 = { fontSize: 21, fontWeight: 800, marginTop: 38, marginBottom: 10, color: '#fff', letterSpacing: '-0.01em' }

// Pagina pubblica (no auth) richiesta per la schermata consenso OAuth Google.
// ⚠️ BOZZA da far validare a un legale prima del go-live. Tradotta via i18n (terms.*).
export default function TermsOfService() {
  const { t } = useI18n()
  const updated = '6/6/2026'
  return (
    <main style={{
      minHeight: '100vh', background: '#000', color: 'rgba(255,255,255,0.78)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      lineHeight: 1.7, fontSize: 15, position: 'relative', overflowX: 'hidden',
    }}>
      <div style={{ position: 'fixed', top: -160, left: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -180, right: -120, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(circle, ${BLUE}2e, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', background: `linear-gradient(90deg,#fff,${ACCENT} 60%,${BLUE})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>LyftAI</span>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13.5 }}>{t('legal.backToSite', null, '← Back to site')}</Link>
        </div>

        <div style={{ padding: '46px 0 90px' }}>
          <h1 style={{ fontSize: 38, fontWeight: 900, marginBottom: 8, color: '#fff', letterSpacing: '-0.02em' }}>{t('terms.title', null, 'Terms of Service')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 0, fontSize: 13.5 }}>{t('legal.lastUpdate', { date: updated }, `Last updated: ${updated}`)}</p>

          <p>{t('terms.intro', null, 'These Terms of Service ("Terms") govern the use of LyftAI ("the Service", "we"), an analytics and marketing intelligence platform for e-commerce. By using the Service, the user ("you", "the merchant") accepts these Terms.')}</p>

          <h2 style={h2}>{t('terms.h1', null, '1. Description of the service')}</h2>
          <p>{t('terms.p1pre', null, 'LyftAI lets the merchant connect their accounts (Shopify, Meta, Google, GA4, Klaviyo and other platforms) to view dashboards, KPIs, reports, attribution analysis, LTV/cohorts and recommendations based on their own data. Access to connected data is ')}<strong style={{ color: '#fff' }}>{t('terms.readonly', null, 'read-only')}</strong>.</p>

          <h2 style={h2}>{t('terms.h2', null, '2. Account and access')}</h2>
          <p>{t('terms.p2', null, 'The merchant is responsible for the confidentiality of their credentials and for all activity carried out through their account. Authorizations to connected platforms can be revoked at any time by disconnecting the integration.')}</p>

          <h2 style={h2}>{t('terms.h3', null, '3. Permitted use')}</h2>
          <p>{t('terms.p3', null, 'The merchant agrees to use the Service in compliance with applicable laws and the terms of the connected platforms (including the Google API Services, Shopify and Meta policies). It is forbidden to attempt to access other merchants\' data, reverse engineer, or use the Service for unlawful purposes.')}</p>

          <h2 style={h2}>{t('terms.h4', null, '4. Data and privacy')}</h2>
          <p>{t('terms.p4pre', null, 'Data processing is described in our ')}<Link href="/privacy" style={{ color: BLUE }}>Privacy Policy</Link>{t('terms.p4mid', null, '. LyftAI acts as a data processor on behalf of the merchant, who is the controller of their customers\' data. The use of data obtained from Google APIs complies with the ')}<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}>Google API Services User Data Policy</a>{t('terms.p4post', null, ', including the Limited Use requirements.')}</p>

          <h2 style={h2}>{t('terms.h5', null, '5. Availability and changes')}</h2>
          <p>{t('terms.p5', null, 'We strive to keep the Service available, but we do not guarantee uninterrupted or error-free operation. We may modify, suspend or discontinue Service features, giving notice when reasonably possible.')}</p>

          <h2 style={h2}>{t('terms.h6', null, '6. Limitation of liability')}</h2>
          <p>{t('terms.p6', null, 'The Service is provided "as is". To the extent permitted by law, LyftAI is not liable for indirect damages, data loss or lost profits arising from the use of the Service. Business decisions based on the reports remain the merchant\'s responsibility.')}</p>

          <h2 style={h2}>{t('terms.h7', null, '7. Termination')}</h2>
          <p>{t('terms.p7', null, 'The merchant may stop using the Service at any time. We may suspend or close an account in case of breach of these Terms. Upon termination, access to connected platforms is revoked.')}</p>

          <h2 style={h2}>{t('terms.h8', null, '8. Contacts')}</h2>
          <p><strong style={{ color: '#fff' }}>LYFT SRL</strong> — P. IVA 02600730440. {t('terms.p8', null, 'For requests regarding these Terms:')} <a href="mailto:info@lyftads.agency" style={{ color: BLUE }}>info@lyftads.agency</a></p>

          <p style={{ marginTop: 46, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{t('legal.draftNote', null, 'This document is a technical draft and must be validated by a legal advisor before final publication.')}</p>
        </div>
      </div>
    </main>
  )
}
