// ============================================================================
//  Il canale LyftTalk di un progetto.
//
//  Un progetto e il suo gruppo di chat sono la stessa cosa vista da due punti:
//  il gruppo nasce col progetto e i suoi partecipanti sono i membri del
//  progetto. Chi entra nel progetto si ritrova nel gruppo, chi esce ne esce.
//  Senza questo allineamento la chat diventa un elenco di persone che non
//  lavorano più al progetto — e i messaggi finiscono a chi non serve.
// ============================================================================

function isMissing(error) {
  const s = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return s.includes('42p01') || s.includes('does not exist') || s.includes('could not find')
}

// Nome canale: minuscolo, senza accenti, unico nel workspace (vincolo esistente).
function channelName(projectName) {
  const base = String(projectName || 'progetto').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return base || 'progetto'
}

// Crea il canale del progetto (o restituisce quello esistente).
// Ritorna { channelId } oppure { needsSetup: true } se la colonna project_id
// non c'è ancora: il progetto si crea lo stesso, la chat arriva dopo.
export async function ensureProjectChannel(admin, { workspaceId, projectId, projectName, createdBy, memberIds = [] }) {
  if (!admin || !projectId) return { channelId: null }
  try {
    const { data: found, error } = await admin.from('channels').select('id')
      .eq('workspace_id', workspaceId).eq('project_id', projectId).maybeSingle()
    if (error && isMissing(error)) return { needsSetup: true, channelId: null }
    if (found) {
      await syncChannelMembers(admin, { channelId: found.id, memberIds })
      return { channelId: found.id }
    }
  } catch (e) {
    if (isMissing(e)) return { needsSetup: true, channelId: null }
  }

  const base = channelName(projectName)
  for (const name of [base, `${base}-2`, `${base}-${Date.now().toString().slice(-4)}`]) {
    const { data, error } = await admin.from('channels')
      .insert({ workspace_id: workspaceId, name, created_by: createdBy || null, project_id: projectId })
      .select('id').single()
    if (!error && data) {
      await syncChannelMembers(admin, { channelId: data.id, memberIds })
      return { channelId: data.id, created: true }
    }
    if (error && isMissing(error)) return { needsSetup: true, channelId: null }
  }
  return { channelId: null }
}

// Allinea i partecipanti del gruppo a quelli del progetto.
export async function syncChannelMembers(admin, { channelId, memberIds = [] }) {
  if (!admin || !channelId) return
  const ids = [...new Set(memberIds.filter(Boolean))]
  try {
    if (ids.length) {
      await admin.from('channel_members')
        .upsert(ids.map(id => ({ channel_id: channelId, member_id: id })), { onConflict: 'channel_id,member_id' })
    }
    // Chi non è più nel progetto esce dal gruppo. Se il progetto resta senza
    // membri il gruppo non viene svuotato: meglio un gruppo con dentro chi
    // c'era che una chat orfana a cui nessuno può più accedere.
    if (ids.length) {
      await admin.from('channel_members').delete()
        .eq('channel_id', channelId).not('member_id', 'in', `(${ids.join(',')})`)
    }
  } catch {}
}

export async function addToProjectChannel(admin, { workspaceId, projectId, memberId }) {
  if (!admin || !projectId || !memberId) return
  try {
    const { data } = await admin.from('channels').select('id')
      .eq('workspace_id', workspaceId).eq('project_id', projectId).maybeSingle()
    if (data) await admin.from('channel_members').upsert({ channel_id: data.id, member_id: memberId }, { onConflict: 'channel_id,member_id' })
  } catch {}
}

export async function removeFromProjectChannel(admin, { workspaceId, projectId, memberId }) {
  if (!admin || !projectId || !memberId) return
  try {
    const { data } = await admin.from('channels').select('id')
      .eq('workspace_id', workspaceId).eq('project_id', projectId).maybeSingle()
    if (data) await admin.from('channel_members').delete().eq('channel_id', data.id).eq('member_id', memberId)
  } catch {}
}
