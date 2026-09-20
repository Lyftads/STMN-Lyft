'use client'

import { avvisa } from '../../lib/client/avviso'
import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { TeamManagePanel } from './TeamManage'

// ============================================================================
//  Gestione team (menu System) — inviti, ruoli e visibilità delle tab.
//  Era un modale dentro Progetti & Task: chi doveva invitare qualcuno non lo
//  trovava. Qui è una tab, e i dati li carica per conto suo.
// ============================================================================

export default function TeamManageTab() {
  const { t } = useI18n()
  const [members, setMembers] = useState([])
  const [rolesCatalog, setRolesCatalog] = useState([])
  const [roleLabels, setRoleLabels] = useState({})
  const [seats, setSeats] = useState(null)
  const [hiddenTabs, setHiddenTabs] = useState([])
  const [customRoles, setCustomRoles] = useState([])
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const j = await fetch('/api/team-members', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      if (j) {
        setMembers(j.members || [])
        setRolesCatalog(j.roles || [])
        setRoleLabels(j.roleLabels || {})
        setSeats(j.seats || null)
        setHiddenTabs(Array.isArray(j.hiddenTabs) ? j.hiddenTabs : [])
        setCustomRoles(Array.isArray(j.customRoles) ? j.customRoles : [])
        setMe(j.me || null)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveHiddenTabs(next) {
    setHiddenTabs(next)
    await fetch('/api/team-members', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hiddenTabs: next }),
    })
  }

  // I ruoli su misura vivono sul workspace, come le tab nascoste: dopo il
  // salvataggio si ricarica, così il catalogo dei ruoli è quello vero del server.
  async function addRole(label) {
    const r = await fetch('/api/team-members', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addRole: label }),
    }).then(x => x.json()).catch(() => ({ ok: false, error: 'network' }))
    if (r?.ok) await load()
    return r
  }

  async function removeRole(id) {
    const r = await fetch('/api/team-members', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeRole: id }),
    }).then(x => x.json()).catch(() => ({ ok: false }))
    if (r?.ok) await load()
    return r
  }

  async function inviteMember(email, roles) {
    const r = await fetch('/api/team-members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, roles }),
    }).then(x => x.json()).catch(() => ({ ok: false }))
    if (r?.ok && r.member) setMembers(prev => [...prev, r.member])
    else if (r?.error) avvisa(r.error, 'errore')
    return r
  }

  async function updateMemberRoles(id, roles) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, roles } : m))
    await fetch('/api/team-members', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, roles }),
    })
  }

  async function removeMember(id) {
    if (!confirm(t('tk.confirmRemoveMember', null, 'Rimuovere la persona dal team?'))) return
    setMembers(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/team-members?id=${id}`, { method: 'DELETE' })
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text2)', fontSize: 13 }}>{t('tk.loadingTeam', null, 'Carico il team…')}</div>
  }

  // Solo chi amministra il workspace può invitare o cambiare permessi: mostrarlo
  // agli altri creerebbe pulsanti che il server rifiuta comunque.
  if (me && !me.isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>
        {t('tk.teamAdminOnly', null, 'Solo un amministratore può gestire il team.')}
      </div>
    )
  }

  return (
    <TeamManagePanel
      embedded
      members={members}
      rolesCatalog={rolesCatalog}
      roleLabels={roleLabels}
      ownerUserId={me?.userId}
      seats={seats}
      hiddenTabs={hiddenTabs}
      customRoles={customRoles}
      onSaveHiddenTabs={saveHiddenTabs}
      onAddRole={addRole}
      onRemoveRole={removeRole}
      onInvite={inviteMember}
      onUpdateRoles={updateMemberRoles}
      onRemove={removeMember}
    />
  )
}
