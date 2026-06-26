'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import Icon from '../components/ui/Icon'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import LogoMark from '../components/LogoMark'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { useI18n } from '../../lib/i18n/I18nProvider'

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'
const GREEN = '#22c55e'

// Testi via i18n: [chiave, fallback-IT]
const PLANS = [
  {
    id: 'starter', name: 'Starter', price: '€69', accent: '#0ea5e9',
    tag: ['br.tagStarter', 'Per founder che strutturano il primo brand'],
    features: [
      ['br.fStarter1', 'Dashboard KPI core'],
      ['br.fStarter2', 'Report periodici'],
      ['br.fStarter3', 'Integrazione Shopify + Meta + GA4'],
      ['br.fStarter4', 'Email support 48h'],
    ],
    cta: ['br.ctaStarter', 'Inizia trial con Starter'],
  },
  {
    id: 'growth', name: 'Growth', price: '€149', accent: ACCENT, popular: true,
    tag: ['br.tagGrowth', 'Brand in scaling che cercano leve data-driven'],
    features: [
      ['br.fGrowth1', 'Tutto di Starter +'],
      ['br.fGrowth2', 'Klaviyo + Creative Tab Meta Ads'],
      ['br.fGrowth3', 'AI Website Scanner (CRO)'],
      ['br.fGrowth4', 'Meta Detail ad-level'],
      ['br.fGrowth5', 'Priority support 12h'],
    ],
    cta: ['br.ctaGrowth', 'Inizia trial con Growth'],
  },
  {
    id: 'scale', name: 'Scale', price: '€299', accent: GREEN,
    tag: ['br.tagScale', 'Brand 7-8 figure con team dedicato'],
    features: [
      ['br.fScale1', 'Tutto di Growth +'],
      ['br.fScale2', 'Creative Lab AI generation'],
      ['br.fScale3', 'Competitor Intel'],
      ['br.fScale4', 'Performance Agent AI + Simulatore'],
      ['br.fScale5', 'CSM dedicato'],
    ],
    cta: ['br.ctaScale', 'Inizia trial con Scale'],
  },
  {
    // Enterprise: prezzo fisso, solo clienti diretti (Stripe). Nascosto ai merchant
    // Shopify (App Store policy: per loro solo Managed Pricing standard).
    id: 'enterprise', name: 'Enterprise', price: '€599', accent: '#f59e0b',
    tag: ['br.tagEnterprise', 'Oltre 7.000 ordini/mese · volumi alti ed esigenze custom'],
    features: [
      ['br.fEnterprise1', 'Tutto di Scale +'],
      ['br.fEnterprise2', '7.000+ ordini/mese'],
      ['br.fEnterprise3', 'SLA e onboarding dedicato'],
      ['br.fEnterprise4', 'Integrazioni custom'],
      ['br.fEnterprise5', 'Account manager dedicato'],
    ],
    cta: ['br.ctaEnterprise', 'Inizia trial con Enterprise'],
  },
]

export default function BillingRequiredPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  )
}

function BillingContent() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const cancelled = searchParams.get('cancelled') === '1'

  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)
  // Utenti arrivati da Shopify → addebiti via Shopify Managed Pricing (policy 1.2.x),
  // NON Stripe. Rilevati dallo store Shopify collegato (Nango o store URL).
  const [isShopify, setIsShopify] = useState(false)

  useEffect(() => {
    const sb = getBrowserSupabase()
    if (sb) sb.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata || {}
      setUserName(meta.name || meta.full_name || '')
    })
    fetch('/api/integrations/status').then(r => r.json())
      .then(j => { if (j?.shopifyStore || (Array.isArray(j.connected) && j.connected.includes('shopify'))) setIsShopify(true) })
      .catch(() => {})
  }, [])

  const startTrial = async (planId) => {
    setLoading(planId)
    setError(null)
    try {
      if (isShopify) {
        const res = await fetch('/api/shopify/billing/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId }),
        })
        const j = await res.json()
        if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
        window.location.href = j.confirmationUrl
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, trial: true }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      window.location.href = j.url
    } catch (e) {
      setError(e?.message || t('br.checkoutError', null, 'Error starting checkout'))
      setLoading(null)
    }
  }

  const handleLogout = async () => {
    const sb = getBrowserSupabase()
    if (sb) await sb.auth.signOut()
    window.location.href = '/welcome'
  }

  const per = t('br.period', null, '/month')

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', position: 'relative', overflowX: 'hidden' }}>
      <BgFx />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 50 }}>
          <Link href="/welcome" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <LogoMark size={32} />
            <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>LyftAI</span>
          </Link>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('br.logout', null, 'Log out')}</button>
        </header>

        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 999, background: `linear-gradient(90deg, ${GREEN}22, ${ACCENT}18)`, border: `1px solid ${GREEN}55`, fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 24, boxShadow: `0 10px 40px ${GREEN}22` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, animation: 'pulseDot 2s infinite' }} />
            {t('br.trialBadge', null, 'Free trial · 14 days')}
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, margin: 0, marginBottom: 16 }}>
            {userName ? t('br.heroTitleNamed', { name: userName }, `${userName}, choose your plan to start`) : t('br.heroTitle', null, 'Choose your plan to start')}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, maxWidth: 680, margin: '0 auto' }}>
            {t('br.subA', null, '14 days of full access to all features of the chosen plan. ')}<strong style={{ color: '#fff' }}>{t('br.noCardBold', null, 'No card required')}</strong>{t('br.subB', null, '. Cancel in 1 click. At the end we ask you to confirm if you want to continue.')}
          </p>
        </div>

        {cancelled && (
          <div style={{ maxWidth: 600, margin: '0 auto 30px', padding: 14, borderRadius: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.30)', color: '#fbbf24', fontSize: 13, textAlign: 'center' }}>
            {t('br.cancelledMsg', null, 'Checkout cancelled. No problem, pick a plan whenever you are ready.')}
          </div>
        )}

        {error && (
          <div style={{ maxWidth: 600, margin: '0 auto 30px', padding: 14, borderRadius: 12, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>
            <Icon name="warning" size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
          {(isShopify ? PLANS.filter(p => p.id !== 'enterprise') : PLANS).map(p => (
            <div key={p.id} className="glass-card-static" style={{ padding: 30, position: 'relative', ...(p.popular && { borderTop: `2px solid ${p.accent}`, boxShadow: `0 30px 80px rgba(0,0,0,0.80), 0 0 80px ${p.accent}22, inset 0 1.5px 0 ${p.accent}88` }) }}>
              {p.popular && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '4px 14px', borderRadius: 999, background: p.accent, color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em' }}>{t('br.popular', null, 'POPULAR')}</div>
              )}
              <div style={{ fontSize: 12, color: p.accent, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em' }}>{p.price}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{per}</span>
              </div>
              <div style={{ fontSize: 11.5, color: GREEN, fontWeight: 700, marginBottom: 14 }}>
                {t('br.freeThen', { p: `${p.price}${per}` }, `14 days free · then ${p.price}${per}`)}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24, minHeight: 38 }}>{t(p.tag[0], null, p.tag[1])}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 26 }}>
                {p.features.map(([fk, fv]) => (
                  <li key={fk} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                    <span style={{ color: p.accent, fontWeight: 800, fontSize: 14, lineHeight: 1.4, display: 'inline-flex' }}><Icon name="check" size={13} /></span>
                    {t(fk, null, fv)}
                  </li>
                ))}
              </ul>
              <button onClick={() => startTrial(p.id)} disabled={!!loading} style={{ display: 'block', width: '100%', textAlign: 'center', padding: '13px 18px', borderRadius: 999, border: 'none', background: p.popular ? `linear-gradient(135deg, ${ACCENT}, ${BLUE})` : 'rgba(255,255,255,0.06)', borderTop: p.popular ? 'none' : '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em', opacity: loading && loading !== p.id ? 0.5 : 1, boxShadow: p.popular ? '0 20px 50px rgba(191,90,242,0.30)' : 'none' }}>
                {loading === p.id ? t('br.waiting', null, 'Please wait…') : t(p.cta[0], null, p.cta[1])}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 50, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', gap: 28, fontSize: 12, color: 'rgba(255,255,255,0.5)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={12} /> {t('br.rNoCard', null, 'No card required')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={12} /> {t('br.rCancel', null, 'Cancel in 1 click')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={12} /> {t('br.rNoPenalty', null, 'No penalties')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={12} /> {t('br.rFullAccess', null, 'Full access during the trial')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BgFx() {
  return (
    <>
      <style>{`
        @keyframes pulseDot { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes orbDrift { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(8vw, -10vh); } }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, filter: 'blur(60px)', animation: 'orbDrift 30s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '0%', right: '10%', width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, ${BLUE}33, transparent 70%)`, filter: 'blur(60px)', animation: 'orbDrift 35s ease-in-out infinite reverse' }} />
      </div>
    </>
  )
}
