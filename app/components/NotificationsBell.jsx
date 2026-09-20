'use client'

import { avvisa } from '../../lib/client/avviso'
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
      if (perm !== 'granted') { avvisa('Permesso notifiche negato dal browser.', 'errore'); return }
      const { publicKey } = await fetch('/api/push/subscribe', { cache: 'no-store' }).then(r => r.json())
      if (!publicKey) { avvisa('Push non ancora configurato (manca la chiave VAPID su Vercel).'); return }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) })
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) })
      setPushOn(true)
    } catch (e) { avvisa('Attivazione push fallita: ' + (e?.message || ''), 'errore') }
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
        aria-label={t('notif.title', null, 'Notifications')}
        data-suggerimento={open ? undefined : t('notif.title', null, 'Notifications')}
        className="ly-icona-btn senza-tocco"
      >
        <Icon name="bell" size={16} />
        {unread > 0 && <span className="ly-icona-conto">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="app-notifications-popover" role="region" aria-label="Notifiche team" style={{ position: 'absolute', right: 0, top: 46, width: 340, maxHeight: 460, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 1000, fontFamily: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontFamily: 'inherit', fontSize: 15, color: 'var(--text)' }}>{t('notif.title', null, 'Notifications')}</span>
            {items.some(n => !n.read) && <button onClick={markAll} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t('notif.markAllRead', null, 'Mark all read')}</button>}
          </div>
          {pushSupported && (
            <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              {pushOn
                ? <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="check" size={13} /> {t('notif.pushActive', null, 'Push notifications active on this device')}</span>
                : <button onClick={enablePush} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, textAlign: 'left' }}><Icon name="bell" size={13} /> {t('notif.enablePush', null, 'Enable push notifications on this device')}</button>}
            </div>
          )}
          {items.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--text2)', fontSize: 13 }}>{t('notif.none', null, 'No notifications.')}</div>
          ) : items.map(n => (
            <div key={n.id} onClick={() => openItem(n)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--neutro-bg)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 6, background: 'var(--accent)', marginTop: 5, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{n.body}</div>}
                  <div style={{ fontSize: 11.5, color: '#6c6c6c', marginTop: 3 }}>{new Date(n.created_at).toLocaleString(intlLocale || 'it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
