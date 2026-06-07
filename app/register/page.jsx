'use client'

import { useState } from 'react'
import Icon from '../components/ui/Icon'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { AuthShell, AuthInput, AuthButton, AuthError } from '../components/AuthShell'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri')
      return
    }
    setLoading(true)
    const supabase = getBrowserSupabase()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Metadata custom — il trigger DB legge questi per creare la riga companies
        data: { name, company_name: company },
        emailRedirectTo: `${origin}/auth/callback?next=/`,
      },
    })
    setLoading(false)
    if (error) {
      if (error.message?.includes('already registered')) {
        setError('Email gia\' registrata. Fai login o resetta la password.')
      } else {
        setError(error.message)
      }
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <AuthShell title="Conferma la tua email" subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.30)',
          color: '#86efac', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          <Icon name="check" size={14} /> Account creato. Ti abbiamo inviato una email a <b>{email}</b>: clicca sul link di conferma per attivare l'account.
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12.5, color: 'var(--text3)' }}>
          Non hai ricevuto l'email? Controlla lo spam o{' '}
          <Link href="/register" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>riprova</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Crea il tuo account"
      subtitle="Inizia a misurare e ottimizzare il tuo brand DTC"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthInput
          label="Nome e cognome"
          type="text" autoComplete="name" required
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Mario Rossi"
        />
        <AuthInput
          label="Nome azienda"
          type="text" autoComplete="organization" required
          value={company} onChange={e => setCompany(e.target.value)}
          placeholder="Nome del brand / azienda"
        />
        <AuthInput
          label="Email"
          type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="tua@azienda.it"
        />
        <AuthInput
          label="Password"
          type="password" autoComplete="new-password" required
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Minimo 8 caratteri"
          hint="Almeno 8 caratteri. Usa caratteri speciali per maggiore sicurezza."
        />
        <AuthError error={error} />
        <AuthButton loading={loading}>Crea account</AuthButton>
      </form>
      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--text3)' }}>
        Hai gia\' un account?{' '}
        <Link href="/login" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>
          Accedi
        </Link>
      </div>
    </AuthShell>
  )
}
