'use client'

import { useRef, useState } from 'react'
import { getClientLocale } from '../../lib/i18n/clientLocale'

// ============================================================================
//  Pulsante + overlay CALL full-duplex con un agente della Squadra AI
//  (ElevenLabs Conversational AI, multi-voce con transfer tra colleghi).
//  Riusato in TeamTab (chat 1:1) e in ChatTab/LyftTalk ("Chiama la squadra").
//  Props: agent = { id, name, role, color, avatar?, emoji? }, label?
// ============================================================================

function CallAvatar({ a, size = 120 }) {
  const [err, setErr] = useState(false)
  if (a.avatar && !err) {
    return <img src={a.avatar} alt={a.name} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${a.color}55` }} />
  }
  return <span style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, background: `${a.color}22`, border: `2px solid ${a.color}55` }}>{a.emoji || '🤖'}</span>
}

export default function AgentCall({ agent, label = '📞 Chiama', buttonStyle }) {
  const [call, setCall] = useState(null) // { status, mode, error? }
  const convRef = useRef(null)
  const convIdRef = useRef(null)
  const finalizedRef = useRef(false)

  // A fine call: trascrizione + estrazione/esecuzione azioni + memoria (server).
  function finalize() {
    const id = convIdRef.current
    if (!id || finalizedRef.current) return
    finalizedRef.current = true
    fetch('/api/team/call/finalize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: id, agentId: agent.id }),
    }).catch(() => {})
  }

  async function startCall() {
    setCall({ status: 'connecting', mode: 'listening' })
    convIdRef.current = null; finalizedRef.current = false
    try {
      // Innesca i dati in BACKGROUND (non bloccante): la call parte subito usando
      // lo snapshot già pronto; il prime aggiorna i dati per i turni successivi.
      fetch('/api/team/call/prime', { method: 'POST' }).catch(() => {})
      const cfg = await fetch(`/api/team/call/signed-url?agentId=${encodeURIComponent(agent.id)}`).then(r => r.json()).catch(() => ({}))
      if (!cfg.configured) { setCall({ status: 'ended', error: cfg.reason || 'Call non configurata.' }); return }
      if (!cfg.signedUrl) { setCall({ status: 'ended', error: cfg.error || 'Impossibile avviare la call.' }); return }
      const { Conversation } = await import('@elevenlabs/client')
      // NB: niente customLlmExtraBody (l'agente lo rifiuta, error 1008). L'agente
      // è identificato dal `model` (team-<id>) configurato sull'agent ElevenLabs.
      const conv = await Conversation.startSession({
        signedUrl: cfg.signedUrl,
        connectionType: 'websocket',
        onConnect: (e) => { convIdRef.current = e?.conversationId || convIdRef.current },
        onStatusChange: (s) => setCall(c => c ? { ...c, status: s?.status === 'connected' ? 'connected' : c.status } : c),
        onModeChange: (m) => setCall(c => c ? { ...c, mode: m?.mode === 'speaking' ? 'speaking' : 'listening' } : c),
        onError: (e) => setCall(c => ({ ...(c || {}), status: 'ended', error: String(e?.message || e || 'Errore call') })),
        onDisconnect: () => { finalize(); setCall(c => c && c.status !== 'ended' ? { ...c, status: 'ended' } : c) },
      })
      convRef.current = conv
      try { convIdRef.current = convIdRef.current || conv.getId?.() } catch {}
      setCall(c => ({ ...(c || {}), status: 'connected', mode: 'listening' }))
    } catch (e) {
      setCall({ status: 'ended', error: String(e?.message || e || 'Microfono o connessione non disponibili') })
    }
  }
  async function endCall() {
    try { await convRef.current?.endSession() } catch {}
    finalize()
    convRef.current = null
    setCall(null)
  }

  return (
    <>
      <button type="button" onClick={startCall} title="Chiama in vivavoce"
        style={buttonStyle || { cursor: 'pointer', background: '#30d158', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700 }}>
        {label}
      </button>

      {call && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8,6,20,0.92)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `3px solid ${agent.color}`,
              opacity: call.mode === 'speaking' ? 0.9 : 0.3, animation: call.status === 'connected' ? 'lyftPulse 1.2s ease-out infinite' : 'none' }} />
            <CallAvatar a={agent} size={120} />
          </div>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{agent.name}</div>
            <div style={{ color: agent.color, fontSize: 14, fontWeight: 600 }}>{agent.role}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#c7c7cf' }}>
              {call.status === 'connecting' && 'Connessione in corso…'}
              {call.status === 'connected' && (call.mode === 'speaking' ? '🔊 Sta parlando…' : '🎙️ Ti ascolto, parla pure')}
              {call.status === 'ended' && (call.error ? `⚠️ ${call.error}` : 'Call terminata')}
            </div>
          </div>
          {call.status === 'ended'
            ? <button type="button" onClick={() => setCall(null)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 999, padding: '12px 26px', fontSize: 15, fontWeight: 700 }}>Chiudi</button>
            : <button type="button" onClick={endCall} style={{ cursor: 'pointer', background: '#ff453a', border: 'none', color: '#fff', borderRadius: 999, padding: '14px 30px', fontSize: 16, fontWeight: 800 }}>📵 Riaggancia</button>}
          <style>{`@keyframes lyftPulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.25);opacity:0}100%{opacity:0}}`}</style>
        </div>
      )}
    </>
  )
}
