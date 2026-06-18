'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Modal per creare/collegare una nuova azienda cliente (agency multi-workspace).
// Sostituisce il window.prompt. Controllato: open + onSubmit(name) async + busy + error.
export default function AddClientModal({ open, onClose, onSubmit, busy = false, error = null }) {
  const { t } = useI18n()
  const [name, setName] = useState('')

  useEffect(() => { if (open) setName('') }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open || typeof document === 'undefined') return null

  const canSubmit = name.trim().length >= 2 && !busy
  const submit = () => { if (canSubmit) onSubmit?.(name.trim()) }

  return createPortal((
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.() }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(5,5,12,0.72)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{
        width: '100%', maxWidth: 440, background: 'var(--surface, #0d0d16)', border: '1px solid var(--border)',
        borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #2997ff, #bf5af2)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 20, fontWeight: 900, color: '#fff' }}>+</span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.01em' }}>{t('acm.title', null, 'Add a company')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('acm.subtitle', null, 'Create a new client workspace to manage')}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 24px 8px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{t('reg.companyName', null, 'Company name')}</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder={t('acm.placeholder', null, 'e.g. Acme Inc.')}
            disabled={busy}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 11,
              background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)',
              fontSize: 14, fontWeight: 600, outline: 'none',
            }}
          />
          {error && <div style={{ marginTop: 10, fontSize: 12.5, color: '#fca5a5' }}>{error}</div>}
          <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
            {t('acm.helper', null, 'After creation you will enter the new workspace, where you can connect its integrations (Meta, Klaviyo, Shopify, Google).')}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px 22px' }}>
          <button type="button" onClick={() => !busy && onClose?.()} disabled={busy} style={{
            padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--glass)',
            color: 'var(--text2)', fontSize: 13.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
          }}>{t('common.cancel', null, 'Cancel')}</button>
          <button type="button" onClick={submit} disabled={!canSubmit} style={{
            padding: '11px 22px', borderRadius: 11, border: 'none',
            background: canSubmit ? 'linear-gradient(135deg, #2997ff, #bf5af2)' : 'var(--glass2, rgba(255,255,255,0.06))',
            color: canSubmit ? '#fff' : 'var(--text3)', fontSize: 13.5, fontWeight: 800,
            cursor: canSubmit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {busy && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: 999, animation: 'spin 1s linear infinite' }} />}
            {busy ? t('acm.creating', null, 'Creating…') : t('acm.createWorkspace', null, 'Create workspace')}
          </button>
        </div>
      </div>
    </div>
  ), document.body)
}
