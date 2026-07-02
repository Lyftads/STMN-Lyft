'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import { markDataWarming } from './PreparingDataBanner'

// Pulsante che apre la Nango Connect UI per collegare un provider OAuth.
// Flusso: crea session (backend) → openConnectUI → on 'connect' salva il
// connectionId nel tenant (companies.nango_connections).
export default function NangoConnectButton({ integrationId, label = 'Collega', onConnected, style }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(null)

  // Stato persistente: già collegato se la sua integration è in companies.
  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(j => { if (Array.isArray(j.connected) && j.connected.includes(integrationId)) setDone(true) })
      .catch(() => {})
  }, [integrationId])

  // Scollega: rimuove la connection dal tenant (companies.nango_connections) →
  // l'utente può rifare il collegamento da zero. Utile quando il badge dice
  // "Collegato" per una connection vecchia/residua.
  const disconnect = async () => {
    setErr(null)
    try {
      await fetch(`/api/integrations/save-connection?integrationId=${encodeURIComponent(integrationId)}`, { method: 'DELETE' })
      setDone(false)
    } catch (e) {
      setErr(e?.message || 'Errore disconnessione')
    }
  }

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
            // Warm-up: appena Shopify è collegato, avvia in BACKGROUND i calcoli
            // pesanti (storico metrics + bulk clienti + CRO + LTV) così sono pronti
            // quando il cliente apre le dashboard, invece di aspettare ~minuti al
            // primo click ("sembra rotto"). Girano mentre finisce l'onboarding.
            if (provider === 'shopify' || integrationId === 'shopify') {
              markDataWarming() // mostra il banner "preparazione dati" con countdown
              for (const u of ['/api/metrics?force=1', '/api/customers?refresh=1', '/api/cro?refresh=1&days=30', '/api/ltv-cohorts?force=1&months=12']) {
                try { fetch(u, { cache: 'no-store' }).catch(() => {}) } catch {}
              }
            }
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
          padding: '8px 14px', fontWeight: 800, fontSize: 12.5, borderRadius: 10,
          border: done ? '1px solid rgba(48,209,88,0.40)' : '1px solid var(--border)',
          background: done ? 'rgba(48,209,88,0.15)' : 'var(--glass)',
          color: done ? 'var(--green)' : 'var(--text)',
          cursor: loading || done ? 'default' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          ...(done ? {} : style),
        }}
      >
        {done ? <><Icon name="check" size={12} /> Collegato</> : loading ? 'Collegamento…' : label}
      </button>
      {done && (
        <button
          onClick={disconnect}
          style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 11, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          {t('obp.disconnectReconnect', null, 'Scollega e ricollega')}
        </button>
      )}
      {err && <div style={{ color: 'var(--red)', fontSize: 11 }}>{err}</div>}
    </div>
  )
}
