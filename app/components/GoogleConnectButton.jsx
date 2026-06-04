'use client'

import { useEffect, useState } from 'react'

// Google (GA4 + Ads): usa il flusso OAuth NATIVO dell'app (/api/google/auth/start),
// che salva il refresh_token per tenant in companies.google_refresh_token.
// Mostra lo stato connesso leggendo /api/integrations/status (googleConnected).
export default function GoogleConnectButton() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(j => setConnected(!!j.googleConnected))
      .catch(() => {})
  }, [])

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      {connected && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>✓ Collegato</span>}
      <button
        onClick={() => { window.location.href = '/api/google/auth/start' }}
        style={{ padding: '8px 16px', fontWeight: 800, fontSize: 12.5, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--glass)', color: '#fff', cursor: 'pointer' }}
      >
        {connected ? 'Ricollega' : 'Collega'}
      </button>
    </div>
  )
}
