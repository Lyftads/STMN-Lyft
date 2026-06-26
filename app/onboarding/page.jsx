'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Icon from '../components/ui/Icon'
import NangoConnectButton from '../components/NangoConnectButton'
import BrandIdentityPanel from '../components/BrandIdentityPanel'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '../../lib/i18n/I18nProvider'

const ACCENT = '#bf5af2'

// description e field.hint sono nei dizionari i18n (obp.*), risolti via t().
const STEPS = [
  {
    id: 'shopify',
    label: 'Shopify',
    icon: <Icon name="bag" size={22} />,
    descKey: 'obp.shopify.desc',
    nangoConnect: 'shopify', stepKey: 'shopify',
    fields: [
      { key: 'shopify_store_url', label: 'Store URL', placeholder: 'mio-store.myshopify.com', required: true, hintKey: 'obp.shopify.urlHint' },
      { key: 'shopify_admin_token', label: 'Admin API Token', placeholder: 'shpat_xxxxxx', required: true, type: 'password', hintKey: 'obp.shopify.tokenHint' },
    ],
  },
  {
    id: 'meta',
    label: 'Meta Ads',
    icon: '◧',
    descKey: 'obp.meta.desc',
    nangoConnect: 'facebook', stepKey: 'meta',
    fields: [
      { key: 'meta_access_token', label: 'Access Token', placeholder: 'EAA...', required: true, type: 'password', hintKey: 'obp.meta.tokenHint' },
      { key: 'meta_account_id', label: 'Ad Account ID', placeholder: 'act_123456789', required: false, hintKey: 'obp.meta.accountHint' },
    ],
  },
  {
    id: 'googleAds',
    label: 'Google Ads',
    icon: '▰',
    descKey: 'obp.googleAds.desc',
    oauth: true, googleType: 'ads', // connect Google (1 volta) + picker account
    fields: [],
  },
  {
    id: 'ga4',
    label: 'Google Analytics 4',
    icon: '▰',
    descKey: 'obp.ga4.desc',
    oauth: true, googleType: 'ga4', // connect Google (1 volta) + picker property
    fields: [],
  },
  {
    id: 'gsc',
    label: 'Search Console',
    icon: '▰',
    descKey: 'obp.gsc.desc',
    oauth: true, googleType: 'gsc', // connect Google (1 volta) + picker sito
    fields: [],
  },
  {
    id: 'klaviyo',
    label: 'Klaviyo',
    icon: <Icon name="mail" size={22} />,
    descKey: 'obp.klaviyo.desc',
    nango: 'klaviyo-oauth', // collegamento one-click via Nango (no API key manuale)
    fields: [],
  },
  {
    id: 'brandIdentity',
    label: 'Brand Identity',
    icon: <Icon name="star" size={22} />,
    descKey: 'obp.brand.desc',
    component: 'brandIdentity',
    fields: [],
  },
]

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  )
}

export function OnboardingInner({ embedded = false } = {}) {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentStep, setCurrentStep] = useState(0)
  const [stepStatus, setStepStatus] = useState({ shopify: false, meta: false, googleAds: false, ga4: false, gsc: false, klaviyo: false })
  const [completed, setCompleted] = useState(false)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const biRef = useRef(null) // handle save() del BrandIdentityPanel embedded

  const loadStatus = useCallback(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(j => {
        if (j?.error) { setError(j.error); return }
        setCompleted(!!j.completed)
        setStepStatus(j.steps || {})
        // Se gia' completato → redirect home (solo standalone: embedded resta per
        // ri-collegare/cambiare le integrazioni dalla tab in-app).
        if (j.completed && !embedded) router.push('/')
      })
      .catch(e => setError(e?.message))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Auto-jump dopo OAuth callback: torna allo step Google da cui si è partiti
  // (param `step`), altrimenti al primo step Google (googleAds).
  useEffect(() => {
    if (searchParams.get('gaConnected') === '1') {
      const want = searchParams.get('step')
      const idx = STEPS.findIndex(s => s.id === want && s.oauth)
      const fallback = STEPS.findIndex(s => s.googleType)
      const target = idx >= 0 ? idx : fallback
      if (target >= 0) setCurrentStep(target)
    }
  }, [searchParams])

  const step = STEPS[currentStep]

  const setField = (k, v) => setValues(prev => ({ ...prev, [k]: v }))

  const handleSaveStep = async () => {
    // Step Brand Identity: il salvataggio è delegato al pannello (POST /api/brand-identity)
    if (step.component === 'brandIdentity') {
      setSaving(true)
      setError(null)
      const ok = await biRef.current?.save()
      setSaving(false)
      if (!ok) { setError(t('obp.errSaveBrand', null, 'Brand Identity save error')); return }
      setStepStatus(prev => ({ ...prev, brandIdentity: true }))
      if (currentStep < STEPS.length - 1) { setCurrentStep(currentStep + 1); setValues({}) }
      else await completeOnboarding()
      return
    }
    // Step di connessione (Nango: Meta/Shopify/Klaviyo — oppure OAuth Google:
    // Ads/GA4/GSC): la connessione è già persistita a parte (save-connection o
    // il callback Google). Se l'utente non ha valori da salvare (nessun account
    // selezionato / nessun campo manuale), "Salva e continua" NON deve fare POST
    // (darebbe "Nessun campo valido"): basta avanzare. Con valori → POST.
    const isConnectStep = !!(step.nangoConnect || step.nango || step.oauth)
    const hasManualValues = Object.keys(values || {}).length > 0
    if (isConnectStep && !hasManualValues) {
      setStepStatus(prev => ({ ...prev, [step.id]: true }))
      if (currentStep < STEPS.length - 1) { setCurrentStep(currentStep + 1); setValues({}) }
      else await completeOnboarding()
      return
    }
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
      setError(e?.message || t('obp.errSave', null, 'Save error'))
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
      if (!res.ok) throw new Error(t('obp.errConfirm', null, 'Onboarding confirmation error'))
      // Embedded (tab in-app): resta nella tab e aggiorna lo stato; standalone → dashboard.
      if (embedded) { setCurrentStep(0); loadStatus() }
      else router.push('/?tab=dashboard&welcome=1')
    } catch (e) {
      setError(e?.message)
    }
  }

  const handleSkipAll = async () => {
    if (!confirm(t('obp.confirmSkipAll', null, 'Want to set up integrations later? You can do it from the Brand Identity section anytime. Without credentials the dashboard shows the beta tenant data.'))) return
    try {
      const res = await fetch('/api/onboarding?action=skip', { method: 'PATCH' })
      if (!res.ok) throw new Error(t('obp.errSkip', null, 'Skip error'))
      if (embedded) loadStatus()
      else router.push('/?tab=dashboard')
    } catch (e) {
      setError(e?.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>
        {t('obp.loading', null, 'Loading…')}
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
      <div style={{ maxWidth: step?.component === 'brandIdentity' ? 860 : 720, margin: '0 auto', transition: 'max-width .2s' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            fontSize: 11, color: ACCENT, fontWeight: 800,
            letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            {t('obp.setupLabel', null, 'Initial setup')}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em' }}>
            {t('obp.title', null, 'Connect your integrations')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12, lineHeight: 1.5 }}>
            {t('obp.subtitle', { n: STEPS.length }, '{n} steps to bring your brand data into LyftAI. You can skip a step and complete it later from Brand Identity.')}
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
                {t('ob.stepOf', { n: currentStep + 1, total: STEPS.length }, 'Step {n} of {total}')}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.02em' }}>
                {t('obp.connectStep', { name: step.label }, 'Connect {name}')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
                {t(step.descKey, null, '')}
              </div>
            </div>
          </div>

          {/* Fields o OAuth step */}
          {step.component === 'brandIdentity' ? (
            <div style={{ marginTop: 8 }}>
              <BrandIdentityPanel ref={biRef} embedded onSaved={() => setStepStatus(p => ({ ...p, brandIdentity: true }))} />
            </div>
          ) : step.oauth ? (
            <GoogleStep
              type={step.googleType}
              stepId={step.id}
              values={values}
              setField={setField}
              gaConnected={searchParams.get('gaConnected') === '1'}
              gaError={searchParams.get('gaError')}
            />
          ) : step.nango ? (
            <div style={{ marginTop: 8, padding: 24, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', textAlign: 'center' }}>
              <div style={{ marginBottom: 10, color: '#7b5bff' }}><Icon name="link" size={34} /></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{t('obp.klaviyo.connectTitle', null, 'Collega Klaviyo')}</div>
              <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.5 }}>{t('obp.klaviyo.connectIntro', null, '1 click: autorizzi Klaviyo, nessuna API key da copiare.')}</p>
              <NangoConnectButton integrationId={step.nango} label={t('obp.klaviyo.connectBtn', null, 'Collega Klaviyo')}
                onConnected={() => {
                  setStepStatus(p => ({ ...p, klaviyo: true }))
                  if (currentStep < STEPS.length - 1) { setCurrentStep(currentStep + 1); setValues({}) }
                  else completeOnboarding()
                }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              {step.nangoConnect && (
                <div style={{ padding: 28, borderRadius: 16, background: 'linear-gradient(180deg, rgba(123,91,255,0.14), rgba(255,255,255,0.02))', border: '1px solid rgba(123,91,255,0.40)', textAlign: 'center' }}>
                  <div style={{ marginBottom: 10, color: '#7b5bff' }}><Icon name="link" size={36} /></div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{t('obp.oneClickTitle', null, 'Collega in un click')}</div>
                  <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 auto 18px', maxWidth: 420, lineHeight: 1.5 }}>{t('obp.oneClickIntro', null, 'Autorizzi in sicurezza, nessun token da copiare.')}</p>
                  <NangoConnectButton integrationId={step.nangoConnect} label={t('obp.connectOneClick', { name: step.label }, `Collega ${step.label} con un click`)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 30px', borderRadius: 999, background: 'linear-gradient(135deg, #7b5bff, #5b8bff)', color: '#fff', border: 'none', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 14px 38px rgba(123,91,255,0.42)' }}
                    onConnected={() => {
                      setStepStatus(p => ({ ...p, [step.id]: true }))
                      if (currentStep < STEPS.length - 1) { setCurrentStep(currentStep + 1); setValues({}) }
                      else completeOnboarding()
                    }} />
                </div>
              )}
              {step.fields.length > 0 && (step.nangoConnect ? (
                <details style={{ marginTop: 2 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text4, #666)' }}>{t('obp.orManual', null, 'Oppure inserisci il token manualmente (avanzato)')}</summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
                    {step.fields.map(f => <FieldInput key={f.key} f={f} values={values} setField={setField} t={t} />)}
                  </div>
                </details>
              ) : (
                step.fields.map(f => <FieldInput key={f.key} f={f} values={values} setField={setField} t={t} />)
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
              {t('ob.skipStep', null, 'Skip this step')}
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
              {saving ? t('obp.saving', null, 'Saving…') : currentStep === STEPS.length - 1 ? t('obp.finalize', null, 'Finalize setup') : t('obp.saveContinue', null, 'Save and continue →')}
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
            {t('obp.skipAll', null, 'Skip all, configure later')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Google Step generico — connetti Google (1 volta, scope Ads+GA4+GSC) +
//  picker dedicato (account pubblicitario / proprietà GA4 / sito Search Console).
// ─────────────────────────────────────────────────────────────
const GOOGLE_CFG = {
  ads: {
    listUrl: '/api/google/ads-accounts', listKey: 'accounts', valueKey: 'google_ads_customer_id',
    optValue: a => a.id, optLabel: a => `${a.name || a.id} — ${a.id}`,
    labelKey: 'obp.adsAccount', labelDef: 'Account Google Ads',
    connectedKey: 'obp.googleConnectedAds', connectedDef: 'Google connesso. Scegli l’account pubblicitario.',
    noneKey: 'obp.noAds', noneDef: 'Nessun account Google Ads trovato su questo profilo.',
    selectKey: 'obp.selectAds', selectDef: '— Seleziona account —',
    manualKey: 'obp.adsManual', manualDef: 'Inserisci manualmente l’ID account Google Ads (Customer ID, 10 cifre)',
    manualPhKey: 'obp.adsManualPh', manualPhDef: 'Es: 123-456-7890',
  },
  ga4: {
    listUrl: '/api/google/properties', listKey: 'properties', valueKey: 'ga4_property_id',
    optValue: p => p.id, optLabel: p => `${p.displayName} (${p.accountName}) — ID ${p.id}`,
    labelKey: 'obp.propertyGA4', labelDef: 'Proprietà GA4',
    connectedKey: 'obp.googleConnected', connectedDef: 'Google connesso. Scegli la proprietà GA4.',
    noneKey: 'obp.noProps', noneDef: 'Nessuna proprietà GA4 trovata su questo account.',
    selectKey: 'obp.selectProperty', selectDef: '— Seleziona proprietà —',
    manualKey: 'obp.ga4Manual', manualDef: 'Inserisci manualmente l’ID proprietà GA4 (solo numeri)',
    manualPhKey: 'obp.ga4ManualPh', manualPhDef: 'Es: 312345678',
  },
  gsc: {
    listUrl: '/api/gsc?action=sites', listKey: 'sites', valueKey: 'gsc_site_url',
    optValue: s => s.siteUrl, optLabel: s => s.siteUrl,
    labelKey: 'obp.gscSite', labelDef: 'Sito Search Console',
    connectedKey: 'obp.googleConnectedGsc', connectedDef: 'Google connesso. Scegli il sito Search Console.',
    noneKey: 'obp.noSites', noneDef: 'Nessun sito Search Console verificato trovato.',
    selectKey: 'obp.selectSite', selectDef: '— Seleziona sito —',
    manualKey: 'obp.gscManual', manualDef: 'Inserisci manualmente l’URL del sito Search Console',
    manualPhKey: 'obp.gscManualPh', manualPhDef: 'Es: https://www.tuosito.com/',
  },
}

function GoogleStep({ type, stepId, values, setField, gaError }) {
  const { t } = useI18n()
  const cfg = GOOGLE_CFG[type] || GOOGLE_CFG.ga4
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [connected, setConnected] = useState(true) // ottimista; la fetch corregge

  useEffect(() => {
    let alive = true
    setLoading(true); setListError(null)
    // Fonte di verità per "Google collegato" = il refresh token È salvato sul
    // tenant (integrations/status.googleConnected). NON dipende dal fatto che la
    // lista (ads/ga4/gsc) ritorni elementi: con Basic access in ritardo (Ads) o
    // nessun sito verificato (GSC) la lista è vuota MA il collegamento c'è → non
    // dobbiamo rimandare l'utente alla schermata "Connetti Google" (= "non salva").
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(s => { if (alive && typeof s?.googleConnected === 'boolean') setConnected(s.googleConnected) })
      .catch(() => {})
    fetch(cfg.listUrl)
      .then(r => r.json())
      .then(j => {
        if (!alive) return
        // notConnected/configured:false vale solo come fallback se lo status non
        // ha già confermato la connessione (gestito sopra). Qui carichiamo gli item.
        if (j?.notConnected || j?.configured === false) { return }
        if (j?.error) { setListError(j.error); return }
        const list = j[cfg.listKey] || []
        setItems(list)
        setConnected(true)
        if (list.length === 1 && !values[cfg.valueKey]) setField(cfg.valueKey, cfg.optValue(list[0]))
      })
      .catch(e => { if (alive) setListError(e?.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  if (gaError) {
    return (
      <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#fca5a5', fontSize: 13 }}>
        <Icon name="warning" size={13} /> {t('obp.connFailed', null, 'Connessione fallita:')} <strong>{gaError}</strong>. {t('obp.retryBelow', null, 'Riprova col pulsante qui sotto.')}
        <div style={{ marginTop: 14 }}><ConnectButton stepId={stepId} label={t('obp.connectGoogle', null, 'Connetti Google')} /></div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ padding: 24, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', textAlign: 'center' }}>
          <div style={{ marginBottom: 10, color: '#7b5bff' }}><Icon name="link" size={34} /></div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{t('obp.connectGoogleAccount', null, 'Collega il tuo account Google')}</div>
          <p style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.5 }}>{t('obp.gaIntro', null, 'Nessun token da copiare. 1 click ti porta su Google, autorizzi l’accesso in lettura (Analytics, Ads, Search Console) e torni qui in automatico.')}</p>
          <ConnectButton stepId={stepId} label={t('obp.connectGoogle', null, 'Connetti Google')} />
          <div style={{ fontSize: 11, color: 'var(--text4, #666)', marginTop: 16 }}>{t('obp.permsPre', null, 'Permessi richiesti:')} <strong>{t('obp.readonly', null, 'sola lettura')}</strong></div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ padding: 14, borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.30)', color: '#86efac', fontSize: 13, marginBottom: 16 }}>
        <Icon name="check" size={13} /> {t(cfg.connectedKey, null, cfg.connectedDef)}
      </div>

      <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.02em' }}>
        {t(cfg.labelKey, null, cfg.labelDef)} <span style={{ color: ACCENT, marginLeft: 4 }}>*</span>
      </label>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 14px' }}>{t('obp.loadingList', null, 'Caricamento…')}</div>
      ) : listError ? (
        // Lista non disponibile (es. Developer Token Google Ads non configurato):
        // NON è un vicolo cieco → consenti l'inserimento manuale del valore.
        <div>
          <div style={{ fontSize: 12.5, color: '#fbbf24', padding: '10px 14px', borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.30)', marginBottom: 12 }}>
            <Icon name="warning" size={13} /> {listError}. {t('obp.enterManual', null, 'Puoi inserirlo manualmente qui sotto.')}
          </div>
          <ManualField cfg={cfg} values={values} setField={setField} t={t} />
        </div>
      ) : items.length === 0 ? (
        // Nessun elemento trovato → fallback manuale (stessa logica).
        <div>
          <div style={{ padding: 14, borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.30)', color: '#fbbf24', fontSize: 13, marginBottom: 12 }}>
            {t(cfg.noneKey, null, cfg.noneDef)}
          </div>
          <ManualField cfg={cfg} values={values} setField={setField} t={t} />
        </div>
      ) : (
        <select
          value={values[cfg.valueKey] || ''}
          onChange={e => setField(cfg.valueKey, e.target.value)}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">{t(cfg.selectKey, null, cfg.selectDef)}</option>
          {items.map(it => (
            <option key={cfg.optValue(it)} value={cfg.optValue(it)}>{cfg.optLabel(it)}</option>
          ))}
        </select>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text4, #666)' }}>
        {t('obp.changeGoogle', null, 'Vuoi cambiare account Google?')} <ConnectButton compact stepId={stepId} label={t('obp.reconnect', null, 'Riconnetti')} />
      </div>
    </div>
  )
}

// Inserimento manuale del valore (Customer ID Ads / property GA4 / sito GSC)
// quando la lista automatica non è disponibile. Per gli Ads normalizza l'ID
// rimuovendo i trattini (123-456-7890 → 1234567890).
function ManualField({ cfg, values, setField, t }) {
  const onChange = (raw) => {
    let v = raw
    if (cfg.valueKey === 'google_ads_customer_id') v = raw.replace(/[^0-9]/g, '')
    setField(cfg.valueKey, v)
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{t(cfg.manualKey, null, cfg.manualDef)}</div>
      <input
        type="text"
        value={values[cfg.valueKey] || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={t(cfg.manualPhKey, null, cfg.manualPhDef)}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
      />
    </div>
  )
}

function ConnectButton({ compact = false, label, stepId }) {
  const { t } = useI18n()
  return (
    <a href={`/api/google/auth/start${stepId ? `?step=${encodeURIComponent(stepId)}` : ''}`} style={{
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
      {label || t('obp.connectGA', null, 'Connect Google Analytics')}
    </a>
  )
}

// Campo input manuale riusabile (token avanzati).
function FieldInput({ f, values, setField, t }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.02em' }}>
        {f.label}{f.required && <span style={{ color: ACCENT, marginLeft: 4 }}>*</span>}
      </label>
      <input
        type={f.type || 'text'}
        value={values[f.key] || ''}
        onChange={e => setField(f.key, e.target.value)}
        placeholder={f.placeholder}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', transition: 'border-color .15s' }}
        onFocus={e => e.currentTarget.style.borderColor = ACCENT}
        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
      />
      {f.hintKey && <div style={{ fontSize: 11, color: 'var(--text4, #666)', marginTop: 6, lineHeight: 1.5 }}>{t(f.hintKey, null, '')}</div>}
    </div>
  )
}
