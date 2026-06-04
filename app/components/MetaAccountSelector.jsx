'use client'

import { useEffect, useState } from 'react'

// Selettore dell'ad account Meta per il tenant corrente.
// Legge gli account raggiungibili dal token (via /meta-adaccounts) e salva la
// scelta in companies.meta_account_id.
export default function MetaAccountSelector() {
  const [data, setData] = useState(null)
  const [sel, setSel] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/integrations/meta-adaccounts')
      .then(r => r.json())
      .then(j => { if (!cancelled) { setData(j); setSel(j.currentAccountId || '') } })
      .catch(() => { if (!cancelled) setData({ error: 'Errore di rete', accounts: [] }) })
    return () => { cancelled = true }
  }, [])

  const save = async (accountId) => {
    setSel(accountId); setSaved(false); setErr(null)
    if (!accountId) return
    setSaving(true)
    try {
      const r = await fetch('/api/integrations/meta-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Errore')
      setSaved(true)
    } catch (e) {
      setErr(e?.message || 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Carico ad account…</div>
  const accounts = data.accounts || []
  if (data.error || !accounts.length) {
    return <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{data.error ? `Meta: ${data.error}` : 'Nessun ad account dal token (collega Meta prima).'}</div>
  }

  return (
    <div style={{ marginTop: 12, width: '100%' }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 700 }}>
        Ad account usato da questo tenant {saving && <span style={{ color: 'var(--text3)' }}>· salvo…</span>}{saved && <span style={{ color: 'var(--green)' }}>· ✓ salvato</span>}
      </div>
      <select
        value={sel}
        onChange={e => save(e.target.value)}
        disabled={saving}
        className="btn-glass"
        style={{ padding: '8px 12px', fontWeight: 600, width: '100%', cursor: 'pointer' }}
      >
        <option value="" style={{ background: 'var(--surface)' }}>— Scegli un ad account —</option>
        {accounts.map(a => (
          <option key={a.id} value={a.id} style={{ background: 'var(--surface)' }}>
            {a.name} · {a.business || '—'} ({a.accountId})
          </option>
        ))}
      </select>
      {err && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{err}</div>}
    </div>
  )
}
