'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import LogoMark from '../components/LogoMark'
import { getBrowserSupabase } from '../../lib/supabase/client'

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'
const GREEN = '#22c55e'

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: '€119,99', period: '/mese',
    tagline: 'Per founder che strutturano il primo brand',
    features: ['Dashboard KPI core', 'Report periodici', 'Integrazione Shopify + Meta + GA4', 'Email support 48h'],
    cta: 'Inizia trial con Starter',
    accent: '#0ea5e9',
  },
  {
    id: 'growth', name: 'Growth', price: '€179,99', period: '/mese',
    tagline: 'Brand in scaling che cercano leve data-driven',
    features: ['Tutto di Starter +', 'Klaviyo + Creative Tab Meta Ads', 'AI Website Scanner (CRO)', 'Meta Detail ad-level', 'Priority support 12h'],
    cta: 'Inizia trial con Growth',
    accent: ACCENT, popular: true,
  },
  {
    id: 'scale', name: 'Scale', price: '€349,99', period: '/mese',
    tagline: 'Brand 7-8 figure con team dedicato',
    features: ['Tutto di Growth +', 'Creative Lab AI generation', 'Competitor Intel', 'Performance Agent AI + Simulatore', 'CSM dedicato'],
    cta: 'Inizia trial con Scale',
    accent: GREEN,
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const cancelled = searchParams.get('cancelled') === '1'

  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const sb = getBrowserSupabase()
    if (!sb) return
    sb.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata || {}
      setUserName(meta.name || meta.full_name || '')
    })
  }, [])

  const startTrial = async (planId) => {
    setLoading(planId)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, trial: true }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      window.location.href = j.url
    } catch (e) {
      setError(e?.message || 'Errore di avvio checkout')
      setLoading(null)
    }
  }

  const handleLogout = async () => {
    const sb = getBrowserSupabase()
    if (sb) await sb.auth.signOut()
    window.location.href = '/welcome'
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#fff',
      position: 'relative', overflowX: 'hidden',
    }}>
      <BgFx />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Top bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 50 }}>
          <Link href="/welcome" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <LogoMark size={32} />
            <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>LyftAI</span>
          </Link>
          <button onClick={handleLogout} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.65)', borderRadius: 10,
            padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Esci</button>
        </header>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 50 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 18px', borderRadius: 999,
            background: `linear-gradient(90deg, ${GREEN}22, ${ACCENT}18)`,
            border: `1px solid ${GREEN}55`,
            fontSize: 12, fontWeight: 800, color: '#fff',
            letterSpacing: '0.10em', textTransform: 'uppercase',
            marginBottom: 24,
            boxShadow: `0 10px 40px ${GREEN}22`,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, animation: 'pulseDot 2s infinite' }} />
            Prova gratuita · 14 giorni
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 56px)',
            fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05,
            margin: 0, marginBottom: 16,
          }}>
            {userName ? `${userName}, scegli` : 'Scegli'} il tuo piano per iniziare
          </h1>
          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
            maxWidth: 680, margin: '0 auto',
          }}>
            14 giorni di accesso completo a tutte le funzionalità del piano scelto. <strong style={{ color: '#fff' }}>Niente carta richiesta</strong>.
            Cancella in 1 click. Alla scadenza ti chiediamo di confermare se vuoi continuare.
          </p>
        </div>

        {cancelled && (
          <div style={{
            maxWidth: 600, margin: '0 auto 30px',
            padding: 14, borderRadius: 12,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.30)',
            color: '#fbbf24', fontSize: 13, textAlign: 'center',
          }}>
            Checkout annullato. Nessun problema, scegli il piano quando sei pronto.
          </div>
        )}

        {error && (
          <div style={{
            maxWidth: 600, margin: '0 auto 30px',
            padding: 14, borderRadius: 12,
            background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)',
            color: '#fca5a5', fontSize: 13, textAlign: 'center',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Plans */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 20, maxWidth: 1000, margin: '0 auto',
        }}>
          {PLANS.map(p => (
            <div key={p.id} className="glass-card-static" style={{
              padding: 30, position: 'relative',
              ...(p.popular && {
                borderTop: `2px solid ${p.accent}`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.80), 0 0 80px ${p.accent}22, inset 0 1.5px 0 ${p.accent}88`,
              }),
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  padding: '4px 14px', borderRadius: 999,
                  background: p.accent, color: '#fff',
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                }}>POPOLARE</div>
              )}
              <div style={{ fontSize: 12, color: p.accent, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {p.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em' }}>{p.price}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{p.period}</span>
              </div>
              <div style={{ fontSize: 11.5, color: GREEN, fontWeight: 700, marginBottom: 14 }}>
                14 giorni gratis · poi {p.price}{p.period}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24, minHeight: 38 }}>{p.tagline}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: 26 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                    <span style={{ color: p.accent, fontWeight: 800, fontSize: 14, lineHeight: 1.4 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startTrial(p.id)}
                disabled={!!loading}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  padding: '13px 18px', borderRadius: 999, border: 'none',
                  background: p.popular ? `linear-gradient(135deg, ${ACCENT}, ${BLUE})` : 'rgba(255,255,255,0.06)',
                  borderTop: p.popular ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', cursor: loading ? 'wait' : 'pointer',
                  fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em',
                  opacity: loading && loading !== p.id ? 0.5 : 1,
                  boxShadow: p.popular ? '0 20px 50px rgba(191,90,242,0.30)' : 'none',
                }}
              >
                {loading === p.id ? 'Attendere…' : p.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Reassurance */}
        <div style={{ marginTop: 50, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', gap: 28, fontSize: 12, color: 'rgba(255,255,255,0.5)',
            flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <span>✓ Niente carta richiesta</span>
            <span>✓ Cancella in 1 click</span>
            <span>✓ Niente penali</span>
            <span>✓ Accesso completo durante il trial</span>
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
        <div style={{
          position: 'absolute', top: '10%', left: '20%',
          width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`,
          filter: 'blur(60px)', animation: 'orbDrift 30s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '0%', right: '10%',
          width: 700, height: 700, borderRadius: '50%',
          background: `radial-gradient(circle, ${BLUE}33, transparent 70%)`,
          filter: 'blur(60px)', animation: 'orbDrift 35s ease-in-out infinite reverse',
        }} />
      </div>
    </>
  )
}
