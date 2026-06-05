'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Avatar from './Avatar'
import ProfileModal from './ProfileModal'

// Chat interna del team: canali + messaggi. Aggiornamento via polling (5s) per
// non dipendere dalla config Realtime/RLS di Supabase.

const PANEL = { background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 12 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, fontFamily: 'Barlow', width: '100%', outline: 'none' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '10px 16px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }

export default function ChatTab({ standalone = false }) {
  const [channels, setChannels] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [me, setMe] = useState(null)
  const [members, setMembers] = useState([])
  const [profile, setProfile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)
  const lastAtRef = useRef(null)
  const seenRef = useRef(new Set())

  // carica canali
  useEffect(() => {
    fetch('/api/channels', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setChannels(d.channels || [])
      setMe(d.me || null)
      if (d.channels && d.channels.length) setActive(prev => prev || d.channels[0].id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // membri + presenza (heartbeat ogni 30s)
  useEffect(() => {
    const loadMembers = () => fetch('/api/team-members', { cache: 'no-store' }).then(r => r.json()).then(d => setMembers(d.members || [])).catch(() => {})
    const ping = () => fetch('/api/presence', { method: 'POST' }).catch(() => {})
    loadMembers(); ping()
    fetch('/api/profile', { cache: 'no-store' }).then(r => r.json()).then(d => setProfile(d.profile || null)).catch(() => {})
    const t = setInterval(() => { if (!document.hidden) { ping(); loadMembers() } }, 30000)
    return () => clearInterval(t)
  }, [])

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  // carica messaggi (full) quando cambia canale
  useEffect(() => {
    if (!active) return
    seenRef.current = new Set()
    lastAtRef.current = null
    fetch(`/api/channel-messages?channel_id=${active}`, { cache: 'no-store' })
      .then(r => r.json()).then(d => {
        const msgs = d.messages || []
        msgs.forEach(m => seenRef.current.add(m.id))
        if (msgs.length) lastAtRef.current = msgs[msgs.length - 1].created_at
        setMessages(msgs)
        scrollBottom()
      }).catch(() => {})
  }, [active])

  // polling incrementale
  const poll = useCallback(() => {
    if (!active || document.hidden) return
    const after = lastAtRef.current
    const url = `/api/channel-messages?channel_id=${active}${after ? `&after=${encodeURIComponent(after)}` : ''}`
    fetch(url, { cache: 'no-store' }).then(r => r.json()).then(d => {
      const incoming = (d.messages || []).filter(m => !seenRef.current.has(m.id))
      if (incoming.length) {
        incoming.forEach(m => seenRef.current.add(m.id))
        lastAtRef.current = incoming[incoming.length - 1].created_at
        setMessages(prev => [...prev, ...incoming])
        scrollBottom()
      }
    }).catch(() => {})
  }, [active])

  useEffect(() => {
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [poll])

  async function send() {
    const body = text.trim()
    if (!body || !active) return
    setText('')
    const r = await fetch('/api/channel-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: active, body }) })
      .then(x => x.json()).catch(() => ({}))
    if (r.ok && r.message && !seenRef.current.has(r.message.id)) {
      seenRef.current.add(r.message.id)
      lastAtRef.current = r.message.created_at
      setMessages(prev => [...prev, r.message])
      scrollBottom()
    }
  }

  async function addChannel() {
    const name = prompt('Nome del canale (es. marketing):')
    if (!name || !name.trim()) return
    const r = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(x => x.json())
    if (r.ok && r.channel) {
      setChannels(prev => prev.some(c => c.id === r.channel.id) ? prev : [...prev, r.channel])
      setActive(r.channel.id)
    }
  }

  const activeName = channels.find(c => c.id === active)?.name
  const memberMap = useMemo(() => { const m = {}; members.forEach(x => { m[x.id] = x }); return m }, [members])
  const isOnline = (mem) => !!(mem?.last_seen_at && (Date.now() - new Date(mem.last_seen_at).getTime() < 70000))

  if (loading) return <div style={{ padding: 40, color: '#b0b0bd', fontFamily: 'Barlow' }}>Caricamento chat…</div>

  return (
    <div style={{ fontFamily: 'Barlow', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 14px', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 28, fontWeight: 700 }}>💬 Chat del team</h2>
        {!standalone && (
          <a href="/chat" target="_blank" rel="noopener" style={{ ...btn, textDecoration: 'none', fontSize: 13 }}>↗ Apri come app</a>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', height: standalone ? 'calc(100dvh - 110px)' : '68vh' }}>
        {/* Canali */}
        <aside style={{ ...PANEL, width: 240, flexShrink: 0, padding: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px 6px' }}>Canali</div>
            {channels.map(c => (
              <div key={c.id} onClick={() => setActive(c.id)} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: active === c.id ? 700 : 500, color: active === c.id ? '#fff' : '#d0d0d8', background: active === c.id ? 'rgba(123,91,255,0.18)' : 'transparent', marginBottom: 2 }}># {c.name}</div>
            ))}
            <button style={{ background: 'transparent', border: '1px solid #3d3d4c', borderRadius: 8, padding: '7px', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow', width: '100%', marginTop: 6 }} onClick={addChannel}>+ Nuovo canale</button>

            <div style={{ fontSize: 11, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em', padding: '16px 8px 6px' }}>Persone · {members.filter(isOnline).length} online</div>
            {members.map(mem => (
              <div key={mem.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={28} online={isOnline(mem)} />
                <span style={{ fontSize: 13, color: '#d0d0d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.full_name || mem.email}{mem.status === 'invited' ? ' (invitato)' : ''}</span>
              </div>
            ))}
          </div>

          <div onClick={() => setShowProfile(true)} title="Modifica profilo" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderTop: '1px solid #3d3d4c', marginTop: 8, cursor: 'pointer' }}>
            <Avatar name={profile?.full_name || profile?.email} url={profile?.avatar_url} size={32} online />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Il mio profilo'}</div>
              <div style={{ fontSize: 11, color: '#7b5bff' }}>Modifica profilo</div>
            </div>
          </div>
        </aside>

        {/* Messaggi */}
        <div style={{ ...PANEL, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #3d3d4c', fontWeight: 700, fontFamily: 'Barlow Condensed', fontSize: 18 }}>
            {activeName ? `# ${activeName}` : 'Seleziona un canale'}
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && <div style={{ color: '#48484a', fontSize: 13 }}>Nessun messaggio. Scrivi il primo!</div>}
            {messages.map(m => {
              const mem = memberMap[m.author_id]
              return (
                <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name={mem?.full_name || m.author_name || mem?.email} url={mem?.avatar_url} size={36} online={mem ? isOnline(mem) : undefined} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#b0b0bd' }}>
                      <b style={{ color: '#fff' }}>{mem?.full_name || m.author_name || 'Utente'}</b> · {new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 14, color: '#e6e6ee', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 1 }}>{m.body}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #3d3d4c' }}>
            <input style={input} placeholder={activeName ? `Messaggio in #${activeName}…` : 'Messaggio…'} value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <button style={btn} onClick={send}>Invia</button>
          </div>
        </div>
      </div>

      {showProfile && (
        <ProfileModal
          profile={profile || { email: '' }}
          onClose={() => setShowProfile(false)}
          onSaved={(p) => { setProfile(p); setMembers(prev => prev.map(m => m.id === p.id ? { ...m, full_name: p.full_name, avatar_url: p.avatar_url } : m)) }}
        />
      )}
    </div>
  )
}
