'use client'

import { avvisa } from '../../lib/client/avviso'
import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Avatar from './Avatar'
import ProfiloPopup from './ProfiloPopup'
import { NewChannelDialog, ChannelMembersDialog } from './ChatDialogs'
import { renderMarkdown } from './chatMarkdown'
// La call 1:1 con un agente della Squadra AI: qui il prodotto e' multi-cliente
// e gli agenti fanno parte della chat, quindi il componente resta montato.
import AgentCall from './AgentCall'
import Avvisi from './ui/Avvisi'
import { useI18n } from '../../lib/i18n/I18nProvider'

const SQUAD_AGENTS = [
  { id: 'ceo', name: 'Chiara', role: 'CEO', color: 'var(--accent)', emoji: '👑', avatar: null },
  { id: 'cfo', name: 'Marco', role: 'CFO', color: '#22c55e', emoji: '📊', avatar: null },
  { id: 'cmo', name: 'Luigi', role: 'CMO', color: '#2997ff', emoji: '🎯', avatar: null },
  { id: 'ads', name: 'Sofia', role: 'Advertising Specialist', color: '#ef4444', emoji: '🚀', avatar: null },
  { id: 'seo', name: 'Davide', role: 'SEO Specialist', color: '#ffd60a', emoji: '🔍', avatar: null },
  { id: 'cro', name: 'Giulia', role: 'CRO Specialist', color: 'var(--accent)', emoji: '🧪', avatar: null },
  { id: 'data', name: 'Alessandro', role: 'Data Analyst', color: 'var(--text)', emoji: '📈', avatar: null },
  { id: 'creative', name: 'Valentina', role: 'Creative Strategist', color: '#f59e0b', emoji: '🎨', avatar: null },
]

// Estetica minimale/futuristica, coerente col resto del software (glass + var CSS).
const PANEL = { background: 'var(--glass, rgba(18,18,28,0.55))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 16, backdropFilter: 'blur(14px)' }
const FIELD = { background: 'var(--surface, rgba(10,10,18,0.55))', border: '1px solid var(--border, rgba(255,255,255,0.10))', borderRadius: 12, padding: '10px 12px', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', width: '100%', outline: 'none', resize: 'none' }
const BTN = { background: 'var(--btn-primario)', border: 'none', borderRadius: 12, padding: '0 16px', height: 38, color: 'var(--btn-primario-testo)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const MUTED = '#8c8c8c'
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
// Le tre che stanno DIRETTAMENTE nella barra al passaggio del mouse, come in
// Slack: la reazione piu' comune deve costare un clic, non tre.
const REAZIONI_AL_VOLO = ['✅', '👀', '🙌']

function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function highlightComposer(text) {
  return escHtml(text).replace(/(^|\s)(@[\p{L}\w.\-]+)/gu, '$1<span style="color:#7b9cff;font-weight:600">$2</span>').replace(/\n/g, '<br>')
}

// `initialChannelId` apre direttamente un canale (la tab Chat di un progetto
// apre il canale di quel progetto); `hideSidebar` toglie l'elenco canali,
// perché lì il canale è uno solo e sceglierne un altro non avrebbe senso.
export default function ChatTab({ standalone = false, initialChannelId = null, hideSidebar = false }) {
  const { t: tr, intlLocale } = useI18n()
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
  const [sendError, setSendError] = useState('')
  const [agentTyping, setAgentTyping] = useState(false)
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
  const [squadPicker, setSquadPicker] = useState(false) // popup scelta agente per la call
  const [callAgent, setCallAgent] = useState(null)       // agente selezionato → avvia AgentCall
  const [savedIds, setSavedIds] = useState([])
  const [caret, setCaret] = useState(0)          // dove si sta scrivendo
  const [thCaret, setThCaret] = useState(0)      // idem, nella conversazione a lato
  const thRef = useRef(null)
  const [showFmt, setShowFmt] = useState(true)   // barra di formattazione a vista
  const [msgMenu, setMsgMenu] = useState(null)   // menu del destro su un messaggio
  const [chanMenu, setChanMenu] = useState(null) // menu del destro su una conversazione
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
  // Senza questa chiamata gli agenti non compaiono da nessuna parte: niente foto
  // sui loro messaggi, niente voce nel menu @, niente elenco "Squadra AI".
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
      if (d.channels && d.channels.length) setActive(prev => prev || initialChannelId || (d.channels.find(c => !c.is_dm)?.id || d.channels[0].id))
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
    } else if (!r.ok) {
      // Invio fallito: prima il testo spariva senza dire nulla
      setText(body)
      setSendError(r.error || tr('chat.sendFailed', null, 'Messaggio non inviato. Riprova.'))
      return
    }
    setSendError('')
    // Risposta degli agenti del team AI:
    //  - se il messaggio NOMINA un agente, oppure
    //  - se l'ULTIMO a parlare nel canale era un agente (continua la conversazione
    //    senza dover richiamare il nome ogni volta).
    // I messaggi degli agenti hanno author_id null.
    // Trigger agenti: SOLO menzione esplicita con @ (i nomi propri da soli
    // facevano irrompere l'AI nelle conversazioni tra colleghi umani) oppure
    // continuazione entro 3 minuti da una risposta dell'agente.
    const prevMsg = messages[messages.length - 1]
    const recentAgent = !!(prevMsg && !prevMsg.author_id &&
      (Date.now() - new Date(prevMsg.created_at).getTime()) < 3 * 60000)
    const mentionsAgent = /@\s*(chiara|marco|luigi|sofia|davide|giulia|alessandro|valentina)\b/i.test(body)
    if (mentionsAgent || recentAgent) {
      let locale = null
      try { locale = localStorage.getItem('lyft_lang') } catch {}
      setAgentTyping(true)
      fetch('/api/team/channel-reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: active, locale }),
      })
        .then(x => x.json()).catch(() => ({}))
        .then(j => {
          // La risposta CONTIENE già i messaggi dell'agente: dipingerli subito
          // invece di aspettare il poll (prima il canale restava immobile).
          const list = Array.isArray(j?.messages) ? j.messages : (j?.message ? [j.message] : [])
          const fresh = list.filter(m => m?.id && !seenRef.current.has(m.id))
          if (fresh.length) {
            fresh.forEach(m => seenRef.current.add(m.id))
            lastAtRef.current = fresh[fresh.length - 1].created_at || lastAtRef.current
            setMessages(prev => [...prev, ...fresh]); scrollBottom()
          }
        })
        .finally(() => setAgentTyping(false))
    }
  }

  function reloadMembers() { fetch('/api/team-members', { cache: 'no-store' }).then(r => r.json()).then(d => setMembers(d.members || [])).catch(() => {}) }

  // Elimina un canale (non quelli di progetto: quelli muoiono col progetto).
  async function deleteChannel(c) {
    if (!confirm(tr('ch.deleteConfirm', { name: c.name }, `Eliminare il canale "${c.name}"? I messaggi non si recuperano.`))) return
    const r = await fetch(`/api/channels?id=${c.id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ ok: false }))
    if (!r?.ok) { avvisa(r?.error || tr('ch.deleteFailed', null, 'Eliminazione non riuscita.'), 'errore'); return }
    setChannels(prev => prev.filter(x => x.id !== c.id))
    if (active === c.id) setActive(null)
  }

  async function createChannel({ name, is_private, member_ids, externals }) {
    const r = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, is_private, member_ids }) }).then(x => x.json())
    if (!r.ok || !r.channel) { avvisa(r.error || tr('ch.errCreateChannel', null, 'Channel creation error'), 'errore'); return }
    setChannels(prev => prev.some(c => c.id === r.channel.id) ? prev : [...prev, r.channel])
    setActive(r.channel.id); setShowNewChannel(false)
    if (externals && externals.length) {
      const pwds = []
      for (const email of externals) {
        const inv = await fetch('/api/chat-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, channel_id: r.channel.id }) }).then(x => x.json()).catch(() => ({}))
        if (inv.ok && inv.tempPassword) pwds.push(`${email}: ${inv.tempPassword}`)
      }
      reloadMembers()
      if (pwds.length) alert(tr('ch.externalInvitesCreated', null, 'External invites created (temporary password, share it):') + '\n\n' + pwds.join('\n'))
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
      alert(inv.emailSent ? tr('ch.inviteSentTo', { email }, 'Invite sent to {email}') : tr('ch.accountCreatedFor', { email, password: inv.tempPassword || '—' }, 'Account created for {email}. Temporary password: {password}'))
    } else avvisa(inv.error || tr('ch.errInvite', null, 'Invite error'), 'errore')
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
    } else if (!r.ok) {
      // Invio fallito: qui NON si ripristina il composer (payload può essere un
      // allegato/vocale, non il testo digitato): solo il banner d'errore.
      setSendError(r.error || tr('chat.sendFailed', null, 'Messaggio non inviato. Riprova.'))
      return r
    }
    setSendError('')
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
        if (up.ok && up.url) await pushMessage({ channel_id: active, body: '🎤 ' + tr('ch.voiceMessage', null, 'Voice message'), audio_url: up.url })
        else avvisa(tr('ch.audioUploadFailed', null, 'Audio upload failed'), 'errore')
      }
      recRef.current = mr; mr.start(); setRecording(true); setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch { avvisa(tr('ch.micUnavailable', null, 'Microphone unavailable or permission denied'), 'errore') }
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
    else avvisa(up.error || 'Upload fallito', 'errore')
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
    pushMessage({ channel_id: active, body: tr('ch.meetingStarted', { url }, '📹 Meeting started — join: {url}') })
  }

  async function toggleReaction(id, emoji) {
    setReactFor(null)
    const r = await fetch('/api/channel-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, emoji }) }).then(x => x.json()).catch(() => ({}))
    if (r.ok && r.message) updateMsg(r.message)
  }
  async function deleteMessage(id) {
    if (!confirm(tr('ch.confirmDeleteMsg', null, 'Delete the message?'))) return
    setMessages(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/channel-messages?id=${id}`, { method: 'DELETE' })
  }
  async function forwardTo(member, msg) {
    setForwardMsg(null)
    const r = await fetch('/api/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dm: true, target_id: member.id }) }).then(x => x.json()).catch(() => ({}))
    if (!r.ok || !r.channel) { avvisa(tr('ch.error', null, 'Error'), 'errore'); return }
    setChannels(prev => prev.some(c => c.id === r.channel.id) ? prev : [...prev, r.channel])
    const body = `↪︎ ${tr('ch.forwardedPrefix', null, 'Forwarded')}:\n${msg.body || (msg.audio_url ? '🎤 ' + tr('ch.voiceMessage', null, 'Voice message') : '')}`
    await fetch('/api/channel-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: r.channel.id, body, audio_url: msg.audio_url || null }) })
    setActive(r.channel.id)
  }

  // composer helpers
  // Due caselle di scrittura (il canale e la conversazione a lato) e un solo
  // motore di formattazione: duplicarlo vorrebbe dire correggere ogni baco due
  // volte, e prima o poi una delle due resta indietro.
  const fmt = useMemo(() => ({ ...creaFormattatore(taRef, text, setText, setCaret), link: openLink }), [text, openLink])
  const fmtTh = useMemo(() => creaFormattatore(thRef, threadText, setThreadText, setThCaret), [threadText])

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
    if (!url) { avvisa(tr('ch.enterLink', null, 'Enter the link'), 'errore'); return }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    const label = linkText.trim() || url
    const { s, e } = linkSelRef.current
    setText(text.slice(0, s) + `[${label}](${url})` + text.slice(e))
    setLinkOpen(false); setLinkText(''); setLinkUrl('')
  }

  const memberMap = useMemo(() => { const m = {}; members.forEach(x => { m[x.id] = x }); return m }, [members])
  const isOnline = (mem) => !!(mem?.last_seen_at && (Date.now() - new Date(mem.last_seen_at).getTime() < 70000))
  const dmOther = (ch) => { const parts = String(ch.name || '').replace(/^dm_/, '').split('_'); const id = parts.find(p => p !== me?.memberId) || parts[0]; return memberMap[id] }
  const channelLabel = (ch) => ch?.is_dm ? (dmOther(ch)?.full_name || dmOther(ch)?.email || tr('ch.direct', null, 'Direct')) : ch?.name

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
  // "Letta" qui e' un orario tenuto in locale: segnarla letta vuol dire
  // portarlo all'ultimo messaggio. Un forzatura dello stato fa ridisegnare
  // l'elenco, che altrimenti resterebbe col pallino acceso.
  const markChannelRead = (ch) => {
    const last = lastAt[ch.id]
    try { localStorage.setItem('chread_' + ch.id, last || new Date().toISOString()) } catch {}
    setLastAt(prev => ({ ...prev }))
  }

  const miniMsg = (m) => {
    const mem = memberMap[m.author_id]
    return (
      <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0' }}>
        <Avatar name={mem?.full_name || m.author_name} url={mem?.avatar_url || agentAvatars[m.author_name]} size={30} online={mem ? isOnline(mem) : undefined} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, color: MUTED }}><b style={{ color: 'var(--text)' }}>{mem?.full_name || m.author_name || tr('ch.user', null, 'User')}</b> · {new Date(m.created_at).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          {m.body && <div className="ch-corpo" style={{ fontSize: 15, color: '#e8e8e8', lineHeight: 1.5, wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }} />}
          {m.audio_url && <AudioMsg src={m.audio_url} />}
          {m.file_url && ((/^image\//.test(m.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(m.file_name || ''))
            ? <a href={m.file_url} target="_blank" rel="noopener"><img src={m.file_url} alt="" style={{ marginTop: 6, maxWidth: 240, borderRadius: 8, display: 'block' }} /></a>
            : <a href={m.file_url} target="_blank" rel="noopener" style={{ marginTop: 6, display: 'inline-block', color: '#7b9cff', fontSize: 13 }}><Icon name="paperclip" size={14} /> {m.file_name || tr('ch.attachment', null, 'Attachment')}</a>)}
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ padding: 40, color: MUTED, fontFamily: 'inherit' }}>{tr('ch.loadingChat', null, 'Loading chat…')}</div>

  const itemStyle = (on) => ({ padding: '7px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 15, fontWeight: on ? 700 : 500, color: on ? 'var(--text)' : '#cacaca', background: on ? 'var(--neutro-bg)' : 'transparent', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 })

  return (
    <div className="chat-workspace" style={{ fontFamily: 'inherit', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 16px', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="tipwrap" style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button onClick={winClose} title={tr('ch.winClose', null, 'Close')} style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--border3)' }} />
            <button onClick={winMin} title={tr('ch.winMin', null, 'Minimize (exit full screen)')} style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--border3)' }} />
            <button onClick={winFull} title={tr('ch.winFull', null, 'Full screen')} style={{ width: 13, height: 13, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--border3)' }} />
          </div>
          <h2 style={{ margin: 0, fontFamily: 'inherit', fontSize: 20, fontWeight: 600, letterSpacing: '.01em', display: 'flex', alignItems: 'center', gap: 9 }}><img src="/chat-192.png" alt="LyftTalk" style={{ width: 28, height: 28, borderRadius: 8 }} /> LyftTalk</h2>
        </div>
        {!standalone && <a href="/chat" target="_blank" rel="noopener" style={{ ...BTN, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontSize: 13 }}>↗ {tr('ch.openAsApp', null, 'Open as app')}</a>}
      </div>

      <div className="m-chat" style={{ display: 'flex', gap: 14, alignItems: 'stretch', height: standalone ? 'calc(100dvh - 110px)' : '70vh' }}>
        {/* Rail icone (a colonne) */}
        <div className="m-chatrail" style={{ ...PANEL, width: 60, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0' }}>
          <RailBtn active={rail === 'home'} onClick={() => selectRail('home')} title={tr('ch.allChannels', null, 'All channels')}><Icon name="hash" size={20} /></RailBtn>
          <RailBtn active={rail === 'dms'} onClick={() => selectRail('dms')} title={tr('ch.directMessages', null, 'Direct messages')}><Icon name="dm" size={20} /></RailBtn>
          <RailBtn active={rail === 'unread'} onClick={() => selectRail('unread')} title={tr('ch.unread', null, 'Unread')} badge={unreadList.length}><Icon name="inbox" size={20} /></RailBtn>
          <RailBtn active={rail === 'files'} onClick={() => selectRail('files')} title={tr('ch.sharedFiles', null, 'Shared files')}><Icon name="folder" size={20} /></RailBtn>
        </div>
        {/* Sidebar */}
        <aside className="m-chanlist" style={{ ...PANEL, display: hideSidebar ? 'none' : 'flex', width: 248, flexShrink: 0, padding: 10, flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {rail === 'home' && (<>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>{tr('ch.channels', null, 'Channels')}</div>
              {groupChannels.map(c => (
                <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)} className="ch-row"
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMsgMenu(null); setChanMenu({ x: e.clientX, y: e.clientY, c, label: c.name }) }}>
                  <span style={{ opacity: 0.6, display: 'inline-flex' }}>{c.is_private ? <Icon name="lock" size={12} /> : '#'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: channelUnread(c) ? 800 : (active === c.id ? 700 : 500), color: channelUnread(c) ? 'var(--text)' : undefined }}>{c.name}</span>
                  {channelUnread(c) && <span style={{ width: 8, height: 8, borderRadius: 6, background: 'var(--accent)' }} />}
                  {!c.project_id && (
                    <span className="ch-del" role="button" title={tr('ch.delete', null, 'Elimina canale')}
                      onClick={(e) => { e.stopPropagation(); deleteChannel(c) }}
                      style={{ display: 'inline-flex', color: '#f87171', opacity: 0, transition: 'opacity .12s' }}>
                      <Icon name="trash" size={12} />
                    </span>
                  )}
                </div>
              ))}
              <button style={{ background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 12, padding: '7px', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', width: '100%', marginTop: 6 }} onClick={() => setShowNewChannel(true)}>+ {tr('ch.newChannel', null, 'New channel')}</button>
              {dmChannels.length > 0 && <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>{tr('ch.directMessages', null, 'Direct messages')}</div>}
              {dmChannels.map(c => { const o = dmOther(c); return (
                <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMsgMenu(null); setChanMenu({ x: e.clientX, y: e.clientY, c, label: o?.full_name || o?.email || tr('ch.direct', null, 'Direct') }) }}>
                  <Avatar name={o?.full_name || o?.email} url={o?.avatar_url} size={22} online={o ? isOnline(o) : undefined} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: channelUnread(c) ? 800 : undefined }}>{o?.full_name || o?.email || tr('ch.direct', null, 'Direct')}</span>
                  {channelUnread(c) && <span style={{ width: 8, height: 8, borderRadius: 6, background: 'var(--accent)' }} />}
                </div>
              ) })}
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>{tr('ch.peopleOnline', { count: members.filter(isOnline).length }, 'People · {count} online')}</div>
              {members.filter(m => m.id !== me?.memberId).map(mem => (
                <div key={mem.id} onClick={() => openDM(mem)} title={mem.bio ? `${mem.full_name || mem.email} — ${mem.bio}` : tr('ch.directMessage', null, 'Direct message')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 12, cursor: 'pointer' }}>
                  <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={26} online={isOnline(mem)} />
                  {/* Il soprannome scelto nel profilo vale anche per i colleghi; "chi sei" esce passandoci sopra. */}
                  <span style={{ fontSize: 13, color: '#cacaca', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.nickname || mem.full_name || mem.email}{(mem.roles || []).includes('guest') ? ` · ${tr('ch.guest', null, 'guest')}` : ''}</span>
                </div>
              ))}
              {agentMembers.length > 0 && (<>
                <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>{tr('ch.teamAI', { count: agentMembers.length }, 'AI Team · {count}')}</div>
                {agentMembers.map(a => (
                  <div key={a.id} title={tr('ch.mentionWith', { name: a.full_name }, 'Mention with @{name}')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 12 }}>
                    <Avatar name={a.full_name} url={a.avatar_url} size={26} online={true} />
                    <span style={{ fontSize: 13, color: '#cacaca', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.full_name} <span style={{ color: MUTED, fontSize: 11.5 }}>· {a.role}</span> <span style={{ color: '#a78bfa', fontSize: 10 }}>AI</span></span>
                  </div>
                ))}
              </>)}
            </>)}

            {rail === 'dms' && (<>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>{tr('ch.directMessages', null, 'Direct messages')}</div>
              {dmChannels.map(c => { const o = dmOther(c); return (
                <div key={c.id} onClick={() => setActive(c.id)} style={itemStyle(active === c.id)}>
                  <Avatar name={o?.full_name || o?.email} url={o?.avatar_url} size={22} online={o ? isOnline(o) : undefined} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o?.full_name || o?.email || tr('ch.direct', null, 'Direct')}</span>
                  {channelUnread(c) && <span style={{ width: 8, height: 8, borderRadius: 6, background: 'var(--accent)' }} />}
                </div>
              ) })}
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '16px 8px 6px' }}>{tr('ch.startConversation', null, 'Start a conversation')}</div>
              {members.filter(m => m.id !== me?.memberId).map(mem => (
                <div key={mem.id} onClick={() => openDM(mem)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 12, cursor: 'pointer' }}>
                  <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={26} online={isOnline(mem)} />
                  <span style={{ fontSize: 13, color: '#cacaca', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.full_name || mem.email}</span>
                </div>
              ))}
            </>)}

            {rail === 'unread' && (<>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>{tr('ch.unread', null, 'Unread')} · {unreadList.length}</div>
              {unreadList.length === 0 ? <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>{tr('ch.allRead', null, 'All read 🎉')}</div> : unreadList.map(c => { const o = c.is_dm ? dmOther(c) : null; return (
                <div key={c.id} onClick={() => { setActive(c.id); setRail('home') }} style={itemStyle(false)}>
                  {c.is_dm ? <Avatar name={o?.full_name || o?.email} url={o?.avatar_url} size={22} online={o ? isOnline(o) : undefined} /> : <span style={{ opacity: 0.6, display: 'inline-flex' }}>{c.is_private ? <Icon name="lock" size={12} /> : '#'}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 640, color: 'var(--text)' }}>{c.is_dm ? (o?.full_name || o?.email || tr('ch.direct', null, 'Direct')) : c.name}</span>
                  <span style={{ width: 8, height: 8, borderRadius: 6, background: 'var(--accent)' }} />
                </div>
              ) })}
            </>)}

            {rail === 'files' && (<>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '.12em', padding: '6px 8px' }}>{tr('ch.sharedFiles', null, 'Shared files')}</div>
              {allFiles.length === 0 ? <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>{tr('ch.noFiles', null, 'No files.')}</div> : allFiles.map(f => {
                const isImg = (/^image\//.test(f.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(f.file_name || ''))
                return (
                  <a key={f.id} href={f.file_url || f.audio_url} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 12, textDecoration: 'none', color: 'var(--text)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass)', fontSize: 15 }}>{f.audio_url ? <Icon name="mic" size={16} /> : (isImg ? <img src={f.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="paperclip" size={16} />)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.audio_url ? tr('ch.voice', null, 'Voice') : (f.file_name || tr('ch.attachment', null, 'Attachment'))}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>#{f.channel_name} · {f.author_name || ''}</div>
                    </div>
                  </a>
                )
              })}
            </>)}
          </div>

          <div onClick={() => setShowProfile(true)} title={tr('ch.editProfile', null, 'Edit profile')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderTop: '1px solid var(--border, rgba(255,255,255,0.08))', marginTop: 8, cursor: 'pointer' }}>
            <Avatar name={profile?.full_name || profile?.email} url={profile?.avatar_url} size={32} online />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || tr('ch.myProfile', null, 'My profile')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--accent)' }}>{tr('ch.editProfile', null, 'Edit profile')}</div>
            </div>
          </div>
        </aside>

        {/* Conversazione */}
        <div className="chat-conversation" style={{ ...PANEL, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontFamily: 'inherit', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeChannel?.is_dm
                  ? <><Avatar name={channelLabel(activeChannel)} url={dmOther(activeChannel)?.avatar_url} size={24} online={isOnline(dmOther(activeChannel))} /> {channelLabel(activeChannel)}</>
                  : (active ? <>{activeChannel?.is_private ? <Icon name="lock" size={13} /> : '#'} {activeName(activeChannel)}</> : tr('ch.selectConversation', null, 'Select a conversation'))}
              </span>
              {active && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['messages', tr('ch.messages', null, 'Messages')], ['files', tr('ch.files', null, 'Files')]].map(([v, l]) => (
                    <button key={v} onClick={() => setChannelView(v)} style={{ background: channelView === v ? 'var(--neutro-bg)' : 'transparent', border: 'none', borderRadius: 8, padding: '5px 10px', color: channelView === v ? 'var(--text)' : MUTED, cursor: 'pointer', fontSize: 13, fontWeight: channelView === v ? 700 : 500, fontFamily: 'inherit' }}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            {active && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <HBtn onClick={() => setSearchOpen(o => !o)} title={tr('ch.searchChannel', null, 'Search in channel')}><Icon name="search" size={16} /></HBtn>
                <HBtn onClick={toggleMute} title={muted ? tr('ch.notifOff', null, 'Notifications off · turn on') : tr('ch.notifOn', null, 'Notifications on · turn off')}><Icon name={muted ? 'bellOff' : 'bell'} size={16} /></HBtn>
                <div style={{ position: 'relative' }}>
                  <HBtn onClick={() => setCallMenu(o => !o)} title={tr('ch.meetingMenu', null, 'Meeting: start or copy link')}><Icon name="headset" size={16} /></HBtn>
                  {callMenu && (
                    <div style={{ position: 'absolute', top: 38, right: 0, ...PANEL, background: 'rgba(16,16,24,0.98)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', padding: 6, width: 240, zIndex: 30 }}>
                      <MenuItem onClick={() => { startCall(); setCallMenu(false) }}><Icon name="headset" size={14} style={{ marginRight: 8 }} />{tr('ch.startMeeting', null, 'Start meeting')}</MenuItem>
                      <MenuItem onClick={() => { copyMeetLink(); setCallMenu(false) }}><Icon name="link" size={14} style={{ marginRight: 8 }} />{tr('ch.copyMeetingLink', null, 'Copy meeting link')}</MenuItem>
                    </div>
                  )}
                </div>
                {!activeChannel?.is_dm && <HBtn onClick={() => openManage(activeChannel.id)} title={tr('ch.membersAdd', null, 'Members · add people')}><Icon name="users" size={16} /></HBtn>}
                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setSquadPicker(o => !o)} title={tr('ch.callSquadTitle', null, 'Call an AI Squad agent')}
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--neutro-bg)', border: '1px solid rgba(124,92,255,0.4)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}><Icon name="phone" size={14} />{tr('ch.squadAI', null, 'AI Squad')}</button>
                  {squadPicker && (
                    <>
                      <div onClick={() => setSquadPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div style={{ position: 'absolute', top: 40, right: 0, ...PANEL, background: 'rgba(16,16,24,0.98)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', padding: 8, width: 290, maxHeight: 380, overflowY: 'auto', zIndex: 41 }}>
                        <div style={{ padding: '6px 8px 8px' }}>
                          <div style={{ color: 'var(--text)', fontWeight: 640, fontSize: 13 }}>{tr('ch.callSquad', null, 'Call the AI Squad')}</div>
                          <div style={{ color: MUTED, fontSize: 11.5, marginTop: 2 }}>{tr('ch.chooseAgent', null, 'Choose an agent. The call is 1:1, one agent at a time.')}</div>
                        </div>
                        {SQUAD_AGENTS.map(a => (
                          <button key={a.id} type="button"
                            onClick={() => { setCallAgent(a); setSquadPicker(false) }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px', background: 'transparent', border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {/* Bordo neutro: le tinte degli agenti ora sono var()
                                e "var(--accent)55" non e' un colore valido — il
                                cerchio spariva senza dire niente. */}
                            <Avatar name={a.name} url={a.avatar} size={34} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                              <span style={{ display: 'block', color: MUTED, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.role}</span>
                            </span>
                            <Icon name="phone" size={15} style={{ marginLeft: 'auto', color: a.color }} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          {searchOpen && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <input autoFocus style={FIELD} placeholder={tr('ch.searchPlaceholder', null, 'Search the channel messages…')} value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            </div>
          )}

          {channelView === 'messages' ? (
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {shownMessages.length === 0 && <div style={{ color: MUTED, fontSize: 13, padding: 12 }}>{searchQ ? tr('ch.noResults', null, 'No results.') : tr('ch.noMessages', null, 'No messages. Write the first one!')}</div>}
            {(() => { let prevDay = null; return shownMessages.map(m => {
              const mem = memberMap[m.author_id]
              const mine = me?.memberId && m.author_id === me.memberId
              const reactions = (m.reactions && typeof m.reactions === 'object') ? m.reactions : {}
              const day = new Date(m.created_at).toDateString()
              const showDay = day !== prevDay; prevDay = day
              const dayLabel = new Date(m.created_at).toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long' })
              return (
                <Fragment key={m.id}>
                {showDay && <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}><span className="ch-giorno" style={{ fontSize: 13, color: 'var(--text2)', background: 'var(--surface2, var(--glass))', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 999, padding: '3px 14px', fontWeight: 600 }}>{dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}</span></div>}
                {firstUnreadId === m.id && unreadCount > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 8px' }}><div style={{ flex: 1, height: 1, background: 'rgba(255,90,122,0.4)' }} /><span style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>{tr('ch.newMessages', { count: unreadCount }, '{count} new messages')}</span><div style={{ flex: 1, height: 1, background: 'rgba(255,90,122,0.4)' }} /></div>}
                <div className="chat-row"
                  onClick={() => setActionsFor(actionsFor === m.id ? null : m.id)}
                  onContextMenu={e => {
                    // Il destro dentro a un campo di testo resta quello del
                    // sistema: taglia, copia e incolla non si tolgono a nessuno.
                    if (e.target.closest('input, textarea, a')) return
                    e.preventDefault(); e.stopPropagation()
                    setMenuFor(null); setChanMenu(null)
                    setMsgMenu({ x: e.clientX, y: e.clientY, m, mine })
                  }}
                  style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 12 }}>
                  <Avatar name={mem?.full_name || m.author_name || mem?.email} url={mem?.avatar_url || agentAvatars[m.author_name]} size={34} online={mem ? isOnline(mem) : undefined} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: MUTED }}>
                      <b style={{ color: 'var(--text)' }}>{mem?.full_name || m.author_name || tr('ch.user', null, 'User')}</b> · {new Date(m.created_at).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {m.pinned && <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 600 }}><Icon name="pin" size={11} /> {tr('ch.pinned', null, 'pinned')}</span>}
                    </div>
                    {m.reply_excerpt && (
                      <div style={{ borderLeft: '2px solid #7b5bff', padding: '2px 8px', margin: '3px 0', color: MUTED, fontSize: 13, background: 'var(--neutro-bg)', borderRadius: '0 6px 6px 0' }}>
                        ↩︎ <b style={{ color: '#bababa' }}>{m.reply_author || ''}</b>: {m.reply_excerpt}
                      </div>
                    )}
                    {m.body && <div className="ch-corpo" style={{ fontSize: 15, color: '#e8e8e8', lineHeight: 1.5, wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }} />}
                    {m.audio_url && <AudioMsg src={m.audio_url} />}
                    {m.file_url && ((/^image\//.test(m.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(m.file_name || ''))
                      ? <a href={m.file_url} target="_blank" rel="noopener"><img src={m.file_url} alt={m.file_name || ''} style={{ marginTop: 6, maxWidth: 280, maxHeight: 220, borderRadius: 12, display: 'block' }} /></a>
                      : <a href={m.file_url} target="_blank" rel="noopener" style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 12, color: 'var(--text)', textDecoration: 'none', fontSize: 13 }}><Icon name="paperclip" size={14} /> {m.file_name || tr('ch.attachment', null, 'Attachment')}</a>
                    )}
                    {Object.keys(reactions).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {Object.entries(reactions).map(([em, ids]) => (
                          <button key={em} onClick={() => toggleReaction(m.id, em)} style={{ background: 'var(--glass2)', borderRadius: 12, padding: '1px 8px', fontSize: 13, color: 'var(--text)', cursor: 'pointer', border: (ids || []).includes(me?.memberId) ? '1px solid #7b5bff' : '1px solid var(--border, rgba(255,255,255,0.12))' }}>{em} {(ids || []).length}</button>
                        ))}
                      </div>
                    )}
                    {m.reply_count > 0 && (
                      <div onClick={() => openThread(m)} style={{ marginTop: 5, color: '#7b9cff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}><Icon name="chat" size={12} /> {m.reply_count} {m.reply_count === 1 ? tr('ch.replyOne', null, 'reply') : tr('ch.replyMany', null, 'replies')}</div>
                    )}
                    {reactFor === m.id && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, ...PANEL, padding: 4, width: 'fit-content' }}>
                        {QUICK_REACTIONS.map(em => <button key={em} onClick={() => toggleReaction(m.id, em)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, padding: 2 }}>{em}</button>)}
                      </div>
                    )}
                  </div>
                  <div className={`chat-actions${actionsFor === m.id ? ' show' : ''}`} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: -10, right: 10, display: 'flex', gap: 1, background: 'rgba(24,24,36,0.98)', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 12, padding: 3, backdropFilter: 'blur(8px)', zIndex: 6 }}>
                    {REAZIONI_AL_VOLO.map(em => (
                      <button key={em} type="button" title={em} onClick={() => toggleReaction(m.id, em)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>{em}</button>
                    ))}
                    <span style={{ width: 1, height: 16, background: 'var(--border, rgba(255,255,255,0.14))', margin: '0 2px', alignSelf: 'center' }} />
                    <ActBtn title={tr('ch.addReaction', null, 'Add reaction')} onClick={() => setReactFor(reactFor === m.id ? null : m.id)}><Icon name="smile" /></ActBtn>
                    <ActBtn title={tr('ch.replyInThread', null, 'Reply in thread')} onClick={() => openThread(m)}><Icon name="reply" /></ActBtn>
                    <ActBtn title={tr('ch.forwardMessage', null, 'Forward message')} onClick={() => setForwardMsg(m)}><Icon name="forward" /></ActBtn>
                    <ActBtn title={savedIds.includes(m.id) ? tr('ch.unsave', null, 'Remove from saved') : tr('ch.save', null, 'Save message')} onClick={() => toggleSave(m)}><span style={{ color: savedIds.includes(m.id) ? 'var(--accent)' : 'inherit' }}><Icon name="bookmark" /></span></ActBtn>
                    <div style={{ position: 'relative' }}>
                      <ActBtn title={tr('ch.moreActions', null, 'More actions')} onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}><Icon name="more" /></ActBtn>
                      {menuFor === m.id && (
                        <div style={{ position: 'absolute', top: 30, right: 0, ...PANEL, padding: 6, width: 240, zIndex: 30 }}>
                          <MenuItem onClick={() => { markUnread(m); setMenuFor(null) }}><Icon name="dot" size={12} style={{ marginRight: 8, color: '#3b82f6' }} />{tr('ch.markUnread', null, 'Mark as unread')}</MenuItem>
                          <MenuItem onClick={() => { copyText(m.body || ''); setMenuFor(null) }}><Icon name="clipboard" size={14} style={{ marginRight: 8 }} />{tr('ch.copyMessage', null, 'Copy message')}</MenuItem>
                          <MenuItem onClick={() => { copyText(`${typeof location !== 'undefined' ? location.origin : ''}/chat`); setMenuFor(null) }}><Icon name="link" size={14} style={{ marginRight: 8 }} />{tr('ch.copyLink', null, 'Copy link')}</MenuItem>
                          <MenuItem onClick={() => { togglePin(m); setMenuFor(null) }}><Icon name="pin" size={14} style={{ marginRight: 8 }} />{m.pinned ? tr('ch.unpin', null, 'Unpin') : tr('ch.pin', null, 'Pin to channel')}</MenuItem>
                          {(mine || me?.isAdmin) && <MenuItem danger onClick={() => { deleteMessage(m.id); setMenuFor(null) }}><Icon name="trash" size={14} style={{ marginRight: 8 }} />{tr('ch.deleteMessage', null, 'Delete message')}</MenuItem>}
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
              {sharedFiles.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>{tr('ch.noSharedFiles', null, 'No files shared in this channel.')}</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sharedFiles.slice().reverse().map(m => {
                    const mem = memberMap[m.author_id]
                    const isImg = (/^image\//.test(m.file_type || '') || /\.(png|jpe?g|webp|gif)$/i.test(m.file_name || ''))
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--glass)', fontSize: 17 }}>
                          {m.audio_url ? <Icon name="mic" size={18} /> : (isImg ? <img src={m.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="paperclip" size={16} />)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.audio_url ? tr('ch.voiceMessage', null, 'Voice message') : (m.file_name || tr('ch.attachment', null, 'Attachment'))}</div>
                          <div style={{ fontSize: 11.5, color: MUTED }}>{mem?.full_name || m.author_name || tr('ch.user', null, 'User')} · {new Date(m.created_at).toLocaleDateString(intlLocale)}</div>
                        </div>
                        <a href={m.file_url || m.audio_url} target="_blank" rel="noopener" style={{ color: '#7b9cff', fontSize: 13, textDecoration: 'none' }}>{tr('ch.open', null, 'Open')}</a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Composer a colonne */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
            {replyTo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--neutro-bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: MUTED }}>↩︎ {tr('ch.replyToLabel', null, 'Reply to')} <b style={{ color: 'var(--text)' }}>{replyTo.author}</b>: {replyTo.excerpt.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 15 }}>×</button>
              </div>
            )}
            {recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--neutro-bg)', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 12, padding: '8px 12px', marginBottom: 8 }}>
                <span style={{ color: '#ef4444', fontSize: 13, animation: 'pulse 1s infinite' }}>●</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, flex: 1, height: 24, overflow: 'hidden' }}>
                  {Array.from({ length: 32 }).map((_, i) => <span key={i} style={{ width: 3, borderRadius: 6, background: '#7b9cff', height: 5 + ((i * 7 + recSeconds * 5) % 19) }} />)}
                </div>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13 }}>{Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')}</span>
                <button onClick={cancelRec} title={tr('ch.cancelRec', null, 'Cancel recording')} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 17 }}>×</button>
                <button onClick={stopRec} title={tr('ch.sendVoice', null, 'Send voice message')} style={{ ...BTN, width: 40, padding: 0 }}>✓</button>
              </div>
            )}
            <div style={{ border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 12, background: 'var(--surface, rgba(10,10,18,0.55))' }}>
              {showFmt && <FormatBar tr={tr} value={text} caret={caret} fmt={fmt} />}
              {/* Input con evidenziazione menzioni */}
              <div style={{ position: 'relative' }}>
                <div aria-hidden style={{ position: 'absolute', inset: 0, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', lineHeight: 1.45, color: '#e8e8e8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden', pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: highlightComposer(text) }} />
                {/* Una riga sola per due cose che l'utente deve vedere subito:
                    l'agente che sta pensando e l'invio fallito. */}
                {(agentTyping || sendError) && (
                  <div style={{ padding: '6px 14px', fontSize: 13, color: sendError ? '#fca5a5' : 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sendError || tr('chat.agentTyping', null, 'L\'agente sta scrivendo…')}
                  </div>
                )}

                <textarea
                  ref={taRef}
                  rows={2}
                  value={text}
                  onChange={handleChange}
                  onSelect={e => setCaret(e.target.selectionStart)}
                  onClick={e => setCaret(e.target.selectionStart)}
                  onKeyUp={e => setCaret(e.target.selectionStart)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && (mentionOpen || emojiOpen)) { e.preventDefault(); setMentionOpen(false); setEmojiOpen(false); return }
                    // Le stesse scorciatoie di Slack: chi le ha nelle dita non
                    // deve andare a cercare il pulsante.
                    if (fmt.scorciatoia(e)) return
                    if (e.key === 'Enter' && !e.shiftKey) {
                      if (mentionOpen && mentionList.length) { e.preventDefault(); pickMention(mentionList[0]); return }
                      e.preventDefault(); send()
                    }
                  }}
                  placeholder={activeChannel ? (activeChannel.is_dm ? tr('ch.msgTo', { name: channelLabel(activeChannel) }, 'Message {name}') : tr('ch.msgIn', { channel: `${activeChannel.is_private ? '🔒' : '#'}${activeChannel.name}` }, 'Message in {channel}')) + '…' : tr('ch.msgPlaceholder', null, 'Message…')}
                  style={{ ...FIELD, position: 'relative', border: 'none', background: 'transparent', borderRadius: 0, minHeight: 44, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', lineHeight: 1.45, color: 'transparent', caretColor: 'var(--text)' }}
                />
              </div>
              {/* Bottom row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', position: 'relative' }}>
                <label className="tipwrap" style={{ position: 'relative', cursor: 'pointer', color: '#bababa', width: 30, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={16} />
                  <Tip>{tr('ch.attachFile', null, 'Attach file')}</Tip>
                  <input type="file" hidden onChange={attachFile} accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt" />
                </label>
                <TB on={showFmt} onClick={() => setShowFmt(v => !v)} title={showFmt ? tr('ch.hideFormatting', null, 'Nascondi la formattazione') : tr('ch.showFormatting', null, 'Mostra la formattazione')}><span style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 15 }}>Aa</span></TB>
                <TB onClick={recording ? stopRec : startRec} title={recording ? tr('ch.stopSendVoice', null, 'Stop and send voice') : tr('ch.voiceMessage', null, 'Voice message')}><Icon name={recording ? 'stop' : 'mic'} size={16} /></TB>
                <TB onClick={() => { setEmojiOpen(o => !o); setMentionOpen(false) }} title={tr('ch.emoji', null, 'Emoji')}><Icon name="smile" size={16} /></TB>
                <TB onClick={() => { setMentionOpen(o => !o); setEmojiOpen(false) }} title={tr('ch.mention', null, 'Mention')}><Icon name="at" size={16} /></TB>
                <button onClick={send} style={{ ...BTN, marginLeft: 'auto', width: 38, padding: 0 }} title={tr('ch.send', null, 'Send')}><Icon name="send" size={16} /></button>

                {emojiOpen && (
                  <div style={{ position: 'absolute', bottom: 44, left: 8, ...PANEL, background: '#16161f', border: '1px solid var(--border2)', backdropFilter: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.55)', padding: 8, width: 320, zIndex: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: MUTED }}>{tr('ch.emoji', null, 'Emoji')}</span>
                      <button onClick={() => setEmojiOpen(false)} title={tr('ch.close', null, 'Close')} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 17, lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
                      {EMOJIS.map(em => <button key={em} onClick={() => { insertAtCursor(em); setEmojiOpen(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, padding: 4 }}>{em}</button>)}
                    </div>
                  </div>
                )}
                {mentionOpen && mentionList.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 44, left: 8, ...PANEL, background: '#16161f', border: '1px solid var(--border2)', backdropFilter: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.55)', padding: 6, width: 240, maxHeight: 240, overflowY: 'auto', zIndex: 30 }}>
                    {mentionList.map(mem => (
                      <div key={mem.id} onClick={() => pickMention(mem)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#cacaca' }}>
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
          <div className="m-thread" style={{ ...PANEL, width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontFamily: 'inherit', fontSize: 15 }}>{tr('ch.conversation', null, 'Thread')}</span>
              <button onClick={() => setThreadRoot(null)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              {miniMsg(threadRoot)}
              <div style={{ fontSize: 13, color: MUTED, margin: '6px 0 8px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: 8 }}>{threadMsgs.length} {threadMsgs.length === 1 ? tr('ch.replyOne', null, 'reply') : tr('ch.replyMany', null, 'replies')}</div>
              {threadMsgs.map(miniMsg)}
            </div>
            {/* Anche qui si scrive, quindi anche qui si formatta: nel pannello
                a lato la barra non e' un di piu', e' la stessa cosa. */}
            <div style={{ padding: 12, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              <div style={{ border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 12, background: 'var(--surface, rgba(10,10,18,0.55))' }}>
                {showFmt && <FormatBar tr={tr} value={threadText} caret={thCaret} fmt={fmtTh} />}
                <textarea
                  ref={thRef} rows={2} value={threadText}
                  placeholder={tr('ch.replyPlaceholder', null, 'Rispondi…')}
                  onChange={e => { setThreadText(e.target.value); setThCaret(e.target.selectionStart) }}
                  onSelect={e => setThCaret(e.target.selectionStart)}
                  onClick={e => setThCaret(e.target.selectionStart)}
                  onKeyUp={e => setThCaret(e.target.selectionStart)}
                  onKeyDown={e => {
                    if (fmtTh.scorciatoia(e)) return
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThread() }
                  }}
                  style={{ ...FIELD, border: 'none', background: 'transparent', borderRadius: 0, minHeight: 40, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.45, resize: 'none' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px' }}>
                  <TB on={showFmt} onClick={() => setShowFmt(v => !v)} title={showFmt ? tr('ch.hideFormatting', null, 'Nascondi la formattazione') : tr('ch.showFormatting', null, 'Mostra la formattazione')}><span style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 15 }}>Aa</span></TB>
                  <button onClick={sendThread} style={{ ...BTN, marginLeft: 'auto', width: 38, padding: 0 }} title={tr('ch.send', null, 'Invia')}><Icon name="send" size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Menu del tasto destro su un messaggio: le stesse voci della barra piu'
          quelle che la barra non ha spazio per tenere. Chi cerca un comando
          preme il destro, e li' deve trovarlo tutto. */}
      {msgMenu && (
        <FloatMenu x={msgMenu.x} y={msgMenu.y} onClose={() => setMsgMenu(null)} voci={[
          { titolo: msgMenu.m.author_name || memberMap[msgMenu.m.author_id]?.full_name || tr('ch.message', null, 'Messaggio') },
          { label: tr('ch.addReactionDots', null, 'Aggiungi reazione…'), icona: 'smile', fai: () => setReactFor(msgMenu.m.id) },
          { label: tr('ch.replyInThread', null, 'Rispondi nella conversazione'), icona: 'reply', fai: () => openThread(msgMenu.m) },
          { label: tr('ch.forwardDots', null, 'Inoltra messaggio…'), icona: 'forward', fai: () => setForwardMsg(msgMenu.m) },
          { label: savedIds.includes(msgMenu.m.id) ? tr('ch.unsave', null, 'Rimuovi dai salvati') : tr('ch.saveForLater', null, 'Salva per dopo'), icona: 'bookmark', fai: () => toggleSave(msgMenu.m) },
          { sep: true },
          { label: tr('ch.markUnread', null, 'Contrassegna come non letto'), icona: 'dot', fai: () => markUnread(msgMenu.m) },
          { label: tr('ch.followThread', null, 'Ricevi le notifiche per le nuove risposte'), icona: 'bell', fai: () => openThread(msgMenu.m) },
          { sep: true },
          { label: tr('ch.copyLink', null, 'Copia collegamento'), icona: 'link', fai: () => copyText(`${typeof location !== 'undefined' ? location.origin : ''}/chat`) },
          { label: tr('ch.copyMessage', null, 'Copia messaggio'), icona: 'clipboard', fai: () => copyText(msgMenu.m.body || '') },
          { sep: true },
          { label: msgMenu.m.pinned ? tr('ch.unpin', null, 'Rimuovi dai messaggi in evidenza') : tr('ch.pin', null, 'Aggiungi ai messaggi in evidenza'), icona: 'pin', fai: () => togglePin(msgMenu.m) },
          (msgMenu.mine || me?.isAdmin) && { sep: true },
          (msgMenu.mine || me?.isAdmin) && { label: tr('ch.deleteMessage', null, 'Elimina messaggio'), icona: 'trash', danger: true, fai: () => deleteMessage(msgMenu.m.id) },
        ]} />
      )}

      {/* Destro su una conversazione nell'elenco */}
      {chanMenu && (
        <FloatMenu x={chanMenu.x} y={chanMenu.y} onClose={() => setChanMenu(null)} voci={[
          { titolo: chanMenu.label },
          { label: tr('ch.openConversation', null, 'Apri la conversazione'), icona: 'chat', fai: () => setActive(chanMenu.c.id) },
          { label: tr('ch.markRead', null, 'Segna come letta'), icona: 'dot', fai: () => markChannelRead(chanMenu.c) },
          { sep: true },
          { label: tr('ch.copyName', null, 'Copia il nome'), icona: 'clipboard', fai: () => copyText(chanMenu.label) },
          !chanMenu.c.is_dm && !chanMenu.c.project_id && { label: tr('ch.manageMembers', null, 'Gestisci i partecipanti'), icona: 'users', fai: () => setManageId(chanMenu.c.id) },
          !chanMenu.c.is_dm && !chanMenu.c.project_id && { sep: true },
          !chanMenu.c.is_dm && !chanMenu.c.project_id && { label: tr('ch.delete', null, 'Elimina canale'), icona: 'trash', danger: true, fai: () => deleteChannel(chanMenu.c) },
        ]} />
      )}

      {showProfile && (
        <ProfiloPopup onClose={() => setShowProfile(false)} onSaved={(p) => { setProfile(p); setMembers(prev => prev.map(m => m.id === p.id ? { ...m, full_name: p.full_name, avatar_url: p.avatar_url } : m)) }} />
      )}
      {showNewChannel && <NewChannelDialog members={members.filter(m => m.id !== me?.memberId)} onClose={() => setShowNewChannel(false)} onCreate={createChannel} />}
      {manageId && <ChannelMembersDialog channel={manageChannel} members={members} memberIds={manageMemberIds} onClose={() => setManageId(null)} onToggle={toggleChannelMember} onInvite={inviteExternalToChannel} />}

      {forwardMsg && (
        <div onClick={() => setForwardMsg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px', fontFamily: 'inherit' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(380px,100%)', padding: 16, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontFamily: 'inherit', fontSize: 20, fontWeight: 600 }}>{tr('ch.forwardTo', null, 'Forward to…')}</h3>
              <button onClick={() => setForwardMsg(null)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: MUTED, borderLeft: '2px solid #7b5bff', paddingLeft: 8, marginBottom: 12 }}>{(forwardMsg.body || ('🎤 ' + tr('ch.voice', null, 'voice'))).slice(0, 100)}</div>
            {members.filter(m => m.id !== me?.memberId).map(mem => (
              <div key={mem.id} onClick={() => forwardTo(mem, forwardMsg)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={28} online={isOnline(mem)} />
                {mem.full_name || mem.email}
              </div>
            ))}
          </div>
        </div>
      )}

      {linkOpen && (
        <div onClick={() => setLinkOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px', fontFamily: 'inherit' }}>
          <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(440px,100%)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontFamily: 'inherit', fontSize: 20, fontWeight: 600 }}>{tr('ch.addLink', null, 'Add link')}</h3>
              <button onClick={() => setLinkOpen(false)} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>
            <label style={{ fontSize: 13, color: MUTED }}>{tr('ch.text', null, 'Text')}</label>
            <input autoFocus style={{ ...FIELD, marginTop: 4, marginBottom: 12 }} value={linkText} onChange={e => setLinkText(e.target.value)} placeholder={tr('ch.linkTextPlaceholder', null, 'Link text')} />
            <label style={{ fontSize: 13, color: MUTED }}>{tr('ch.link', null, 'Link')}</label>
            <input style={{ ...FIELD, marginTop: 4 }} value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" onKeyDown={e => { if (e.key === 'Enter') saveLink() }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setLinkOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.14))', borderRadius: 12, padding: '9px 14px', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>{tr('ch.cancel', null, 'Cancel')}</button>
              <button onClick={saveLink} style={{ ...BTN }}>{tr('ch.saveBtn', null, 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.ch-row:hover .ch-del{opacity:1 !important} .chat-row{cursor:pointer} .chat-row:hover{background:rgba(255,255,255,0.04)} .chat-actions{opacity:0;pointer-events:none;transition:opacity .12s} .chat-row:hover .chat-actions{opacity:1;pointer-events:auto} .chat-actions.show{opacity:1;pointer-events:auto} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}} .tipwrap .tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border,rgba(255,255,255,0.16));color:var(--text);font-size:11.5px;font-weight:600;padding:4px 8px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.4)} .tipwrap:hover .tip{opacity:1} .tipwrap .tip.tip-right{bottom:auto;top:50%;left:calc(100% + 10px);transform:translateY(-50%)}`}</style>
      {/* Gli avvisi discreti li disegna la cornice (AppShell monta <Avvisi />),
          ma /chat e' una pagina a se' e fuori dalla cornice: li' nessuno
          ascolta l'evento e ogni errore sparirebbe in silenzio. Quindi solo
          quando la chat sta per conto suo se li monta da sola: mai due volte. */}
      {standalone && <Avvisi />}
      {/* Call 1:1 con l'agente scelto dal picker (un solo agente alla volta) */}
      {callAgent && (
        <AgentCall key={callAgent.id} agent={callAgent} autoStart hideButton onClose={() => setCallAgent(null)} />
      )}
    </div>
  )
}

function Tip({ children, right }) {
  return children ? <span className={right ? 'tip tip-right' : 'tip'}>{children}</span> : null
}

function ActBtn({ onClick, title, children }) {
  return <button type="button" onClick={onClick} className="tipwrap" style={{ position: 'relative', background: 'none', border: 'none', color: '#c2c2d0', cursor: 'pointer', width: 30, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'var(--text)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#c2c2d0' }}>{children}<Tip>{title}</Tip></button>
}

function HBtn({ onClick, title, children }) {
  return <button type="button" onClick={onClick} className="tipwrap" style={{ position: 'relative', background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 8, width: 34, height: 32, color: '#dddddd', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'rgba(123,91,255,0.5)' }} onMouseLeave={e => { e.currentTarget.style.color = '#dddddd'; e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.12))' }}>{children}<Tip>{title}</Tip></button>
}

// ── Formattazione: ogni segno e' un interruttore ───────────────────────────
//
// Prima il pulsante sapeva solo avvolgere: premuto due volte metteva i segni
// due volte, e non diceva mai se lo stile era attivo. Qui invece se il punto in
// cui scrivi e' gia' dentro a quel segno, il pulsante e' acceso e premerlo lo
// toglie.
function creaFormattatore(ref, text, setText, setCaret) {
  const setSel = (a, b) => {
    requestAnimationFrame(() => {
      const ta = ref.current; if (!ta) return
      ta.focus(); ta.selectionStart = a; ta.selectionEnd = b === undefined ? a : b
      setCaret(a)
    })
  }

  function toggleWrap(mk) {
    const ta = ref.current
    if (!ta) { setText(text + mk + mk); return }
    const s = ta.selectionStart, e = ta.selectionEnd
    const n = mk.length

    if (s !== e) {
      // Selezione gia' avvolta: si toglie il segno, da fuori o da dentro.
      if (text.slice(s - n, s) === mk && text.slice(e, e + n) === mk) {
        setText(text.slice(0, s - n) + text.slice(s, e) + text.slice(e + n))
        return setSel(s - n, e - n)
      }
      if (text.slice(s, s + n) === mk && text.slice(e - n, e) === mk && e - s > n * 2) {
        setText(text.slice(0, s) + text.slice(s + n, e - n) + text.slice(e))
        return setSel(s, e - n * 2)
      }
      setText(text.slice(0, s) + mk + text.slice(s, e) + mk + text.slice(e))
      return setSel(s + n, e + n)
    }

    // Nessuna selezione: se il cursore e' gia' dentro si esce (stile spento),
    // altrimenti si apre la coppia e si resta in mezzo (stile acceso).
    if (marksAt(text, s).has(mk)) {
      const chiusura = text.indexOf(mk, s)
      const fineRiga = text.indexOf('\n', s)
      if (chiusura !== -1 && (fineRiga === -1 || chiusura < fineRiga)) return setSel(chiusura + n)
      setText(text.slice(0, s) + mk + text.slice(s))
      return setSel(s + n)
    }
    setText(text.slice(0, s) + mk + mk + text.slice(s))
    return setSel(s + n)
  }

  // Prefissi di riga (elenco, numerato, citazione): stesso interruttore, ma
  // sulla riga intera e su tutte quelle toccate dalla selezione.
  function toggleLine(kind) {
    const ta = ref.current
    const s = ta ? ta.selectionStart : text.length
    const e = ta ? ta.selectionEnd : text.length
    const inizio = text.lastIndexOf('\n', s - 1) + 1
    let fine = text.indexOf('\n', e)
    if (fine === -1) fine = text.length

    const righe = text.slice(inizio, fine).split('\n')
    const test = { bullet: /^(\s*)-\s+/, number: /^(\s*)\d+\.\s+/, quote: /^(\s*)>\s?/ }[kind]
    const spente = righe.some(r => !test.test(r))

    let k = 0
    const fatte = righe.map(r => {
      if (!spente) return r.replace(test, '$1')
      const pulita = r.replace(/^(\s*)(?:-\s+|\d+\.\s+|>\s?)/, '$1')
      k += 1
      return kind === 'bullet' ? `- ${pulita}` : kind === 'number' ? `${k}. ${pulita}` : `> ${pulita}`
    })

    const nuovo = fatte.join('\n')
    setText(text.slice(0, inizio) + nuovo + text.slice(fine))
    setSel(inizio, inizio + nuovo.length)
  }

  function toggleCodeBlock() {
    const ta = ref.current
    const s = ta ? ta.selectionStart : text.length
    const e = ta ? ta.selectionEnd : text.length
    if (marksAt(text, s).has('```')) {
      const chiusura = text.indexOf('```', s)
      return setSel(chiusura === -1 ? text.length : chiusura + 3)
    }
    const dentro = text.slice(s, e)
    const blocco = '```\n' + dentro + '\n```'
    setText(text.slice(0, s) + blocco + text.slice(e))
    setSel(s + 4, s + 4 + dentro.length)
  }

  // Le stesse scorciatoie di Slack: chi le ha nelle dita non deve andare a
  // cercare il pulsante.
  function scorciatoia(e) {
    if (!(e.metaKey || e.ctrlKey)) return false
    const k = e.key.toLowerCase()
    const tabella = e.shiftKey
      ? { x: () => toggleWrap('~~'), c: () => toggleWrap('`'), '8': () => toggleLine('bullet'), '7': () => toggleLine('number'), '9': () => toggleLine('quote') }
      : { b: () => toggleWrap('**'), i: () => toggleWrap('_'), u: () => toggleWrap('__') }
    const fai = tabella[k]
    if (!fai) return false
    e.preventDefault(); fai(); return true
  }

  // Link senza finestrella: si scrive il modello e il cursore va dentro
  // l'indirizzo, che e' l'unica parte che manca davvero.
  function link() {
    const ta = ref.current
    const s = ta ? ta.selectionStart : text.length
    const e = ta ? ta.selectionEnd : text.length
    const etichetta = text.slice(s, e) || 'testo'
    const modello = `[${etichetta}](https://)`
    setText(text.slice(0, s) + modello + text.slice(e))
    const dentro = s + 1 + etichetta.length + 2 + 8
    setSel(dentro)
  }

  return { toggleWrap, toggleLine, toggleCodeBlock, scorciatoia, link }
}

// Quali segni di formattazione sono APERTI nel punto in cui si scrive.
// Serve ad accendere i pulsanti: senza, non si sa mai se il grassetto e' attivo.
const SEGNI = ['**', '__', '~~', '`', '_']
function marksAt(value, pos) {
  const aperti = new Set()
  // Il blocco di codice si conta su tutto il testo, non sulla riga. E dentro
  // un blocco non c'e' nessun altro stile: e' codice.
  const prima = value.slice(0, pos)
  if (((prima.match(/```/g) || []).length) % 2 === 1) { aperti.add('```'); return aperti }

  const inizio = value.lastIndexOf('\n', pos - 1) + 1
  const riga = value.slice(inizio, pos)
  let i = 0
  while (i < riga.length) {
    const mk = SEGNI.find(x => riga.startsWith(x, i))
    if (mk) { aperti.has(mk) ? aperti.delete(mk) : aperti.add(mk); i += mk.length }
    else i++
  }
  return aperti
}

// Prefissi di riga attivi nel punto in cui si scrive.
function lineMarkAt(value, pos) {
  const inizio = value.lastIndexOf('\n', pos - 1) + 1
  let fine = value.indexOf('\n', pos)
  if (fine === -1) fine = value.length
  const riga = value.slice(inizio, fine)
  if (/^\s*>\s?/.test(riga)) return 'quote'
  if (/^\s*-\s+/.test(riga)) return 'bullet'
  if (/^\s*\d+\.\s+/.test(riga)) return 'number'
  return null
}

// ── La barra di formattazione ──────────────────────────────────────────────
// Le stesse voci del riferimento e nello stesso ordine. Ogni pulsante si
// accende quando lo stile e' attivo nel punto in cui si scrive.
function FormatBar({ tr, value, caret, fmt }) {
  const segni = marksAt(value, caret)
  const riga = lineMarkAt(value, caret)
  const sep = <span style={{ width: 1, height: 16, background: 'var(--border, rgba(255,255,255,0.12))', margin: '0 4px' }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.07))', flexWrap: 'wrap' }}>
      <TB on={segni.has('**')} onClick={() => fmt.toggleWrap('**')} title={tr('ch.bold', null, 'Grassetto')}><b>B</b></TB>
      <TB on={segni.has('_')} onClick={() => fmt.toggleWrap('_')} title={tr('ch.italic', null, 'Corsivo')}><i>I</i></TB>
      <TB on={segni.has('__')} onClick={() => fmt.toggleWrap('__')} title={tr('ch.underline', null, 'Sottolineato')}><Icon name="underline" size={15} /></TB>
      <TB on={segni.has('~~')} onClick={() => fmt.toggleWrap('~~')} title={tr('ch.strike', null, 'Barrato')}><s>S</s></TB>
      {sep}
      <TB onClick={fmt.link} title={tr('ch.insertLink', null, 'Inserisci link')}><Icon name="link" size={16} /></TB>
      <TB on={riga === 'bullet'} onClick={() => fmt.toggleLine('bullet')} title={tr('ch.bulletList', null, 'Elenco puntato')}><Icon name="bullet" size={16} /></TB>
      <TB on={riga === 'number'} onClick={() => fmt.toggleLine('number')} title={tr('ch.numberList', null, 'Elenco numerato')}><Icon name="number" size={16} /></TB>
      <TB on={riga === 'quote'} onClick={() => fmt.toggleLine('quote')} title={tr('ch.quote', null, 'Citazione')}><Icon name="quote" size={15} /></TB>
      {sep}
      <TB on={segni.has('`')} onClick={() => fmt.toggleWrap('`')} title={tr('ch.code', null, 'Codice')}>{'</>'}</TB>
      <TB on={segni.has('```')} onClick={fmt.toggleCodeBlock} title={tr('ch.codeBlock', null, 'Blocco di codice')}><Icon name="codeblock" size={15} /></TB>
    </div>
  )
}

function TB({ onClick, title, children, on }) {
  // Acceso = lo stile e' attivo nel punto in cui si scrive. Il pulsante deve
  // dirlo, altrimenti non si sa mai se si sta scrivendo in grassetto o no.
  const base = on ? 'var(--neutro-bg)' : 'none'
  const tinta = on ? '#c3b4ff' : '#bababa'
  return <button type="button" onClick={onClick} className="tipwrap" aria-pressed={!!on}
    style={{ position: 'relative', background: base, border: on ? '1px solid rgba(123,91,255,0.45)' : '1px solid transparent', color: tinta, cursor: 'pointer', fontSize: 13, fontFamily: 'ui-monospace,monospace', width: 30, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s, color .12s, border-color .12s' }}
    onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text)' } }}
    onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#bababa' } }}>{children}<Tip>{title}</Tip></button>
}

// ── Menu che compare dove hai premuto ──────────────────────────────────────
// Si ribalta ai bordi dello schermo e misura dove e' finito davvero: se un
// antenato ha un transform o un filtro, position:fixed non parte piu' dalla
// finestra e il menu si aprirebbe lontano dal puntatore.
function FloatMenu({ x, y, voci, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x, y, misurato: false })

  useEffect(() => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const dx = r.left - x, dy = r.top - y
    const fx = x + r.width > window.innerWidth - 8 ? Math.max(8, x - r.width) : x
    const fy = y + r.height > window.innerHeight - 8 ? Math.max(8, y - r.height) : y
    setPos({ x: fx - dx, y: fy - dy, misurato: true })
  }, [x, y])

  useEffect(() => {
    const via = () => onClose()
    const esc = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('click', via)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('click', via); window.removeEventListener('keydown', esc) }
  }, [onClose])

  return (
    <div ref={ref} onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 1200, minWidth: 248, maxWidth: 340,
        visibility: pos.misurato ? 'visible' : 'hidden',
        padding: '6px 0', borderRadius: 12, background: 'rgba(18,18,28,0.98)', backdropFilter: 'blur(20px)',
        border: '1px solid var(--border2, rgba(255,255,255,0.14))', boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
      }}>
      {voci.filter(Boolean).map((v, i) => {
        if (v.sep) return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '5px 0' }} />
        if (v.titolo) return (
          <div key={i} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8b8b8b', padding: '6px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titolo}</div>
        )
        return (
          <button key={i} type="button" onMouseDown={e => { e.stopPropagation(); v.fai(); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: v.danger ? '#ef4444' : '#e8e8e8', fontSize: 13, fontFamily: 'inherit', padding: '7px 12px' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
            {v.icona && <Icon name={v.icona} size={14} />}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function MenuItem({ onClick, danger, children }) {
  return <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: danger ? '#ef4444' : '#e8e8e8', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>{children}</button>
}

function RailBtn({ active, onClick, title, badge, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={title} style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--btn-primario)' : 'rgba(255,255,255,0.05)', color: active ? 'var(--btn-primario-testo)' : '#bababa' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}>
      {children}
      {badge > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#ef4444', color: 'var(--text)', fontSize: 10, fontWeight: 640, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge > 9 ? '9+' : badge}</span>}
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
    // Il pulsante "Squadra AI" e ogni riga del picker chiedono questa icona:
    // senza il caso, Icon tornava null e il telefono non si vedeva.
    case 'phone': return <svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
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
    case 'quote': return <svg {...p}><path d="M9 7H5.5A2.5 2.5 0 0 0 3 9.5v2A2.5 2.5 0 0 0 5.5 14H7c0 2-1 3-3 3.5" /><path d="M20 7h-3.5A2.5 2.5 0 0 0 14 9.5v2a2.5 2.5 0 0 0 2.5 2.5H18c0 2-1 3-3 3.5" /></svg>
    case 'codeblock': return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><polyline points="9 10 7 12 9 14" /><polyline points="15 10 17 12 15 14" /></svg>
    case 'underline': return <svg {...p}><path d="M7 4v6a5 5 0 0 0 10 0V4" /><line x1="5" y1="20" x2="19" y2="20" /></svg>
    case 'eye': return <svg {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, padding: '7px 12px 7px 7px', background: 'var(--neutro-bg)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 999, maxWidth: 300 }}>
      <audio ref={ref} src={src} preload="metadata" onTimeUpdate={e => setCur(e.target.currentTime)} onLoadedMetadata={e => setDur(e.target.duration || 0)} onEnded={() => { setPlaying(false); setCur(0) }} style={{ display: 'none' }} />
      <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--btn-primario)', color: 'var(--btn-primario-testo)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={playing ? 'pause' : 'play'} size={15} /></button>
      <div onClick={e => { const a = ref.current; if (!a || !dur) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - r.left) / r.width) * dur }} style={{ flex: 1, height: 4, borderRadius: 6, background: 'rgba(255,255,255,0.16)', cursor: 'pointer', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'var(--text3)', borderRadius: 6 }} />
      </div>
      <span style={{ fontSize: 11.5, color: '#bababa', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(cur)} / {fmt(dur)}</span>
    </div>
  )
}

function activeName(ch) { return ch?.name }
