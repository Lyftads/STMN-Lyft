'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddClientModal from '../components/AddClientModal'

// Login picker: l'agency/freelance sceglie quale azienda aprire.
// Se l'utente ha un solo workspace, redirect diretto in dashboard.
export default function SelectWorkspacePage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.status === 401 ? Promise.reject('unauth') : r.json())
      .then(d => {
        if (!d?.workspaces?.length) { router.replace('/?tab=dashboard'); return }
        if (d.workspaces.length === 1 && !d.isAgency) { router.replace('/?tab=dashboard'); return }
        setData(d)
      })
      .catch(e => { if (e === 'unauth') router.replace('/login'); else setError('Errore di caricamento') })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (id) => {
    setBusy(true)
    try {
      await fetch('/api/workspaces/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: id }) })
      window.location.href = '/?tab=dashboard'
    } catch { setBusy(false); setError('Impossibile aprire questa azienda') }
  }

  const createClient = async (name) => {
    setAddBusy(true); setAddError(null)
    try {
      const r = await fetch('/api/workspaces/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: name, companyName: name }) })
      const j = await r.json()
      if (j?.workspace?.id) await open(j.workspace.id)
      else { setAddBusy(false); setAddError(j?.error || 'Errore creazione cliente') }
    } catch { setAddBusy(false); setAddError('Errore di rete') }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06060c', color: 'var(--text, #e8e8ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' }}>Scegli l'azienda</div>
          <div style={{ fontSize: 14, color: 'var(--text3, #8b8b99)', marginTop: 6 }}>Seleziona il workspace da aprire</div>
        </div>

        {error && <div style={{ textAlign: 'center', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {!data && !error && <div style={{ textAlign: 'center', color: 'var(--text3, #8b8b99)', padding: 40 }}>Carico…</div>}

        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {data.workspaces.map(w => (
              <button key={w.id} type="button" disabled={busy} onClick={() => open(w.id)} style={{
                textAlign: 'left', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${w.id === data.activeId ? '#2997ff' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #2997ff, #bf5af2)', flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 900, color: '#fff' }}>
                  {(w.label || '?').slice(0, 1).toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text3, #8b8b99)', marginTop: 2 }}>{w.isSelf ? 'Il tuo account' : 'Cliente'}</span>
                </span>
              </button>
            ))}

            {data.isAgency && (
              <button type="button" disabled={busy} onClick={() => { setAddError(null); setAddOpen(true) }} style={{
                cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
                background: 'transparent', border: '1px dashed rgba(34,197,94,0.5)', color: '#22c55e',
                borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 800,
              }}>+ Aggiungi cliente</button>
            )}
          </div>
        )}
      </div>
      <AddClientModal open={addOpen} busy={addBusy} error={addError} onClose={() => setAddOpen(false)} onSubmit={createClient} />
    </div>
  )
}
