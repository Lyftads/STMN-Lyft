'use client'

import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Avatar from './Avatar'
import ProfileModal from './ProfileModal'
import { NewChannelDialog, ChannelMembersDialog } from './ChatDialogs'
import { renderMarkdown } from './chatMarkdown'
import AgentCall from './AgentCall'
import GroupCall from './GroupCall'

const SQUAD_AGENTS = [
  { id: 'ceo', name: 'Chiara', avatar: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { id: 'cfo', name: 'Marco', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { id: 'cmo', name: 'Luigi', avatar: 'https://randomuser.me/api/portraits/men/45.jpg' },
  { id: 'ads', name: 'Sofia', avatar: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 'seo', name: 'Davide', avatar: 'https://randomuser.me/api/portraits/men/52.jpg' },
  { id: 'cro', name: 'Giulia', avatar: 'https://randomuser.me/api/portraits/women/65.jpg' },
  { id: 'data', name: 'Alessandro', avatar: 'https://randomuser.me/api/portraits/men/76.jpg' },
  { id: 'creative', name: 'Valentina', avatar: 'https://randomuser.me/api/portraits/women/12.jpg' },
]

// Estetica minimale/futuristica, coerente col resto del software (glass + var CSS).
const PANEL = { background: 'var(--glass, rgba(18,18,28,0.55))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 16, backdropFilter: 'blur(14px)' }
const FIELD = { background: 'var(--surface, rgba(10,10,18,0.55))', border: '1px solid var(--border, rgba(255,255,255,0.10))', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14, fontFamily: 'Barlow', width: '100%', outline: 'none', resize: 'none' }
const BTN = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '0 16px', height: 38, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const MUTED = '#8b8b9a'
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
  '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
  '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵',
  '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👻', '💀', '👽', '🤖', '💩', '🎃', '😺', '😸',
  '🙈', '🙉', '🙊', '🫶', '🙏', '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇',
  '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '👏', '🙌', '👐', '🤲', '💪', '🫡', '✍️', '🫵', '🙋', '🤦', '🤷', '💅', '👀',
  '🔥', '✨', '⭐', '🌟', '💫', '⚡', '💥', '🌈', '☀️', '🌙', '❄️', '💧', '🌊', '🍀', '🌸', '🌹', '🌷', '🎵', '🎶', '💤',
  '✅', '❌', '⭕', '⚠️', '❗', '❓', '💯', '🎉', '🎊', '🎁', '🏆', '🥇', '🎯', '🚀', '💡', '🔑', '📌', '📎', '🔗', '📊',
  '📈', '📉', '💰', '💸', '💳', '🛒', '📦', '📣', '📢', '🔔', '⏰', '📅', '📆', '🕐', '⌛', '💼', '📝', '📄', '🗂️', '🖥️',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💬',
  '👑', '💎', '🎀', '🍕', '🍔', '🍟', '🌮', '🍩', '🍰', '🎂', '☕', '🍺', '🍻', '🍷', '🥂', '🍾', '🎈', '🥂', '🤩', '🫠',
]
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '✅', '🙏', '🔥', '👀']

function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function highlightComposer(text) {
  return escHtml(text).replace(/(^|\s)(@[\p{L}\w.\-]+)/gu, '$1<span style="color:#7b9cff;font-weight:700">$2</span>').replace(/\n/g, '<br>')
}

export default function ChatTab({ standalone = false }) {
  const [channels, setChannels] = useState([])
  const [active, setActive] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [me, setMe] = useState(null)
  const [members, setMembers] = useState([])
  const [agentAvatars, setAgentAvatars] = useState({}) // tag "Nome · Ruolo" → foto profilo agente AI
  const [agentMembers, setAgentMembers] = useState([]) // agenti AI come pseudo-membri (per @ e pannello persone)
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
  const [recSeconds, setRecSeconds] = useState(0)
  const [reactFor, setReactFor] = useState(null)
  const [actionsFor, setActionsFor] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [firstUnreadId, setFirstUnreadId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuFor, setMenuFor] = useState(null)
  const [callMenu, setCallMenu] = useState(false)
  const [groupCall, setGroupCall] = useState(false)
  const [savedIds, setSavedIds] = useState([])
  const [threadRoot, setThreadRoot] = useState(null)
  const [threadMsgs, setThreadMsgs] = useState([])
  const [threadText, setThreadText] = useState('')
  const [channelView, setChannelView] = useState('messages')
  const [rail, setRail] = useState('home')
  const [lastAt, setLastAt] = useState({})
  const [allFiles, setAllFiles] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [muted, setMuted] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const scrollRef = useRef(null)
  const taRef = useRef(null)
  const lastAtRef = useRef(null)
  const seenRef = useRef(new Set())
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const threadSeen = useRef(new Set())
  const recTimerRef = useRef(null)
  const recCancelRef = useRef(false)
  const linkSelRef = useRef({ s: 0, e: 0 })

  // Roster agenti AI → mappa tag→foto, per mostrare le foto profilo in chat.
  useEffect(() => {
    fetch('/api/team-agent', { cache: 'no-store' }).then(r => r.json()).then(d => {
      const map = {}
      ;(d.team || []).forEach(a => { if (a.tag && a.avatar) map[a.tag] = a.avatar })
      setAgentAvatars(map)
      // Pseudo-membri per il menu @ e il pannello persone (sempre "online").
      setAgentMembers((d.team || []).map(a => ({
        id: 'agent:' + a.id, full_name: a.name, email: a.name, role: a.role,
        avatar_url: a.avatar, isAgent: true,
      })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/channels', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setChannels(d.channels || [])
      setMe(d.me || null)
      setLastAt(d.lastAt || {})
      if (d.channels && d.channels.length) setActive(prev => prev || (d.channels.find(c => !c.is_dm)?.id || d.channels[0].id))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // aggiorna canali + ultima attività (per i non letti) ogni 30s
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return
      fetch('/api/channels', { cache: 'no-store' }).then(r => r.json()).then(d => { setChannels(d.channels || []); setLastAt(d.lastAt || {}) }).catch(() => {})
    }, 30000)
    return () => clearInterval(t)
  }, [])

  // file di tutti i canali (rail File)
  useEffect(() => {
    if (rail !== 'files') return
    fetch('/api/chat-files', { cache: 'no-store' }).then(r => r.json()).then(d => setAllFiles(d.files || [])).catch(() => {})
  }, [rail])

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
    seenRef.current = new Set(); lastAtRef.current = null; setReplyTo(null); setChannelView('messages'); setThreadRoot(null); setSearchOpen(false); setSearchQ('')
    try { setMuted(localStorage.getItem('chmute_' + active) === '1') } catch {}
    fetch(`/api/channel-messages?channel_id=${active}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      const msgs = d.messages || []
      msgs.forEach(m => seenRef.current.add(m.id))
      if (msgs.length) lastAtRef.current = msgs[msgs.length - 1].created_at
      let lastRead = null; try { lastRead = localStorage.getItem('chread_' + active) } catch {}
      const unread = me?.memberId ? msgs.filter(x => x.author_id !== me.memberId && (!lastRead || x.created_at > lastRead)) : []
      setUnreadCount(unread.length); setFirstUnreadId(unread.length ? unread[0].id : null)
      if (msgs.length) { try { localStorage.setItem('chread_' + active, msgs[msgs.length - 1].created_at) } catch {} }
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
        try { localStorage.setItem('chread_' + active, incoming[incoming.length - 1].created_at) } catch {}
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
  useEffect(() => { try { setSavedIds(JSON.parse(localStorage.getItem('chatsaved') || '[]')) } catch {} }, [])

  // polling del thread aperto
  useEffect(() => {
    if (!threadRoot) return
    const t = setInterval(() => {
      if (document.hidden) return
      fetch(`/api/channel-messages?channel_id=${active}&thread_root=${threadRoot.id}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
        const incoming = (d.messages || []).filter(x => !threadSeen.current.has(x.id))
        if (incoming.length) { incoming.forEach(x => threadSeen.current.add(x.id)); setThreadMsgs(prev => [...prev, ...incoming]) }
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [threadRoot, active])

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
    // Risposta degli agenti del team AI:
    //  - se il messaggio NOMINA un agente, oppure
    //  - se l'ULTIMO a parlare nel canale era un agente (continua la conversazione
    //    senza dover richiamare il nome ogni volta).
    // I messaggi degli agenti hanno author_id null.
    const prevMsg = messages[messages.length - 1]
    const continueAgent = !!(prevMsg && !prevMsg.author_id)
    const mentionsAgent = /(^|[^a-zà-ù])(chiara|marco|luigi|sofia|davide|giulia|alessandro|valentina)([^a-zà-ù]|$)/i.test(body)
    if (mentionsAgent || continueAgent) {
      let locale = null
      try { locale = localStorage.getItem('lyft_lang') } catch {}
      fetch('/api/team/channel-reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: active, locale }),
      }).catch(() => {})
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
        clearInterval(recTimerRef.current)
        if (recCancelRef.current) return
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const fd = new FormData(); fd.append('file', blob, 'audio.webm')
        const up = await fetch('/api/chat-upload', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({}))
        if (up.ok && up.url) await pushMessage({ channel_id: active, body: '🎤 Messaggio vocale', audio_url: up.url })
        else alert('Upload audio fallito')
      }
      recRef.current = mr; mr.start(); setRecording(true); setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch { alert('Microfono non disponibile o permesso negato') }
  }
  function stopRec() { recCancelRef.current = false; try { recRef.current && recRef.current.stop() } catch {}; setRecording(false) }
  function cancelRec() { recCancelRef.current = true; try { recRef.current && recRef.current.stop() } catch {}; clearInterval(recTimerRef.current); setRecording(false) }

  function copyText(t) { try { navigator.clipboard.writeText(t) } catch {} }
  function toggleSave(m) {
    setSavedIds(prev => { const next = prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]; try { localStorage.setItem('chatsaved', JSON.stringify(next)) } catch {}; return next })
  }
  function markUnread(m) {
    const idx = messages.findIndex(x => x.id === m.id)
    if (idx < 0) return
    const unread = messages.slice(idx).filter(x => x.author_id !== me?.memberId)
    setFirstUnreadId(m.id); setUnreadCount(unread.length)
    try { localStorage.setItem('chread_' + active, new Date(new Date(m.created_at).getTime() - 1).toISOString()) } catch {}
  }
  async function togglePin(m) {
    const r = await fetch('/api/channel-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, pin: !m.pinned }) }).then(x => x.json()).catch(() => ({}))
    if (r.ok && r.message) updateMsg(r.message)
  }
  const meetUrl = () => `https://meet.jit.si/LyftAI-${active}`
  function copyMeetLink() { copyText(meetUrl()) }

  function winClose() { try { window.close() } catch {}; try { if (!window.closed) window.location.href = '/' } catch {} }
  function winMin() { try { if (document.fullscreenElement) document.exitFullscreen() } catch {} }
  function winFull() { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen() } catch {} }

  function selectRail(r) {
    setRail(r)
    const isUnread = (c) => { const last = lastAt[c.id]; if (!last) return false; let read = null; try { read = localStorage.getItem('chread_' + c.id) } catch {}; return !read || last > read }
    let target = null
    if (r === 'home') target = channels.find(c => !c.is_dm) || channels[0]
    else if (r === 'dms') target = channels.find(c => c.is_dm)
    else if (r === 'unread') target = channels.find(isUnread)
    if (target) setActive(target.id)
  }

  async function attachFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''
    if (!f || !active) return
    const fd = new FormData(); fd.append('file', f)
    const up = await fetch('/api/chat-upload', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({}))
    if (up.ok && up.url) await pushMessage({ channel_id: active, body: '', file_url: up.url, file_name: up.name, file_type: up.type || f.type })
    else alert(up.error || 'Upload fallito')
  }

  function openThread(m) {
    setThreadRoot(m); setThreadMsgs([]); threadSeen.current = new Set()
    fetch(`/api/channel-messages?channel_id=${active}&thread_root=${m.id}`, { cache: 'no-store' }).then(r => r.json()).then(d => {
      const msgs = d.messages || []; msgs.forEach(x => threadSeen.current.add(x.id)); setThreadMsgs(msgs)
    }).catch(() => {})
  }
  async function sendThread() {
    const body = threadText.trim(); if (!body || !threadRoot) return
    setThreadText('')
    const r = await fetch('/api/channel-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: active, body, thread_root: threadRoot.id }) }).then(x => x.json()).catch(() => ({}))
    if (r.ok && r.message) {
      if (!threadSeen.current.has(r.message.id)) { threadSeen.current.add(r.message.id); setThreadMsgs(prev => [...prev, r.message]) }
      setMessages(prev => prev.map(x => x.id === threadRoot.id ? { ...x, reply_count: (x.reply_count || 0) + 1 } : x))
      setThreadRoot(prev => prev ? { ...prev, reply_count: (prev.reply_count || 0) + 1 } : prev)
    }
  }

  function toggleMute() {
    const v = !muted; setMuted(v)
    try { localStorage.setItem('chmute_' + active, v ? '1' : '0') } catch {}
  }

  function startCall() {
    if (!active) return
    const url = meetUrl()
    window.open(url, '_blank', 'noopener')
    pushMessage({ channel_id: active, body: `📹 Incontro avviato — entra: ${url}` })
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
  function openLink() {
    const ta = taRef.current
    const s = ta ? ta.selectionStart : text.length
    const e = ta ? ta.selectionEnd : text.length
    linkSelRef.current = { s, e }
    setLinkText(text.slice(s, e)); setLinkUrl(''); setLinkOpen(true)
  }
  function saveLink() {
    let url = linkUrl.trim()
    if (!url) { alert('Inserisci il collegamento'); return }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    const label = linkText.trim() || url
    const { s, e } = linkSelRef.current
    setText(text.slice(0, s) + `[${label}](${url})` + text.slice(e))
    setLinkOpen(false); setLinkText(''); setLinkUrl('')
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
  // Gli agenti AI sono sempre menzionabili (in ogni canale), in cima alla lista.
  const mentionList = [...agentMembers, ...mentionPool].filter(m => { const n = (m.full_name || m.email || '').toLowerCase(); return !mentionQuery || n.includes(mentionQuery.toLowerCase()) }).slice(0, 12)
  const shownMessages = searchQ.trim() ? messages.filter(m => (m.body || '').toLowerCase().includes(searchQ.trim().toLowerCase())) : messages
  const sharedFiles = messages.filter(m => m.file_url || m.audio_url)
  const channelUnread = (ch) => { const last = lastAt[ch.id]; if (!last) return false; let read = null; try { read = localStorage.getItem('chread_' + ch.id) } catch {}; return ch.id !== active && (!read || last > read) }
  const unreadList = channels.filter(channelUnread)

  const miniMsg = (m) => {
    const mem = memberMap[m.author_id]
    return (
      <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0' }}>
        <Avatar name={mem?.full_name || m.author_name} url={mem?.avatar_url || agentAvatars[m.author_name]} size={30} online={mem ? isOnline(mem) : undefined} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, color: MUTED }}><b style={{ color: '#fff' }}>{mem?.full_name || m.author_name || 'Utente'}</b> · {new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          {m.body && <div style={{ fontSize: 14, color: '#e7e7ef', lineHeight: 1.5, wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }} />}
          {m.audio_url && <AudioMsg src={m.audio_url} />}
          {m.file_url && ((/^image\//.test(m.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(m.file_name || ''))
            ? <a href={m.file_url} target="_blank" rel="noopener"><img src={m.file_url} alt="" style={{ marginTop: 6, maxWidth: 240, borderRadius: 8, display: 'block' }} /></a>
            : <a href={m.file_url} target="_blank" rel="noopener" style={{ marginTop: 6, display: 'inline-block', color: '#7b9cff', fontSize: 13 }}><Icon name="paperclip" size={14} /> {m.file_name || 'Allegato'}</a>)}
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ padding: 40, color: MUTED, fontFamily: 'Barlow' }}>Caricamento chat…</div>

  const itemStyle = (on) => ({ padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: on ? 700 : 500, color: on ? '#fff' : '#c9c9d6', background: on ? 'rgba(123,91,255,0.16)' : 'transparent', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 })

  return (
    <div style={{ fontFamily: 'Barlow', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 16px', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="tipwrap" style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button onClick={winClose} title="Chiudi" style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#ff5f57' }} />
            <button onClick={winMin} title="Riduci (esci da schermo intero)" style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#febc2e' }} />
            <button onClick={winFull} title="Schermo intero" style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#28c840' }} />
          </div>
          <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 26, fontWeight: 700, letterSpacing: '.01em', display: 'flex', alignItems: 'center', gap: 9 }}><img src="/chat-192.png" alt="LyftTalk" style={{ width: 28, height: 28, borderRadius: 8 }} /> LyftTalk</h2>
        </div>
        {!standalone && <a href="/chat" target="_blank" rel="noopener" style={{ ...BTN, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontSize: 13 }}>↗ Apri come app</a>}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', height: standalone ? 'calc(100dvh - 110px)' : '70vh' }}>
        {/* Rail icone (stile Slack) */}
        <div style={{ ...PANEL, width: 60, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0' }}>
          <RailBtn active={rail === 'home'} onClick={() => selectRail('home')} title="Tutti i canali"><Icon name="hash" size={20} /></RailBtn>
          <RailBtn active={rail === 'dms'} onClick={() => selectRail('dms')} title="Messaggi diretti"><Icon name="dm" size={20} /></RailBtn>
          <RailBtn active={rail === 'unread'} onClick={() => selectRail('unread')} title="Non letti" badge={unreadList.length}><Icon name="inbox" size={20} /></RailBtn>
          <RailBtn active={rail === 'files'} onClick={() => selectRail('files')} title="File condivisi"><Icon name="folder" size={20} /></RailBtn>
        </div>
        {/* Sidebar */}
        <aside style={{ ...PANEL, width: 248, flexShrink: 0, padding: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {rail === 'home' && (<>
              <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>Canali</div>
              {groupChannels.map(c => (
                <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)}>
                  <span style={{ opacity: 0.6, display: 'inline-flex' }}>{c.is_private ? <Icon name="lock" size={12} /> : '#'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: channelUnread(c) ? 800 : (active === c.id ? 700 : 500), color: channelUnread(c) ? '#fff' : undefined }}>{c.name}</span>
                  {channelUnread(c) && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#7b5bff' }} />}
                </div>
              ))}
              <button style={{ background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 10, padding: '7px', color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Barlow', width: '100%', marginTop: 6 }} onClick={() => setShowNewChannel(true)}>+ Nuovo canale</button>
              {dmChannels.length > 0 && <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>Messaggi diretti</div>}
              {dmChannels.map(c => { const o = dmOther(c); return (
                <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)}>
                  <Avatar name={o?.full_name || o?.email} url={o?.avatar_url} size={22} online={o ? isOnline(o) : undefined} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: channelUnread(c) ? 800 : undefined }}>{o?.full_name || o?.email || 'Diretto'}</span>
                  {channelUnread(c) && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#7b5bff' }} />}
                </div>
              ) })}
              <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>Persone · {members.filter(isOnline).length} online</div>
              {members.filter(m => m.id !== me?.memberId).map(mem => (
                <div key={mem.id} onClick={() => openDM(mem)} title="Messaggio diretto" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 10, cursor: 'pointer' }}>
                  <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={26} online={isOnline(mem)} />
                  <span style={{ fontSize: 13, color: '#c9c9d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.full_name || mem.email}{(mem.roles || []).includes('guest') ? ' · guest' : ''}</span>
                </div>
              ))}
              {agentMembers.length > 0 && (<>
                <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>Team AI · {agentMembers.length}</div>
                {agentMembers.map(a => (
                  <div key={a.id} title={`Menzionalo con @${a.full_name}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 10 }}>
                    <Avatar name={a.full_name} url={a.avatar_url} size={26} online={true} />
                    <span style={{ fontSize: 13, color: '#c9c9d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.full_name} <span style={{ color: MUTED, fontSize: 11 }}>· {a.role}</span> <span style={{ color: '#a78bfa', fontSize: 10 }}>AI</span></span>
                  </div>
                ))}
              </>)}
            </>)}

            {rail === 'dms' && (<>
              <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>Messaggi diretti</div>
              {dmChannels.map(c => { const o = dmOther(c); return (
                <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)}>
                  <Avatar name={o?.full_name || o?.email} url={o?.avatar_url} size={22} online={o ? isOnline(o) : undefined} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o?.full_name || o?.email || 'Diretto'}</span>
                  {channelUnread(c) && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#7b5bff' }} />}
                </div>
              ) })}
              <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>Avvia una conversazione</div>
              {members.filter(m => m.id !== me?.memberId).map(mem => (
                <div key={mem.id} onClick={() => openDM(mem)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 10, cursor: 'pointer' }}>
                  <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={26} online={isOnline(mem)} />
                  <span style={{ fontSize: 13, color: '#c9c9d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.full_name || mem.email}</span>
                </div>
              ))}
            </>)}

            {rail === 'unread' && (<>
              <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>Non letti · {unreadList.length}</div>
              {unreadList.length === 0 ? <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>Tutto letto 🎉</div> : unreadList.map(c => { const o = c.is_dm ? dmOther(c) : null; return (
                <div key={c.id} onClick={() => { setActive(c.id); setRail('home') }} style={itemStyle(false)}>
                  {c.is_dm ? <Avatar name={o?.full_name || o?.email} url={o?.avatar_url} size={22} online={o ? isOnline(o) : undefined} /> : <span style={{ opacity: 0.6, display: 'inline-flex' }}>{c.is_private ? <Icon name="lock" size={12} /> : '#'}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800, color: '#fff' }}>{c.is_dm ? (o?.full_name || o?.email || 'Diretto') : c.name}</span>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: '#7b5bff' }} />
                </div>
              ) })}
            </>)}

            {rail === 'files' && (<>
              <div style={{ fontSize: 10.5, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>File condivisi</div>
              {allFiles.length === 0 ? <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>Nessun file.</div> : allFiles.map(f => {
                const isImg = (/^image\//.test(f.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(f.file_name || ''))
                return (
                  <a key={f.id} href={f.file_url || f.audio_url} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, textDecoration: 'none', color: '#fff' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 7, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', fontSize: 15 }}>{f.audio_url ? <Icon name="mic" size={16} /> : (isImg ? <img src={f.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="paperclip" size={16} />)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.audio_url ? 'Vocale' : (f.file_name || 'Allegato')}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>#{f.channel_name} · {f.author_name || ''}</div>
                    </div>
                  </a>
                )
              })}
            </>)}
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
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontFamily: 'Barlow Condensed', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeChannel?.is_dm
                  ? <><Avatar name={channelLabel(activeChannel)} url={dmOther(activeChannel)?.avatar_url} size={24} online={isOnline(dmOther(activeChannel))} /> {channelLabel(activeChannel)}</>
                  : (active ? <>{activeChannel?.is_private ? <Icon name="lock" size={13} /> : '#'} {activeName(activeChannel)}</> : 'Seleziona una conversazione')}
              </span>
              {active && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['messages', 'Messaggi'], ['files', 'File']].map(([v, l]) => (
                    <button key={v} onClick={() => setChannelView(v)} style={{ background: channelView === v ? 'rgba(123,91,255,0.16)' : 'transparent', border: 'none', borderRadius: 8, padding: '5px 10px', color: channelView === v ? '#fff' : MUTED, cursor: 'pointer', fontSize: 13, fontWeight: channelView === v ? 700 : 500, fontFamily: 'Barlow' }}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            {active && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <HBtn onClick={() => setSearchOpen(o => !o)} title="Cerca nel canale"><Icon name="search" size={16} /></HBtn>
                <HBtn onClick={toggleMute} title={muted ? 'Notifiche disattivate · attiva' : 'Notifiche attive · disattiva'}><Icon name={muted ? 'bellOff' : 'bell'} size={16} /></HBtn>
                <div style={{ position: 'relative' }}>
                  <HBtn onClick={() => setCallMenu(o => !o)} title="Incontro: avvia o copia link"><Icon name="headset" size={16} /></HBtn>
                  {callMenu && (
                    <div style={{ position: 'absolute', top: 38, right: 0, ...PANEL, padding: 6, width: 240, zIndex: 30 }}>
                      <MenuItem onClick={() => { startCall(); setCallMenu(false) }}><Icon name="headset" size={14} style={{ marginRight: 8 }} />Avvia incontro</MenuItem>
                      <MenuItem onClick={() => { copyMeetLink(); setCallMenu(false) }}><Icon name="link" size={14} style={{ marginRight: 8 }} />Copia link all'incontro</MenuItem>
                    </div>
                  )}
                </div>
                {!activeChannel?.is_dm && <HBtn onClick={() => openManage(activeChannel.id)} title="Membri · aggiungi persone"><Icon name="users" size={16} /></HBtn>}
                <AgentCall
                  agent={{ id: 'ceo', name: 'Chiara', role: 'Squadra AI', color: '#7c5cff', emoji: '👑', avatar: 'https://randomuser.me/api/portraits/women/68.jpg' }}
                  label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="phone" size={14} />Squadra AI</span>}
                  buttonStyle={{ cursor: 'pointer', background: 'rgba(124,92,255,0.16)', border: '1px solid rgba(124,92,255,0.4)', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}
                />
                <button type="button" onClick={() => setGroupCall(true)} title="Call di gruppo: team + agent insieme"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(48,209,88,0.16)', border: '1px solid rgba(48,209,88,0.4)', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}><Icon name="users" size={14} />Call di gruppo</button>
              </div>
            )}
          </div>
          {searchOpen && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <input autoFocus style={FIELD} placeholder="Cerca nei messaggi del canale…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            </div>
          )}

          {channelView === 'messages' ? (
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {shownMessages.length === 0 && <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>{searchQ ? 'Nessun risultato.' : 'Nessun messaggio. Scrivi il primo!'}</div>}
            {(() => { let prevDay = null; return shownMessages.map(m => {
              const mem = memberMap[m.author_id]
              const mine = me?.memberId && m.author_id === me.memberId
              const reactions = (m.reactions && typeof m.reactions === 'object') ? m.reactions : {}
              const day = new Date(m.created_at).toDateString()
              const showDay = day !== prevDay; prevDay = day
              const dayLabel = new Date(m.created_at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
              return (
                <Fragment key={m.id}>
                {showDay && <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}><span style={{ fontSize: 12, color: '#c9c9d6', background: 'rgba(20,20,30,0.7)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 999, padding: '3px 14px', fontWeight: 700 }}>{dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}</span></div>}
                {firstUnreadId === m.id && unreadCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 8px' }}><div style={{ flex: 1, height: 1, background: 'rgba(255,90,122,0.4)' }} /><span style={{ fontSize: 11.5, color: '#ff5a7a', fontWeight: 700, whiteSpace: 'nowrap' }}>{unreadCount} nuovi messaggi</span><div style={{ flex: 1, height: 1, background: 'rgba(255,90,122,0.4)' }} /></div>}
                <div className="chat-row" onClick={() => setActionsFor(actionsFor === m.id ? null : m.id)} style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 10 }}>
                  <Avatar name={mem?.full_name || m.author_name || mem?.email} url={mem?.avatar_url || agentAvatars[m.author_name]} size={34} online={mem ? isOnline(mem) : undefined} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: MUTED }}>
                      <b style={{ color: '#fff' }}>{mem?.full_name || m.author_name || 'Utente'}</b> · {new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {m.pinned && <span style={{ marginLeft: 6, color: '#7b5bff', fontWeight: 600 }}><Icon name="pin" size={11} /> fissato</span>}
                    </div>
                    {m.reply_excerpt && (
                      <div style={{ borderLeft: '2px solid #7b5bff', padding: '2px 8px', margin: '3px 0', color: MUTED, fontSize: 12.5, background: 'rgba(123,91,255,0.07)', borderRadius: '0 6px 6px 0' }}>
                        ↩︎ <b style={{ color: '#b9b9c8' }}>{m.reply_author || ''}</b>: {m.reply_excerpt}
                      </div>
                    )}
                    {m.body && <div style={{ fontSize: 14, color: '#e7e7ef', lineHeight: 1.5, wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }} />}
                    {m.audio_url && <AudioMsg src={m.audio_url} />}
                    {m.file_url && ((/^image\//.test(m.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(m.file_name || ''))
                      ? <a href={m.file_url} target="_blank" rel="noopener"><img src={m.file_url} alt={m.file_name || ''} style={{ marginTop: 6, maxWidth: 280, maxHeight: 220, borderRadius: 10, display: 'block' }} /></a>
                      : <a href={m.file_url} target="_blank" rel="noopener" style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 10, color: '#fff', textDecoration: 'none', fontSize: 13 }}><Icon name="paperclip" size={14} /> {m.file_name || 'Allegato'}</a>
                    )}
                    {Object.keys(reactions).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {Object.entries(reactions).map(([em, ids]) => (
                          <button key={em} onClick={() => toggleReaction(m.id, em)} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '1px 8px', fontSize: 12.5, color: '#fff', cursor: 'pointer', border: (ids || []).includes(me?.memberId) ? '1px solid #7b5bff' : '1px solid var(--border, rgba(255,255,255,0.12))' }}>{em} {(ids || []).length}</button>
                        ))}
                      </div>
                    )}
                    {m.reply_count > 0 && (
                      <div onClick={() => openThread(m)} style={{ marginTop: 5, color: '#7b9cff', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }}><Icon name="chat" size={12} /> {m.reply_count} rispost{m.reply_count === 1 ? 'a' : 'e'}</div>
                    )}
                    {reactFor === m.id && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, ...PANEL, padding: 4, width: 'fit-content' }}>
                        {QUICK_REACTIONS.map(em => <button key={em} onClick={() => toggleReaction(m.id, em)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2 }}>{em}</button>)}
                      </div>
                    )}
                  </div>
                  <div className={`chat-actions${actionsFor === m.id ? ' show' : ''}`} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: -10, right: 10, display: 'flex', gap: 1, background: 'rgba(24,24,36,0.98)', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 10, padding: 3, backdropFilter: 'blur(8px)', zIndex: 6 }}>
                    <ActBtn title="Aggiungi reazione" onClick={() => setReactFor(reactFor === m.id ? null : m.id)}><Icon name="smile" /></ActBtn>
                    <ActBtn title="Rispondi nella conversazione" onClick={() => openThread(m)}><Icon name="reply" /></ActBtn>
                    <ActBtn title="Inoltra messaggio" onClick={() => setForwardMsg(m)}><Icon name="forward" /></ActBtn>
                    <ActBtn title={savedIds.includes(m.id) ? 'Rimuovi dai salvati' : 'Salva messaggio'} onClick={() => toggleSave(m)}><span style={{ color: savedIds.includes(m.id) ? '#7b5bff' : 'inherit' }}><Icon name="bookmark" /></span></ActBtn>
                    <div style={{ position: 'relative' }}>
                      <ActBtn title="Altre azioni" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}><Icon name="more" /></ActBtn>
                      {menuFor === m.id && (
                        <div style={{ position: 'absolute', top: 30, right: 0, ...PANEL, padding: 6, width: 240, zIndex: 30 }}>
                          <MenuItem onClick={() => { markUnread(m); setMenuFor(null) }}><Icon name="dot" size={12} style={{ marginRight: 8, color: '#3b82f6' }} />Contrassegna come non letto</MenuItem>
                          <MenuItem onClick={() => { copyText(m.body || ''); setMenuFor(null) }}><Icon name="clipboard" size={14} style={{ marginRight: 8 }} />Copia messaggio</MenuItem>
                          <MenuItem onClick={() => { copyText(`${typeof location !== 'undefined' ? location.origin : ''}/chat`); setMenuFor(null) }}><Icon name="link" size={14} style={{ marginRight: 8 }} />Copia collegamento</MenuItem>
                          <MenuItem onClick={() => { togglePin(m); setMenuFor(null) }}><Icon name="pin" size={14} style={{ marginRight: 8 }} />{m.pinned ? 'Rimuovi dai fissati' : 'Fissa sul canale'}</MenuItem>
                          {(mine || me?.isAdmin) && <MenuItem danger onClick={() => { deleteMessage(m.id); setMenuFor(null) }}><Icon name="trash" size={14} style={{ marginRight: 8 }} />Elimina messaggio</MenuItem>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </Fragment>
              )
            }) })()}
          </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {sharedFiles.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>Nessun file condiviso in questo canale.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sharedFiles.slice().reverse().map(m => {
                    const mem = memberMap[m.author_id]
                    const isImg = (/^image\//.test(m.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(m.file_name || ''))
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 10 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', fontSize: 18 }}>
                          {m.audio_url ? <Icon name="mic" size={18} /> : (isImg ? <img src={m.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="paperclip" size={16} />)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.audio_url ? 'Messaggio vocale' : (m.file_name || 'Allegato')}</div>
                          <div style={{ fontSize: 11.5, color: MUTED }}>{mem?.full_name || m.author_name || 'Utente'} · {new Date(m.created_at).toLocaleDateString('it-IT')}</div>
                        </div>
                        <a href={m.file_url || m.audio_url} target="_blank" rel="noopener" style={{ color: '#7b9cff', fontSize: 13, textDecoration: 'none' }}>Apri</a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Composer stile Slack */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(123,91,255,0.10)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 12.5 }}>
                <span style={{ color: MUTED }}>↩︎ Rispondi a <b style={{ color: '#fff' }}>{replyTo.author}</b>: {replyTo.excerpt.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            )}
            {recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(123,91,255,0.12)', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 12, padding: '8px 12px', marginBottom: 8 }}>
                <span style={{ color: '#ff5a7a', fontSize: 13, animation: 'pulse 1s infinite' }}>●</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flex: 1, height: 24, overflow: 'hidden' }}>
                  {Array.from({ length: 32 }).map((_, i) => <span key={i} style={{ width: 3, borderRadius: 2, background: '#7b9cff', height: 5 + ((i * 7 + recSeconds * 5) % 19) }} />)}
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13 }}>{Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')}</span>
                <button onClick={cancelRec} title="Annulla registrazione" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 18 }}>×</button>
                <button onClick={stopRec} title="Invia vocale" style={{ ...BTN, width: 40, padding: 0 }}>✓</button>
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
                <TB onClick={() => insertAtCursor('\n- ')} title="Elenco puntato"><Icon name="bullet" size={16} /></TB>
                <TB onClick={() => insertAtCursor('\n1. ')} title="Elenco numerato"><Icon name="number" size={16} /></TB>
                <TB onClick={openLink} title="Inserisci link"><Icon name="link" size={16} /></TB>
              </div>
              {/* Input con evidenziazione menzioni */}
              <div style={{ position: 'relative' }}>
                <div aria-hidden style={{ position: 'absolute', inset: 0, padding: '10px 12px', fontSize: 14, fontFamily: 'Barlow', lineHeight: 1.45, color: '#e7e7ef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden', pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: highlightComposer(text) }} />
                <textarea
                  ref={taRef}
                  rows={2}
                  value={text}
                  onChange={handleChange}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder={activeChannel ? `Messaggio ${activeChannel.is_dm ? `a ${channelLabel(activeChannel)}` : `in ${activeChannel.is_private ? '🔒' : '#'}${activeChannel.name}`}…` : 'Messaggio…'}
                  style={{ ...FIELD, position: 'relative', border: 'none', background: 'transparent', borderRadius: 0, minHeight: 44, padding: '10px 12px', fontSize: 14, fontFamily: 'Barlow', lineHeight: 1.45, color: 'transparent', caretColor: '#fff' }}
                />
              </div>
              {/* Bottom row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', position: 'relative' }}>
                <label className="tipwrap" style={{ position: 'relative', cursor: 'pointer', color: '#b9b9c8', width: 30, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={16} />
                  <Tip>Allega file</Tip>
                  <input type="file" hidden onChange={attachFile} accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt" />
                </label>
                <TB onClick={recording ? stopRec : startRec} title={recording ? 'Ferma e invia vocale' : 'Messaggio vocale'}><Icon name={recording ? 'stop' : 'mic'} size={16} /></TB>
                <TB onClick={() => { setEmojiOpen(o => !o); setMentionOpen(false) }} title="Emoji"><Icon name="smile" size={16} /></TB>
                <TB onClick={() => { setMentionOpen(o => !o); setEmojiOpen(false) }} title="Menziona"><Icon name="at" size={16} /></TB>
                <button onClick={send} style={{ ...BTN, marginLeft: 'auto', width: 38, padding: 0 }} title="Invia"><Icon name="send" size={16} /></button>

                {emojiOpen && (
                  <div style={{ position: 'absolute', bottom: 44, left: 8, ...PANEL, background: '#16161f', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.55)', padding: 8, width: 320, zIndex: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: MUTED }}>Emoji</span>
                      <button onClick={() => setEmojiOpen(false)} title="Chiudi" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
                      {EMOJIS.map(em => <button key={em} onClick={() => { insertAtCursor(em); setEmojiOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 4 }}>{em}</button>)}
                    </div>
                  </div>
                )}
                {mentionOpen && mentionList.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 44, left: 8, ...PANEL, padding: 6, width: 240, maxHeight: 240, overflowY: 'auto', zIndex: 10 }}>
                    {mentionList.map(mem => (
                      <div key={mem.id} onClick={() => pickMention(mem)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#c9c9d6' }}>
                        <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={22} online={mem.isAgent ? true : isOnline(mem)} />
                        <span>{mem.full_name || mem.email}{mem.role ? <span style={{ color: MUTED, fontSize: 11.5 }}> · {mem.role}</span> : null}{mem.isAgent ? <span style={{ color: '#a78bfa', fontSize: 10, marginLeft: 4 }}>AI</span> : null}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {threadRoot && (
          <div style={{ ...PANEL, width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontFamily: 'Barlow Condensed', fontSize: 17 }}>Conversazione</span>
              <button onClick={() => setThreadRoot(null)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {miniMsg(threadRoot)}
              <div style={{ fontSize: 12, color: MUTED, margin: '6px 0 8px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: 8 }}>{threadMsgs.length} rispost{threadMsgs.length === 1 ? 'a' : 'e'}</div>
              {threadMsgs.map(miniMsg)}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <input style={FIELD} placeholder="Rispondi…" value={threadText} onChange={e => setThreadText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThread() } }} />
              <button onClick={sendThread} style={{ ...BTN, width: 40, padding: 0 }}><Icon name="send" size={16} /></button>
            </div>
          </div>
        )}
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

      {linkOpen && (
        <div onClick={() => setLinkOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px', fontFamily: 'Barlow' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(440px,100%)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 21, fontWeight: 700 }}>Aggiungi collegamento</h3>
              <button onClick={() => setLinkOpen(false)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <label style={{ fontSize: 12, color: MUTED }}>Testo</label>
            <input autoFocus style={{ ...FIELD, marginTop: 4, marginBottom: 12 }} value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="Testo del link" />
            <label style={{ fontSize: 12, color: MUTED }}>Collegamento</label>
            <input style={{ ...FIELD, marginTop: 4 }} value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" onKeyDown={e => { if (e.key === 'Enter') saveLink() }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setLinkOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 10, padding: '9px 14px', color: '#fff', cursor: 'pointer', fontFamily: 'Barlow' }}>Annulla</button>
              <button onClick={saveLink} style={{ ...BTN }}>Salva</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.chat-row{cursor:pointer} .chat-row:hover{background:rgba(255,255,255,0.04)} .chat-actions{opacity:0;transition:opacity .12s} .chat-row:hover .chat-actions{opacity:1} .chat-actions.show{opacity:1} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}} .tipwrap .tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#14141d;border:1px solid var(--border,rgba(255,255,255,0.16));color:#fff;font-size:11px;font-weight:600;padding:4px 8px;border-radius:7px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.4)} .tipwrap:hover .tip{opacity:1} .tipwrap .tip.tip-right{bottom:auto;top:50%;left:calc(100% + 10px);transform:translateY(-50%)}`}</style>
      {groupCall && active && (
        <GroupCall room={`channel-${active}`} channelId={active} title="Call di gruppo" agents={SQUAD_AGENTS} onClose={() => setGroupCall(false)} />
      )}
    </div>
  )
}

function Tip({ children, right }) {
  return children ? <span className={right ? 'tip tip-right' : 'tip'}>{children}</span> : null
}

function ActBtn({ onClick, title, children }) {
  return <button type="button" onClick={onClick} className="tipwrap" style={{ position: 'relative', background: 'none', border: 'none', color: '#c2c2d0', cursor: 'pointer', width: 30, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#fff' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#c2c2d0' }}>{children}<Tip>{title}</Tip></button>
}

function HBtn({ onClick, title, children }) {
  return <button type="button" onClick={onClick} className="tipwrap" style={{ position: 'relative', background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 9, width: 34, height: 32, color: '#dcdce6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(123,91,255,0.5)' }} onMouseLeave={e => { e.currentTarget.style.color = '#dcdce6'; e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.12))' }}>{children}<Tip>{title}</Tip></button>
}

function TB({ onClick, title, children }) {
  return <button type="button" onClick={onClick} className="tipwrap" style={{ position: 'relative', background: 'none', border: 'none', color: '#b9b9c8', cursor: 'pointer', fontSize: 13, fontFamily: 'ui-monospace,monospace', width: 30, height: 28, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#b9b9c8' }}>{children}<Tip>{title}</Tip></button>
}

function MenuItem({ onClick, danger, children }) {
  return <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: danger ? '#ff5a7a' : '#e7e7ef', cursor: 'pointer', fontSize: 13.5, fontFamily: 'Barlow', padding: '8px 10px', borderRadius: 8 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>{children}</button>
}

function RailBtn({ active, onClick, title, badge, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={title} style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : 'rgba(255,255,255,0.05)', color: active ? '#fff' : '#b9b9c8' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}>
      {children}
      {badge > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#ff375f', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge > 9 ? '9+' : badge}</span>}
    </button>
  )
}

function Icon({ name, size = 17, style }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', style: { verticalAlign: 'middle', flex: 'none', ...style } }
  switch (name) {
    case 'smile': return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9.5" x2="9.01" y2="9.5" /><line x1="15" y1="9.5" x2="15.01" y2="9.5" /></svg>
    case 'reply': return <svg {...p}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-3.5A8.5 8.5 0 1 1 21 11.5z" /></svg>
    case 'forward': return <svg {...p}><polyline points="15 17 20 12 15 7" /><path d="M4 18v-2a4 4 0 0 1 4-4h12" /></svg>
    case 'bookmark': return <svg {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
    case 'more': return <svg {...p}><circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="12" cy="19" r="1.3" /></svg>
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    case 'bell': return <svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
    case 'bellOff': return <svg {...p}><path d="M13.7 21a2 2 0 0 1-3.4 0" /><path d="M18 8a6 6 0 0 0-9.3-5" /><path d="M6 8c0 7-3 9-3 9h13" /><line x1="3" y1="3" x2="21" y2="21" /></svg>
    case 'headset': return <svg {...p}><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="2" y="14" width="4" height="6" rx="1.5" /><rect x="18" y="14" width="4" height="6" rx="1.5" /></svg>
    case 'users': return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'mic': return <svg {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
    case 'stop': return <svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
    case 'plus': return <svg {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
    case 'at': return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9" /></svg>
    case 'send': return <svg {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
    case 'link': return <svg {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
    case 'bullet': return <svg {...p}><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1.1" /><circle cx="4.5" cy="12" r="1.1" /><circle cx="4.5" cy="18" r="1.1" /></svg>
    case 'number': return <svg {...p}><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 6h1.2v4" /><path d="M3.6 10h2" /></svg>
    case 'play': return <svg {...p} fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4" /></svg>
    case 'pause': return <svg {...p} fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
    case 'hash': return <svg {...p}><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
    case 'dm': return <svg {...p}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-3.5A8.5 8.5 0 1 1 21 11.5z" /><line x1="8" y1="11" x2="8.01" y2="11" /><line x1="12" y1="11" x2="12.01" y2="11" /><line x1="16" y1="11" x2="16.01" y2="11" /></svg>
    case 'inbox': return <svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
    case 'folder': return <svg {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
    case 'paperclip': return <svg {...p}><path d="M19 11.5 12 18.5a4.5 4.5 0 0 1-6.5-6.5l7-7a3 3 0 0 1 4.5 4.5l-7 7a1.5 1.5 0 0 1-2.2-2.2l6.2-6.2" /></svg>
    case 'lock': return <svg {...p}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
    case 'pin': return <svg {...p}><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" /><line x1="12" y1="14" x2="12" y2="21" /></svg>
    case 'chat': return <svg {...p}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-3.5A8.5 8.5 0 1 1 21 11.5z" /></svg>
    case 'trash': return <svg {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 14h10l1-14" /></svg>
    case 'clipboard': return <svg {...p}><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="8.5" y1="11" x2="15.5" y2="11" /><line x1="8.5" y1="15" x2="13.5" y2="15" /></svg>
    case 'dot': return <svg {...p} fill="currentColor" stroke="none"><circle cx="12" cy="12" r="5" /></svg>
    default: return null
  }
}

function AudioMsg({ src }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`
  const pct = dur ? (cur / dur) * 100 : 0
  function toggle() { const a = ref.current; if (!a) return; if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) } }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, padding: '7px 12px 7px 7px', background: 'rgba(123,91,255,0.10)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 999, maxWidth: 300 }}>
      <audio ref={ref} src={src} preload="metadata" onTimeUpdate={e => setCur(e.target.currentTime)} onLoadedMetadata={e => setDur(e.target.duration || 0)} onEnded={() => { setPlaying(false); setCur(0) }} style={{ display: 'none' }} />
      <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={playing ? 'pause' : 'play'} size={15} /></button>
      <div onClick={e => { const a = ref.current; if (!a || !dur) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - r.left) / r.width) * dur }} style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.16)', cursor: 'pointer', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'linear-gradient(90deg,#7b5bff,#5b8bff)', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11.5, color: '#b9b9c8', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(cur)} / {fmt(dur)}</span>
    </div>
  )
}

function activeName(ch) { return ch?.name }
