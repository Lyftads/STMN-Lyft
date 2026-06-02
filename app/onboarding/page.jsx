'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#bf5af2'

const STEPS = [
  {
    id: 'shopify',
    label: 'Shopify',
    icon: '🛍',
    description: 'Lo store da cui leggere ordini, prodotti, clienti, marketing.',
    fields: [
      { key: 'shopify_store_url', label: 'Store URL', placeholder: 'mio-store.myshopify.com', required: true, hint: 'Senza https://. Es: stamina-fitness3.myshopify.com' },
      { key: 'shopify_admin_token', label: 'Admin API Token', placeholder: 'shpat_xxxxxx', required: true, type: 'password', hint: 'Custom app token, NON il client secret. Settings → Apps → Develop apps → Create app → API credentials' },
    ],
  },
  {
    id: 'meta',
    label: 'Meta Ads',
    icon: '◧',
    description: 'Per leggere spend, ROAS, performance campagne.',
    fields: [
      { key: 'meta_access_token', label: 'Access Token', placeholder: 'EAA...', required: true, type: 'password', hint: 'Token long-lived dal Business Manager. Permessi richiesti: ads_read, business_management' },
      { key: 'meta_account_id', label: 'Ad Account ID', placeholder: 'act_123456789', required: false, hint: 'Opzionale ma raccomandato. Trova in Business Settings → Ad Accounts. Formato act_XXXXXXX' },
    ],
  },
  {
    id: 'ga4',
    label: 'Google Analytics 4',
    icon: '▰',
    description: 'Per traffico, sessioni, attribuzione canali.',
    fields: [
      { key: 'ga4_property_id', label: 'GA4 Property ID', placeholder: '123456789', required: true, hint: 'Solo il numero (no "properties/"). Trova in Admin → Property Settings' },
      { key: 'google_refresh_token', label: 'Google OAuth Refresh Token', placeholder: '1//...', required: true, type: 'password', hint: 'Generato via OAuth playground o app OAuth Lyft con scope analytics.readonly' },
      { key: 'google_client_id', label: 'Google OAuth Client ID', placeholder: 'xxx.apps.googleusercontent.com', required: false, hint: 'Opzionale: lascia vuoto per usare app OAuth condivisa Lyft' },
      { key: 'google_client_secret', label: 'Google OAuth Client Secret', placeholder: '', required: false, type: 'password', hint: 'Opzionale: solo se usi tua app OAuth' },
    ],
  },
  {
    id: 'klaviyo',
    label: 'Klaviyo',
    icon: '✉',
    description: 'Per email flows, segmenti, revenue da email marketing.',
    fields: [
      { key: 'klaviyo_api_key', label: 'Private API Key', placeholder: 'pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, type: 'password', hint: 'Account → Settings → API Keys → Create Private API Key. Scope: read_all' },
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [stepStatus, setStepStatus] = useState({ shopify: false, meta: false, ga4: false, klaviyo: false })
  const [completed, setCompleted] = useState(false)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(j => {
        if (j?.error) { setError(j.error); return }
        setCompleted(!!j.completed)
        setStepStatus(j.steps || {})
        // Se gia' completato → redirect home
        if (j.completed) router.push('/')
      })
      .catch(e => setError(e?.message))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => { loadStatus() }, [loadStatus])

  const step = STEPS[currentStep]

  const setField = (k, v) => setValues(prev => ({ ...prev, [k]: v }))

  const handleSaveStep = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: step.id, values }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      setStepStatus(prev => ({ ...prev, [step.id]: true }))
      // Vai al prossimo step o completa
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1)
        setValues({})
      } else {
        await completeOnboarding()
      }
    } catch (e) {
      setError(e?.message || 'Errore di salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const handleSkipStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
      setValues({})
    } else {
      completeOnboarding()
    }
  }

  const completeOnboarding = async () => {
    try {
      const res = await fetch('/api/onboarding?action=complete', { method: 'PATCH' })
      if (!res.ok) throw new Error('Errore conferma onboarding')
      router.push('/?tab=dashboard&welcome=1')
    } catch (e) {
      setError(e?.message)
    }
  }

  const handleSkipAll = async () => {
    if (!confirm('Vuoi configurare le integrazioni dopo? Potrai farlo dalla sezione Brand Identity quando vuoi. Senza credenziali la dashboard mostrera\' i dati del tenant beta.')) return
    try {
      const res = await fetch('/api/onboarding?action=skip', { method: 'PATCH' })
      if (!res.ok) throw new Error('Errore skip')
      router.push('/?tab=dashboard')
    } catch (e) {
      setError(e?.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>
        Caricamento…
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 30% 20%, rgba(191,90,242,0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(41,151,255,0.10), transparent 40%), #000',
      color: 'var(--text)',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            fontSize: 11, color: ACCENT, fontWeight: 800,
            letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Setup iniziale
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em' }}>
            Collega le tue integrazioni
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5 }}>
            4 step per portare i dati del tuo brand dentro LyftAI. Puoi saltare uno step e completarlo dopo da Brand Identity.
          </p>
        </div>

        {/* Progress dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32,
        }}>
          {STEPS.map((s, i) => {
            const isDone = stepStatus[s.id]
            const isCurrent = i === currentStep
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 999,
                background: isCurrent ? `${ACCENT}22` : isDone ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                border: isCurrent ? `1px solid ${ACCENT}66` : isDone ? '1px solid rgba(34,197,94,0.30)' : '1px solid rgba(255,255,255,0.06)',
                fontSize: 11, fontWeight: 700,
                color: isCurrent ? '#fff' : isDone ? '#86efac' : 'var(--text4, #666)',
              }}>
                {isDone ? '✓' : `${i + 1}`}
                <span>{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Step card */}
        <div className="glass-card-static" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <span style={{
              width: 52, height: 52, borderRadius: 14,
              background: `${ACCENT}20`, color: ACCENT,
              display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 800,
              flexShrink: 0,
            }}>{step.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Step {currentStep + 1} di {STEPS.length}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
                Collega {step.label}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
                {step.description}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            {step.fields.map(f => (
              <div key={f.key}>
                <label style={{
                  display: 'block', fontSize: 11, color: 'var(--text3)',
                  fontWeight: 700, marginBottom: 6, letterSpacing: '0.02em',
                }}>
                  {f.label}
                  {f.required && <span style={{ color: ACCENT, marginLeft: 4 }}>*</span>}
                </label>
                <input
                  type={f.type || 'text'}
                  value={values[f.key] || ''}
                  onChange={e => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', transition: 'border-color .15s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = ACCENT}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                {f.hint && (
                  <div style={{ fontSize: 11, color: 'var(--text4, #666)', marginTop: 6, lineHeight: 1.5 }}>
                    {f.hint}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 10,
              background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)',
              color: '#fca5a5', fontSize: 12,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginTop: 24,
          }}>
            <button
              type="button"
              onClick={handleSkipStep}
              disabled={saving}
              style={{
                padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text3)', fontSize: 13, fontWeight: 700,
                opacity: saving ? 0.5 : 1,
              }}
            >
              Salta questo step
            </button>

            <button
              type="button"
              onClick={handleSaveStep}
              disabled={saving}
              style={{
                padding: '12px 26px', borderRadius: 10, cursor: saving ? 'wait' : 'pointer',
                background: `linear-gradient(135deg, ${ACCENT}, #2997ff)`,
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
                letterSpacing: '-0.01em', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Salvataggio…' : currentStep === STEPS.length - 1 ? 'Finalizza setup' : 'Salva e continua →'}
            </button>
          </div>
        </div>

        {/* Skip all link */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            type="button"
            onClick={handleSkipAll}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text4, #666)', fontSize: 12, textDecoration: 'underline',
            }}
          >
            Salta tutto, configuro dopo
          </button>
        </div>
      </div>
    </div>
  )
}
