'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { AuthShell, AuthInput, AuthButton, AuthError } from '../components/AuthShell'

export default function LoginPage() {
  // useSearchParams richiede una Suspense boundary in Next 14 SSG
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const nextUrl = search.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getBrowserSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email o password errati'
        : error.message)
      return
    }
    // Agency/freelance con più aziende → schermata di scelta workspace.
    try {
      const ws = await fetch('/api/workspaces').then(r => r.ok ? r.json() : null)
      const multi = ws && (ws.isAgency || (ws.workspaces?.length || 0) > 1)
      if (multi && (nextUrl === '/' || nextUrl.startsWith('/?'))) {
        router.push('/select-workspace')
        router.refresh()
        return
      }
    } catch {}
    router.push(nextUrl)
    router.refresh()
  }

  return (
    <AuthShell
      title="Bentornato"
      subtitle="Accedi al tuo account Lyft per continuare"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthInput
          label="Email"
          type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="tua@azienda.it"
        />
        <AuthInput
          label="Password"
          type="password" autoComplete="current-password" required
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
          <Link href="/reset-password" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>
            Password dimenticata?
          </Link>
        </div>
        <AuthError error={error} />
        <AuthButton loading={loading}>Accedi</AuthButton>
      </form>
      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--text3)' }}>
        Non hai un account?{' '}
        <Link href="/register" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>
          Registrati
        </Link>
      </div>
    </AuthShell>
  )
}
