'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './ui/Icon'

// ============================================================================
//  CALL DI GRUPPO (LiveKit), stile Google Meet: più membri del team nella
//  stessa stanza + (via worker bridge) uno o più agent della Squadra AI.
//  Ogni partecipante ha il proprio tile con foto. Audio realtime.
//  Props: room (nome stanza condivisa), channelId?, title?, agents?, onClose
// ============================================================================

function Tile({ p, muted }) {
  const initial = (p.name || p.identity || '?').trim()[0]?.toUpperCase() || '?'
  const ring = p.isAgent ? '#7c5cff' : '#30d158'
  return (
    <div style={{
      position: 'relative', aspectRatio: '4 / 3', borderRadius: 16, overflow: 'hidden',
      background: 'linear-gradient(160deg,#1b1827,#0d0b16)',
      border: `2px solid ${p.speaking ? ring : 'rgba(255,255,255,0.07)'}`,
      boxShadow: p.speaking ? `0 0 0 1px ${ring}, 0 0 24px ${ring}55` : 'none',
      transition: 'border-color .15s, box-shadow .15s',
    }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.avatar
          ? <img src={p.avatar} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${ring}66` }} />
          : <div style={{ width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: 'var(--text)', background: p.isAgent ? '#7c5cff33' : '#30d15833', border: `2px solid ${ring}66` }}>{initial}</div>}
      </div>
      <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', borderRadius: 9, padding: '4px 10px', maxWidth: 'calc(100% - 20px)' }}>
        {p.isAgent && <span style={{ fontSize: 10, color: '#b9a6ff', fontWeight: 800, letterSpacing: '.04em' }}>AI</span>}
        <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{p.isLocal ? ' (tu)' : ''}</span>
      </div>
      {p.isLocal && muted && (
        <div style={{ position: 'absolute', right: 10, bottom: 10, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,69,58,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
          <Icon name="mic-off" size={15} />
        </div>
      )}
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
  const [agentState, setAgentState] = useState({})
  const [mounted, setMounted] = useState(false)
  const roomRef = useRef(null)
  const audioEls = useRef([])

  useEffect(() => { setMounted(true) }, [])
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

      const agentAvatars = {}
      agents.forEach(a => { if (a?.name) agentAvatars[a.name.toLowerCase()] = a.avatar })

      const refresh = () => {
        const all = [lk.localParticipant, ...lk.remoteParticipants.values()]
        setParticipants(all.map(p => {
          let meta = {}
          try { meta = p.metadata ? JSON.parse(p.metadata) : {} } catch {}
          const isAgent = !!meta.isAgent || String(p.identity || '').toLowerCase().startsWith('agent')
          const name = meta.name || p.name || p.identity
          const avatar = meta.avatar || (isAgent ? agentAvatars[String(name).toLowerCase()] : null) || null
          return { identity: p.identity, name, speaking: p.isSpeaking, isLocal: p === lk.localParticipant, isAgent, avatar }
        }))
      }
      lk.on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.ParticipantMetadataChanged, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === 'audio') { const el = track.attach(); el.autoplay = true; el.play?.().catch(() => {}); document.body.appendChild(el); audioEls.current.push(el); refresh() } })
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
    // Un solo agente per call: blocca se ce n'è già uno (presente o in arrivo).
    const locked = participants.some(p => p.isAgent) || Object.values(agentState).some(s => s === 'calling' || s === 'sent')
    if (locked) return
    setInviting(true); setAgentState(s => ({ ...s, [agentId]: 'calling' }))
    try {
      const d = await fetch('/api/team/call/agent-dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, agentId }) }).then(r => r.json()).catch(() => ({}))
      if (!d.ok) { alert(d.error || d.reason || 'Bridge agente non ancora attivo (manca il worker).'); setAgentState(s => ({ ...s, [agentId]: 'err' })) }
      else setAgentState(s => ({ ...s, [agentId]: 'sent' }))
    } finally { setInviting(false) }
  }

  const n = participants.length
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4
  const gridMax = Math.min(cols * 300, 1040)
  // Un solo agente per call (presente in stanza o invito in corso).
  const agentLocked = participants.some(p => p.isAgent) || Object.values(agentState).some(s => s === 'calling' || s === 'sent')

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(8,6,20,0.97)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 24px 22px', overflowY: 'auto' }}>
      <div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 800 }}>{title}</div>
      <div style={{ color: '#c7c7cf', fontSize: 13, marginTop: 4 }}>
        {status === 'connecting' && 'Connessione alla stanza…'}
        {status === 'connected' && `${n} in stanza`}
        {status === 'ended' && 'Call terminata'}
        {status === 'error' && <span style={{ color: '#ff8b80' }}>⚠️ {error}</span>}
      </div>

      {status === 'connected' && (
        <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '20px 0' }}>
          <div style={{ display: 'grid', gap: 14, width: '100%', maxWidth: gridMax, gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {participants.map(p => <Tile key={p.identity} p={p} muted={muted} />)}
          </div>
        </div>
      )}

      {/* Invita UN agente (max 1 per call) */}
      {status === 'connected' && agents.length > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ color: '#9a9aa8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
            {agentLocked ? 'Un agente è in call' : 'Invita un agente (max 1)'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720 }}>
            {agents.map(a => {
              const st = agentState[a.id]
              const disabled = inviting || (agentLocked && st !== 'calling' && st !== 'sent')
              return (
                <button key={a.id} type="button" disabled={disabled} onClick={() => inviteAgent(a.id)}
                  style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 7, background: st === 'sent' ? 'rgba(124,92,255,0.32)' : 'rgba(124,92,255,0.16)', border: '1px solid rgba(124,92,255,0.45)', color: 'var(--text)', borderRadius: 999, padding: '5px 6px 5px 12px', fontSize: 12.5 }}>
                  {a.avatar && <img src={a.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />}
                  {a.name}{st === 'calling' ? ' …' : st === 'sent' ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Invita persone del team */}
      {status === 'connected' && members.length > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ color: '#9a9aa8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Invita una persona</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720 }}>
            {members.map(m => {
              const st = invited[m.id]
              return (
                <button key={m.id} type="button" disabled={st === 'sending' || st === 'sent'} onClick={() => invitePerson(m)}
                  style={{ cursor: st ? 'default' : 'pointer', background: st === 'sent' ? 'rgba(48,209,88,0.18)' : 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 999, padding: '6px 12px', fontSize: 12.5 }}>
                  {st === 'sent' ? '✓ invitato' : st === 'sending' ? '…' : '+ ' + (m.full_name || m.email?.split('@')[0] || 'membro')}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {status === 'connected' && (
          <button type="button" onClick={toggleMute} title={muted ? 'Riattiva microfono' : 'Disattiva microfono'}
            style={{ cursor: 'pointer', borderRadius: 999, width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: muted ? '#ff453a' : 'var(--glass)', color: 'var(--text)' }}>
            <Icon name={muted ? 'mic-off' : 'mic'} size={22} />
          </button>
        )}
        <button type="button" onClick={leave} title={status === 'ended' || status === 'error' ? 'Chiudi' : 'Esci dalla call'}
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, background: status === 'ended' || status === 'error' ? 'var(--glass)' : '#ff453a', border: status === 'ended' || status === 'error' ? '1px solid var(--border)' : 'none', color: 'var(--text)', borderRadius: 999, padding: '0 26px', height: 54, fontSize: 15, fontWeight: 800 }}>
          {status === 'ended' || status === 'error' ? 'Chiudi' : <><Icon name="phone-off" size={18} />Esci</>}
        </button>
      </div>
    </div>
  )

  return mounted ? createPortal(overlay, document.body) : null
}
