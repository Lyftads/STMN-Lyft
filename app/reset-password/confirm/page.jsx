'use client'

import { useState, useEffect } from 'react'
import Icon from '../../components/ui/Icon'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBrowserSupabase } from '../../../lib/supabase/client'
import { AuthShell, AuthInput, AuthButton, AuthError } from '../../components/AuthShell'

export default function ResetPasswordConfirmPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  // Quando Supabase apre questa pagina dal link email, la sessione e'
  // gia' attiva (parsing del hash #access_token=... gestito dal SDK).
  useEffect(() => {
    const supabase = getBrowserSupabase()
    supabase.auth.getUser().then(({ data: { user } }) => setHasSession(!!user))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La password deve avere almeno 8 caratteri'); return }
    if (password !== confirm) { setError('Le password non corrispondono'); return }
    setLoading(true)
    const supabase = getBrowserSupabase()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/'), 2000)
  }

  if (done) {
    return (
      <AuthShell title="Password aggiornata" subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)',
          color: '#86efac', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          <Icon name="check" size={14} /> Password aggiornata. Reindirizzamento alla dashboard…
        </div>
      </AuthShell>
    )
  }

  if (!hasSession) {
    return (
      <AuthShell title="Link non valido" subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)',
          color: '#fca5a5', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          Il link di reset e' scaduto o invalido. Richiedi un nuovo link.
        </div>
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Link href="/reset-password" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>
            Richiedi nuovo link →
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Nuova password"
      subtitle="Scegli una nuova password per il tuo account"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthInput
          label="Nuova password"
          type="password" autoComplete="new-password" required
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Minimo 8 caratteri"
        />
        <AuthInput
          label="Conferma password"
          type="password" autoComplete="new-password" required
          value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="Ripeti la password"
        />
        <AuthError error={error} />
        <AuthButton loading={loading}>Aggiorna password</AuthButton>
      </form>
    </AuthShell>
  )
}
