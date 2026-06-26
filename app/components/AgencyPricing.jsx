'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Avvia il checkout Stripe per un piano agency (solo in-app, utente autenticato).
async function startAgencyCheckout(planId, setLoading, setError) {
  setLoading(planId); setError(null)
  try {
    const r = await fetch('/api/stripe/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, mode: 'subscription' }),
    })
    const j = await r.json()
    if (!r.ok || !j?.url) { setError(j?.error || `Errore ${r.status}`); setLoading(null); return }
    window.location.href = j.url
  } catch (e) { setError(e?.message || 'Network error'); setLoading(null) }
}

// ============================================================================
//  AgencyPricing — vetrina piani Agency/Freelance (multi-azienda).
//  UX: toggle cadenza (Mensile / Annuale = 2 mesi gratis) con risparmio
//  ben visibile (prezzo/mese effettivo + totale fatturato + "Risparmi €X" +
//  prezzo pieno barrato). Solo display: il checkout si cabla quando Stripe è Live.
// ============================================================================

const ACCENT = '#bf5af2'

// label/bill e features sono nei dizionari i18n (ap.*), risolti via t().
const CADENCES = [
  { id: 'monthly', labelKey: 'ap.cadMonthly', months: 1,  factor: 1,     off: 0,  billKey: null },
  // Annuale = 2 mesi gratis → paghi 10 mensilità su 12 (factor 10/12).
  { id: 'annual',  labelKey: 'ap.cadAnnual',  months: 12, factor: 10 / 12, off: 1, billKey: 'ap.billAnnual' },
]

const PLANS = [
  { id: 'freelance', name: 'Freelance', price: 199, clients: 3, extra: 59, accent: '#2997ff', featureCount: 5 },
  { id: 'agency', name: 'Agency', price: 599, clients: 12, extra: 45, accent: ACCENT, popular: true, featureCount: 5 },
  { id: 'pro', name: 'Agency Pro', price: 1290, clients: 30, extra: 35, accent: '#30d158', featureCount: 5 },
  { id: 'enterprise', name: 'Enterprise', price: 1990, flat: true, accent: '#f59e0b', featureCount: 5 },
]

// checkout=true (in-app, utente loggato) → bottoni che avviano lo Stripe Checkout.
// checkout=false (landing pubblica) → bottoni che portano alla registrazione.
export default function AgencyPricing({ compact = false, checkout = false }) {
  const { t, intlLocale } = useI18n()
  const eur = n => `€${Number(n).toLocaleString(intlLocale, { maximumFractionDigits: 0 })}`
  const [cad, setCad] = useState('annual') // default sull'annuale → mostra subito il max risparmio
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

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
                    background: on ? 'rgba(10,10,20,0.18)' : 'rgba(34,197,94,0.16)', color: on ? '#0a0a14' : '#22c55e',
                  }}>{t('ap.twoMonthsFree', null, '2 months free')}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {c.off > 0 && (
        <div style={{ textAlign: 'center', marginTop: -8, fontSize: 12.5, color: '#22c55e', fontWeight: 700 }}>
          {t('ap.annualSaves', null, 'With annual: 2 months free every year')}
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#fca5a5', fontSize: 12.5 }}>{error}</div>
      )}

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(230px, 1fr))' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
        {PLANS.map(p => {
          // flat = prezzo fisso (Enterprise): nessuno sconto annuale.
          const effMonthly = p.custom ? null : (p.flat ? p.price : Math.round(p.price * c.factor))
          const total = (p.custom || p.flat) ? null : Math.round(p.price * c.factor * c.months)
          const savings = (p.custom || p.flat) ? 0 : Math.round((p.price - p.price * c.factor) * c.months)
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
                  {(c.off > 0 && !p.flat) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'line-through' }}>{eur(p.price)}{t('ap.perMonth', null, '/mo')}</span>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.16)', color: '#ef4444' }}>{t('ap.youSave', { amount: eur(savings) }, 'You save {amount}')}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('ap.billedMonthly', null, 'billed monthly')}</div>
                  )}
                  {c.off > 0 && !p.flat && (
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

              {(() => {
                // id univoco per il checkout: agency_<piano>[_annual] (enterprise = flat, niente annuale)
                const planId = `agency_${p.id}${(c.id === 'annual' && !p.flat) ? '_annual' : ''}`
                const btnStyle = {
                  marginTop: 18, padding: '11px 14px', borderRadius: 11, width: '100%', display: 'block', textAlign: 'center', boxSizing: 'border-box',
                  border: `1px solid ${p.popular ? ACCENT : 'var(--border)'}`,
                  background: p.popular ? ACCENT : 'transparent',
                  color: p.popular ? '#0a0a14' : 'var(--text)', fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', textDecoration: 'none',
                }
                const label = t('ap.selectCta', null, 'Inizia')
                if (!checkout) {
                  // Landing pubblica → registrazione, poi sceglie il piano in-app.
                  return <Link href="/register" style={btnStyle}>{label}</Link>
                }
                return (
                  <button type="button" disabled={loading === planId} onClick={() => startAgencyCheckout(planId, setLoading, setError)} style={{ ...btnStyle, cursor: loading === planId ? 'wait' : 'pointer', opacity: (loading && loading !== planId) ? 0.5 : 1 }}>
                    {loading === planId ? t('ap.waiting', null, 'Attendi…') : label}
                  </button>
                )
              })()}
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
