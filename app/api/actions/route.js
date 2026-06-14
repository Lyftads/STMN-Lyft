export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { addNotification } from '../../../lib/team/notify'
import { withTenantContext } from '../../../lib/tenant/credentials'
import { executeMetaAction } from '../../../lib/actions/executors/meta'

const META_EXECUTOR_ON = process.env.ACTIONS_META_EXECUTOR === 'true' || process.env.ACTIONS_META_EXECUTOR === '1'

// Coda Azioni (Fase 1). Workspace-scoped, service-role + filtro workspace_id.
// Le mutazioni di stato (approva/rifiuta/esegui/elimina) sono riservate all'admin.

// Canali social rimossi dal core (non c'è più la tab Social): le azioni social
// non si creano più e quelle eventualmente già in coda vengono filtrate.
const SOCIAL_CHANNELS = new Set(['tiktok', 'instagram'])
const CHANNELS = ['meta', 'klaviyo', 'google', 'shopify', 'other']
const TYPES = ['pause_campaign', 'resume_campaign', 'scale_budget', 'shift_budget', 'refresh_creative', 'create_campaign', 'create_ad', 'custom']
const STATUSES = ['pending', 'approved', 'executed', 'rejected', 'failed']

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ actions: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ actions: [] })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  try {
    let q = admin
      .from('action_queue')
      .select('*')
      .eq('workspace_id', ws.workspaceId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (status && STATUSES.includes(status)) q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw error
    // Escludi le azioni social (tab Social rimossa) → non compaiono più in coda.
    const rows = (data || []).filter(a => !SOCIAL_CHANNELS.has(a.channel))
    const counts = { pending: 0, approved: 0, executed: 0, rejected: 0, failed: 0 }
    for (const a of rows) if (counts[a.status] != null) counts[a.status]++
    return NextResponse.json({
      actions: rows,
      counts,
      me: { memberId: ws.memberId, roles: ws.roles, isAdmin: ws.isAdmin },
    })
  } catch (e) {
    return NextResponse.json({ actions: [], error: e.message })
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'DB non disponibile' })

  let b = {}
  try { b = await req.json() } catch {}
  const channel = String(b.channel || '').trim()
  const type = String(b.type || '').trim()
  const summary = String(b.summary || '').trim()
  if (!CHANNELS.includes(channel)) return NextResponse.json({ ok: false, error: 'Canale non valido' }, { status: 400 })
  if (!TYPES.includes(type)) return NextResponse.json({ ok: false, error: 'Tipo azione non valido' }, { status: 400 })
  if (!summary) return NextResponse.json({ ok: false, error: 'Descrizione mancante' }, { status: 400 })

  const row = {
    workspace_id: ws.workspaceId,
    channel,
    type,
    target_ref: b.target_ref ? String(b.target_ref) : null,
    target_name: b.target_name ? String(b.target_name) : null,
    payload: (b.payload && typeof b.payload === 'object') ? b.payload : {},
    summary,
    source: b.source ? String(b.source) : 'manual',
    status: 'pending',
    requested_by: ws.memberId || ws.userId || null,
  }

  try {
    const { data, error } = await admin.from('action_queue').insert(row).select().single()
    if (error) throw error
    return NextResponse.json({ ok: true, action: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'DB non disponibile' })

  let b = {}
  try { b = await req.json() } catch {}
  const id = b.id
  const op = String(b.op || '').trim()   // approve | reject | execute | reopen | update
  if (!id) return NextResponse.json({ ok: false, error: 'ID mancante' }, { status: 400 })

  // Modifica contenuto (caption/descrizione/data/media): admin o autore.
  if (op === 'update') {
    const { data: act } = await admin.from('action_queue').select('*').eq('workspace_id', ws.workspaceId).eq('id', id).maybeSingle()
    if (!act) return NextResponse.json({ ok: false, error: 'Azione non trovata' }, { status: 404 })
    const me = ws.memberId || ws.userId || null
    if (!ws.isAdmin && !(act.requested_by && act.requested_by === me)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
    const up = { updated_at: new Date().toISOString() }
    if (typeof b.summary === 'string') up.summary = b.summary
    if (b.target_name != null) up.target_name = String(b.target_name)
    if (b.payload && typeof b.payload === 'object') up.payload = { ...(act.payload || {}), ...b.payload }
    try {
      const { data, error } = await admin.from('action_queue').update(up).eq('workspace_id', ws.workspaceId).eq('id', id).select().single()
      if (error) throw error
      return NextResponse.json({ ok: true, action: data })
    } catch (e) { return NextResponse.json({ ok: false, error: e.message }) }
  }

  // Operazioni di stato: solo admin.
  if (!ws.isAdmin) return NextResponse.json({ ok: false, error: 'Solo un admin può gestire le azioni' }, { status: 403 })

  const patch = { updated_at: new Date().toISOString() }
  if (b.note != null) patch.note = String(b.note)
  if (op === 'approve') {
    patch.status = 'approved'
    patch.approved_by = ws.memberId || ws.userId || null
  } else if (op === 'reject') {
    patch.status = 'rejected'
    patch.approved_by = ws.memberId || ws.userId || null
  } else if (op === 'execute') {
    // Default: esecuzione MANUALE ("segna come eseguita").
    patch.status = 'executed'
    patch.executed_at = new Date().toISOString()
    // Fase 2: se l'executor è attivo e l'azione è su Meta, prova l'esecuzione reale.
    if (META_EXECUTOR_ON) {
      try {
        const { data: act } = await admin.from('action_queue').select('*').eq('workspace_id', ws.workspaceId).eq('id', id).single()
        if (act && act.channel === 'meta') {
          const r = await withTenantContext(req, () => executeMetaAction(act))
          if (r.ok) {
            patch.result = r.result || null
          } else if (r.manual) {
            // non auto-eseguibile → resta "eseguita" manualmente dall'admin
          } else {
            patch.status = 'failed'
            patch.error = r.error || 'Esecuzione fallita'
            patch.executed_at = null
          }
        }
      } catch (e) {
        patch.status = 'failed'
        patch.error = e.message
        patch.executed_at = null
      }
    }
  } else if (op === 'reopen') {
    patch.status = 'pending'
    patch.approved_by = null
    patch.executed_at = null
  } else {
    return NextResponse.json({ ok: false, error: 'Operazione non valida' }, { status: 400 })
  }

  try {
    const { data, error } = await admin
      .from('action_queue')
      .update(patch)
      .eq('workspace_id', ws.workspaceId)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    // Notifica l'autore della richiesta quando un admin diverso da lui decide.
    const approver = ws.memberId || ws.userId || null
    if (['approve', 'reject', 'execute'].includes(op) && data?.requested_by && data.requested_by !== approver) {
      addNotification({
        workspaceId: ws.workspaceId,
        recipientId: data.requested_by,
        type: 'action_' + op,
        title: data.summary,
        tab: 'actionQueue',
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, action: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}

export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'DB non disponibile' })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'ID mancante' }, { status: 400 })

  // Eliminazione: admin o autore della richiesta.
  if (!ws.isAdmin) {
    const { data: act } = await admin.from('action_queue').select('requested_by').eq('workspace_id', ws.workspaceId).eq('id', id).maybeSingle()
    const me = ws.memberId || ws.userId || null
    if (!act || !(act.requested_by && act.requested_by === me)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  }
  try {
    const { error } = await admin
      .from('action_queue')
      .delete()
      .eq('workspace_id', ws.workspaceId)
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
