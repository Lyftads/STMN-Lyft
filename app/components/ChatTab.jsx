'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Avatar from './Avatar'
import ProfileModal from './ProfileModal'
import { NewChannelDialog, ChannelMembersDialog } from './ChatDialogs'
import { renderMarkdown } from './chatMarkdown'

// Estetica minimale/futuristica, coerente col resto del software (glass + var CSS).
const PANEL = { background: 'var(--glass, rgba(18,18,28,0.55))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 16, backdropFilter: 'blur(14px)' }
const FIELD = { background: 'var(--surface, rgba(10,10,18,0.55))', border: '1px solid var(--border, rgba(255,255,255,0.10))', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14, fontFamily: 'Barlow', width: '100%', outline: 'none', resize: 'none' }
const BTN = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '0 16px', height: 38, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const MUTED = '#8b8b9a'
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😎', '🤩',
  '🤔', '🤨', '😐', '😶', '🙄', '😏', '😴', '😪', '😜', '🤪', '😝', '🤤', '😒', '😓', '😔', '😕', '🙁', '😖', '😞', '😟',
  '😢', '😭', '😤', '😠', '😡', '🤬', '😱', '😨', '😰', '😥', '🤯', '😬', '😮', '😲', '🥳', '🤗', '🤭', '🤫', '🫶', '🙏',
  '👍', '👎', '👌', '🤌', '✌️', '🤞', '🤝', '👏', '🙌', '💪', '🫡', '👋', '🤙', '✍️', '🫵', '🔥', '✨', '⭐', '🌟', '💥',
  '✅', '❌', '⚠️', '❗', '❓', '💯', '🎉', '🎊', '🚀', '💡', '📌', '📎', '📈', '📉', '💰', '💸', '🛒', '📦', '📣', '🔔',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💬', '👀', '🍕', '☕', '🍻', '🎯', '⏰', '📅', '🤖', '👑', '🙈',
]
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '✅', '🙏', '🔥', '👀']

export default function ChatTab({ standalone = false }) {
  const [channels, setChannels] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [me, setMe] = useState(null)
  const [members, setMembers] = useState([])
  const [profile, setProfile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [manageId, setManageId] = useState(null)
  const [manageMemberIds, setManageMemberIds] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mentionQuery, setMentionQuery] = useState('')
  const [activeMemberIds, setActiveMemberIds] = useState([])
  const [recording, setRecording] = useState(false)
  const [reactFor, setReactFor] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const scrollRef = useRef(null)
  const taRef = useRef(null)
  const lastAtRef = useRef(null)
  const seenRef = useRef(new Set())
  const recRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    fetch('/api/channels', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setChannels(d.channels || [])
      setMe(d.me || null)
      if (d.channels && d.channels.length) setActive(prev => prev || (d.channels.find(c => !c.is_dm)?.id || d.channels[0].id))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const loadMembers = () => fetch('/api/team-members', { cache: 'no-store' }).then(r => r.json()).then(d => setMembers(d.members || [])).catch(() => {})
    const ping = () => fetch('/api/presence', { method: 'POST' }).catch(() => {})
    loadMembers(); ping()
    fetch('/api/profile', { cache: 'no-store' }).then(r => r.json()).then(d => setProfile(d.profile || null)).catch(() => {})
    const t = setInterval(() => { if (!document.hidden) { ping(); loadMembers() } }, 30000)
    return () => clearInterval(t)
  }, [])

  const scrollBottom = () => requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight })

  useEffect(() => {
    if (!active) return
    seenRef.current = new Set(); lastAtRef.current = null; setReplyTo(null)
    fetch(`/api/channel-messages?channel_id=${active}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      const msgs = d.messages || []
      msgs.forEach(m => seenRef.current.add(m.id))
      if (msgs.length) lastAtRef.current = msgs[msgs.length - 1].created_at
      setMessages(msgs); scrollBottom()
    }).catch(() => {})
  }, [active])

  const poll = useCallback(() => {
    if (!active || document.hidden) return
    const after = lastAtRef.current
    fetch(`/api/channel-messages?channel_id=${active}${after ? `&after=${encodeURIComponent(after)}` : ''}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      const incoming = (d.messages || []).filter(m => !seenRef.current.has(m.id))
      if (incoming.length) {
        incoming.forEach(m => seenRef.current.add(m.id))
        lastAtRef.current = incoming[incoming.length - 1].created_at
        setMessages(prev => [...prev, ...incoming]); scrollBottom()
      }
    }).catch(() => {})
  }, [active])
  useEffect(() => { const t = setInterval(poll, 5000); return () => clearInterval(t) }, [poll])

  // membri del canale attivo (per le menzioni @)
  useEffect(() => {
    if (!active) { setActiveMemberIds([]); return }
    fetch(`/api/channel-members?channel_id=${active}`, { cache: 'no-store' }).then(r => r.json()).then(d => setActiveMemberIds(d.member_ids || [])).catch(() => {})
  }, [active])

  const updateMsg = (msg) => setMessages(prev => prev.map(x => x.id === msg.id ? msg : x))

  async function send() {
    const body = text.trim()
    if (!body || !active) return
    setText(''); setEmojiOpen(false); setMentionOpen(false)
    const payload = { channel_id: active, body }
    if (replyTo) { payload.reply_to = replyTo.id; payload.reply_author = replyTo.author; payload.reply_excerpt = replyTo.excerpt }
    setReplyTo(null)
    const r = await fetch('/api/channel-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(x => x.json()).catch(() => ({}))
    if (r.ok && r.message && !seenRef.current.has(r.message.id)) {
      seenRef.current.add(r.message.id); lastAtRef.current = r.message.created_at
      setMessages(prev => [...prev, r.message]); scrollBottom()
    }
  }

  function reloadMembers() { fetch('/api/team-members', { cache: 'no-store' }).then(r => r.json()).then(d => setMembers(d.members || [])).catch(() => {}) }

  async function createChannel({ name, is_private, member_ids, externals }) {
    const r = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, is_private, member_ids }) }).then(x => x.json())
    if (!r.ok || !r.channel) { alert(r.error || 'Errore creazione canale'); return }
    setChannels(prev => prev.some(c => c.id === r.channel.id) ? prev : [...prev, r.channel])
    setActive(r.channel.id); setShowNewChannel(false)
    if (externals && externals.length) {
      const pwds = []
      for (const email of externals) {
        const inv = await fetch('/api/chat-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, channel_id: r.channel.id }) }).then(x => x.json()).catch(() => ({}))
        if (inv.ok && inv.tempPassword) pwds.push(`${email}: ${inv.tempPassword}`)
      }
      reloadMembers()
      if (pwds.length) alert('Inviti esterni creati (password temporanea, condividila):\n\n' + pwds.join('\n'))
    }
  }

  async function openManage(channelId) {
    setManageId(channelId)
    const d = await fetch(`/api/channel-members?channel_id=${channelId}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    setManageMemberIds(d.member_ids || [])
  }
  async function toggleChannelMember(memberId, add) {
    setManageMemberIds(prev => add ? [...new Set([...prev, memberId])] : prev.filter(x => x !== memberId))
    if (add) await fetch('/api/channel-members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: manageId, member_id: memberId }) })
    else await fetch(`/api/channel-members?channel_id=${manageId}&member_id=${memberId}`, { method: 'DELETE' })
  }
  async function inviteExternalToChannel(email) {
    const inv = await fetch('/api/chat-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, channel_id: manageId }) }).then(x => x.json()).catch(() => ({}))
    if (inv.ok) {
      if (inv.member) setManageMemberIds(prev => [...new Set([...prev, inv.member.id])])
      reloadMembers()
      alert(inv.emailSent ? `Invito inviato a ${email}` : `Account creato per ${email}. Password temporanea: ${inv.tempPassword || '—'}`)
    } else alert(inv.error || 'Errore invito')
  }

  async function openDM(member) {
    const r = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dm: true, target_id: member.id }) }).then(x => x.json()).catch(() => ({}))
    if (r.ok && r.channel) {
      setChannels(prev => prev.some(c => c.id === r.channel.id) ? prev : [...prev, r.channel])
      setActive(r.channel.id)
    }
  }

  function handleChange(e) {
    const v = e.target.value
    setText(v)
    const upto = v.slice(0, e.target.selectionStart || v.length)
    const m = upto.match(/(?:^|\s)@([\p{L}\w.\-]*)$/u)
    if (m) { setMentionQuery(m[1]); setMentionOpen(true); setEmojiOpen(false) } else setMentionOpen(false)
  }
  function pickMention(mem) {
    const name = '@' + (mem.full_name || mem.email).replace(/\s+/g, '') + ' '
    const ta = taRef.current
    if (!ta) { insertAtCursor(name); setMentionOpen(false); return }
    const pos = ta.selectionStart
    const before = text.slice(0, pos).replace(/@([\p{L}\w.\-]*)$/u, name)
    const nv = before + text.slice(pos)
    setText(nv); setMentionOpen(false)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = before.length })
  }

  async function pushMessage(payload) {
    const r = await fetch('/api/channel-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(x => x.json()).catch(() => ({}))
    if (r.ok && r.message && !seenRef.current.has(r.message.id)) {
      seenRef.current.add(r.message.id); lastAtRef.current = r.message.created_at
      setMessages(prev => [...prev, r.message]); scrollBottom()
    }
    return r
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const fd = new FormData(); fd.append('file', blob, 'audio.webm')
        const up = await fetch('/api/chat-upload', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({}))
        if (up.ok && up.url) await pushMessage({ channel_id: active, body: '🎤 Messaggio vocale', audio_url: up.url })
        else alert('Upload audio fallito')
      }
      recRef.current = mr; mr.start(); setRecording(true)
    } catch { alert('Microfono non disponibile o permesso negato') }
  }
  function stopRec() { try { recRef.current && recRef.current.stop() } catch {}; setRecording(false) }

  async function attachFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''
    if (!f || !active) return
    const fd = new FormData(); fd.append('file', f)
    const up = await fetch('/api/chat-upload', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({}))
    if (up.ok && up.url) await pushMessage({ channel_id: active, body: '', file_url: up.url, file_name: up.name, file_type: up.type || f.type })
    else alert(up.error || 'Upload fallito')
  }

  function startCall() {
    if (!active) return
    const room = `LyftAI-${active}-${Date.now().toString(36)}`
    const url = `https://meet.jit.si/${room}`
    window.open(url, '_blank', 'noopener')
    pushMessage({ channel_id: active, body: `📹 Videochiamata avviata — entra: ${url}` })
  }

  async function toggleReaction(id, emoji) {
    setReactFor(null)
    const r = await fetch('/api/channel-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, emoji }) }).then(x => x.json()).catch(() => ({}))
    if (r.ok && r.message) updateMsg(r.message)
  }
  async function deleteMessage(id) {
    if (!confirm('Eliminare il messaggio?')) return
    setMessages(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/channel-messages?id=${id}`, { method: 'DELETE' })
  }
  async function forwardTo(member, msg) {
    setForwardMsg(null)
    const r = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dm: true, target_id: member.id }) }).then(x => x.json()).catch(() => ({}))
    if (!r.ok || !r.channel) { alert('Errore'); return }
    setChannels(prev => prev.some(c => c.id === r.channel.id) ? prev : [...prev, r.channel])
    const body = `↪︎ Inoltrato:\n${msg.body || (msg.audio_url ? '🎤 Messaggio vocale' : '')}`
    await fetch('/api/channel-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: r.channel.id, body, audio_url: msg.audio_url || null }) })
    setActive(r.channel.id)
  }

  // composer helpers
  function surround(pre, post) {
    const ta = taRef.current; if (!ta) { setText(t => t + pre + post); return }
    const s = ta.selectionStart, e = ta.selectionEnd
    const nv = text.slice(0, s) + pre + text.slice(s, e) + post + text.slice(e)
    setText(nv)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + pre.length; ta.selectionEnd = e + pre.length })
  }
  function insertAtCursor(str) {
    const ta = taRef.current
    if (!ta) { setText(t => t + str); return }
    const s = ta.selectionStart, e = ta.selectionEnd
    setText(text.slice(0, s) + str + text.slice(e))
    requestAnimationFrame(() => { ta.focus(); const p = s + str.length; ta.selectionStart = ta.selectionEnd = p })
  }

  const memberMap = useMemo(() => { const m = {}; members.forEach(x => { m[x.id] = x }); return m }, [members])
  const isOnline = (mem) => !!(mem?.last_seen_at && (Date.now() - new Date(mem.last_seen_at).getTime() < 70000))
  const dmOther = (ch) => { const parts = String(ch.name || '').replace(/^dm_/, '').split('_'); const id = parts.find(p => p !== me?.memberId) || parts[0]; return memberMap[id] }
  const channelLabel = (ch) => ch?.is_dm ? (dmOther(ch)?.full_name || dmOther(ch)?.email || 'Diretto') : ch?.name

  const groupChannels = channels.filter(c => !c.is_dm)
  const dmChannels = channels.filter(c => c.is_dm)
  const activeChannel = channels.find(c => c.id === active)
  const manageChannel = channels.find(c => c.id === manageId)
  const mentionPool = (activeChannel && (activeChannel.is_private || activeChannel.is_dm) && activeMemberIds.length)
    ? members.filter(m => activeMemberIds.includes(m.id))
    : members
  const mentionList = mentionPool.filter(m => { const n = (m.full_name || m.email || '').toLowerCase(); return !mentionQuery || n.includes(mentionQuery.toLowerCase()) }).slice(0, 8)

  if (loading) return <div style={{ padding: 40, color: MUTED, fontFamily: 'Barlow' }}>Caricamento chat…</div>

  const itemStyle = (on) => ({ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: on ? 700 : 500, color: on ? '#fff' : '#c9c9d6', background: on ? 'rgba(123,91,255,0.16)' : 'transparent', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 })

  return (
    <div style={{ fontFamily: 'Barlow', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 16px', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 26, fontWeight: 700, letterSpacing: '.01em' }}>Chat</h2>
        {!standalone && <a href="/chat" target="_blank" rel="noopener" style={{ ...BTN, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontSize: 13 }}>↗ Apri come app</a>}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', height: standalone ? 'calc(100dvh - 110px)' : '70vh' }}>
        {/* Sidebar */}
        <aside style={{ ...PANEL, width: 248, flexShrink: 0, padding: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>Canali</div>
            {groupChannels.map(c => (
              <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)}>
                <span style={{ opacity: 0.6 }}>{c.is_private ? '🔒' : '#'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              </div>
            ))}
            <button style={{ background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 10, padding: '7px', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow', width: '100%', marginTop: 6 }} onClick={() => setShowNewChannel(true)}>+ Nuovo canale</button>

            {dmChannels.length > 0 && <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>Messaggi diretti</div>}
            {dmChannels.map(c => { const o = dmOther(c); return (
              <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)}>
                <Avatar name={o?.full_name || o?.email} url={o?.avatar_url} size={22} online={o ? isOnline(o) : undefined} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o?.full_name || o?.email || 'Diretto'}</span>
              </div>
            ) })}

            <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>Persone · {members.filter(isOnline).length} online</div>
            {members.filter(m => m.id !== me?.memberId).map(mem => (
              <div key={mem.id} onClick={() => openDM(mem)} title="Messaggio diretto" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 10, cursor: 'pointer' }}>
                <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={26} online={isOnline(mem)} />
                <span style={{ fontSize: 13, color: '#c9c9d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.full_name || mem.email}{(mem.roles || []).includes('guest') ? ' · guest' : ''}</span>
              </div>
            ))}
          </div>

          <div onClick={() => setShowProfile(true)} title="Modifica profilo" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', marginTop: 8, cursor: 'pointer' }}>
            <Avatar name={profile?.full_name || profile?.email} url={profile?.avatar_url} size={32} online />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Il mio profilo'}</div>
              <div style={{ fontSize: 11, color: '#7b5bff' }}>Modifica profilo</div>
            </div>
          </div>
        </aside>

        {/* Conversazione */}
        <div style={{ ...PANEL, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontWeight: 700, fontFamily: 'Barlow Condensed', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeChannel?.is_dm
                ? <><Avatar name={channelLabel(activeChannel)} url={dmOther(activeChannel)?.avatar_url} size={24} online={isOnline(dmOther(activeChannel))} /> {channelLabel(activeChannel)}</>
                : (active ? `${activeChannel?.is_private ? '🔒' : '#'} ${activeName(activeChannel)}` : 'Seleziona una conversazione')}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {active && (
              <button onClick={startCall} title="Avvia videochiamata" style={{ background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 9, padding: '5px 10px', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'Barlow' }}>📹</button>
            )}
            {activeChannel?.is_private && !activeChannel?.is_dm && (
              <button onClick={() => openManage(activeChannel.id)} style={{ background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 9, padding: '5px 10px', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow' }}>👥 Membri</button>
            )}
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {messages.length === 0 && <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>Nessun messaggio. Scrivi il primo!</div>}
            {messages.map(m => {
              const mem = memberMap[m.author_id]
              const mine = me?.memberId && m.author_id === me.memberId
              const reactions = (m.reactions && typeof m.reactions === 'object') ? m.reactions : {}
              return (
                <div key={m.id} className="chat-row" style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 10 }}>
                  <Avatar name={mem?.full_name || m.author_name || mem?.email} url={mem?.avatar_url} size={34} online={mem ? isOnline(mem) : undefined} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: MUTED }}>
                      <b style={{ color: '#fff' }}>{mem?.full_name || m.author_name || 'Utente'}</b> · {new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {m.reply_excerpt && (
                      <div style={{ borderLeft: '2px solid #7b5bff', padding: '2px 8px', margin: '3px 0', color: MUTED, fontSize: 12.5, background: 'rgba(123,91,255,0.07)', borderRadius: '0 6px 6px 0' }}>
                        ↩︎ <b style={{ color: '#b9b9c8' }}>{m.reply_author || ''}</b>: {m.reply_excerpt}
                      </div>
                    )}
                    {m.body && <div style={{ fontSize: 14, color: '#e7e7ef', lineHeight: 1.5, wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }} />}
                    {m.audio_url && <audio controls src={m.audio_url} style={{ marginTop: 6, height: 38, maxWidth: 280 }} />}
                    {m.file_url && ((/^image\//.test(m.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(m.file_name || ''))
                      ? <a href={m.file_url} target="_blank" rel="noopener"><img src={m.file_url} alt={m.file_name || ''} style={{ marginTop: 6, maxWidth: 280, maxHeight: 220, borderRadius: 10, display: 'block' }} /></a>
                      : <a href={m.file_url} target="_blank" rel="noopener" style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 10, color: '#fff', textDecoration: 'none', fontSize: 13 }}>📎 {m.file_name || 'Allegato'}</a>
                    )}
                    {Object.keys(reactions).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {Object.entries(reactions).map(([em, ids]) => (
                          <button key={em} onClick={() => toggleReaction(m.id, em)} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '1px 8px', fontSize: 12.5, color: '#fff', cursor: 'pointer', border: (ids || []).includes(me?.memberId) ? '1px solid #7b5bff' : '1px solid var(--border, rgba(255,255,255,0.12))' }}>{em} {(ids || []).length}</button>
                        ))}
                      </div>
                    )}
                    {reactFor === m.id && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, ...PANEL, padding: 4, width: 'fit-content' }}>
                        {QUICK_REACTIONS.map(em => <button key={em} onClick={() => toggleReaction(m.id, em)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2 }}>{em}</button>)}
                      </div>
                    )}
                  </div>
                  <div className="chat-actions" style={{ position: 'absolute', top: -12, right: 10, display: 'flex', gap: 2, background: 'var(--glass, rgba(20,20,30,0.92))', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 10, padding: 3, opacity: 0, transition: 'opacity .12s', backdropFilter: 'blur(8px)' }}>
                    <ActBtn title="Reazione" onClick={() => setReactFor(reactFor === m.id ? null : m.id)}>😊</ActBtn>
                    <ActBtn title="Rispondi" onClick={() => setReplyTo({ id: m.id, author: mem?.full_name || m.author_name || 'Utente', excerpt: (m.body || '🎤 audio').slice(0, 120) })}>↩︎</ActBtn>
                    <ActBtn title="Inoltra" onClick={() => setForwardMsg(m)}>↪︎</ActBtn>
                    {(mine || me?.isAdmin) && <ActBtn title="Elimina" onClick={() => deleteMessage(m.id)}>🗑</ActBtn>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Composer stile Slack */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(123,91,255,0.10)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 12.5 }}>
                <span style={{ color: MUTED }}>↩︎ Rispondi a <b style={{ color: '#fff' }}>{replyTo.author}</b>: {replyTo.excerpt.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            )}
            <div style={{ border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 12, background: 'var(--surface, rgba(10,10,18,0.55))' }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.07))', flexWrap: 'wrap' }}>
                <TB onClick={() => surround('**', '**')} title="Grassetto"><b>B</b></TB>
                <TB onClick={() => surround('_', '_')} title="Corsivo"><i>I</i></TB>
                <TB onClick={() => surround('~~', '~~')} title="Barrato"><s>S</s></TB>
                <TB onClick={() => surround('`', '`')} title="Codice">{'</>'}</TB>
                <span style={{ width: 1, height: 16, background: 'var(--border, rgba(255,255,255,0.12))', margin: '0 4px' }} />
                <TB onClick={() => insertAtCursor('\n- ')} title="Elenco">•</TB>
                <TB onClick={() => surround('[', '](https://)')} title="Link">🔗</TB>
              </div>
              {/* Input */}
              <textarea
                ref={taRef}
                rows={2}
                value={text}
                onChange={handleChange}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={activeChannel ? `Messaggio ${activeChannel.is_dm ? `a ${channelLabel(activeChannel)}` : `in ${activeChannel.is_private ? '🔒' : '#'}${activeChannel.name}`}…` : 'Messaggio…'}
                style={{ ...FIELD, border: 'none', background: 'transparent', borderRadius: 0, minHeight: 44, padding: '10px 12px' }}
              />
              {/* Bottom row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', position: 'relative' }}>
                <label title="Allega file" style={{ cursor: 'pointer', color: '#b9b9c8', width: 30, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  +<input type="file" hidden onChange={attachFile} accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt" />
                </label>
                <TB onClick={recording ? stopRec : startRec} title={recording ? 'Ferma e invia vocale' : 'Messaggio vocale'}>{recording ? '⏹' : '🎤'}</TB>
                {recording && <span style={{ fontSize: 12, color: '#ff5a7a' }}>● rec…</span>}
                <TB onClick={() => { setEmojiOpen(o => !o); setMentionOpen(false) }} title="Emoji">😊</TB>
                <TB onClick={() => { setMentionOpen(o => !o); setEmojiOpen(false) }} title="Menziona">@</TB>
                <button onClick={send} style={{ ...BTN, marginLeft: 'auto', width: 38, padding: 0 }} title="Invia">➤</button>

                {emojiOpen && (
                  <div style={{ position: 'absolute', bottom: 44, left: 8, ...PANEL, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, width: 300, zIndex: 10 }}>
                    {EMOJIS.map(em => <button key={em} onClick={() => { insertAtCursor(em); setEmojiOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4 }}>{em}</button>)}
                  </div>
                )}
                {mentionOpen && mentionList.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 44, left: 8, ...PANEL, padding: 6, width: 240, maxHeight: 240, overflowY: 'auto', zIndex: 10 }}>
                    {mentionList.map(mem => (
                      <div key={mem.id} onClick={() => pickMention(mem)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#c9c9d6' }}>
                        <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={22} online={isOnline(mem)} />
                        {mem.full_name || mem.email}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showProfile && (
        <ProfileModal profile={profile || { email: '' }} onClose={() => setShowProfile(false)} onSaved={(p) => { setProfile(p); setMembers(prev => prev.map(m => m.id === p.id ? { ...m, full_name: p.full_name, avatar_url: p.avatar_url } : m)) }} />
      )}
      {showNewChannel && <NewChannelDialog members={members.filter(m => m.id !== me?.memberId)} onClose={() => setShowNewChannel(false)} onCreate={createChannel} />}
      {manageId && <ChannelMembersDialog channel={manageChannel} members={members} memberIds={manageMemberIds} onClose={() => setManageId(null)} onToggle={toggleChannelMember} onInvite={inviteExternalToChannel} />}

      {forwardMsg && (
        <div onClick={() => setForwardMsg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px', fontFamily: 'Barlow' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(380px,100%)', padding: 16, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 20, fontWeight: 700 }}>Inoltra a…</h3>
              <button onClick={() => setForwardMsg(null)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, borderLeft: '2px solid #7b5bff', paddingLeft: 8, marginBottom: 12 }}>{(forwardMsg.body || '🎤 vocale').slice(0, 100)}</div>
            {members.filter(m => m.id !== me?.memberId).map(mem => (
              <div key={mem.id} onClick={() => forwardTo(mem, forwardMsg)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5 }}>
                <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={28} online={isOnline(mem)} />
                {mem.full_name || mem.email}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`.chat-row:hover{background:rgba(255,255,255,0.04)} .chat-actions{opacity:0} .chat-row:hover .chat-actions{opacity:1}`}</style>
    </div>
  )
}

function ActBtn({ onClick, title, children }) {
  return <button type="button" onClick={onClick} title={title} style={{ background: 'none', border: 'none', color: '#c9c9d6', cursor: 'pointer', fontSize: 14, width: 28, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>{children}</button>
}

function TB({ onClick, title, children }) {
  return <button type="button" onClick={onClick} title={title} style={{ background: 'none', border: 'none', color: '#b9b9c8', cursor: 'pointer', fontSize: 13, fontFamily: 'ui-monospace,monospace', width: 30, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#b9b9c8' }}>{children}</button>
}

function activeName(ch) { return ch?.name }
