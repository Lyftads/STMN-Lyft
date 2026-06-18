'use client'

import { useState } from 'react'
import Avatar from './Avatar'
import { useI18n } from '../../lib/i18n/I18nProvider'

const PANEL = { background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 12, padding: 20 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'Barlow', width: '100%', outline: 'none' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '10px 16px', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }

export default function ProfileModal({ profile, onClose, onSaved }) {
  const { t } = useI18n()
  const [name, setName] = useState(profile?.full_name || '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(profile?.avatar_url || null)
  const [saving, setSaving] = useState(false)

  function pick(e) {
    const f = e.target.files && e.target.files[0]
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)) }
  }

  async function save() {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('full_name', name.trim())
      if (file) fd.append('avatar', file)
      const r = await fetch('/api/profile', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({}))
      if (r.ok) { if (onSaved) onSaved(r.profile); onClose() }
      else alert(r.error || t('profile.saveError', null, 'Error saving profile'))
    } finally { setSaving(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px', fontFamily: 'Barlow' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(420px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t('profile.title', null, 'My profile')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b0b0bd', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <Avatar name={name || profile?.email} url={preview} size={64} />
          <label style={{ ...btn, background: 'transparent', border: '1px solid #3d3d4c', cursor: 'pointer' }}>
            {t('profile.changePhoto', null, 'Change photo')}
            <input type="file" hidden accept=".png,.jpg,.jpeg,.webp,.gif" onChange={pick} />
          </label>
        </div>

        <label style={{ fontSize: 12, color: '#b0b0bd' }}>{t('profile.fullName', null, 'Full name')}</label>
        <input style={{ ...input, marginTop: 6, marginBottom: 8 }} placeholder={t('profile.namePlaceholder', null, 'Jane Doe')} value={name} onChange={e => setName(e.target.value)} />
        <div style={{ fontSize: 12, color: '#6b6b78', marginBottom: 16 }}>{profile?.email}</div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ ...btn, background: 'transparent', border: '1px solid #3d3d4c' }}>{t('common.cancel', null, 'Cancel')}</button>
          <button onClick={save} disabled={saving} style={{ ...btn, opacity: saving ? 0.6 : 1 }}>{saving ? t('metaConnect.saving', null, 'Saving…') : t('common.save', null, 'Save')}</button>
        </div>
      </div>
    </div>
  )
}
