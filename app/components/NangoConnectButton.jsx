'use client'

import { useState } from 'react'

// Pulsante che apre la Nango Connect UI per collegare un provider OAuth.
// Flusso: crea session (backend) → openConnectUI → on 'connect' salva il
// connectionId nel tenant (companies.nango_connections).
export default function NangoConnectButton({ integrationId, label = 'Collega', onConnected, style }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(null)

  const start = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch('/api/integrations/connect-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedIntegrations: [integrationId] }),
      })
      const j = await r.json()
      if (!r.ok || !j.sessionToken) throw new Error(j.error || 'Sessione non creata')

      const mod = await import('@nangohq/frontend')
      const Nango = mod.default || mod.Nango
      const nango = new Nango()

      let settled = false
      const onEvent = async (event) => {
        const type = event?.type
        if (type === 'connect' || type === 'connection') {
          const p = event?.payload || event || {}
          const connectionId = p.connectionId || p.connection_id || p.connectionId
          const provider = p.providerConfigKey || p.provider_config_key || integrationId
          if (connectionId && !settled) {
            settled = true
            await fetch('/api/integrations/save-connection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ integrationId: provider, connectionId }),
            }).catch(() => {})
            setDone(true)
            onConnected?.(provider, connectionId)
          }
          setLoading(false)
        } else if (type === 'close') {
          setLoading(false)
        }
      }

      const connect = nango.openConnectUI({ sessionToken: j.sessionToken, onEvent })
      // Compat versioni: alcune richiedono setSessionToken dopo l'apertura
      if (connect && typeof connect.setSessionToken === 'function') connect.setSessionToken(j.sessionToken)
    } catch (e) {
      setErr(e?.message || 'Errore di collegamento')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={start}
        disabled={loading || done}
        style={{
          padding: '8px 16px', fontWeight: 800, fontSize: 12.5, borderRadius: 10,
          border: '1px solid var(--border)',
          background: done ? 'rgba(48,209,88,0.15)' : 'var(--glass)',
          color: done ? 'var(--green)' : '#fff',
          cursor: loading || done ? 'default' : 'pointer',
          ...style,
        }}
      >
        {done ? '✓ Collegato' : loading ? 'Collegamento…' : label}
      </button>
      {err && <div style={{ color: 'var(--red)', fontSize: 11 }}>{err}</div>}
    </div>
  )
}
