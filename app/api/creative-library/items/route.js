export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { resolveWorkspace, isCollaborator } from '../../../../lib/team/workspace'

// ============================================================================
//  Creatività a tre formati.
//
//  Una creatività è l'idea; i file sono le sue tre declinazioni (quadrato,
//  verticale, orizzontale). Lo stato sta sull'idea, non sul ritaglio.
//
//  GET    → creatività con i loro file, campagne e progetti per i menu
//  POST   → crea una creatività
//  PATCH  → stato, nome, campagna, progetto
//  DELETE → elimina la creatività e i suoi file (anche dallo storage)
// ============================================================================

const BUCKET = 'creativita'
const STATUSES = ['da_rivisionare', 'accettata', 'bocciata', 'utilizzata']
const FORMATS = ['1:1', '9:16', '16:9']

function isMissingTable(error) {
  const s = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return s.includes('42p01') || s.includes('does not exist') || s.includes('could not find the table')
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ items: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ items: [] })

  let items = [], assets = [], needsSetup = false
  try {
    const { data, error } = await admin.from('creative_items').select('*')
      .eq('workspace_id', ws.workspaceId).order('created_at', { ascending: false })
    if (error && isMissingTable(error)) needsSetup = true
    items = data || []
  } catch (e) { if (isMissingTable(e)) needsSetup = true }

  try {
    const { data } = await admin.from('creative_assets').select('*')
      .eq('workspace_id', ws.workspaceId).not('item_id', 'is', null)
    assets = data || []
  } catch {}

  const byItem = {}
  for (const a of assets) (byItem[a.item_id] = byItem[a.item_id] || []).push(a)

  // Progetti e promo: sono le due cose per cui una creatività viene fatta.
  let campaigns = [], projects = [], promos = []
  try {
    const { data } = await admin.from('creative_campaigns').select('id, name')
      .eq('workspace_id', ws.workspaceId).eq('archived', false)
    campaigns = data || []
  } catch {}
  try {
    const { data } = await admin.from('projects').select('id, name')
      .eq('workspace_id', ws.workspaceId).eq('archived', false)
    projects = data || []
  } catch {}
  try {
    const { data } = await admin.from('calendar_events').select('id, title, kind, start_date, end_date')
      .eq('workspace_id', ws.workspaceId).in('kind', ['promo_b2c', 'promo_negozi'])
      .order('start_date', { ascending: false })
    promos = data || []
  } catch {}

  return NextResponse.json({
    items: items.map(i => ({ ...i, files: byItem[i.id] || [] })),
    campaigns, projects, promos, needsSetup,
    can: { write: ws.isAdmin || isCollaborator(ws) },
  })
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  const name = String(b.name || '').trim().slice(0, 200)
  if (!name) return NextResponse.json({ ok: false, error: 'Nome mancante' }, { status: 400 })

  const { data, error } = await admin.from('creative_items').insert({
    workspace_id: ws.workspaceId,
    campaign_id: b.campaignId || null,
    project_id: b.projectId || null,
    promo_id: b.promoId || null,
    name,
    status: STATUSES.includes(b.status) ? b.status : 'da_rivisionare',
    product: b.product ? String(b.product).slice(0, 160) : null,
    author: b.author ? String(b.author).slice(0, 120) : null,
    notes: b.notes ? String(b.notes).slice(0, 500) : null,
    created_by: ws.memberId,
  }).select('*').single()

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ ok: false, needsSetup: true, error: 'Tabella creative_items assente' }, { status: 200 })
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  }
  return NextResponse.json({ ok: true, item: data })
}

export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  if (!b.id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })

  const patch = { updated_at: new Date().toISOString() }
  if (b.status && STATUSES.includes(b.status)) patch.status = b.status
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 200)
  if (b.campaignId !== undefined) patch.campaign_id = b.campaignId || null
  if (b.projectId !== undefined) patch.project_id = b.projectId || null
  if (b.promoId !== undefined) patch.promo_id = b.promoId || null
  if (b.notes !== undefined) patch.notes = b.notes ? String(b.notes).slice(0, 500) : null

  await admin.from('creative_items').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId)
  return NextResponse.json({ ok: true })
}

// Elimina la creatività e i suoi file. Qui i file SI cancellano: sono le
// declinazioni di quell'idea, senza di essa non hanno più un posto.
export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const format = url.searchParams.get('format')   // se presente: elimina solo quel formato
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })

  if (format && FORMATS.includes(format)) {
    const { data: one } = await admin.from('creative_assets').select('id, file_path')
      .eq('workspace_id', ws.workspaceId).eq('item_id', id).eq('format', format).maybeSingle()
    if (one?.file_path) { try { await admin.storage.from(BUCKET).remove([one.file_path]) } catch {} }
    if (one?.id) await admin.from('creative_assets').delete().eq('id', one.id)
    return NextResponse.json({ ok: true })
  }

  const { data: files } = await admin.from('creative_assets').select('file_path')
    .eq('workspace_id', ws.workspaceId).eq('item_id', id)
  const paths = (files || []).map(f => f.file_path).filter(Boolean)
  if (paths.length) { try { await admin.storage.from(BUCKET).remove(paths) } catch {} }
  await admin.from('creative_items').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
  return NextResponse.json({ ok: true })
}
