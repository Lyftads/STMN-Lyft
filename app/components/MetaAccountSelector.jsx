'use client'

import { useEffect, useState } from 'react'

// Selettore (multi) degli ad account Meta per il tenant corrente.
// Legge gli account raggiungibili dal token (/meta-adaccounts) e salva la
// scelta (anche multipla, comma-separated) in companies.meta_account_id.
export default function MetaAccountSelector() {
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
        // pre-seleziona dagli account attualmente attivi (env o salvati)
        const cur = String(j.currentAccountId || '')
        const set = new Set()
        for (const a of (j.accounts || [])) {
          if (cur.includes(a.accountId) || cur.includes(a.id)) set.add(a.id)
        }
        setSel(set)
      })
      .catch(() => { if (!cancelled) setData({ error: 'Errore di rete', accounts: [] }) })
    return () => { cancelled = true }
  }, [])

  const toggle = (id) => {
    setSaved(false)
    setSel(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const save = async () => {
    setSaving(true); setSaved(false); setErr(null)
    try {
      const accountId = [...sel].join(',') // formato "act_1,act_2"
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
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 700 }}>
        Ad account usati da questo tenant ({sel.size} selezionati)
      </div>
      <div style={{ maxHeight: 190, overflowY: 'auto', display: 'grid', gap: 4, border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
        {accounts.map(a => {
          const on = sel.has(a.id)
          return (
            <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 8, cursor: 'pointer', background: on ? 'rgba(41,151,255,0.12)' : 'transparent' }}>
              <input type="checkbox" checked={on} onChange={() => toggle(a.id)} />
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{a.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>· {a.business || '—'} · {a.accountId}</span>
            </label>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button onClick={save} disabled={saving} className="btn-glass" style={{ padding: '7px 16px', fontWeight: 800, fontSize: 12, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Salvo…' : 'Salva selezione'}
        </button>
        {saved && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✓ salvato</span>}
        {err && <span style={{ fontSize: 11, color: 'var(--red)' }}>{err}</span>}
      </div>
    </div>
  )
}
