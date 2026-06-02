'use client'

import { useState, useEffect, useCallback } from 'react'

// Customer Stripe ora persiste su DB Supabase (companies.stripe_customer_id),
// non piu' localStorage. L'API /api/stripe/subscription lo risolve in automatico
// dall'utente autenticato.

const ACCENT = '#bf5af2'

// ── Plans definition ──────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 119.99,
    priceLabel: '€119,99',
    period: '/month',
    tagline: 'Per founder che stanno strutturando il primo brand DTC',
    accent: '#0ea5e9',
    accentBg: 'rgba(14,165,233,0.12)',
    accentBorder: 'rgba(14,165,233,0.30)',
    features: [
      'Dashboard KPI core (Fatturato · Ordini · AOV · NC · RC)',
      'KPI Brain con paesi di fatturazione',
      'Report Weekly / Monthly / Quarter / Year',
      'Confronto period-over-period su ogni KPI',
      'Integrazione Shopify + Meta Ads + GA4',
      'Esportazione CSV illimitata',
      'Storico dati 12 mesi',
      'Email support entro 48h',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 179.99,
    priceLabel: '€179,99',
    period: '/month',
    tagline: 'Brand in scaling che cercano leve di crescita data-driven',
    accent: '#bf5af2',
    accentBg: 'rgba(191,90,242,0.12)',
    accentBorder: 'rgba(191,90,242,0.35)',
    badge: 'POPOLARE',
    features: [
      'Tutto di Starter +',
      'Klaviyo (Email Marketing · Flussi · Segmenti)',
      'CRO Tab (Funnel · Top Pages · Flusso traffico)',
      'AI Website Scanner — audit CRO via GPT-4o Vision',
      'Creative Tab Meta Ads + analisi RSA',
      'Meta Detail per ad-level performance',
      'Storico dati 24 mesi',
      'Priority support entro 12h',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 349.99,
    priceLabel: '€349,99',
    period: '/month',
    tagline: 'Brand 7-8 figure con team marketing dedicato',
    accent: '#22c55e',
    accentBg: 'rgba(34,197,94,0.12)',
    accentBorder: 'rgba(34,197,94,0.30)',
    features: [
      'Tutto di Growth +',
      'Creative Lab — generazione AI di ad creative',
      'Competitor Intel — creative & catalogo competitor',
      'Performance Agent AI (CMO · CFO · CRO advisor)',
      'Simulatore LTV:CAC + scenari adv',
      'Multi-store (fino a 5 brand sotto stesso account)',
      'White-label opzionale (logo + dominio custom)',
      'Storico dati illimitato',
      'CSM dedicato + onboarding personalizzato',
    ],
  },
]

// Feature matrix per la tabella comparativa
const FEATURE_MATRIX = [
  { feature: 'Dashboard KPI core', starter: true, growth: true, scale: true },
  { feature: 'KPI Brain', starter: true, growth: true, scale: true },
  { feature: 'Report Weekly / Monthly / Quarter / Year', starter: true, growth: true, scale: true },
  { feature: 'Esportazione CSV', starter: true, growth: true, scale: true },
  { feature: 'Integrazione Shopify + Meta + GA4', starter: true, growth: true, scale: true },
  { feature: 'Paesi di fatturazione', starter: true, growth: true, scale: true },
  { feature: 'Klaviyo (Email & Flussi)', starter: false, growth: true, scale: true },
  { feature: 'CRO Tab (Funnel · Top Pages)', starter: false, growth: true, scale: true },
  { feature: 'AI Website Scanner', starter: false, growth: true, scale: true },
  { feature: 'Creative Tab Meta Ads', starter: false, growth: true, scale: true },
  { feature: 'Meta Detail ad-level', starter: false, growth: true, scale: true },
  { feature: 'Creative Lab AI generation', starter: false, growth: false, scale: true },
  { feature: 'Competitor Intel', starter: false, growth: false, scale: true },
  { feature: 'Performance Agent AI', starter: false, growth: false, scale: true },
  { feature: 'Simulatore LTV:CAC', starter: false, growth: false, scale: true },
  { feature: 'Multi-store (max 5 brand)', starter: false, growth: false, scale: true },
  { feature: 'White-label (logo + dominio)', starter: false, growth: false, scale: true },
  { feature: 'Storico dati', starter: '12 mesi', growth: '24 mesi', scale: 'Illimitato' },
  { feature: 'Support', starter: 'Email 48h', growth: 'Priority 12h', scale: 'CSM dedicato' },
]


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
        border: '1.5px solid rgba(255,255,255,0.06)',
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  return (
    <div
      style={{
        position: 'relative',
        padding: 26,
        borderRadius: 20,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.30))',
        border: `1.5px solid ${plan.accentBorder}`,
        borderTopColor: plan.accent + 'AA',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.55), 0 0 36px ${plan.accent}22`,
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease',
        display: 'flex', flexDirection: 'column', gap: 18,
        minHeight: 580,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)'
        e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.7), 0 0 60px ${plan.accent}44`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.55), 0 0 36px ${plan.accent}22`
      }}
    >
      {plan.badge && (
        <div style={{
          position: 'absolute', top: -10, right: 20,
          padding: '4px 12px', borderRadius: 999,
          background: `linear-gradient(135deg, ${plan.accent}, ${plan.accent}88)`,
          color: '#fff', fontSize: 9, fontWeight: 900,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          boxShadow: `0 8px 20px ${plan.accent}66`,
        }}>
          {plan.badge}
        </div>
      )}

      <div>
        <div style={{
          fontSize: 26, fontWeight: 900, color: '#fff',
          letterSpacing: '-0.02em', marginBottom: 6,
        }}>{plan.name}</div>
        <div style={{
          fontSize: 12, color: 'var(--text3)',
          lineHeight: 1.5, minHeight: 36,
        }}>{plan.tagline}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
          {plan.priceLabel}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>
          {plan.period}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <div style={{
              flexShrink: 0,
              width: 18, height: 18, borderRadius: 5,
              background: plan.accentBg,
              border: `1px solid ${plan.accentBorder}`,
              display: 'grid', placeItems: 'center',
              color: plan.accent, fontSize: 11, fontWeight: 900,
              marginTop: 1,
            }}>✓</div>
            <span style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>{f}</span>
          </div>
        ))}
      </div>

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
          color: isCurrent ? 'var(--text3)' : '#fff',
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
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: '#fff', borderRadius: 999,
              animation: 'spin 1s linear infinite',
            }} />
            Redirect a Stripe…
          </>
        ) : isCurrent ? '✓ Piano attuale' : '↑ Passa a ' + plan.name}
      </button>
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
  return (
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      borderTopColor: 'rgba(255,255,255,0.10)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.25))',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
            <th style={{
              textAlign: 'left', padding: '14px 16px',
              fontSize: 10.5, fontWeight: 800, color: 'var(--text3)',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>Feature</th>
            {['Starter','Growth','Scale'].map((p, i) => (
              <th key={p} style={{
                textAlign: 'center', padding: '14px 16px', minWidth: 100,
                fontSize: 11, fontWeight: 900, color: '#fff',
                letterSpacing: '0.10em', textTransform: 'uppercase',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '1px solid rgba(255,255,255,0.04)',
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
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>{row.feature}</td>
              {['starter','growth','scale'].map((tier, j) => {
                const v = row[tier]
                return (
                  <td key={tier} style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    fontSize: 12.5, fontWeight: 700,
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    borderLeft: '1px solid rgba(255,255,255,0.04)',
                    background: j === 1 ? 'rgba(191,90,242,0.04)' : 'transparent',
                  }}>
                    {typeof v === 'boolean'
                      ? (v ? <span style={{ color: '#86efac', fontSize: 16, fontWeight: 900 }}>✓</span>
                           : <span style={{ color: 'var(--text3)', opacity: 0.5 }}>—</span>)
                      : <span style={{ color: '#fff' }}>{v}</span>}
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
          background: 'rgba(255,255,255,0.05)',
          display: 'grid', placeItems: 'center',
          fontSize: 14, color: 'var(--text2)',
        }}>◧</span>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Subscription Status</div>
      </div>

      {loading && (
        <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,0.15)', borderTopColor:'#fff', borderRadius:999, animation:'spin 1s linear infinite' }} />
          Caricamento subscription…
        </div>
      )}

      {!loading && !hasActive && (
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
          color: 'var(--text2)', fontSize: 13, lineHeight: 1.5,
        }}>
          {customerId
            ? <>Nessuna subscription attiva. Scegli un piano qui sotto per attivarla.</>
            : <>Nessun account Stripe collegato. Completa un checkout per attivare una subscription.</>}
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
                fontSize: 20, color: '#fff',
                boxShadow: `0 0 24px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}>♛</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{plan.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {subscription?.amount != null
                    ? `€${(subscription.amount / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })} / ${subscription.interval === 'month' ? 'mese' : subscription.interval || 'periodo'}`
                    : 'Subscription attiva'}
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
            <div style={{ padding: 14, borderRadius: 11, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                Periodo corrente
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                {fmtDate(subscription.currentPeriodStart)} → {fmtDate(subscription.currentPeriodEnd)}
              </div>
            </div>
            <div style={{ padding: 14, borderRadius: 11, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                {subscription.cancelAtPeriodEnd ? 'Termina il' : 'Prossimo rinnovo'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                {fmtDate(subscription.currentPeriodEnd)} {daysLeft != null && <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 12 }}>({daysLeft} giorni)</span>}
              </div>
            </div>
          </div>

          {subscription.cancelAtPeriodEnd && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 9,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              color: '#fcd34d', fontSize: 12,
            }}>
              ⚠ Cancellazione programmata: la subscription terminerà alla fine del periodo corrente.
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
            border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            boxShadow: `0 8px 22px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          Gestisci abbonamento ↗
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
        <text x="26" y="22" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif" letterSpacing="0.5">VISA</text>
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
        <text x="26" y="21" textAnchor="middle" fill="#fff" fontSize="10.5" fontWeight="900" fontFamily="Arial, sans-serif" letterSpacing="0.8">AMEX</text>
      </svg>
    ),
  },
  {
    id: 'paypal',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="PayPal">
        <rect width="52" height="32" rx="5" fill="#fff"/>
        <text x="14" y="22" textAnchor="middle" fill="#003087" fontSize="12" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif">Pay</text>
        <text x="36" y="22" textAnchor="middle" fill="#009cde" fontSize="12" fontWeight="900" fontStyle="italic" fontFamily="Arial, sans-serif">Pal</text>
      </svg>
    ),
  },
  {
    id: 'bancomat',
    svg: (
      <svg width="52" height="32" viewBox="0 0 52 32" aria-label="Bancomat">
        <rect width="52" height="32" rx="5" fill="#fff"/>
        <rect x="4" y="10" width="22" height="12" rx="1.5" fill="#E2001A"/>
        <rect x="26" y="10" width="22" height="12" rx="1.5" fill="#005EAA"/>
        <text x="15" y="19.5" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="900" fontFamily="Arial, sans-serif">PAGO</text>
        <text x="37" y="19.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="900" fontFamily="Arial, sans-serif">BANCO</text>
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
        <text x="26" y="23" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="900" fontFamily="Helvetica, Arial, sans-serif" letterSpacing="-0.5">Revolut</text>
      </svg>
    ),
  },
]

function PaymentMethodCard({ pm, customerId, loading: parentLoading, onClearCustomer }) {
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
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Metodo di pagamento</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
              Salva la carta per gli addebiti automatici. Tokenizzata in modo sicuro.
            </div>
          </div>
        </div>
      </div>

      {!savedCard && (
        <div style={{
          padding: '28px 24px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.10)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', gap: 14,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(255,255,255,0.04)',
            display: 'grid', placeItems: 'center',
            fontSize: 24, color: 'var(--text3)',
          }}>▭</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Nessun metodo di pagamento</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, maxWidth: 420, lineHeight: 1.5 }}>
              Aggiungi una carta per abilitare la fatturazione automatica. Gestione sicura via Stripe (PCI-DSS).
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => startStripeCheckout({ mode: 'setup', setError, setLoading })}
            style={{
              padding: '11px 22px', borderRadius: 11,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none', color: '#fff',
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
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff', borderRadius: 999,
                  animation: 'spin 1s linear infinite',
                }} />
                Redirect a Stripe…
              </>
            ) : (
              <>+ Aggiungi metodo di pagamento</>
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
              fontSize: 10, fontWeight: 900, color: '#fff',
              letterSpacing: '0.04em',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>{savedCard.brand}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', fontFamily: 'ui-monospace, monospace' }}>
                •••• •••• •••• {savedCard.last4}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                {savedCard.name} · scad. {savedCard.exp}
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
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text2)', fontSize: 11.5, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >{loading ? 'Apertura…' : 'Gestisci ↗'}</button>
        </div>
      )}

      {/* Accepted brands */}
      <div style={{ marginTop: 22 }}>
        <div style={{
          fontSize: 9.5, color: 'var(--text3)', fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12,
          textAlign: 'center',
        }}>Metodi accettati</div>
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
                border: '1px solid rgba(255,255,255,0.08)',
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
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>Invoice History</div>
      </div>

      {loading && (
        <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: 13 }}>Caricamento fatture…</div>
      )}

      {!loading && list.length === 0 && (
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.10)',
          color: 'var(--text3)', fontSize: 13, textAlign: 'center',
        }}>
          Nessuna fattura. Apparirà qui dopo il primo addebito.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.025)' }}>
                {['Data','Importo','Status','Fattura'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px',
                    fontSize: 10, fontWeight: 800, color: 'var(--text3)',
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => {
                const sb = statusBadge(inv.status)
                return (
                  <tr key={inv.id}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{fmtDate(inv.date)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {fmtMoney(inv.amount, inv.currency)} <span style={{ color: 'var(--text3)', fontSize: 11 }}>{inv.currency?.toUpperCase() || ''}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 999,
                        background: sb.bg, border: `1px solid ${sb.border}`,
                        color: sb.color, fontSize: 10.5, fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}>● {sb.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {inv.pdfUrl
                        ? <a href={inv.pdfUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>PDF ↗</a>
                        : inv.hostedUrl
                          ? <a href={inv.hostedUrl} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>Apri ↗</a>
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
              {subActive ? 'Change Plan' : 'Scegli un piano'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginTop: 4 }}>
              {subActive ? 'Cambia il piano della tua subscription' : 'Scegli il piano giusto per la tua crescita'}
            </div>
          </div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            Comparativa piani
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
  const config = {
    'success':         { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  color: '#86efac', text: '✓ Pagamento completato. Subscription attivata.' },
    'cancelled':       { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', color: '#fcd34d', text: 'Checkout annullato. Nessun addebito.' },
    'setup-success':   { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  color: '#86efac', text: '✓ Metodo di pagamento salvato.' },
    'setup-cancelled': { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', color: '#fcd34d', text: 'Aggiunta carta annullata.' },
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
