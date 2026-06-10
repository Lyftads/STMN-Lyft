'use client'

import { useEffect, useRef, useState } from 'react'

// ============================================================================
//  CALL DI GRUPPO (LiveKit): più membri del team nella stessa stanza + (via
//  worker bridge) uno o più agent della Squadra AI. Audio realtime.
//  Props: room (nome stanza condivisa), title?, agents? (lista per "invita"), onClose
// ============================================================================

function Avatar({ p, size = 64 }) {
  const initial = (p.name || p.identity || '?').trim()[0]?.toUpperCase() || '?'
  const isAgent = String(p.identity || '').startsWith('agent-')
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: `3px solid ${isAgent ? '#7c5cff' : '#30d158'}`, opacity: p.speaking ? 0.95 : 0.25, transition: 'opacity .15s' }} />
      {p.avatar
        ? <img src={p.avatar} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover' }} alt="" />
        : <span style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: '#fff', background: isAgent ? '#7c5cff33' : '#30d15833' }}>{isAgent ? '🤖' : initial}</span>}
    </div>
  )
}

export default function GroupCall({ room, channelId, title = 'Call di gruppo', agents = [], onClose }) {
  const [status, setStatus] = useState('connecting') // connecting|connected|ended|error
  const [error, setError] = useState('')
  const [participants, setParticipants] = useState([])
  const [muted, setMuted] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [members, setMembers] = useState([])
  const [invited, setInvited] = useState({})
  const roomRef = useRef(null)
  const audioEls = useRef([])

  useEffect(() => { connect(); return () => cleanup() }, []) // eslint-disable-line
  useEffect(() => {
    fetch('/api/team-members').then(r => r.ok ? r.json() : null).then(d => {
      const list = (d?.members || d?.team || []).filter(m => (m.status === 'active' || m.status === 'invited') && !(m.roles || []).includes('guest'))
      setMembers(list)
    }).catch(() => {})
  }, [])

  async function invitePerson(m) {
    setInvited(p => ({ ...p, [m.id]: 'sending' }))
    try {
      const d = await fetch('/api/team/call/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: m.id, channelId, room }) }).then(r => r.json()).catch(() => ({}))
      setInvited(p => ({ ...p, [m.id]: d.ok ? 'sent' : 'err' }))
    } catch { setInvited(p => ({ ...p, [m.id]: 'err' })) }
  }

  function cleanup() {
    try { roomRef.current?.disconnect() } catch {}
    audioEls.current.forEach(el => { try { el.remove() } catch {} })
    audioEls.current = []
  }

  async function connect() {
    try {
      const cfg = await fetch('/api/team/call/livekit-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room }) }).then(r => r.json()).catch(() => ({}))
      if (!cfg.ok || !cfg.token) { setStatus('error'); setError(cfg.reason || cfg.error || 'Stanza non configurata'); return }
      const { Room, RoomEvent } = await import('livekit-client')
      const lk = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = lk
      const refresh = () => {
        const all = [lk.localParticipant, ...lk.remoteParticipants.values()]
        setParticipants(all.map(p => ({ identity: p.identity, name: p.name || p.identity, speaking: p.isSpeaking, isLocal: p === lk.localParticipant })))
      }
      lk.on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === 'audio') { const el = track.attach(); el.autoplay = true; el.play?.().catch(() => {}); document.body.appendChild(el); audioEls.current.push(el) } })
        .on(RoomEvent.Disconnected, () => setStatus('ended'))
      await lk.connect(cfg.url, cfg.token)
      await lk.localParticipant.setMicrophoneEnabled(true)
      setStatus('connected'); refresh()
    } catch (e) { setStatus('error'); setError(String(e?.message || e || 'Connessione fallita')) }
  }

  async function toggleMute() {
    const r = roomRef.current; if (!r) return
    const m = !muted; setMuted(m)
    try { await r.localParticipant.setMicrophoneEnabled(!m) } catch {}
  }
  function leave() { cleanup(); onClose?.() }

  async function inviteAgent(agentId) {
    setInviting(true)
    try {
      const d = await fetch('/api/team/call/agent-dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, agentId }) }).then(r => r.json()).catch(() => ({}))
      if (!d.ok) alert(d.error || d.reason || 'Bridge agente non ancora attivo (manca il worker).')
    } finally { setInviting(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,6,20,0.94)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 24 }}>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{title}</div>
      <div style={{ color: '#c7c7cf', fontSize: 13 }}>
        {status === 'connecting' && 'Connessione alla stanza…'}
        {status === 'connected' && `${participants.length} in stanza`}
        {status === 'ended' && 'Call terminata'}
        {status === 'error' && `⚠️ ${error}`}
      </div>

      {status === 'connected' && (
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700 }}>
          {participants.map(p => (
            <div key={p.identity} style={{ textAlign: 'center' }}>
              <Avatar p={p} size={72} />
              <div style={{ color: '#fff', fontSize: 13, marginTop: 8 }}>{p.name}{p.isLocal ? ' (tu)' : ''}</div>
            </div>
          ))}
        </div>
      )}

      {/* Invita agent */}
      {status === 'connected' && agents.length > 0 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#9a9aa8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Invita un agente</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
            {agents.map(a => (
              <button key={a.id} type="button" disabled={inviting} onClick={() => inviteAgent(a.id)}
                style={{ cursor: inviting ? 'default' : 'pointer', background: 'rgba(124,92,255,0.18)', border: '1px solid rgba(124,92,255,0.45)', color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12.5 }}>
                🤖 {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Invita persone del team */}
      {status === 'connected' && members.length > 0 && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#9a9aa8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Invita una persona</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
            {members.map(m => {
              const st = invited[m.id]
              return (
                <button key={m.id} type="button" disabled={st === 'sending' || st === 'sent'} onClick={() => invitePerson(m)}
                  style={{ cursor: st ? 'default' : 'pointer', background: st === 'sent' ? 'rgba(48,209,88,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12.5 }}>
                  {st === 'sent' ? '✓ invitato' : st === 'sending' ? '…' : '+ ' + (m.full_name || m.email?.split('@')[0] || 'membro')}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {status === 'connected' && (
          <button type="button" onClick={toggleMute}
            style={{ cursor: 'pointer', borderRadius: 999, width: 52, height: 52, fontSize: 20, border: '1px solid var(--border)', background: muted ? '#ff453a' : 'var(--glass)', color: '#fff' }}>{muted ? '🔇' : '🎙️'}</button>
        )}
        <button type="button" onClick={leave}
          style={{ cursor: 'pointer', background: status === 'ended' || status === 'error' ? 'var(--glass)' : '#ff453a', border: status === 'ended' || status === 'error' ? '1px solid var(--border)' : 'none', color: '#fff', borderRadius: 999, padding: '0 26px', height: 52, fontSize: 15, fontWeight: 800 }}>
          {status === 'ended' || status === 'error' ? 'Chiudi' : '📵 Esci'}
        </button>
      </div>
    </div>
  )
}
