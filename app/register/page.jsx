'use client'

import { useState } from 'react'
import Icon from '../components/ui/Icon'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { AuthShell, AuthInput, AuthButton, AuthError } from '../components/AuthShell'
import { useI18n } from '../../lib/i18n/I18nProvider'

export default function RegisterPage() {
  const { t } = useI18n()
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
      setError(t('reg.pwShort', null, 'Password must be at least 8 characters'))
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
        setError(t('reg.emailTaken', null, 'Email already registered. Log in or reset your password.'))
      } else {
        setError(error.message)
      }
      return
    }
    setSuccess(true)
  }

  if (success) {
    return (
      <AuthShell title={t('reg.confirmEmail', null, 'Confirm your email')} subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.30)',
          color: '#86efac', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          <Icon name="check" size={14} /> {t('reg.accountCreatedPre', null, 'Account created. We sent an email to ')}<b>{email}</b>{t('reg.accountCreatedPost', null, ': click the confirmation link to activate the account.')}
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12.5, color: 'var(--text3)' }}>
          {t('reg.notReceived', null, "Didn't receive the email? Check your spam or")}{' '}
          <Link href="/register" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>{t('reg.retry', null, 'try again')}</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t('reg.title', null, 'Create your account')}
      subtitle={t('reg.subtitle', null, 'Start measuring and optimizing your DTC brand')}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthInput
          label={t('profile.fullName', null, 'Full name')}
          type="text" autoComplete="name" required
          value={name} onChange={e => setName(e.target.value)}
          placeholder={t('profile.namePlaceholder', null, 'Jane Doe')}
        />
        <AuthInput
          label={t('reg.companyName', null, 'Company name')}
          type="text" autoComplete="organization" required
          value={company} onChange={e => setCompany(e.target.value)}
          placeholder={t('reg.companyPlaceholder', null, 'Brand / company name')}
        />
        <AuthInput
          label="Email"
          type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder', null, 'you@company.com')}
        />
        <AuthInput
          label="Password"
          type="password" autoComplete="new-password" required
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder={t('reg.pwPlaceholder', null, 'At least 8 characters')}
          hint={t('reg.pwHint', null, 'At least 8 characters. Use special characters for more security.')}
        />
        <AuthError error={error} />
        <AuthButton loading={loading}>{t('reg.createAccount', null, 'Create account')}</AuthButton>
      </form>
      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--text3)' }}>
        {t('reg.haveAccount', null, 'Already have an account?')}{' '}
        <Link href="/login" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>
          {t('auth.login', null, 'Log in')}
        </Link>
      </div>
    </AuthShell>
  )
}
