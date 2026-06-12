'use client'

import { useState, useEffect, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Customer Stripe ora persiste su DB Supabase (companies.stripe_customer_id),
// non piu' localStorage. L'API /api/stripe/subscription lo risolve in automatico
// dall'utente autenticato.

const ACCENT = '#bf5af2'

// ── Plans definition ──────────────────────────────────────────────
// Modello landing: TUTTI i tool inclusi in ogni piano. Il prezzo cresce con
// il volume ordini (non con le funzioni). 4 piani, Enterprise su misura.
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 69,
    priceLabel: '€69',
    period: '/mese', periodKey: 'settings.perMonth',
    tagline: 'Fino a 500 ordini/mese. Perfetto per partire con tutto già incluso.', taglineKey: 'settings.plan.starter.tagline',
    accent: '#0ea5e9',
    accentBg: 'rgba(14,165,233,0.12)',
    accentBorder: 'rgba(14,165,233,0.30)',
    cta: 'Passa a Starter', ctaKey: 'settings.plan.starter.cta',
    features: [
      '✨ Tutti i tool inclusi',
      'Fino a 500 ordini/mese',
      'Tutte le integrazioni (Shopify, Meta, Google, Klaviyo)',
      '2 utenti del team',
      'Email support 48h',
    ],
    featureKeys: ['settings.plan.allTools', 'settings.plan.starter.f2', 'settings.plan.starter.f3', 'settings.plan.starter.f4', 'settings.plan.starter.f5'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149,
    priceLabel: '€149',
    period: '/mese', periodKey: 'settings.perMonth',
    tagline: 'Da 500 a 2.000 ordini/mese. Per brand in crescita.', taglineKey: 'settings.plan.growth.tagline',
    accent: '#bf5af2',
    accentBg: 'rgba(191,90,242,0.12)',
    accentBorder: 'rgba(191,90,242,0.35)',
    badge: 'PIÙ SCELTO', badgeKey: 'settings.plan.growth.badge',
    cta: 'Passa a Growth', ctaKey: 'settings.plan.growth.cta',
    features: [
      '✨ Tutti i tool inclusi',
      '500 – 2.000 ordini/mese',
      '5 utenti del team',
      'Crediti Creative Lab (AI) estesi',
      'Priority support 12h',
    ],
    featureKeys: ['settings.plan.allTools', 'settings.plan.growth.f2', 'settings.plan.growth.f3', 'settings.plan.growth.f4', 'settings.plan.growth.f5'],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 299,
    priceLabel: '€299',
    period: '/mese', periodKey: 'settings.perMonth',
    tagline: 'Da 2.000 a 7.000 ordini/mese. Per brand strutturati.', taglineKey: 'settings.plan.scale.tagline',
    accent: '#22c55e',
    accentBg: 'rgba(34,197,94,0.12)',
    accentBorder: 'rgba(34,197,94,0.30)',
    cta: 'Passa a Scale', ctaKey: 'settings.plan.scale.cta',
    features: [
      '✨ Tutti i tool inclusi',
      '2.000 – 7.000 ordini/mese',
      'Utenti del team illimitati',
      'Crediti Creative Lab (AI) massimi',
      'CSM dedicato',
    ],
    featureKeys: ['settings.plan.allTools', 'settings.plan.scale.f2', 'settings.plan.scale.f3', 'settings.plan.scale.f4', 'settings.plan.scale.f5'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    priceLabel: 'Su misura', priceLabelKey: 'settings.priceCustom',
    period: '',
    tagline: 'Oltre 7.000 ordini/mese. Volumi alti ed esigenze custom.', taglineKey: 'settings.plan.enterprise.tagline',
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.12)',
    accentBorder: 'rgba(245,158,11,0.30)',
    contact: true,
    contactHref: 'mailto:info@lyftads.agency?subject=Richiesta%20piano%20Enterprise%20LyftAI',
    cta: 'Contattaci', ctaKey: 'settings.plan.enterprise.cta',
    features: [
      '✨ Tutti i tool inclusi',
      '7.000+ ordini/mese',
      'SLA e onboarding dedicato',
      'Integrazioni custom',
      'Account manager dedicato',
    ],
    featureKeys: ['settings.plan.allTools', 'settings.plan.enterprise.f2', 'settings.plan.enterprise.f3', 'settings.plan.enterprise.f4', 'settings.plan.enterprise.f5'],
  },
]

// Feature matrix per la tabella comparativa — modello "tutti i tool inclusi":
// i tool sono ✓ ovunque; i piani differiscono per volume, team, crediti AI, support.
const FEATURE_MATRIX = [
  { featureKey: 'settings.fm1', feature: 'Dashboard · KPI Brain · Attribuzione', starter: true, growth: true, scale: true, enterprise: true },
  { featureKey: 'settings.fm2', feature: 'Report Weekly / Monthly / Quarter / Year', starter: true, growth: true, scale: true, enterprise: true },
  { featureKey: 'settings.fm3', feature: 'Klaviyo · CRO · AI Website Scanner', starter: true, growth: true, scale: true, enterprise: true },
  { featureKey: 'settings.fm4', feature: 'Creative · Meta Detail · Meta KPI', starter: true, growth: true, scale: true, enterprise: true },
  { featureKey: 'settings.fm5', feature: 'Creative Lab AI · Competitor Intel', starter: true, growth: true, scale: true, enterprise: true },
  { featureKey: 'settings.fm6', feature: 'Performance Agent AI · Simulatore LTV:CAC', starter: true, growth: true, scale: true, enterprise: true },
  { featureKey: 'settings.fm7', feature: 'Integrazioni (Shopify, Meta, Google, Klaviyo)', starter: true, growth: true, scale: true, enterprise: 'Custom' },
  { featureKey: 'settings.fm8', feature: 'Ordini/mese inclusi', starter: 'Fino a 500', growth: '500 – 2.000', scale: '2.000 – 7.000', enterprise: '7.000+' },
  { featureKey: 'settings.fm9', feature: 'Utenti del team', starter: '2', growth: '5', scale: 'Illimitati', enterprise: 'Illimitati' },
  { featureKey: 'settings.fm10', feature: 'Crediti Creative Lab (AI)', starter: 'Base', growth: 'Estesi', scale: 'Massimi', enterprise: 'Massimi' },
  { featureKey: 'settings.fm11', feature: 'Storico dati', starter: '12 mesi', growth: '24 mesi', scale: 'Illimitato', enterprise: 'Illimitato' },
  { featureKey: 'settings.fm12', feature: 'White-label (logo + dominio)', starter: false, growth: false, scale: 'Opzionale', enterprise: true },
  { featureKey: 'settings.fm13', feature: 'SLA e onboarding dedicato', starter: false, growth: false, scale: false, enterprise: true },
  { featureKey: 'settings.fm14', feature: 'Support', starter: 'Email 48h', growth: 'Priority 12h', scale: 'CSM dedicato', enterprise: 'Account manager' },
]

// Mappa valori-stringa della matrice → chiave i18n (per tradurre le celle).
const FM_VALUE_KEYS = {
  'Custom': 'settings.val.custom',
  'Fino a 500': 'settings.val.upTo500',
  '500 – 2.000': 'settings.val.500to2000',
  '2.000 – 7.000': 'settings.val.2000to7000',
  '7.000+': 'settings.val.7000plus',
  'Illimitati': 'settings.val.unlimitedUsers',
  'Base': 'settings.val.base',
  'Estesi': 'settings.val.extended',
  'Massimi': 'settings.val.max',
  '12 mesi': 'settings.val.12months',
  '24 mesi': 'settings.val.24months',
  'Illimitato': 'settings.val.unlimited',
  'Opzionale': 'settings.val.optional',
  'Email 48h': 'settings.val.email48',
  'Priority 12h': 'settings.val.priority12',
  'CSM dedicato': 'settings.val.csm',
  'Account manager': 'settings.val.accountManager',
}


// ── Reusable black glass 3D card ──────────────────────────────────
function GlassCard({ children, padding = 24, glow = ACCENT, style = {} }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1.5px solid var(--border)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow:
          '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), inset 0 1.5px 0 rgba(255,255,255,0.06)',
        animation: 'sim-pulse 6s ease-in-out infinite',
        ...style,
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${glow}aa, transparent)`,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%', width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: 'sim-scan 9s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )
}

// Helper: avvia Stripe Checkout session e fa redirect
async function startStripeCheckout({ planId, mode, setError, setLoading }) {
  try {
    setLoading?.(true)
    setError?.(null)
    // Utenti Shopify (store collegato) → addebiti via Shopify Billing API
    // (policy App Store 1.2.1), MAI Stripe. Stripe resta per i signup diretti.
    let isShopify = false
    try {
      const st = await fetch('/api/integrations/status').then(r => r.json())
      isShopify = Array.isArray(st?.connected) && st.connected.includes('shopify')
    } catch {}
    if (isShopify) {
      const rs = await fetch('/api/shopify/billing/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const js = await rs.json()
      if (!rs.ok || !js?.confirmationUrl) { setError?.(js?.error || `Errore ${rs.status}`); setLoading?.(false); return }
      window.location.href = js.confirmationUrl
      return
    }
    const r = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, mode: mode || 'subscription' }),
    })
    const j = await r.json()
    if (!r.ok || !j?.url) {
      setError?.(j?.error || `Errore ${r.status}`)
      setLoading?.(false)
      return
    }
    window.location.href = j.url
  } catch (e) {
    setError?.(e?.message || 'Errore di rete')
    setLoading?.(false)
  }
}

// Helper: apre Customer Portal Stripe (cambio piano, cancella, fatture).
// customerId viene risolto server-side dall'utente autenticato.
async function openCustomerPortal({ setError, setLoading }) {
  try {
    setLoading?.(true)
    setError?.(null)
    const r = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const j = await r.json()
    if (!r.ok || !j?.url) {
      setError?.([j?.error, j?.hint].filter(Boolean).join(' — ') || `Errore ${r.status}`)
      setLoading?.(false)
      return
    }
    window.location.href = j.url
  } catch (e) {
    setError?.(e?.message || 'Errore di rete')
    setLoading?.(false)
  }
}

// Mappa brand Stripe → label leggibile (per il display saved card)
function brandLabel(brand) {
  const m = {
    visa: 'VISA',
    mastercard: 'MASTERCARD',
    amex: 'AMEX',
    american_express: 'AMEX',
    discover: 'DISCOVER',
    diners: 'DINERS',
    jcb: 'JCB',
    unionpay: 'UNIONPAY',
  }
  return m[brand?.toLowerCase()] || (brand || 'CARD').toUpperCase()
}

function PlanCard({ plan, isCurrent }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const hot = !!plan.badge
  const baseShadow = hot
    ? `0 30px 80px rgba(0,0,0,0.80), 0 0 70px ${plan.accent}22, inset 0 1.5px 0 ${plan.accent}88`
    : `0 24px 64px rgba(0,0,0,0.55), inset 0 1.5px 0 rgba(255,255,255,0.06)`
  return (
    <div
      className="glass-card-static"
      style={{
        position: 'relative',
        padding: 28,
        borderRadius: 22,
        borderTop: `2px solid ${plan.accent}`,
        boxShadow: baseShadow,
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease',
        display: 'flex', flexDirection: 'column', gap: 16,
        height: '100%', minHeight: 560,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)'
        e.currentTarget.style.boxShadow = `0 36px 90px rgba(0,0,0,0.72), 0 0 70px ${plan.accent}44, inset 0 1.5px 0 rgba(255,255,255,0.08)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = baseShadow
      }}
    >
      {plan.badge && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 14px', borderRadius: 999, whiteSpace: 'nowrap',
          background: plan.accent, color: 'var(--text)',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
          boxShadow: `0 8px 20px ${plan.accent}66`,
        }}>
          {t(plan.badgeKey, null, plan.badge)}
        </div>
      )}

      <div style={{ fontSize: 12, color: plan.accent, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {plan.name}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: -4 }}>
        <span style={{ fontSize: 40, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em' }}>
          {t(plan.priceLabelKey, null, plan.priceLabel)}
        </span>
        {plan.period && (
          <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>{t(plan.periodKey, null, plan.period)}</span>
        )}
      </div>

      <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5, minHeight: 38, marginTop: -6 }}>
        {t(plan.taglineKey, null, plan.tagline)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1, marginTop: 6 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: plan.accent, fontWeight: 800, fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}><Icon name="check" size={13} /></span>
            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{t(plan.featureKeys?.[i], null, f)}</span>
          </div>
        ))}
      </div>

      {plan.contact ? (
        <a
          href={plan.contactHref}
          style={{
            width: '100%', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none',
            padding: '13px 16px', borderRadius: 12,
            background: 'var(--glass2)', border: '1px solid var(--border2)',
            color: 'var(--text)', fontSize: 13.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }}
        >
          {t(plan.ctaKey, null, plan.cta)}
        </a>
      ) : (
        <button
          type="button"
          disabled={isCurrent || loading}
          onClick={() => startStripeCheckout({ planId: plan.id, mode: 'subscription', setError, setLoading })}
          style={{
            width: '100%',
            padding: '13px 16px',
            borderRadius: 12,
            border: 'none',
            cursor: isCurrent ? 'default' : loading ? 'wait' : 'pointer',
            background: isCurrent
              ? 'rgba(255,255,255,0.05)'
              : `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`,
            color: isCurrent ? 'var(--text3)' : 'var(--text)',
            fontSize: 13.5, fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: isCurrent ? 'none' : `0 8px 24px ${plan.accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
            textTransform: 'uppercase',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onMouseEnter={e => { if (!isCurrent && !loading) { e.currentTarget.style.transform = 'translateY(-2px)' } }}
          onMouseLeave={e => { e.currentTarget.style.transform = '' }}
        >
          {loading ? (
            <>
              <span style={{
                display: 'inline-block', width: 14, height: 14,
                border: '2px solid var(--border3)',
                borderTopColor: 'var(--text)', borderRadius: 999,
                animation: 'spin 1s linear infinite',
              }} />
              {t('settings.redirectStripe', null, 'Redirect a Stripe…')}
            </>
          ) : isCurrent ? t('settings.currentPlan', null, 'Piano attuale') : (t(plan.ctaKey, null, plan.cta) || ('↑ Passa a ' + plan.name))}
        </button>
      )}
      {error && (
        <div style={{
          marginTop: -6, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.30)',
          color: '#fca5a5', fontSize: 11, lineHeight: 1.4,
        }}>{error}</div>
      )}
    </div>
  )
}

function ComparisonTable() {
  const { t } = useI18n()
  return (
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid var(--border)',
      borderTopColor: 'rgba(255,255,255,0.10)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.25))',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--glass)' }}>
            <th style={{
              textAlign: 'left', padding: '14px 16px',
              fontSize: 10.5, fontWeight: 800, color: 'var(--text3)',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)',
            }}>{t('settings.feature', null, 'Feature')}</th>
            {['Starter','Growth','Scale','Enterprise'].map((p, i) => (
              <th key={p} style={{
                textAlign: 'center', padding: '14px 16px', minWidth: 96,
                fontSize: 11, fontWeight: 900, color: 'var(--text)',
                letterSpacing: '0.10em', textTransform: 'uppercase',
                borderBottom: '1px solid var(--border)',
                borderLeft: '1px solid var(--border)',
                background: i === 1 ? 'rgba(191,90,242,0.06)' : 'transparent',
              }}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_MATRIX.map((row, i) => (
            <tr key={i} style={{
              background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
            }}>
              <td style={{
                padding: '12px 16px',
                fontSize: 12.5, color: 'var(--text)',
                borderBottom: '1px solid var(--border)',
              }}>{t(row.featureKey, null, row.feature)}</td>
              {['starter','growth','scale','enterprise'].map((tier, j) => {
                const v = row[tier]
                return (
                  <td key={tier} style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontSize: 12.5, fontWeight: 700,
                    borderBottom: '1px solid var(--border)',
                    borderLeft: '1px solid var(--border)',
                    background: j === 1 ? 'rgba(191,90,242,0.04)' : 'transparent',
                  }}>
                    {typeof v === 'boolean'
                      ? (v ? <span style={{ color: '#86efac', fontSize: 16, fontWeight: 900 }}><Icon name="check" size={14} /></span>
                           : <span style={{ color: 'var(--text3)', opacity: 0.5 }}>—</span>)
                      : <span style={{ color: 'var(--text)' }}>{t(FM_VALUE_KEYS[v], null, v)}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusCard({ subscription, loading, customerId, onOpenPortal }) {
  const { t } = useI18n()
  const plan = subscription?.planId ? PLANS.find(p => p.id === subscription.planId) : null
  const hasActive = !!plan && (subscription?.status === 'active' || subscription?.status === 'trialing')
  const fmtDate = ts => ts ? new Date(ts * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const daysLeft = subscription?.currentPeriodEnd
    ? Math.max(0, Math.ceil((subscription.currentPeriodEnd * 1000 - Date.now()) / 86400000))
    : null

  const statusBadge = subscription?.status === 'active'
    ? { color: '#86efac', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.30)', label: '● Active' }
    : subscription?.status === 'trialing'
      ? { color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.30)', label: '● Trial' }
      : subscription?.status === 'past_due'
        ? { color: '#fcd34d', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.30)', label: '● Past due' }
        : subscription?.status === 'canceled'
          ? { color: '#fca5a5', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.30)', label: '● Cancelled' }
          : { color: 'var(--text3)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)', label: '● No plan' }

  const accent = plan?.accent || ACCENT

  return (
    <GlassCard padding={26} glow={accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--glass)',
          display: 'grid', placeItems: 'center',
          fontSize: 14, color: 'var(--text2)',
        }}>◧</span>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{t('settings.subStatus', null, 'Subscription Status')}</div>
      </div>

      {loading && (
        <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display:'inline-block', width:16, height:16, border:'2px solid var(--border2)', borderTopColor:'var(--text)', borderRadius:999, animation:'spin 1s linear infinite' }} />
          {t('settings.loadingSub', null, 'Caricamento subscription…')}
        </div>
      )}

      {!loading && !hasActive && (
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
          color: 'var(--text2)', fontSize: 13, lineHeight: 1.5,
        }}>
          {customerId
            ? <>{t('settings.noSubActive', null, 'Nessuna subscription attiva. Scegli un piano qui sotto per attivarla.')}</>
            : <>{t('settings.noStripe', null, 'Nessun account Stripe collegato. Completa un checkout per attivare una subscription.')}</>}
        </div>
      )}

      {!loading && hasActive && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
                display: 'grid', placeItems: 'center',
                fontSize: 20, color: 'var(--text)',
                boxShadow: `0 0 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}><Icon name="crown" size={20} /></div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{plan.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {subscription?.amount != null
                    ? `€${(subscription.amount / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })} / ${subscription.interval === 'month' ? t('settings.intervalMonth', null, 'mese') : subscription.interval || 'periodo'}`
                    : t('settings.subActiveLabel', null, 'Subscription attiva')}
                </div>
              </div>
            </div>
            <div style={{
              padding: '4px 12px', borderRadius: 999,
              background: statusBadge.bg, border: `1px solid ${statusBadge.border}`,
              color: statusBadge.color, fontSize: 10.5, fontWeight: 900,
              letterSpacing: '0.10em', textTransform: 'uppercase',
            }}>{statusBadge.label}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 22 }}>
            <div style={{ padding: 14, borderRadius: 11, background: 'var(--glass)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                {t('settings.currentPeriod', null, 'Periodo corrente')}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {fmtDate(subscription.currentPeriodStart)} → {fmtDate(subscription.currentPeriodEnd)}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 11, background: 'var(--glass)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                {subscription.cancelAtPeriodEnd ? t('settings.endsOn', null, 'Termina il') : t('settings.nextRenewal', null, 'Prossimo rinnovo')}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                {fmtDate(subscription.currentPeriodEnd)} {daysLeft != null && <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 12 }}>{t('settings.daysLeft', { n: daysLeft }, `(${daysLeft} giorni)`)}</span>}
              </div>
            </div>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 9,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              color: '#fcd34d', fontSize: 12,
            }}>
              {t('settings.cancelScheduled', null, 'Cancellazione programmata: la subscription terminerà alla fine del periodo corrente.')}
            </div>
          )}
        </>
      )}

      {customerId && (
        <button
          type="button"
          onClick={onOpenPortal}
          style={{
            marginTop: 18,
            padding: '11px 20px', borderRadius: 10,
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            border: 'none', color: 'var(--text)',
            fontSize: 13, fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            boxShadow: `0 8px 22px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          {t('settings.manageSub', null, 'Gestisci abbonamento ↗')}
        </button>
      )}
    </GlassCard>
  )
}

// Accepted payment methods — SVG inline brand-correct, formato card
// (52×32 con corner radius), pronti per essere usati ovunque nel UI.
const PAYMENT_ICONS = [
  {
    id: 'visa',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="Visa">
        <rect width="52" height="32" rx="5" fill="#1A1F71"/>
        <text x="26" y="22" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif" letterSpacing="0.5">VISA</text>
      </svg>
    ),
  },
  {
    id: 'mastercard',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="Mastercard">
        <rect width="52" height="32" rx="5" fill="#1a1a1a"/>
        <circle cx="22" cy="16" r="8.5" fill="#EB001B"/>
        <circle cx="30" cy="16" r="8.5" fill="#F79E1B"/>
        <path d="M26 9.5a8.5 8.5 0 010 13 8.5 8.5 0 010-13z" fill="#FF5F00"/>
      </svg>
    ),
  },
  {
    id: 'amex',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="American Express">
        <rect width="52" height="32" rx="5" fill="#016FD0"/>
        <text x="26" y="21" textAnchor="middle" fill="var(--text)" fontSize="10.5" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.8">AMEX</text>
      </svg>
    ),
  },
  {
    id: 'paypal',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="PayPal">
        <rect width="52" height="32" rx="5" fill="var(--text)"/>
        <text x="14" y="22" textAnchor="middle" fill="#003087" fontSize="12" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif">Pay</text>
        <text x="36" y="22" textAnchor="middle" fill="#009cde" fontSize="12" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif">Pal</text>
      </svg>
    ),
  },
  {
    id: 'bancomat',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="Bancomat">
        <rect width="52" height="32" rx="5" fill="var(--text)"/>
        <rect x="4" y="10" width="22" height="12" rx="1.5" fill="#E2001A"/>
        <rect x="26" y="10" width="22" height="12" rx="1.5" fill="#005EAA"/>
        <text x="15" y="19.5" textAnchor="middle" fill="var(--text)" fontSize="7.5" fontWeight="900" fontFamily="Arial, sans-serif">PAGO</text>
        <text x="37" y="19.5" textAnchor="middle" fill="var(--text)" fontSize="7" fontWeight="900" fontFamily="Arial, sans-serif">BANCO</text>
      </svg>
    ),
  },
  {
    id: 'creditcard',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="Credit Card">
        <defs>
          <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#374151"/>
            <stop offset="100%" stopColor="#111827"/>
          </linearGradient>
        </defs>
        <rect width="52" height="32" rx="5" fill="url(#cardGrad)"/>
        <rect x="6" y="11" width="8" height="6" rx="1.2" fill="#fbbf24"/>
        <rect x="6" y="11" width="8" height="6" rx="1.2" fill="none" stroke="#92400e" strokeWidth="0.4"/>
        <line x1="8" y1="13" x2="12" y2="13" stroke="#92400e" strokeWidth="0.4"/>
        <line x1="8" y1="15" x2="12" y2="15" stroke="#92400e" strokeWidth="0.4"/>
        <circle cx="36" cy="14" r="3.5" fill="#9ca3af" opacity="0.55"/>
        <circle cx="40" cy="14" r="3.5" fill="#9ca3af" opacity="0.55"/>
        <rect x="6" y="22" width="20" height="1.2" rx="0.6" fill="#9ca3af" opacity="0.5"/>
        <rect x="29" y="22" width="14" height="1.2" rx="0.6" fill="#9ca3af" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id: 'revolut',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="Revolut">
        <rect width="52" height="32" rx="5" fill="#000"/>
        <text x="26" y="23" textAnchor="middle" fill="var(--text)" fontSize="14" fontWeight="900" fontFamily="Helvetica, Arial, sans-serif" letterSpacing="-0.5">Revolut</text>
      </svg>
    ),
  },
]

function PaymentMethodCard({ pm, customerId, loading: parentLoading, onClearCustomer }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Adatta il pm formato API → struttura interna usata dal display
  const savedCard = pm ? {
    brand: brandLabel(pm.brand),
    last4: pm.last4,
    name: '',
    exp: pm.expMonth && pm.expYear ? `${String(pm.expMonth).padStart(2,'0')}/${String(pm.expYear).slice(-2)}` : '••/••',
  } : null

  return (
    <GlassCard padding={26} glow="#f59e0b">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(245,158,11,0.10)',
            display: 'grid', placeItems: 'center',
            fontSize: 13, color: '#fcd34d',
          }}>▭</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{t('settings.paymentMethod', null, 'Metodo di pagamento')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
              {t('settings.paymentSub', null, 'Salva la carta per gli addebiti automatici. Tokenizzata in modo sicuro.')}
            </div>
          </div>
        </div>
      </div>

      {!savedCard && (
        <div style={{
          padding: '28px 24px',
          borderRadius: 14,
          background: 'var(--glass)',
          border: '1px dashed rgba(255,255,255,0.10)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', gap: 14,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--glass)',
            display: 'grid', placeItems: 'center',
            fontSize: 24, color: 'var(--text3)',
          }}>▭</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('settings.noPaymentMethod', null, 'Nessun metodo di pagamento')}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, maxWidth: 420, lineHeight: 1.5 }}>
              {t('settings.noPaymentDesc', null, 'Aggiungi una carta per abilitare la fatturazione automatica. Gestione sicura via Stripe (PCI-DSS).')}
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => startStripeCheckout({ mode: 'setup', setError, setLoading })}
            style={{
              padding: '11px 22px', borderRadius: 11,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none', color: 'var(--text)',
              fontSize: 13.5, fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 8px 24px rgba(245,158,11,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
              letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: 'inline-block', width: 14, height: 14,
                  border: '2px solid var(--border3)',
                  borderTopColor: 'var(--text)', borderRadius: 999,
                  animation: 'spin 1s linear infinite',
                }} />
                {t('settings.redirectStripe', null, 'Redirect a Stripe…')}
              </>
            ) : (
              <>{t('settings.addPaymentMethod', null, '+ Aggiungi metodo di pagamento')}</>
            )}
          </button>
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.30)',
              color: '#fca5a5', fontSize: 11, lineHeight: 1.4, maxWidth: 460,
            }}>{error}</div>
          )}
        </div>
      )}

      {savedCard && (
        <div style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(0,0,0,0.30))',
          border: '1px solid rgba(34,197,94,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 32, borderRadius: 7,
              background: 'linear-gradient(135deg, #1f2937, #0f172a)',
              display: 'grid', placeItems: 'center',
              fontSize: 10, fontWeight: 900, color: 'var(--text)',
              letterSpacing: '0.04em',
              border: '1px solid var(--border2)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>{savedCard.brand}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '0.06em', fontFamily: 'ui-monospace, monospace' }}>
                •••• •••• •••• {savedCard.last4}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                {savedCard.name} · {t('settings.cardExpiry', null, 'scad.')} {savedCard.exp}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openCustomerPortal({ customerId, setError, setLoading })}
            disabled={loading || !customerId}
            style={{
              padding: '7px 14px', borderRadius: 9,
              background: 'transparent',
              border: '1px solid var(--border2)',
              color: 'var(--text2)', fontSize: 11.5, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >{loading ? t('settings.opening', null, 'Apertura…') : t('settings.manage', null, 'Gestisci ↗')}</button>
        </div>
      )}

      {/* Accepted brands */}
      <div style={{ marginTop: 22 }}>
        <div style={{
          fontSize: 9.5, color: 'var(--text3)', fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12,
          textAlign: 'center',
        }}>{t('settings.acceptedMethods', null, 'Metodi accettati')}</div>
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {PAYMENT_ICONS.map(b => (
            <div
              key={b.id}
              style={{
                display: 'inline-flex',
                borderRadius: 6,
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
                border: '1px solid var(--border)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                lineHeight: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)'
                e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
              }}
            >
              {b.svg}
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

function InvoiceHistory({ invoices, loading }) {
  const { t } = useI18n()
  const fmtDate = ts => ts ? new Date(ts * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const fmtMoney = (amount, currency) => {
    if (amount == null) return '—'
    const sym = currency?.toLowerCase() === 'eur' ? '€' : currency?.toUpperCase() || ''
    return `${sym}${(amount / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const statusBadge = (s) => {
    const m = {
      paid:          { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.30)',  color: '#86efac', label: 'Paid' },
      open:          { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', color: '#fcd34d', label: 'Open' },
      draft:         { bg: 'rgba(255,255,255,0.04)',border: 'rgba(255,255,255,0.10)',color: 'var(--text3)', label: 'Draft' },
      void:          { bg: 'rgba(255,255,255,0.04)',border: 'rgba(255,255,255,0.10)',color: 'var(--text3)', label: 'Void' },
      uncollectible: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  color: '#fca5a5', label: 'Failed' },
    }
    return m[s] || { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', color: 'var(--text3)', label: s || '—' }
  }
  const list = invoices || []
  return (
    <GlassCard padding={26} glow="#22c55e">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(34,197,94,0.10)',
          display: 'grid', placeItems: 'center',
          fontSize: 13, color: '#86efac',
        }}>⌗</span>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{t('settings.invoiceHistory', null, 'Invoice History')}</div>
      </div>

      {loading && (
        <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>{t('settings.loadingInvoices', null, 'Caricamento fatture…')}</div>
      )}

      {!loading && list.length === 0 && (
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'var(--glass)', border: '1px dashed rgba(255,255,255,0.10)',
          color: 'var(--text3)', fontSize: 13, textAlign: 'center',
        }}>
          {t('settings.noInvoices', null, 'Nessuna fattura. Apparirà qui dopo il primo addebito.')}
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--glass)' }}>
                {[t('settings.colDate', null, 'Data'), t('settings.colAmount', null, 'Importo'), t('settings.colStatus', null, 'Status'), t('settings.colInvoice', null, 'Fattura')].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px',
                    fontSize: 10, fontWeight: 800, color: 'var(--text3)',
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => {
                const sb = statusBadge(inv.status)
                return (
                  <tr key={inv.id}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{fmtDate(inv.date)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                      {fmtMoney(inv.amount, inv.currency)} <span style={{ color: 'var(--text3)', fontSize: 11 }}>{inv.currency?.toUpperCase() || ''}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999,
                        background: sb.bg, border: `1px solid ${sb.border}`,
                        color: sb.color, fontSize: 10.5, fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}>● {sb.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      {inv.pdfUrl
                        ? <a href={inv.pdfUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>PDF ↗</a>
                        : inv.hostedUrl
                          ? <a href={inv.hostedUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>{t('settings.openLink', null, 'Apri ↗')}</a>
                          : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

export default function SettingsTab() {
  const { t } = useI18n()
  const [customerId, setCustomerId] = useState(null)
  const [data, setData] = useState(null) // { subscription, paymentMethod, invoices, email, name }
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState(null)
  const [banner, setBanner] = useState(null) // 'success' | 'cancelled' | 'setup-success' | 'setup-cancelled'

  // 1) On mount: parse query params per banner, pulisci URL, fetch dati
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const checkout = url.searchParams.get('checkout')
    const setup = url.searchParams.get('setup')

    if (checkout === 'success') setBanner('success')
    else if (checkout === 'cancelled') setBanner('cancelled')
    else if (setup === 'success') setBanner('setup-success')
    else if (setup === 'cancelled') setBanner('setup-cancelled')

    // Pulisci query string per evitare di rieseguire il banner al refresh
    if (checkout || setup) {
      url.searchParams.delete('session_id')
      url.searchParams.delete('checkout')
      url.searchParams.delete('setup')
      url.searchParams.delete('plan')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // 2) Carica sub + PM + fatture (customerId risolto server-side dall'auth)
  const reload = useCallback(() => {
    setDataLoading(true)
    setDataError(null)
    fetch('/api/stripe/subscription')
      .then(r => r.json())
      .then(j => {
        if (j?.error) { setDataError(j.error); setData(null); return }
        setData(j)
        setCustomerId(j?.customerId || null)
      })
      .catch(e => setDataError(e?.message || 'Errore di rete'))
      .finally(() => setDataLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload, banner])

  const clearCustomer = () => {
    setCustomerId(null)
    setData(null)
  }

  const currentPlanId = data?.subscription?.planId || null
  const subActive = data?.subscription?.status === 'active' || data?.subscription?.status === 'trialing'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {banner && <CheckoutBanner banner={banner} onClose={() => setBanner(null)} />}

      <StatusCard
        subscription={data?.subscription}
        loading={dataLoading}
        customerId={customerId}
        onOpenPortal={() => openCustomerPortal({ customerId, setError: setDataError, setLoading: setDataLoading })}
      />

      <PaymentMethodCard
        pm={data?.paymentMethod}
        customerId={customerId}
        loading={dataLoading}
        onClearCustomer={clearCustomer}
      />

      {/* Change Plan section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9.5, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {subActive ? t('settings.changePlan', null, 'Change Plan') : t('settings.choosePlan', null, 'Scegli un piano')}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginTop: 4 }}>
              {subActive ? t('settings.changePlanTitle', null, 'Cambia il piano della tua subscription') : t('settings.choosePlanTitle', null, 'Scegli il piano giusto per la tua crescita')}
            </div>
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(238px, 1fr))',
          gap: 16,
        }}>
          {PLANS.map(p => (
            <PlanCard key={p.id} plan={p} isCurrent={p.id === currentPlanId} />
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <GlassCard padding={26} glow={ACCENT}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(191,90,242,0.10)',
            display: 'grid', placeItems: 'center',
            fontSize: 13, color: ACCENT,
          }}>▦</span>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {t('settings.comparePlans', null, 'Comparativa piani')}
          </div>
        </div>
        <ComparisonTable />
      </GlassCard>

      <InvoiceHistory invoices={data?.invoices} loading={dataLoading} />
    </div>
  )
}

// Banner colorato in cima dopo redirect checkout/portal
function CheckoutBanner({ banner, onClose }) {
  const { t } = useI18n()
  const config = {
    'success':         { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  color: '#86efac', text: t('settings.bannerSuccess', null, '✓ Pagamento completato. Subscription attivata.') },
    'cancelled':       { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', color: '#fcd34d', text: t('settings.bannerCancelled', null, 'Checkout annullato. Nessun addebito.') },
    'setup-success':   { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  color: '#86efac', text: t('settings.bannerSetupSuccess', null, '✓ Metodo di pagamento salvato.') },
    'setup-cancelled': { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', color: '#fcd34d', text: t('settings.bannerSetupCancelled', null, 'Aggiunta carta annullata.') },
  }[banner]
  if (!config) return null
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 12,
      background: config.bg, border: `1px solid ${config.border}`,
      color: config.color, fontSize: 13, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span>{config.text}</span>
      <button onClick={onClose} type="button" style={{
        background: 'transparent', border: 'none', color: config.color,
        cursor: 'pointer', fontSize: 18, fontWeight: 300, lineHeight: 1,
      }}>×</button>
    </div>
  )
}
