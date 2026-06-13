'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { createPortal } from 'react-dom'

// Meta: pulsante Collega (OAuth Nango) → al termine apre un POP-UP per
// selezionare gli ad account. Pulsante "Ad account" per riaprire il pop-up.
export default function MetaConnectButton() {
  const [connecting, setConnecting] = useState(false)
  const [modal, setModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [connected, setConnected] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => { setMounted(true) }, [])

  // Stato persistente: connesso se esiste una connection 'facebook' salvata.
  const refreshStatus = () => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(j => setConnected(Array.isArray(j.connected) && j.connected.includes('facebook')))
      .catch(() => {})
  }
  useEffect(() => { refreshStatus() }, [])

  const openConnect = async () => {
    setConnecting(true); setErr(null)
    try {
      const r = await fetch('/api/integrations/connect-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedIntegrations: ['facebook'] }),
      })
      const j = await r.json()
      if (!r.ok || !j.sessionToken) throw new Error(j.error || 'Sessione non creata')

      const mod = await import('@nangohq/frontend')
      const Nango = mod.default || mod.Nango
      const nango = new Nango()
      let settled = false
      const onEvent = async (e) => {
        const t = e?.type
        if ((t === 'connect' || t === 'connection') && !settled) {
          settled = true
          const p = e?.payload || {}
          const connectionId = p.connectionId || p.connection_id
          const provider = p.providerConfigKey || p.provider_config_key || 'facebook'
          if (connectionId) {
            await fetch('/api/integrations/save-connection', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ integrationId: provider, connectionId }),
            }).catch(() => {})
          }
          setConnected(true)
          refreshStatus()
          setConnecting(false)
          setModal(true) // apri pop-up selezione ad account
        } else if (t === 'close') {
          setConnecting(false)
        }
      }
      const c = nango.openConnectUI({ sessionToken: j.sessionToken, onEvent })
      if (c && typeof c.setSessionToken === 'function') c.setSessionToken(j.sessionToken)
    } catch (e) {
      setErr(e?.message || 'Errore di collegamento')
      setConnecting(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={openConnect} disabled={connecting} style={btn}>
            {connecting ? 'Collegamento…' : (connected ? 'Ricollega' : 'Collega')}
          </button>
          <button onClick={() => setModal(true)} style={{ ...btn, background: 'transparent' }}>
            Ad account
          </button>
          {connected && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="check" size={12} /> Collegato</span>}
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 11 }}>{err}</div>}
      </div>
      {mounted && modal && createPortal(<AdAccountModal onClose={() => setModal(false)} />, document.body)}
    </>
  )
}

const btn = {
  padding: '8px 16px', fontWeight: 800, fontSize: 12.5, borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', cursor: 'pointer',
}

// ── Pop-up selezione ad account ──────────────────────────────────────────
function AdAccountModal({ onClose }) {
  const [data, setData] = useState(null)
  const [sel, setSel] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/integrations/meta-adaccounts')
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        setData(j)
        const cur = String(j.currentAccountId || '')
        const set = new Set()
        for (const a of (j.accounts || [])) if (cur.includes(a.accountId) || cur.includes(a.id)) set.add(a.id)
        setSel(set)
      })
      .catch(() => { if (!cancelled) setData({ error: 'Errore di rete', accounts: [] }) })
    return () => { cancelled = true }
  }, [])

  const toggle = (id) => { setSaved(false); setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  const save = async () => {
    setSaving(true); setSaved(false); setErr(null)
    try {
      const accountId = [...sel].join(',')
      const r = await fetch('/api/integrations/meta-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Errore')
      setSaved(true)
      setTimeout(onClose, 700)
    } catch (e) { setErr(e?.message || 'Errore salvataggio') } finally { setSaving(false) }
  }

  const accounts = data?.accounts || []

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      zIndex: 100, display: 'grid', placeItems: 'center', animation: 'fadeUp .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(560px, 92vw)', maxHeight: '82vh', overflow: 'hidden',
        background: 'rgba(12,12,20,0.98)', border: '1px solid var(--border)', borderRadius: 18,
        boxShadow: '0 40px 100px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Seleziona ad account Meta</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>Scegli gli account usati da questo tenant</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 9, width: 30, height: 30, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto' }}>
          {!data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>Carico ad account…</div>}
          {data && (data.error || !accounts.length) && (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: 12 }}>{data.error ? `Meta: ${data.error}` : 'Nessun ad account dal token. Collega prima Meta.'}</div>
          )}
          {accounts.length > 0 && (
            <div style={{ display: 'grid', gap: 5 }}>
              {accounts.map(a => {
                const on = sel.has(a.id)
                return (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', background: on ? 'rgba(41,151,255,0.14)' : 'rgba(255,255,255,0.03)', border: `1px solid ${on ? 'rgba(41,151,255,0.4)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={on} onChange={() => toggle(a.id)} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{a.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{a.business || '—'} · {a.accountId}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={save} disabled={saving || !accounts.length} style={{ ...btn, opacity: saving || !accounts.length ? 0.5 : 1 }}>
            {saving ? 'Salvo…' : `Salva (${sel.size})`}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}><Icon name="check" size={11} /> salvato</span>}
          {err && <span style={{ fontSize: 12, color: 'var(--red)' }}>{err}</span>}
        </div>
      </div>
    </div>
  )
}
