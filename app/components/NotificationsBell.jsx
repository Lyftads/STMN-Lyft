'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Campanella notifiche team: badge non-letti + pannello. Polling 30s.
export default function NotificationsBell({ onNavigate }) {
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
        <span style={{ fontSize: 16 }}>📥</span>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: '#ff375f', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 46, width: 340, maxHeight: 460, overflowY: 'auto', background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 1000, fontFamily: 'Barlow' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #3d3d4c' }}>
            <span style={{ fontWeight: 700, fontFamily: 'Barlow Condensed', fontSize: 16, color: '#fff' }}>Notifiche</span>
            {items.some(n => !n.read) && <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#7b5bff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Segna tutte lette</button>}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 20, color: '#b0b0bd', fontSize: 13 }}>Nessuna notifica.</div>
          ) : items.map(n => (
            <div key={n.id} onClick={() => openItem(n)} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(123,91,255,0.10)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#7b5bff', marginTop: 5, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#fff', fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: '#b0b0bd', marginTop: 2 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: '#6b6b78', marginTop: 3 }}>{new Date(n.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
