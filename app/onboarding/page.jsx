'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Icon from '../components/ui/Icon'
import NangoConnectButton from '../components/NangoConnectButton'
import { useRouter, useSearchParams } from 'next/navigation'

const ACCENT = '#bf5af2'

const STEPS = [
  {
    id: 'shopify',
    label: 'Shopify',
    icon: <Icon name="bag" size={22} />,
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
    oauth: true, // gestito da component custom GA4OAuthStep
    fields: [],
  },
  {
    id: 'klaviyo',
    label: 'Klaviyo',
    icon: <Icon name="mail" size={22} />,
    description: 'Per email flows, segmenti, revenue da email marketing.',
    fields: [
      { key: 'klaviyo_api_key', label: 'Private API Key', placeholder: 'pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', required: true, type: 'password', hint: 'Account → Settings → API Keys → Create Private API Key. Scope: read_all' },
    ],
  },
]

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  // Auto-jump allo step GA4 dopo OAuth callback con gaConnected=1
  useEffect(() => {
    if (searchParams.get('gaConnected') === '1') {
      const gaIdx = STEPS.findIndex(s => s.id === 'ga4')
      if (gaIdx >= 0) setCurrentStep(gaIdx)
    }
  }, [searchParams])

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
                {isDone ? <Icon name="check" size={12} /> : `${i + 1}`}
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

          {/* Fields o OAuth step */}
          {step.oauth ? (
            <GA4OAuthStep
              values={values}
              setField={setField}
              gaConnected={searchParams.get('gaConnected') === '1'}
              gaError={searchParams.get('gaError')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              {step.id === 'shopify' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Collega in un clic</div>
                  <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: 0 }}>Inserisci il dominio del tuo store e autorizzi: niente token da copiare.</p>
                  <NangoConnectButton integrationId="shopify" label="Collega Shopify con un clic"
                    onConnected={() => {
                      setStepStatus(p => ({ ...p, shopify: true }))
                      if (currentStep < STEPS.length - 1) { setCurrentStep(currentStep + 1); setValues({}) }
                      else completeOnboarding()
                    }} />
                  <div style={{ fontSize: 11, color: 'var(--text4, #666)' }}>Oppure inserisci il token manualmente qui sotto (avanzato).</div>
                </div>
              )}
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
          )}

          {error && (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 10,
              background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)',
              color: '#fca5a5', fontSize: 12,
            }}>
              <Icon name="warning" size={13} /> {error}
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

// ─────────────────────────────────────────────────────────────
//  GA4 OAuth Step — bottone "Connetti Google" + dropdown property
// ─────────────────────────────────────────────────────────────
function GA4OAuthStep({ values, setField, gaConnected, gaError }) {
  const [properties, setProperties] = useState([])
  const [loadingProps, setLoadingProps] = useState(false)
  const [propsError, setPropsError] = useState(null)
  const [connected, setConnected] = useState(gaConnected)

  // Carica properties se connesso
  useEffect(() => {
    if (!connected) return
    setLoadingProps(true)
    setPropsError(null)
    fetch('/api/google/properties')
      .then(r => r.json())
      .then(j => {
        if (j?.error) {
          if (j.notConnected) setConnected(false)
          else setPropsError(j.error)
          return
        }
        setProperties(j.properties || [])
        // Auto-select se 1 sola property
        if ((j.properties || []).length === 1 && !values.ga4_property_id) {
          setField('ga4_property_id', j.properties[0].id)
        }
      })
      .catch(e => setPropsError(e?.message))
      .finally(() => setLoadingProps(false))
  }, [connected])

  if (gaError) {
    return (
      <div style={{
        marginTop: 16, padding: 16, borderRadius: 12,
        background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)',
        color: '#fca5a5', fontSize: 13,
      }}>
        <Icon name="warning" size={13} /> Connessione fallita: <strong>{gaError}</strong>. Riprova cliccando il bottone qui sotto.
        <div style={{ marginTop: 14 }}>
          <ConnectButton />
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{
          padding: 24, borderRadius: 14,
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed rgba(255,255,255,0.15)',
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 10, color: '#7b5bff' }}><Icon name="link" size={34} /></div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            Connetti il tuo account Google
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.5 }}>
            Niente copia-incolla di token. 1 click ti porta su Google, autorizzi
            l'accesso in lettura ai tuoi dati Analytics, e torni qui automaticamente.
          </p>
          <ConnectButton />
          <div style={{ fontSize: 11, color: 'var(--text4, #666)', marginTop: 16 }}>
            Permessi richiesti: <strong>solo lettura</strong> dei dati Analytics
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        padding: 14, borderRadius: 10,
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.30)',
        color: '#86efac', fontSize: 13, marginBottom: 16,
      }}>
        <Icon name="check" size={13} /> Google connesso. Adesso scegli la property GA4 da monitorare.
      </div>

      <label style={{
        display: 'block', fontSize: 11, color: 'var(--text3)',
        fontWeight: 700, marginBottom: 6, letterSpacing: '0.02em',
      }}>
        Property GA4 <span style={{ color: ACCENT, marginLeft: 4 }}>*</span>
      </label>

      {loadingProps ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 14px' }}>
          Caricamento properties…
        </div>
      ) : propsError ? (
        <div style={{ fontSize: 13, color: '#fca5a5', padding: '12px 14px' }}>
          <Icon name="warning" size={13} /> {propsError}
        </div>
      ) : properties.length === 0 ? (
        <div style={{
          padding: 14, borderRadius: 10,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.30)',
          color: '#fbbf24', fontSize: 13,
        }}>
          Nessuna property GA4 trovata su questo account. Crea una property in
          analytics.google.com e poi riconnetti.
        </div>
      ) : (
        <select
          value={values.ga4_property_id || ''}
          onChange={e => setField('ga4_property_id', e.target.value)}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">— Seleziona property —</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>
              {p.displayName} ({p.accountName}) — ID {p.id}
            </option>
          ))}
        </select>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text4, #666)' }}>
        Vuoi cambiare account Google? <ConnectButton compact label="Riconnetti" />
      </div>
    </div>
  )
}

function ConnectButton({ compact = false, label = 'Connetti Google Analytics' }) {
  return (
    <a href="/api/google/auth/start" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: compact ? '6px 12px' : '12px 22px',
      borderRadius: compact ? 8 : 999,
      background: '#fff', color: '#1a1a1a',
      textDecoration: 'none', fontSize: compact ? 11 : 13.5, fontWeight: 700,
      letterSpacing: '-0.01em',
      boxShadow: compact ? 'none' : '0 10px 30px rgba(0,0,0,0.30)',
      border: compact ? '1px solid rgba(0,0,0,0.12)' : 'none',
    }}>
      <svg width={compact ? 12 : 16} height={compact ? 12 : 16} viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.4-.1-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  )
}
