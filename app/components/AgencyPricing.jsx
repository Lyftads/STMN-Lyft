'use client'

import { useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  AgencyPricing — vetrina piani Agency/Freelance (multi-azienda).
//  UX: toggle cadenza (Mensile / Semestrale −15% / Annuale −20%) con risparmio
//  ben visibile (prezzo/mese effettivo + totale fatturato + "Risparmi €X" +
//  prezzo pieno barrato). Solo display: il checkout si cabla quando Stripe è Live.
// ============================================================================

const ACCENT = '#bf5af2'

// label/bill e features sono nei dizionari i18n (ap.*), risolti via t().
const CADENCES = [
  { id: 'monthly',   labelKey: 'ap.cadMonthly',   months: 1,  factor: 1,    off: 0,  billKey: null },
  { id: 'semestral', labelKey: 'ap.cadSemestral', months: 6,  factor: 0.85, off: 15, billKey: 'ap.billSemestral' },
  { id: 'annual',    labelKey: 'ap.cadAnnual',    months: 12, factor: 0.80, off: 20, billKey: 'ap.billAnnual' },
]

const PLANS = [
  { id: 'freelance', name: 'Freelance', price: 199, clients: 3, extra: 59, accent: '#2997ff', featureCount: 5 },
  { id: 'agency', name: 'Agency', price: 599, clients: 12, extra: 45, accent: ACCENT, popular: true, featureCount: 5 },
  { id: 'pro', name: 'Agency Pro', price: 1290, clients: 30, extra: 35, accent: '#30d158', featureCount: 5 },
  { id: 'enterprise', name: 'Enterprise', price: null, custom: true, accent: '#f59e0b', featureCount: 5 },
]

export default function AgencyPricing({ compact = false }) {
  const { t, intlLocale } = useI18n()
  const eur = n => `€${Number(n).toLocaleString(intlLocale, { maximumFractionDigits: 0 })}`
  const [cad, setCad] = useState('annual') // default sull'annuale → mostra subito il max risparmio

  const c = CADENCES.find(x => x.id === cad)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Founder banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
        padding: '12px 18px', borderRadius: 14, textAlign: 'center',
        background: 'linear-gradient(90deg, rgba(34,197,94,0.16), rgba(41,151,255,0.16))',
        border: '1px solid rgba(34,197,94,0.35)',
      }}>
        <span style={{ fontSize: 18 }}>🎉</span>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#86efac' }}>{t('ap.founder', null, 'Founder: −30% FOR LIFE for the first 100 sign-ups')}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('ap.founderCumulative', null, '· stacks with the annual discount')}</span>
      </div>

      {/* Toggle cadenza */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 5, borderRadius: 14, background: 'var(--glass)', border: '1px solid var(--border)' }}>
          {CADENCES.map(x => {
            const on = cad === x.id
            return (
              <button key={x.id} type="button" onClick={() => setCad(x.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                border: 'none', background: on ? ACCENT : 'transparent', color: on ? '#0a0a14' : 'var(--text2)',
                fontSize: 13.5, fontWeight: 800,
              }}>
                {t(x.labelKey, null, x.id)}
                {x.off > 0 && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 900, padding: '2px 7px', borderRadius: 999,
                    background: on ? 'rgba(10,10,20,0.18)' : 'rgba(239,68,68,0.16)', color: on ? '#0a0a14' : '#ef4444',
                  }}>−{x.off}%</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {c.off > 0 && (
        <div style={{ textAlign: 'center', marginTop: -8, fontSize: 12.5, color: '#ef4444', fontWeight: 700 }}>
          {cad === 'annual' ? t('ap.savingAnnual', null, 'You are saving 2.4 months per year') : t('ap.savingSemestral', null, 'You are saving almost 1 month per half-year')}
        </div>
      )}

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(230px, 1fr))' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
        {PLANS.map(p => {
          const effMonthly = p.custom ? null : Math.round(p.price * c.factor)
          const total = p.custom ? null : Math.round(p.price * c.factor * c.months)
          const savings = p.custom ? 0 : Math.round((p.price - p.price * c.factor) * c.months)
          return (
            <div key={p.id} style={{
              position: 'relative', display: 'flex', flexDirection: 'column',
              background: p.popular ? 'linear-gradient(180deg, rgba(191,90,242,0.10), rgba(0,0,0,0.2))' : 'rgba(255,255,255,0.025)',
              border: `1px solid ${p.popular ? 'rgba(191,90,242,0.45)' : 'var(--border)'}`,
              borderRadius: 18, padding: '22px 20px',
            }}>
              {p.popular && (
                <span style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: ACCENT, color: '#0a0a14', fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>{t('ap.mostChosen', null, 'MOST CHOSEN')}</span>
              )}
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: p.accent }}>{p.name}</div>

              {p.custom ? (
                <div style={{ margin: '12px 0 6px' }}>
                  <span style={{ fontSize: 34, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{t('ap.custom', null, 'Custom')}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '12px 0 2px' }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{eur(effMonthly)}</span>
                    <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>{t('ap.perMonth', null, '/mo')}</span>
                  </div>
                  {c.off > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'line-through' }}>{eur(p.price)}{t('ap.perMonth', null, '/mo')}</span>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.16)', color: '#ef4444' }}>{t('ap.youSave', { amount: eur(savings) }, 'You save {amount}')}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('ap.billedMonthly', null, 'billed monthly')}</div>
                  )}
                  {c.off > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>{t('ap.billedTotal', { total: eur(total), bill: c.billKey ? t(c.billKey, null, '') : '' }, '{total} billed {bill}')}</div>
                  )}
                </>
              )}

              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                {Array.from({ length: p.featureCount }).map((_, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text2)' }}>
                    <span style={{ color: '#22c55e', fontWeight: 900, flexShrink: 0 }}>✓</span>{t(`ap.${p.id}.f${i + 1}`, null, '')}
                  </li>
                ))}
              </ul>

              <button type="button" disabled style={{
                marginTop: 18, padding: '11px 14px', borderRadius: 11, cursor: 'default', width: '100%',
                border: `1px solid ${p.popular ? ACCENT : 'var(--border)'}`,
                background: p.popular ? ACCENT : 'transparent',
                color: p.popular ? '#0a0a14' : 'var(--text2)', fontSize: 13, fontWeight: 800,
              }}>
                {p.custom ? t('ap.contactUs', null, 'Contact us') : t('ap.comingSoon', null, 'Coming soon')}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text3)' }}>
        {t('ap.footer', null, 'Included companies up to 2,000 orders/mo each · high-volume client (2,000–7,000) +€99 · White-label +€199/mo')}
      </div>
    </div>
  )
}
