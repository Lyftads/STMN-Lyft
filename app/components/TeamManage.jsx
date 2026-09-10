'use client'

import { useState } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { MEMBER_TABS, TAB_LABELS } from '../../lib/team/roleTabs'

// ============================================================================
//  Gestione team — inviti, ruoli e visibilità delle tab.
//  Vive nel menu System come tab a sé (prima era un modale dentro Progetti &
//  Task, dove nessuno lo trovava). Lo stesso pannello si usa incorporato.
// ============================================================================

const STATUS_BADGE = {
  invited: { key: 'tk.statusInvited', en: 'Invited', label: 'Invitato', color: '#ff9f0a' },
  active: { key: 'tk.statusActive', en: 'Active', label: 'Attivo', color: '#30d158' },
  disabled: { key: 'tk.statusDisabled', en: 'Disabled', label: 'Disattivato', color: '#b0b0bd' },
}

const PANEL = { background: '#15151f', border: '1px solid #3d3d4c', borderRadius: 12, padding: 18 }
const card = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }
const input = { background: '#14141d', border: '1px solid #3d3d4c', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', width: '100%', fontSize: 13, outline: 'none' }
const btn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnGhost = { background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text)', fontSize: 12.5, cursor: 'pointer' }

export function TeamManagePanel({ embedded = false, members, rolesCatalog, roleLabels, ownerUserId, seats, hiddenTabs = [], customRoles = [], onSaveHiddenTabs, onAddRole, onRemoveRole, onClose, onInvite, onUpdateRoles, onRemove }) {
  const { t } = useI18n()
  const atLimit = seats && seats.limit != null && seats.used >= seats.limit
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState([])
  const [sending, setSending] = useState(false)
  const [created, setCreated] = useState(null)
  const [newRole, setNewRole] = useState('')
  const [roleBusy, setRoleBusy] = useState(false)
  const [roleErr, setRoleErr] = useState(null)
  const customIds = new Set((customRoles || []).map(r => r.id))

  async function addRole() {
    const label = newRole.trim()
    if (!label) return
    setRoleBusy(true); setRoleErr(null)
    const r = await onAddRole?.(label)
    if (r && r.ok === false) setRoleErr(r.error || 'Errore')
    else setNewRole('')
    setRoleBusy(false)
  }

  const toggle = (arr, r) => arr.includes(r) ? arr.filter(x => x !== r) : [...arr, r]

  // Visibilità tab per i membri: l'Admin nasconde/mostra singole tab. Una tab è
  // "nascosta" se presente in hiddenTabs → i membri (non Admin) non la vedono.
  const hidden = new Set(hiddenTabs)
  const toggleTab = (id) => {
    const next = hidden.has(id) ? hiddenTabs.filter(x => x !== id) : [...hiddenTabs, id]
    onSaveHiddenTabs?.(next)
  }

  async function submit() {
    if (!email.trim() || !email.includes('@')) { alert(t('tk.invalidEmail', null, 'Enter a valid email')); return }
    setSending(true)
    setCreated(null)
    try {
      const target = email.trim().toLowerCase()
      const r = await onInvite(target, roles)
      if (r && r.ok) {
        setEmail(''); setRoles([])
        setCreated({ email: target, password: r.tempPassword, emailSent: r.emailSent })
      }
    } finally { setSending(false) }
  }

  // Come tab occupa la pagina; come modale resta sovrapposto. Stesso contenuto.
  // Da tab le sezioni sono card affiancate al resto dell'app, a tutta
  // larghezza; da modale restano dentro la scatola sovrapposta.
  const sec = embedded
    ? { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }
    : null
  const Wrapper = ({ children }) => embedded ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', zIndex: 2 }}>{children}</div>
  ) : (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...PANEL, width: 'min(680px, 100%)', maxWidth: 680, maxHeight: '86vh', overflowY: 'auto' }}>{children}</div>
    </div>
  )

  return (
    <Wrapper>
        {/* Come tab il titolo lo mette già il guscio: ripeterlo è rumore. */}
        <div style={{ display: embedded ? 'none' : 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700 }}>{t('tk.teamMgmt', null, 'Gestione team')}</h3>
          {!embedded && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b0b0bd', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>}
        </div>

        {/* Contatore posti del piano */}
        {seats && (
          <div style={{ ...(sec || {}), marginTop: embedded ? 0 : 14, padding: embedded ? 18 : '10px 14px', borderRadius: embedded ? 14 : 10, border: `1px solid ${atLimit ? 'rgba(255,55,95,0.4)' : 'var(--border)'}`, background: atLimit ? 'rgba(255,55,95,0.08)' : 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{t('tk.teamUsersLabel', null, 'Team users:')} {seats.used}{seats.limit != null ? ` / ${seats.limit}` : ''}</span>
            <span style={{ color: '#b0b0bd' }}>{seats.limit == null ? t('tk.unlimitedPlan', null, 'unlimited on your plan') : atLimit ? t('tk.limitReached', null, '· limit reached, upgrade to add more') : t('tk.planLabel', { plan: seats.plan || '' }, '· {plan} plan')}</span>
          </div>
        )}

        {/* Invita */}
        <div style={{ ...(sec || { padding: 14, border: '1px solid var(--border)', borderRadius: 10 }), marginTop: embedded ? 0 : 16, opacity: atLimit ? 0.55 : 1 }}>
          <div style={{ fontSize: 12, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{t('tk.inviteCollaborator', null, 'Invite a collaborator')}</div>
          <input style={input} placeholder={t('tk.emailPlaceholder', null, 'email@example.com')} value={email} onChange={e => setEmail(e.target.value)} disabled={atLimit} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {rolesCatalog.map(r => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 10px', border: `1px solid ${roles.includes(r) ? '#5b8bff' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(prev => toggle(prev, r))} />
                {roleLabels[r] || r}
                {customIds.has(r) && onRemoveRole && (
                  <span role="button" title={t('tk.removeRole', null, 'Elimina ruolo')}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(t('tk.removeRoleConfirm', null, 'Eliminare il ruolo?'))) onRemoveRole(r) }}
                    style={{ marginLeft: 2, color: '#b0b0bd', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}>x</span>
                )}
              </label>
            ))}
          </div>

          {/* Ruolo su misura: i quattro di serie non bastano a tutti */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <input
              style={{ ...input, width: 'auto', flex: '1 1 220px', maxWidth: 300 }}
              placeholder={t('tk.newRolePlaceholder', null, 'Nuovo ruolo (es. Store manager)')}
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
            />
            <button type="button" style={{ ...btnGhost, opacity: (roleBusy || !newRole.trim()) ? 0.5 : 1 }}
              disabled={roleBusy || !newRole.trim()} onClick={addRole}>
              + {t('tk.addRole', null, 'Crea ruolo')}
            </button>
            {roleErr && <span style={{ fontSize: 12, color: '#fca5a5' }}>{roleErr}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button style={{ ...btn, opacity: (sending || atLimit) ? 0.6 : 1 }} disabled={sending || atLimit} onClick={submit}>
              {sending ? t('tk.creatingAccess', null, 'Creating access…') : atLimit ? t('tk.planLimitReached', null, 'Plan limit reached') : t('tk.createAccessInvite', null, 'Create access & invite')}
            </button>
          </div>

          {created && (
            <div style={{ marginTop: 12, padding: 14, border: '1px solid #30d158', borderRadius: 10, background: 'rgba(48,209,88,0.08)' }}>
              <div style={{ fontWeight: 700, color: '#30d158', marginBottom: 6 }}><Icon name="check" size={13} /> {t('tk.accessReadyFor', { email: created.email }, 'Access ready for {email}')}</div>
              {created.password
                ? <div style={{ fontSize: 14 }}>{t('tk.tempPassword', null, 'Temporary password:')} <b style={{ fontFamily: 'monospace', userSelect: 'all', background: 'var(--surface)', padding: '2px 6px', borderRadius: 5 }}>{created.password}</b></div>
                : <div style={{ fontSize: 14 }}>{t('tk.existingAccount', null, 'Questa email ha già un account LyftAI: accede con la sua password abituale.')}</div>}
              <div style={{ fontSize: 12, color: '#b0b0bd', marginTop: 8 }}>
                {created.emailSent ? t('tk.emailSentToo', null, 'Also sent via email. ') : t('tk.emailNotSent', null, 'Email not sent: share these credentials yourself. ')}
                {t('tk.loginInstructions', null, 'The collaborator logs in at /login and can change the password from the reset page.')}
              </div>
            </div>
          )}
        </div>

        {/* Visibilità tab per i membri (Admin) */}
        <div style={{ ...(sec || { padding: 14, border: '1px solid var(--border)', borderRadius: 10 }), marginTop: embedded ? 0 : 16 }}>
          <div style={{ fontSize: 12, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{t('tk.tabVisibility', null, 'Tab visibility for members')}</div>
          <div style={{ fontSize: 12, color: '#8a8a98', marginBottom: 10 }}>{t('tk.tabVisibilityHint', null, 'Members see everything by default. Click a tab to hide it from them (you, the Admin, always see all).')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {MEMBER_TABS.map(id => {
              const isHidden = hidden.has(id)
              return (
                <button key={id} type="button" onClick={() => toggleTab(id)} title={isHidden ? t('tk.tabHiddenTip', null, 'Hidden from members — click to show') : t('tk.tabVisibleTip', null, 'Visible to members — click to hide')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${isHidden ? 'rgba(255,55,95,0.4)' : 'var(--border)'}`,
                    background: isHidden ? 'rgba(255,55,95,0.10)' : 'rgba(255,255,255,0.02)',
                    color: isHidden ? '#ff6482' : 'var(--text)', textDecoration: isHidden ? 'line-through' : 'none' }}>
                  <Icon name={isHidden ? 'eye-off' : 'eye'} size={12} />
                  {TAB_LABELS[id] || id}
                </button>
              )
            })}
          </div>
        </div>

        {/* Membri */}
        {/* Card dei membri solo se ce ne sono: da tab una scatola vuota in
            fondo alla pagina sembra un errore di caricamento. */}
        <div style={{ ...((embedded && members.length === 0) ? { display: 'none' } : (sec || {})), marginTop: embedded ? 0 : 18, display: (embedded && members.length === 0) ? 'none' : 'flex', flexDirection: 'column', gap: 8 }}>
          {embedded && members.length > 0 && (
            <div style={{ fontSize: 12, color: '#b0b0bd', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>
              {t('tk.teamMembers', null, 'Membri del team')}
            </div>
          )}
          {members.map(m => {
            const isOwner = m.user_id && m.user_id === ownerUserId || (m.roles || []).includes('admin')
            const badge = STATUS_BADGE[m.status] || STATUS_BADGE.invited
            return (
              <div key={m.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{m.full_name || m.email}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, border: `1px solid ${badge.color}55`, borderRadius: 6, padding: '2px 6px', textTransform: 'uppercase' }}>{isOwner ? t('tk.admin', null, 'Admin') : t(badge.key, null, badge.en)}</span>
                  {!isOwner && (
                    <button
                      onClick={async () => {
                        const r = await onInvite(m.email, m.roles || [])
                        if (r && r.ok) setCreated({ email: m.email, password: r.tempPassword, emailSent: r.emailSent })
                      }}
                      title={t('tk.resendAccessTip', null, 'Regenerate and resend the password')}
                      style={{ ...btnGhost, padding: '4px 10px', fontSize: 11 }}
                    ><Icon name="key" size={12} /> {t('tk.resendAccess', null, 'Resend access')}</button>
                  )}
                  {!isOwner && <button onClick={() => onRemove(m.id)} title={t('tk.removeTip', null, 'Remove')} style={{ background: 'none', border: 'none', color: '#ff375f', cursor: 'pointer', fontSize: 16 }}>×</button>}
                </div>
                {m.full_name && <div style={{ fontSize: 12, color: '#b0b0bd' }}>{m.email}</div>}
                {!isOwner && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {rolesCatalog.map(r => {
                      const on = (m.roles || []).includes(r)
                      return (
                        <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 8px', border: `1px solid ${on ? '#5b8bff' : 'var(--border)'}`, borderRadius: 7, cursor: 'pointer' }}>
                          <input type="checkbox" checked={on} onChange={() => onUpdateRoles(m.id, toggle(m.roles || [], r))} />
                          {roleLabels[r] || r}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
    </Wrapper>
  )
}
