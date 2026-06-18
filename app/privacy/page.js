'use client'

import Link from 'next/link'
import { useI18n } from '../../lib/i18n/I18nProvider'

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'

const h2 = { fontSize: 21, fontWeight: 800, marginTop: 38, marginBottom: 10, color: '#fff', letterSpacing: '-0.01em' }
const card = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 18px', margin: '12px 0' }

// Pagina pubblica (no auth) — richiesta per Google Ads API / Shopify App Review.
// ⚠️ BOZZA da far validare a un legale prima del go-live. Tradotta via i18n
// (priv.*) — le traduzioni legali vanno revisionate da un legale.
export default function PrivacyPolicy() {
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
          <h1 style={{ fontSize: 38, fontWeight: 900, marginBottom: 8, color: '#fff', letterSpacing: '-0.02em' }}>Privacy Policy</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 0, fontSize: 13.5 }}>{t('legal.lastUpdate', { date: updated }, `Last updated: ${updated}`)}</p>

          <p>{t('priv.intro', null, 'LyftAI ("we", "the application") is an analytics and marketing intelligence platform for e-commerce. This policy describes what data we process, how and why, when a merchant connects their accounts (Shopify, Meta, Google, Klaviyo and other platforms) to LyftAI.')}</p>

          <h2 style={h2}>{t('priv.h1', null, '1. Data we process')}</h2>
          <p>{t('priv.p1a', null, 'When the merchant authorizes a connection, LyftAI accesses in read-only mode the data needed to generate reports and analytics, including:')}</p>
          <ul>
            <li><strong style={{ color: '#fff' }}>Shopify</strong>: {t('priv.shopify', null, 'orders, products, customers (aggregated: number of orders, spend, acquisition date), reports/analytics, inventory, discounts, fulfillments. Used for sales metrics, LTV, cohorts, attribution.')}</li>
            <li><strong style={{ color: '#fff' }}>{t('priv.adPlatforms', null, 'Advertising platforms')}</strong> (Meta, Google Ads, TikTok) {t('priv.and', null, 'and')} <strong style={{ color: '#fff' }}>analytics</strong> (Google Analytics 4): {t('priv.adData', null, 'spend, impressions, clicks, conversions, campaign performance.')}</li>
            <li><strong style={{ color: '#fff' }}>Email marketing</strong> (Klaviyo) {t('priv.emailTools', null, 'and connected tools (Gmail, Slack), according to the authorized scopes.')}</li>
          </ul>
          <p>{t('priv.p1b', null, "We do not sell or share data with third parties for marketing purposes. We do not use the merchant's customers' personal data for our own profiling.")}</p>

          <h2 style={h2}>{t('priv.h2', null, '2. Access tokens')}</h2>
          <p>{t('priv.p2pre', null, 'OAuth authorizations and access tokens are managed and stored through our integration provider (')}<strong style={{ color: '#fff' }}>Nango</strong>{t('priv.p2post', null, '). Tokens are encrypted and used solely to read the data of the merchant who authorized them. The merchant can revoke them at any time.')}</p>

          <h2 style={h2}>{t('priv.h3', null, '3. Purpose of processing')}</h2>
          <p>{t('priv.p3', null, 'We process data solely to provide the merchant with LyftAI features: dashboards, KPIs, PDF reports, attribution analysis, LTV/cohorts, recommendations and AI assistants on their own data.')}</p>

          <h2 style={h2}>{t('priv.h4', null, '4. Google data and Google API Services compliance')}</h2>
          <p>{t('priv.p4', null, 'When the merchant connects their Google account, LyftAI requests read-only access to the following scopes, only to show the merchant their own data inside the application:')}</p>
          <ul>
            <li><strong style={{ color: '#fff' }}>Google Ads API</strong> — {t('priv.gAds', null, 'campaign performance (spend, impressions, clicks, conversions, ROAS).')}</li>
            <li><strong style={{ color: '#fff' }}>Google Analytics 4</strong> (<code>analytics.readonly</code>) — {t('priv.gGa4', null, 'sessions, traffic sources, conversions.')}</li>
            <li><strong style={{ color: '#fff' }}>Google Search Console</strong> (<code>webmasters.readonly</code>) — {t('priv.gGsc', null, 'queries, impressions and organic ranking.')}</li>
            <li><strong style={{ color: '#fff' }}>BigQuery</strong> (<code>bigquery.readonly</code>) — {t('priv.gBq', null, 'reading analytics datasets, where configured by the merchant.')}</li>
          </ul>
          <div style={card}>
            <strong style={{ color: '#fff' }}>Limited Use disclosure.</strong> LyftAI's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}>Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google user data for advertising, do not sell it, and do not transfer it to third parties except as necessary to provide the service to the merchant who authorized access, to comply with applicable law, or as part of a merger/acquisition. We do not use Google user data to train generalized AI/ML models.
          </div>

          <h2 style={h2}>{t('priv.h5', null, '5. Sub-processors')}</h2>
          <ul>
            <li><strong style={{ color: '#fff' }}>Vercel</strong> — {t('priv.subVercel', null, 'application hosting')}</li>
            <li><strong style={{ color: '#fff' }}>Nango</strong> — {t('priv.subNango', null, 'OAuth and token management')}</li>
            <li><strong style={{ color: '#fff' }}>OpenAI</strong> — {t('priv.subOpenai', null, "processing of requests to AI assistants (aggregated performance data, not customers' PII)")}</li>
            <li><strong style={{ color: '#fff' }}>Browserless</strong> — {t('priv.subBrowserless', null, 'PDF report generation')}</li>
            <li><strong style={{ color: '#fff' }}>Supabase</strong> — {t('priv.subSupabase', null, 'merchant authentication and application data')}</li>
          </ul>

          <h2 style={h2}>{t('priv.h6', null, '6. Retention and deletion')}</h2>
          <p>{t('priv.p6pre', null, 'LyftAI reads sales and marketing data mostly in real time and does not retain identifying personal data of end customers beyond what is needed for technical caching. The merchant can disconnect a platform at any time: in that case we stop access and revoke the tokens. For Google data, the user can also revoke access from ')}<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style={{ color: BLUE }}>{t('priv.p6link', null, 'Google Account → Security → Third-party apps')}</a>.</p>
          <p>{t('priv.p6b', null, "We honor Shopify's compliance webhooks:")}</p>
          <ul>
            <li><code>customers/data_request</code> — {t('priv.whData', null, "a customer's data request")}</li>
            <li><code>customers/redact</code> — {t('priv.whRedact', null, "a customer's data deletion")}</li>
            <li><code>shop/redact</code> — {t('priv.whShop', null, 'shop data deletion after uninstall')}</li>
          </ul>

          <h2 style={h2}>{t('priv.h7', null, '7. Security')}</h2>
          <p>{t('priv.p7', null, 'We use encrypted connections (TLS), least-privilege data access (read-only scopes) and securely managed tokens. Application access is protected by authentication.')}</p>

          <h2 style={h2}>{t('priv.h8', null, '8. Data subject rights')}</h2>
          <p>{t('priv.p8', null, 'The merchant\'s end customers can exercise their rights (access, rectification, deletion) through the merchant, who is the data controller. LyftAI acts as a data processor on behalf of the merchant.')}</p>

          <h2 style={h2}>{t('priv.h9', null, '9. Controller and contacts')}</h2>
          <p><strong style={{ color: '#fff' }}>LYFT SRL</strong> — Via Corso Giuseppe Mazzini 223, San Benedetto del Tronto (AP) 63074 — P. IVA 02600730440.</p>
          <p>{t('priv.contact', null, 'For any privacy request:')} <a href="mailto:info@lyftads.agency" style={{ color: BLUE }}>info@lyftads.agency</a></p>

          <p style={{ marginTop: 46, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{t('legal.draftNote', null, 'This document is a technical draft and must be validated by a legal advisor before final publication.')}</p>
        </div>
      </div>
    </main>
  )
}
