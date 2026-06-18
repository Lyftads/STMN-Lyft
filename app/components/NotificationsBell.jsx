'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// Campanella notifiche team: badge non-letti + pannello. Polling 30s.
export default function NotificationsBell({ onNavigate }) {
  const { t, intlLocale } = useI18n()
  const [pushOn, setPushOn] = useState(false)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const load = useCallback(() => {
    fetch('/api/notifications', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setItems(d.notifications || []); setUnread(d.unread || 0) })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load() }, 30000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!pushSupported) return
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(s => setPushOn(!!s)).catch(() => {})
  }, [])

  async function enablePush() {
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { alert('Permesso notifiche negato dal browser.'); return }
      const { publicKey } = await fetch('/api/push/subscribe', { cache: 'no-store' }).then(r => r.json())
      if (!publicKey) { alert('Push non ancora configurato (manca la chiave VAPID su Vercel).'); return }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) })
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) })
      setPushOn(true)
    } catch (e) { alert('Attivazione push fallita: ' + (e?.message || '')) }
  }

  // chiudi al click fuori
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  async function markAll() {
    setUnread(0); setItems(prev => prev.map(n => ({ ...n, read: true })))
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
  }

  async function openItem(n) {
    setOpen(false)
    if (!n.read) {
      setUnread(u => Math.max(0, u - 1))
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {})
    }
    if (typeof onNavigate === 'function') onNavigate(n.tab || 'tasks')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Notifiche team"
        className="btn-glass"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, padding: 0, cursor: 'pointer' }}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: '#ff375f', color: 'var(--text)', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 46, width: 340, maxHeight: 460, overflowY: 'auto', background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 1000, fontFamily: 'Barlow' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #3d3d4c' }}>
            <span style={{ fontWeight: 700, fontFamily: 'Barlow Condensed', fontSize: 16, color: 'var(--text)' }}>{t('notif.title', null, 'Notifications')}</span>
            {items.some(n => !n.read) && <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#7b5bff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{t('notif.markAllRead', null, 'Mark all read')}</button>}
          </div>
          {pushSupported && (
            <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {pushOn
                ? <span style={{ color: '#30d158', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="check" size={13} /> {t('notif.pushActive', null, 'Push notifications active on this device')}</span>
                : <button onClick={enablePush} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#7b5bff', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, textAlign: 'left' }}><Icon name="bell" size={13} /> {t('notif.enablePush', null, 'Enable push notifications on this device')}</button>}
            </div>
          )}
          {items.length === 0 ? (
            <div style={{ padding: 20, color: '#b0b0bd', fontSize: 13 }}>{t('notif.none', null, 'No notifications.')}</div>
          ) : items.map(n => (
            <div key={n.id} onClick={() => openItem(n)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(123,91,255,0.10)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#7b5bff', marginTop: 5, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: '#b0b0bd', marginTop: 2 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: '#6b6b78', marginTop: 3 }}>{new Date(n.created_at).toLocaleString(intlLocale || 'it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
