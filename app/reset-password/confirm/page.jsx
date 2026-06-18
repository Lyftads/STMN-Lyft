'use client'

import { useState, useEffect } from 'react'
import Icon from '../../components/ui/Icon'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBrowserSupabase } from '../../../lib/supabase/client'
import { AuthShell, AuthInput, AuthButton, AuthError } from '../../components/AuthShell'
import { useI18n } from '../../../lib/i18n/I18nProvider'

export default function ResetPasswordConfirmPage() {
  const { t } = useI18n()
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
    if (password.length < 8) { setError(t('reg.pwShort', null, 'Password must be at least 8 characters')); return }
    if (password !== confirm) { setError(t('rpc.pwMismatch', null, 'Passwords do not match')); return }
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
      <AuthShell title={t('rpc.pwUpdated', null, 'Password updated')} subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)',
          color: '#86efac', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          <Icon name="check" size={14} /> {t('rpc.redirecting', null, 'Password updated. Redirecting to the dashboard…')}
        </div>
      </AuthShell>
    )
  }

  if (!hasSession) {
    return (
      <AuthShell title={t('rpc.invalidLink', null, 'Invalid link')} subtitle="">
        <div style={{
          padding: 18, borderRadius: 12,
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)',
          color: '#fca5a5', fontSize: 13.5, lineHeight: 1.6, textAlign: 'center',
        }}>
          {t('rpc.linkExpired', null, 'The reset link is expired or invalid. Request a new link.')}
        </div>
        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Link href="/reset-password" style={{ color: '#bf5af2', fontWeight: 700, textDecoration: 'none' }}>
            {t('rpc.requestNew', null, 'Request new link →')}
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t('rpc.title', null, 'New password')}
      subtitle={t('rpc.subtitle', null, 'Choose a new password for your account')}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthInput
          label={t('rpc.title', null, 'New password')}
          type="password" autoComplete="new-password" required
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder={t('reg.pwPlaceholder', null, 'At least 8 characters')}
        />
        <AuthInput
          label={t('rpc.confirmLabel', null, 'Confirm password')}
          type="password" autoComplete="new-password" required
          value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder={t('rpc.repeatPw', null, 'Repeat the password')}
        />
        <AuthError error={error} />
        <AuthButton loading={loading}>{t('rpc.updateBtn', null, 'Update password')}</AuthButton>
      </form>
    </AuthShell>
  )
}
