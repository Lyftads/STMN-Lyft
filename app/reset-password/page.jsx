'use client'

import { useState } from 'react'
import Icon from '../components/ui/Icon'
import Link from 'next/link'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { AuthShell, AuthInput, AuthButton, AuthError } from '../components/AuthShell'

export default function ResetPasswordRequestPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getBrowserSupabase()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password/confirm`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell title="Email inviata" subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.30)',
          color: '#86efac', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          <Icon name="check" size={14} /> Se l'email <b>{email}</b> e' registrata, riceverai un link per resettare la password entro pochi minuti.
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12.5, color: 'var(--text3)' }}>
          <Link href="/login" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>← Torna al login</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Inserisci la tua email, ti invieremo un link per impostare una nuova password"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthInput
          label="Email"
          type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="tua@azienda.it"
        />
        <AuthError error={error} />
        <AuthButton loading={loading}>Invia link di reset</AuthButton>
      </form>
      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--text3)' }}>
        <Link href="/login" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>← Torna al login</Link>
      </div>
    </AuthShell>
  )
}
