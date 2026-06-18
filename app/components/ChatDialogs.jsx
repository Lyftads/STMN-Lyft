'use client'

import { useState } from 'react'
import Avatar from './Avatar'
import { useI18n } from '../../lib/i18n/I18nProvider'

const PANEL = { background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 12, padding: 20 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'Barlow', width: '100%', outline: 'none' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '10px 16px', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const ghost = { background: 'transparent', border: '1px solid #3d3d4c', borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'Barlow' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4vh 16px', fontFamily: 'Barlow' }

function MemberRow({ mem, checked, onToggle }) {
  const { t } = useI18n()
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <Avatar name={mem.full_name || mem.email} url={mem.avatar_url} size={26} />
      <span style={{ fontSize: 13, color: '#d0d0d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mem.full_name || mem.email}{(mem.roles || []).includes('guest') ? ` · ${t('ch.guest', null, 'guest')}` : ''}</span>
    </label>
  )
}

export function NewChannelDialog({ members, onClose, onCreate }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [priv, setPriv] = useState(false)
  const [sel, setSel] = useState(new Set())
  const [ext, setExt] = useState('')
  const [busy, setBusy] = useState(false)
  const toggle = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function create() {
    if (!name.trim()) { alert(t('cd.enterName', null, 'Enter a name')); return }
    setBusy(true)
    try {
      const externals = ext.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(e => e.includes('@'))
      await onCreate({ name: name.trim(), is_private: priv, member_ids: [...sel], externals })
    } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(460px,100%)', maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t('ch.newChannel', null, 'New channel')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b0b0bd', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>
        <input style={input} placeholder={t('cd.channelNamePlaceholder', null, 'channel-name (e.g. marketing)')} value={name} onChange={e => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <button onClick={() => setPriv(false)} style={{ ...ghost, flex: 1, ...(priv ? {} : { borderColor: '#7b5bff', color: 'var(--text)' }) }}># {t('cd.public', null, 'Public')}</button>
          <button onClick={() => setPriv(true)} style={{ ...ghost, flex: 1, ...(priv ? { borderColor: '#7b5bff', color: 'var(--text)' } : {}) }}>🔒 {t('cd.private', null, 'Private')}</button>
        </div>
        {priv && (
          <>
            <div style={{ fontSize: 12, color: '#b0b0bd', margin: '6px 0' }}>{t('cd.addMembers', null, 'Add members')}</div>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #3d3d4c', borderRadius: 8, padding: 6 }}>
              {members.map(m => <MemberRow key={m.id} mem={m} checked={sel.has(m.id)} onToggle={() => toggle(m.id)} />)}
            </div>
          </>
        )}
        <div style={{ fontSize: 12, color: '#b0b0bd', margin: '12px 0 6px' }}>{t('cd.inviteExternals', null, 'Invite external people (email, even more than one)')}</div>
        <input style={input} placeholder={t('cd.externalsPlaceholder', null, 'external@email.com, other@email.com')} value={ext} onChange={e => setExt(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={ghost}>{t('ch.cancel', null, 'Cancel')}</button>
          <button onClick={create} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? t('cd.creating', null, 'Creating…') : t('cd.createChannel', null, 'Create channel')}</button>
        </div>
      </div>
    </div>
  )
}

export function ChannelMembersDialog({ channel, members, memberIds, onClose, onToggle, onInvite }) {
  const { t } = useI18n()
  const [ext, setExt] = useState('')
  const [busy, setBusy] = useState(false)
  const set = new Set(memberIds)

  async function invite() {
    const email = ext.trim().toLowerCase()
    if (!email.includes('@')) { alert(t('cd.invalidEmail', null, 'Invalid email')); return }
    setBusy(true)
    try { await onInvite(email); setExt('') } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(460px,100%)', maxHeight: '86vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{t('cd.membersOf', null, 'Members of')} {channel?.is_private ? '🔒' : '#'} {channel?.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b0b0bd', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #3d3d4c', borderRadius: 8, padding: 6 }}>
          {members.map(m => <MemberRow key={m.id} mem={m} checked={set.has(m.id)} onToggle={() => onToggle(m.id, !set.has(m.id))} />)}
        </div>
        <div style={{ fontSize: 12, color: '#b0b0bd', margin: '14px 0 6px' }}>{t('cd.inviteExternalToChannel', null, 'Invite an external person to the channel')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={input} placeholder={t('cd.externalPlaceholder', null, 'external@email.com')} value={ext} onChange={e => setExt(e.target.value)} />
          <button onClick={invite} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : t('cd.invite', null, 'Invite')}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={ghost}>{t('ch.close', null, 'Close')}</button>
        </div>
      </div>
    </div>
  )
}
