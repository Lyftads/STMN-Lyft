'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import PlatformIcon from './PlatformIcon'
import MetaConnectButton from './MetaConnectButton'
import GoogleConnectButton from './GoogleConnectButton'
import NangoConnectButton from './NangoConnectButton'
import BrandIdentityPanel from './BrandIdentityPanel'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Onboarding guidato: l'utente segue gli step in ordine per collegare le
// piattaforme. Ogni step ha una descrizione dettagliata di cosa fa e come
// funziona; qualsiasi step può essere saltato (lo stato "saltato" è locale).
// Lo stato "collegato" è reale (da /api/integrations/status + /api/onboarding).

const MUTED = '#8e8e9e'
const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'Barlow', width: '100%' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 9, padding: '11px 18px', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 16px', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'Barlow' }
const SKIP_KEY = 'lyft_onb_skipped'

// Testi (short/what/how) sono nei dizionari i18n con prefisso ob.<id>.*,
// risolti a runtime con t(); qui restano solo struttura, label e n. di passi.
const STEPS = [
  { id: 'shopify', label: 'Shopify', logo: 'shopify', kind: 'shopify', howCount: 4 },
  { id: 'meta', label: 'Meta Ads', logo: 'meta', kind: 'meta', howCount: 4 },
  { id: 'ga4', label: 'Google (GA4, Ads, Search Console)', logo: 'google', kind: 'google', howCount: 5 },
  { id: 'klaviyo', label: 'Klaviyo', logo: 'klaviyo', kind: 'klaviyo', howCount: 3 },
  { id: 'brand', label: 'Brand Identity', icon: '◉', kind: 'brand', howCount: 4 },
]

// Riga di sotto-stato per le selezioni opzionali (GA4 property / sito GSC / account Ads).
function SubStatus({ on, label, doneText, todoText }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, color: on ? '#0a0a14' : '#8a8a99', background: on ? '#30d158' : 'transparent', border: on ? 'none' : '1.5px solid #44444f' }}>{on ? '✓' : ''}</span>
      <span style={{ color: on ? '#d0d0d8' : '#8a8a99' }}><b style={{ color: on ? '#30d158' : '#c8c8d2', fontWeight: 700 }}>{label}</b> · {on ? doneText : todoText}</span>
    </span>
  )
}

export default function OnboardingTab() {
  const { t } = useI18n()
  const [status, setStatus] = useState({ connected: [], googleConnected: false })
  const [onb, setOnb] = useState({ steps: {}, completed: false })
  const [brandDone, setBrandDone] = useState(false)
  const [current, setCurrent] = useState(0)
  const [skipped, setSkipped] = useState(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || '[]')) } catch { return new Set() }
  })
  const [shopForm, setShopForm] = useState({ shopify_store_url: '', shopify_admin_token: '' })
  const [saving, setSaving] = useState(false)
  const poll = useRef(null)

  const load = useCallback(async () => {
    const [s, o, b] = await Promise.all([
      fetch('/api/integrations/status', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/onboarding', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      fetch('/api/brand-identity', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
    ])
    setStatus(s || {})
    setOnb(o || { steps: {} })
    setBrandDone(!!(b?.identity && Object.keys(b.identity).length > 0))
  }, [])

  useEffect(() => { load() }, [load])
  // Ricarica lo stato quando si torna sulla tab (dopo un OAuth in pop-up) + poll leggero
  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    poll.current = setInterval(load, 7000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(poll.current) }
  }, [load])

  const isConnected = (id) => {
    const c = status.connected || []
    if (id === 'shopify') return c.includes('shopify') || !!onb.steps?.shopify
    if (id === 'meta') return c.includes('facebook') || !!onb.steps?.meta
    if (id === 'ga4') return !!status.googleConnected || !!onb.steps?.ga4
    if (id === 'klaviyo') return c.includes('klaviyo-oauth') || c.includes('klaviyo') || !!onb.steps?.klaviyo
    if (id === 'brand') return brandDone
    return false
  }
  // "Pronto" = collegato E con la selezione necessaria fatta, quindi mostra dati.
  // Meta richiede l'ad account. Google è un bundle (GA4/GSC/Ads opzionali a
  // seconda di cosa usa il cliente) → pronto appena collegato. Shopify/Klaviyo
  // pronti al collegamento.
  const isReady = (id) => {
    if (!isConnected(id)) return false
    if (id === 'meta') return !!status.metaAccountId
    return true
  }
  // Collegato ma non ancora operativo (manca una selezione richiesta).
  const isIncomplete = (id) => isConnected(id) && !isReady(id)
  const isSkipped = (id) => skipped.has(id)
  const isDone = (id) => isConnected(id) || isSkipped(id)

  const persistSkip = (set) => { try { localStorage.setItem(SKIP_KEY, JSON.stringify([...set])) } catch {} }
  const skip = (id) => { const n = new Set(skipped); n.add(id); setSkipped(n); persistSkip(n); next() }
  const unskip = (id) => { const n = new Set(skipped); n.delete(id); setSkipped(n); persistSkip(n) }
  const next = () => setCurrent(c => Math.min(c + 1, STEPS.length - 1))
  const prev = () => setCurrent(c => Math.max(c - 1, 0))

  async function saveShopify() {
    if (!shopForm.shopify_store_url.trim() || !shopForm.shopify_admin_token.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'shopify', values: shopForm }),
      }).then(r => r.json()).catch(() => ({}))
      if (r.ok) { await load(); unskip('shopify') }
    } finally { setSaving(false) }
  }

  async function completeOnboarding() {
    await fetch('/api/onboarding?action=complete', { method: 'PATCH' }).catch(() => {})
    load()
  }

  const doneCount = STEPS.filter(s => isDone(s.id)).length
  const connectedCount = STEPS.filter(s => isConnected(s.id)).length
  const pct = Math.round((doneCount / STEPS.length) * 100)
  const step = STEPS[current]
  const allHandled = STEPS.every(s => isDone(s.id))

  return (
    <div style={{ color: 'var(--text)', fontFamily: 'Barlow', maxWidth: 1040 }}>
      {/* Header + progress */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}><Icon name="rocket" size={22} /> Onboarding</h2>
        <div style={{ color: MUTED, fontSize: 14, marginTop: 2 }}>{t('ob.subtitle', null, 'Follow the steps to connect your platforms. Skip the ones you do not use.')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <div style={{ flex: 1, height: 8, background: '#14141d', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#7b5bff,#5b8bff)', transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 13, color: MUTED, fontWeight: 700, whiteSpace: 'nowrap' }}>{t('ob.connectedCount', { n: connectedCount, total: STEPS.length }, '{n}/{total} connected')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Stepper */}
        <aside style={{ ...card, width: 250, flexShrink: 0, padding: 10 }}>
          {STEPS.map((s, i) => {
            const ready = isReady(s.id), incomplete = isIncomplete(s.id), sk = isSkipped(s.id), active = i === current
            const filled = ready || incomplete || sk
            const mark = ready ? <Icon name="check" size={13} /> : incomplete ? '!' : sk ? '⏭' : active ? '●' : (i + 1)
            const dotBg = ready ? '#30d158' : incomplete ? '#f59e0b' : sk ? '#3d3d4c' : active ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'transparent'
            const subLabel = ready ? t('ob.connected', null, 'Connected') : incomplete ? (s.id === 'meta' ? t('ob.missingAdAccount', null, 'Missing ad account') : t('ob.missingSelection', null, 'Missing selection')) : sk ? t('ob.skipped', null, 'Skipped') : t('ob.todo', null, 'To do')
            const subColor = ready ? '#30d158' : incomplete ? '#f59e0b' : MUTED
            return (
              <button key={s.id} onClick={() => setCurrent(i)} style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                padding: '11px 12px', marginBottom: 3, borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: 'Barlow', background: active ? 'rgba(123,91,255,0.16)' : 'transparent',
              }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: filled || active ? 'var(--text)' : MUTED, background: dotBg, border: filled || active ? 'none' : `1.5px solid ${MUTED}` }}>{mark}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? 'var(--text)' : '#d0d0d8', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.logo ? <PlatformIcon platform={s.logo} size={16} /> : <span>{s.icon}</span>}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span></span>
                  <span style={{ fontSize: 11, color: subColor }}>{subLabel}</span>
                </span>
              </button>
            )
          })}
          {allHandled && !onb.completed && (
            <button style={{ ...btn, width: '100%', marginTop: 8 }} onClick={completeOnboarding}><Icon name="check" size={13} /> {t('ob.completeOnboarding', null, 'Complete onboarding')}</button>
          )}
          {onb.completed && <div style={{ textAlign: 'center', color: '#30d158', fontSize: 12, fontWeight: 700, marginTop: 10 }}>{t('ob.onboardingCompleted', null, 'Onboarding completed')}</div>}
        </aside>

        {/* Dettaglio step */}
        <div style={{ ...card, flex: 1, minWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            {step.logo ? <PlatformIcon platform={step.logo} size={28} /> : <span style={{ fontSize: 30 }}>{step.icon}</span>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{step.label}</div>
              <div style={{ color: MUTED, fontSize: 13 }}>{t('ob.stepOf', { n: current + 1, total: STEPS.length }, 'Step {n} of {total}')} · {t(`ob.${step.id}.short`, null, '')}</div>
            </div>
            {isReady(step.id) && <span style={{ fontSize: 12, fontWeight: 700, color: '#30d158', background: '#30d15822', padding: '5px 12px', borderRadius: 20 }}><Icon name="check" size={13} /> {t('ob.connected', null, 'Connected')}</span>}
            {isIncomplete(step.id) && <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', background: '#f59e0b22', padding: '5px 12px', borderRadius: 20 }}>{t('ob.connectedMissingSelection', null, 'Connected · missing selection')}</span>}
            {!isConnected(step.id) && isSkipped(step.id) && <span style={{ fontSize: 12, fontWeight: 700, color: MUTED, background: '#3d3d4c55', padding: '5px 12px', borderRadius: 20 }}>{t('ob.skipped', null, 'Skipped')}</span>}
          </div>

          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#d0d0d8' }}>{t(`ob.${step.id}.what`, null, '')}</p>

          <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 18, marginBottom: 8 }}>{t('ob.howTo', null, 'How to')}</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: '#c8c8d2' }}>
            {Array.from({ length: step.howCount }).map((_, i) => <li key={i} style={{ marginBottom: 6 }}>{t(`ob.${step.id}.how${i + 1}`, null, '')}</li>)}
          </ol>

          {/* Azione di collegamento per tipo */}
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            {step.kind === 'shopify' && (
              isConnected('shopify') ? (
                <div style={{ color: '#30d158', fontSize: 14 }}><Icon name="check" size={13} /> {t('ob.storeConnected', null, 'Store connected.')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 460 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <NangoConnectButton integrationId="shopify" label={t('ob.connectShopifyOneClick', null, 'Connect Shopify in one click')} />
                    <span style={{ fontSize: 12, color: MUTED }}>{t('ob.shopifyHelper', null, 'Enter your store domain and authorize: no token to copy.')}</span>
                  </div>
                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: 12.5, color: MUTED }}>{t('ob.orManualToken', null, 'Or enter the token manually (advanced)')}</summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                      <input style={input} placeholder="mio-store.myshopify.com" value={shopForm.shopify_store_url} onChange={e => setShopForm(f => ({ ...f, shopify_store_url: e.target.value }))} />
                      <input style={input} type="password" placeholder={t('ob.tokenPh', null, 'Admin API token (shpat_…)')} value={shopForm.shopify_admin_token} onChange={e => setShopForm(f => ({ ...f, shopify_admin_token: e.target.value }))} />
                      <button style={{ ...btn, opacity: saving ? 0.6 : 1, alignSelf: 'flex-start' }} disabled={saving} onClick={saveShopify}>{saving ? t('ob.saving', null, 'Saving…') : t('ob.saveConnectShopify', null, 'Save and connect Shopify')}</button>
                    </div>
                  </details>
                </div>
              )
            )}
            {step.kind === 'meta' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Sempre visibile (anche da collegato) così l'ad account resta scegliibile/cambiabile */}
                <MetaConnectButton />
                {isConnected('meta') && (
                  status.metaAccountId
                    ? <span style={{ color: '#30d158', fontSize: 13 }}><Icon name="check" size={13} /> {t('ob.adAccountSelected', null, 'Ad account selected.')}</span>
                    : <span style={{ color: '#f59e0b', fontSize: 13 }}>{t('ob.metaPickAccount', null, 'Connected. Pick the ad account from the "Ad account" button to see data.')}</span>
                )}
              </div>
            )}
            {step.kind === 'google' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <GoogleConnectButton service="ga4" />
                {isConnected('ga4') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, marginTop: 2 }}>
                    <SubStatus on={!!status.ga4PropertyId} label="GA4" doneText={t('ob.ga4Done', null, 'property selected')} todoText={t('ob.ga4Todo', null, 'pick the property (only if you use Analytics)')} />
                    <SubStatus on={!!status.gscSiteUrl} label="Search Console" doneText={t('ob.gscDone', null, 'site selected')} todoText={t('ob.gscTodo', null, 'pick the site (only if you use Search Console)')} />
                    <SubStatus on={!!status.adsCustomerId} label="Google Ads" doneText={t('ob.adsDone', null, 'account selected')} todoText={t('ob.adsTodo', null, 'pick the account (only if you run Google campaigns)')} />
                  </div>
                )}
              </div>
            )}
            {step.kind === 'klaviyo' && (isConnected('klaviyo') ? <div style={{ color: '#30d158', fontSize: 14 }}><Icon name="check" size={13} /> {t('ob.klaviyoConnected', null, 'Klaviyo connected.')}</div> : <NangoConnectButton integrationId="klaviyo-oauth" label={t('ob.connectKlaviyo', null, 'Connect Klaviyo')} />)}
            {step.kind === 'brand' && (
              <div style={{ margin: '-22px -22px 0', padding: '0 4px' }}>
                <BrandIdentityPanel />
              </div>
            )}
          </div>

          {/* Navigazione */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
            <button style={{ ...btnGhost, opacity: current === 0 ? 0.4 : 1 }} disabled={current === 0} onClick={prev}>← {t('ob.back', null, 'Back')}</button>
            <div style={{ flex: 1 }} />
            {!isConnected(step.id) && (
              <button style={btnGhost} onClick={() => skip(step.id)}>{t('ob.skipStep', null, 'Skip this step')}</button>
            )}
            {current < STEPS.length - 1
              ? <button style={btn} onClick={next}>{t('ob.next', null, 'Next')} →</button>
              : (allHandled
                ? <button style={btn} onClick={completeOnboarding}><Icon name="check" size={13} /> {t('ob.complete', null, 'Complete')}</button>
                : <button style={btnGhost} onClick={next} disabled>{t('ob.next', null, 'Next')} →</button>)}
          </div>
        </div>
      </div>
    </div>
  )
}
