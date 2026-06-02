'use client'

import { useState } from 'react'

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

const INVOICES = [
  { date: '28/12/2025', amount: '€997,00', status: 'Paid' },
  { date: '28/06/2025', amount: '€997,00', status: 'Paid' },
  { date: '28/12/2024', amount: '€997,00', status: 'Paid' },
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

function PlanCard({ plan, isCurrent }) {
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
        disabled={isCurrent}
        style={{
          width: '100%',
          padding: '13px 16px',
          borderRadius: 12,
          border: 'none',
          cursor: isCurrent ? 'default' : 'pointer',
          background: isCurrent
            ? 'rgba(255,255,255,0.05)'
            : `linear-gradient(135deg, ${plan.accent}, ${plan.accent}cc)`,
          color: isCurrent ? 'var(--text3)' : '#fff',
          fontSize: 13.5, fontWeight: 800,
          letterSpacing: '0.04em',
          boxShadow: isCurrent ? 'none' : `0 8px 24px ${plan.accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
          textTransform: 'uppercase',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.transform = 'translateY(-2px)' } }}
        onMouseLeave={e => { e.currentTarget.style.transform = '' }}
      >
        {isCurrent ? '✓ Piano attuale' : '↑ Passa a ' + plan.name}
      </button>
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

function StatusCard({ currentPlanId }) {
  const plan = PLANS.find(p => p.id === currentPlanId) || PLANS[1]
  return (
    <GlassCard padding={26} glow={plan.accent}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          display: 'grid', placeItems: 'center',
          fontSize: 14, color: 'var(--text2)',
        }}>◧</span>
        <div style={{
          fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em',
        }}>Subscription Status</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${plan.accent}, ${plan.accent}88)`,
            display: 'grid', placeItems: 'center',
            fontSize: 20, color: '#fff',
            boxShadow: `0 0 24px ${plan.accent}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}>♛</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{plan.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Semi-Annual Billing</div>
          </div>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 999,
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.30)',
          color: '#86efac', fontSize: 10.5, fontWeight: 900,
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>● Active</div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 22,
      }}>
        <div style={{
          padding: 14, borderRadius: 11,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
            Current Period
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>28/12/2025 → 28/06/2026</div>
        </div>
        <div style={{
          padding: 14, borderRadius: 11,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
            Next Billing Date
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
            28/06/2026 <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 12 }}>(26 days)</span>
          </div>
        </div>
      </div>

      <button type="button" style={{
        marginTop: 18,
        padding: '10px 18px', borderRadius: 10,
        background: 'transparent',
        border: '1px solid rgba(239,68,68,0.35)',
        color: '#fca5a5', fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '0.02em',
      }}>Cancel Subscription</button>
    </GlassCard>
  )
}

// Accepted payment methods + colori per chip
const PAYMENT_BRANDS = [
  { id: 'visa',       label: 'Visa',       color: '#1A1F71', textColor: '#fff' },
  { id: 'mastercard', label: 'Mastercard', color: '#EB001B', textColor: '#fff' },
  { id: 'amex',       label: 'AmEx',       color: '#016FD0', textColor: '#fff' },
  { id: 'paypal',     label: 'PayPal',     color: '#003087', textColor: '#FFC439' },
  { id: 'bancomat',   label: 'Bancomat',   color: '#005EAA', textColor: '#fff' },
  { id: 'creditcard', label: 'Credit Card', color: '#1f2937', textColor: '#fff' },
  { id: 'revolut',    label: 'Revolut',    color: '#000000', textColor: '#fff' },
]

function PaymentMethodCard() {
  const [savedCard, setSavedCard] = useState(null) // mock: nessuna carta salvata
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ number: '', name: '', exp: '', cvc: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    const last4 = form.number.replace(/\s+/g, '').slice(-4) || '••••'
    const brand = /^4/.test(form.number.trim()) ? 'Visa' : /^5/.test(form.number.trim()) ? 'Mastercard' : /^3[47]/.test(form.number.trim()) ? 'AmEx' : 'Card'
    // Mock save — sostituibile con Stripe.setupIntent + paymentMethods.attach
    setSavedCard({ brand, last4, name: form.name || 'Marino Catasta', exp: form.exp || '••/••' })
    setAdding(false)
    setForm({ number: '', name: '', exp: '', cvc: '' })
  }

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

      {!savedCard && !adding && (
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
              Aggiungi una carta per abilitare la fatturazione automatica. I dati vengono tokenizzati e gestiti via Stripe (PCI-DSS).
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              padding: '11px 22px', borderRadius: 11,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none', color: '#fff',
              fontSize: 13.5, fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(245,158,11,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
              letterSpacing: '0.04em',
            }}
          >+ Aggiungi metodo di pagamento</button>
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
            onClick={() => setSavedCard(null)}
            style={{
              padding: '7px 14px', borderRadius: 9,
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.30)',
              color: '#fca5a5', fontSize: 11.5, fontWeight: 700,
              cursor: 'pointer',
            }}
          >Rimuovi</button>
        </div>
      )}

      {adding && (
        <form onSubmit={handleSubmit} style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
            Mock form — sara' sostituito da Stripe Elements
          </div>
          <input
            type="text" placeholder="Numero carta (4242 4242 4242 4242)"
            value={form.number}
            onChange={e => setForm({...form, number: e.target.value})}
            style={inputStyle}
          />
          <input
            type="text" placeholder="Nome sulla carta"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            style={inputStyle}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              type="text" placeholder="MM / AA"
              value={form.exp}
              onChange={e => setForm({...form, exp: e.target.value})}
              style={inputStyle}
            />
            <input
              type="text" placeholder="CVC"
              value={form.cvc}
              onChange={e => setForm({...form, cvc: e.target.value})}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" style={{
              flex: 1, padding: '11px 16px', borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800,
              cursor: 'pointer', letterSpacing: '0.04em',
              boxShadow: '0 6px 18px rgba(245,158,11,0.35)',
            }}>Salva carta</button>
            <button type="button" onClick={() => setAdding(false)} style={{
              padding: '11px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--text2)', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer',
            }}>Annulla</button>
          </div>
        </form>
      )}

      {/* Accepted brands */}
      <div style={{ marginTop: 18 }}>
        <div style={{
          fontSize: 9.5, color: 'var(--text3)', fontWeight: 800,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10,
        }}>Metodi accettati</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {PAYMENT_BRANDS.map(b => (
            <div key={b.id} style={{
              padding: '6px 12px', borderRadius: 8,
              background: b.color,
              color: b.textColor,
              fontSize: 11, fontWeight: 900,
              letterSpacing: '0.04em',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 6px rgba(0,0,0,0.40)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>{b.label}</div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  background: 'rgba(0,0,0,0.40)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'ui-monospace, monospace',
}

function InvoiceHistory() {
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
      <div style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.025)' }}>
              {['Date','Amount','Status','PDF'].map(h => (
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
            {INVOICES.map((inv, i) => (
              <tr key={i}>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{inv.date}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{inv.amount} <span style={{ color: 'var(--text3)', fontSize: 11 }}>EUR</span></td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999,
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.30)',
                    color: '#86efac', fontSize: 10.5, fontWeight: 800,
                    letterSpacing: '0.04em',
                  }}>● {inv.status}</span>
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <a href="#" style={{
                    color: ACCENT, fontSize: 12.5, fontWeight: 700,
                    textDecoration: 'none',
                  }}>Download ↗</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

export default function SettingsTab() {
  const [currentPlanId] = useState('growth')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <StatusCard currentPlanId={currentPlanId} />

      <PaymentMethodCard />

      {/* Change Plan section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9.5, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Change Plan
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginTop: 4 }}>
              Scegli il piano giusto per la tua crescita
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

      <InvoiceHistory />
    </div>
  )
}
