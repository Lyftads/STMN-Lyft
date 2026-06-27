'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { createPortal } from 'react-dom'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Google (GA4 + Ads): flusso OAuth NATIVO (/api/google/auth/start → refresh_token
// per tenant). Pulsante "Collega" + "Proprietà GA4" (pop-up selezione proprietà).
// service: 'ga4' → selettore proprietà GA4 | 'ads' → (selettore account dopo dev token)
export default function GoogleConnectButton({ service = 'ga4' }) {
  const { t } = useI18n()
  const [connected, setConnected] = useState(false)
  const [modal, setModal] = useState(null) // 'ga4' | 'gsc' | 'ads'
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(j => setConnected(!!j.googleConnected))
      .catch(() => {})
  }, [])

  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => { window.location.href = '/api/google/auth/start' }} style={btn}>
          {connected ? t('metaConnect.reconnect', null, 'Reconnect') : t('metaConnect.connect', null, 'Connect')}
        </button>
        {service === 'ga4' && (
          <button onClick={() => setModal('ga4')} style={{ ...btn, background: 'transparent' }}>
            {t('google.propGA4', null, 'GA4 property')}
          </button>
        )}
        {service === 'ga4' && (
          <button onClick={() => setModal('gsc')} style={{ ...btn, background: 'transparent' }}>
            {t('google.gscSite', null, 'Search Console site')}
          </button>
        )}
        {service === 'ads' && connected && (
          <button onClick={() => setModal('ads')} style={{ ...btn, background: 'transparent' }}>
            {t('google.adsAccount', null, 'Ads account')}
          </button>
        )}
        {connected && <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.40)' }}><Icon name="check" size={12} /> {t('metaConnect.connected', null, 'Connected')}</span>}
      </div>
      {mounted && modal === 'ga4' && createPortal(<Ga4PropertyModal onClose={() => setModal(null)} />, document.body)}
      {mounted && modal === 'gsc' && createPortal(<GscSiteModal onClose={() => setModal(null)} />, document.body)}
      {mounted && modal === 'ads' && createPortal(<AdsAccountModal onClose={() => setModal(null)} />, document.body)}
    </>
  )
}

const btn = {
  padding: '8px 16px', fontWeight: 800, fontSize: 12.5, borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', cursor: 'pointer',
}

function Ga4PropertyModal({ onClose }) {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [sel, setSel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/google/properties').then(r => r.json()).catch(() => ({ error: t('common.networkError', null, 'Network error') })),
      fetch('/api/integrations/status').then(r => r.json()).catch(() => ({})),
    ]).then(([props, status]) => {
      if (cancelled) return
      setData(props)
      if (status?.ga4PropertyId) setSel(String(status.ga4PropertyId))
    })
    return () => { cancelled = true }
  }, [])

  const save = async () => {
    if (!sel) return
    setSaving(true); setSaved(false); setErr(null)
    try {
      const r = await fetch('/api/integrations/ga4-property', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: sel }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('metaConnect.error', null, 'Error'))
      setSaved(true)
      setTimeout(onClose, 700)
    } catch (e) { setErr(e?.message || t('metaConnect.saveError', null, 'Save error')) } finally { setSaving(false) }
  }

  const properties = data?.properties || []

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'grid', placeItems: 'center', animation: 'fadeUp .2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', maxHeight: '82vh', overflow: 'hidden', background: 'rgba(12,12,20,0.98)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 40px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('google.selectGA4', null, 'Select GA4 property')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('google.selectGA4Sub', null, 'The Analytics property used by this workspace')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, width: 30, height: 30, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {!data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{t('google.loadingProps', null, 'Loading properties…')}</div>}
          {data && (data.error || data.notConnected) && (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{data.notConnected ? t('google.connectFirst', null, 'Connect Google first.') : t('google.errorPrefix', { msg: data.error }, `Error: ${data.error}`)}</div>
          )}
          {properties.length > 0 && (
            <div style={{ display: 'grid', gap: 5 }}>
              {properties.map(p => {
                const on = String(sel) === String(p.id)
                return (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', background: on ? 'rgba(41,151,255,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(41,151,255,0.4)' : 'var(--border)'}` }}>
                    <input type="radio" name="ga4prop" checked={on} onChange={() => { setSel(String(p.id)); setSaved(false) }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.displayName}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{p.accountName} · {p.id}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={save} disabled={saving || !sel} style={{ ...btn, opacity: saving || !sel ? 0.5 : 1 }}>
            {saving ? t('metaConnect.saving', null, 'Saving…') : t('common.save', null, 'Save')}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}><Icon name="check" size={11} /> {t('metaConnect.savedShort', null, 'saved')}</span>}
          {err && <span style={{ fontSize: 12, color: 'var(--red)' }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}

// Selettore sito Search Console (mirror di Ga4PropertyModal) — salva
// companies.gsc_site_url via /api/integrations/gsc-site.
function GscSiteModal({ onClose }) {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [sel, setSel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/gsc?action=sites').then(r => r.json()).catch(() => ({ error: t('common.networkError', null, 'Network error') }))
      .then(j => {
        if (cancelled) return
        setData(j)
        if (j?.saved) setSel(j.saved)
        else if (j?.sites?.length) setSel(j.sites[0].siteUrl)
      })
    return () => { cancelled = true }
  }, [])

  const save = async () => {
    if (!sel) return
    setSaving(true); setSaved(false); setErr(null)
    try {
      const r = await fetch('/api/integrations/gsc-site', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: sel }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('metaConnect.error', null, 'Error'))
      setSaved(true)
      setTimeout(onClose, 700)
    } catch (e) { setErr(e?.message || t('metaConnect.saveError', null, 'Save error')) } finally { setSaving(false) }
  }

  const sites = data?.sites || []
  const notConnected = data && data.configured === false

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'grid', placeItems: 'center', animation: 'fadeUp .2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', maxHeight: '82vh', overflow: 'hidden', background: 'rgba(12,12,20,0.98)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 40px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('google.selectGSC', null, 'Select Search Console site')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('google.selectGSCSub', null, 'The GSC property used by this workspace')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, width: 30, height: 30, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {!data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{t('google.loadingSites', null, 'Loading sites…')}</div>}
          {notConnected && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{t('google.connectFirstGSC', null, 'Connect Google first (with the Search Console scope).')}</div>}
          {data && !notConnected && sites.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{t('google.noSites', null, 'No verified site accessible from this Google account.')}</div>
          )}
          {sites.length > 0 && (
            <div style={{ display: 'grid', gap: 5 }}>
              {sites.map(s => {
                const on = sel === s.siteUrl
                return (
                  <label key={s.siteUrl} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', background: on ? 'rgba(41,151,255,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(41,151,255,0.4)' : 'var(--border)'}` }}>
                    <input type="radio" name="gscsite" checked={on} onChange={() => { setSel(s.siteUrl); setSaved(false) }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.siteUrl}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{s.permission}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={save} disabled={saving || !sel} style={{ ...btn, opacity: saving || !sel ? 0.5 : 1 }}>
            {saving ? t('metaConnect.saving', null, 'Saving…') : t('common.save', null, 'Save')}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}><Icon name="check" size={11} /> {t('metaConnect.savedShort', null, 'saved')}</span>}
          {err && <span style={{ fontSize: 12, color: 'var(--red)' }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}

// Selettore account Google Ads (mirror di Ga4PropertyModal) — salva
// companies.google_ads_customer_id via /api/integrations/ads-account.
function AdsAccountModal({ onClose }) {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [sel, setSel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/google/ads-accounts').then(r => r.json()).catch(() => ({ error: t('common.networkError', null, 'Network error') })),
      fetch('/api/integrations/status').then(r => r.json()).catch(() => ({})),
    ]).then(([acc, status]) => {
      if (cancelled) return
      setData(acc)
      if (status?.adsCustomerId) setSel(String(status.adsCustomerId))
    })
    return () => { cancelled = true }
  }, [])

  const save = async () => {
    if (!sel) return
    setSaving(true); setSaved(false); setErr(null)
    try {
      const r = await fetch('/api/integrations/ads-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: sel }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || t('metaConnect.error', null, 'Error'))
      setSaved(true)
      setTimeout(onClose, 700)
    } catch (e) { setErr(e?.message || t('metaConnect.saveError', null, 'Save error')) } finally { setSaving(false) }
  }

  const accounts = data?.accounts || []
  const fmt = (id) => String(id).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'grid', placeItems: 'center', animation: 'fadeUp .2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', maxHeight: '82vh', overflow: 'hidden', background: 'rgba(12,12,20,0.98)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 40px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('google.selectAds', null, 'Select Google Ads account')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('google.selectAdsSub', null, 'The advertising account used by this workspace')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, width: 30, height: 30, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {!data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{t('google.loadingAccounts', null, 'Loading accounts…')}</div>}
          {data && (data.error || data.notConnected) && (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{data.notConnected ? t('google.connectFirst', null, 'Connect Google first.') : t('google.errorPrefix', { msg: data.error }, `Error: ${data.error}`)}</div>
          )}
          {data && !data.error && !data.notConnected && accounts.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{t('google.noAds', null, 'No Google Ads account accessible with this login.')}</div>
          )}
          {accounts.length > 0 && (
            <div style={{ display: 'grid', gap: 5 }}>
              {accounts.map(a => {
                const on = String(sel) === String(a.id)
                return (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', background: on ? 'rgba(41,151,255,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(41,151,255,0.4)' : 'var(--border)'}` }}>
                    <input type="radio" name="adsacc" checked={on} onChange={() => { setSel(String(a.id)); setSaved(false) }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{fmt(a.id)}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={save} disabled={saving || !sel} style={{ ...btn, opacity: saving || !sel ? 0.5 : 1 }}>
            {saving ? t('metaConnect.saving', null, 'Saving…') : t('common.save', null, 'Save')}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}><Icon name="check" size={11} /> {t('metaConnect.savedShort', null, 'saved')}</span>}
          {err && <span style={{ fontSize: 12, color: 'var(--red)' }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}
