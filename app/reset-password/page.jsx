'use client'

import { useState } from 'react'
import Icon from '../components/ui/Icon'
import Link from 'next/link'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { AuthShell, AuthInput, AuthButton, AuthError } from '../components/AuthShell'
import { useI18n } from '../../lib/i18n/I18nProvider'

export default function ResetPasswordRequestPage() {
  const { t } = useI18n()
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
      <AuthShell title={t('rp.emailSent', null, 'Email sent')} subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.30)',
          color: '#86efac', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          <Icon name="check" size={14} /> {t('rp.sentPre', null, 'If the email ')}<b>{email}</b>{t('rp.sentPost', null, ' is registered, you will receive a password reset link within a few minutes.')}
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12.5, color: 'var(--text3)' }}>
          <Link href="/login" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>{t('auth.backToLogin', null, '← Back to login')}</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t('rp.title', null, 'Reset password')}
      subtitle={t('rp.subtitle', null, "Enter your email and we'll send you a link to set a new password")}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthInput
          label="Email"
          type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder={t('auth.emailPlaceholder', null, 'you@company.com')}
        />
        <AuthError error={error} />
        <AuthButton loading={loading}>{t('rp.sendLink', null, 'Send reset link')}</AuthButton>
      </form>
      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--text3)' }}>
        <Link href="/login" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>{t('auth.backToLogin', null, '← Back to login')}</Link>
      </div>
    </AuthShell>
  )
}
