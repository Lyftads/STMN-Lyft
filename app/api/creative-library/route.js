export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace, isCollaborator } from '../../../lib/team/workspace'

// ============================================================================
//  Libreria creatività: campagne e file.
//
//  I file NON passano da qui: il browser li manda direttamente allo storage
//  con un permesso firmato (vedi /api/creative-library/upload-url), perché su
//  Vercel una richiesta non può superare 4,5 MB e un video non ci passa.
//  Questa route tiene l'anagrafica: cosa è quel file, di quale campagna, in
//  che stato.
// ============================================================================

const BUCKET = 'creativita'
const KINDS = ['video', 'statica']
const FORMATS = ['1:1', '9:16', '16:9']
// Stati del singolo FILE: gli stessi della creatività, perché il verdetto può
// riguardare un solo formato ("il verticale è da rifare"). I quattro vecchi
// restano accettati per non rompere le righe già scritte.
const STATUSES = ['da_rivisionare', 'accettata', 'bocciata', 'utilizzata']
const LEGACY = { da_completare: 'da_rivisionare', in_approvazione: 'da_rivisionare', approvata: 'accettata', scartata: 'bocciata' }
const normStatus = v => STATUSES.includes(v) ? v : (LEGACY[v] || 'da_rivisionare')

function isMissingTable(error) {
  const s = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return s.includes('42p01') || s.includes('does not exist') || s.includes('could not find the table')
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ campaigns: [], assets: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ campaigns: [], assets: [] })

  const campaignId = new URL(req.url).searchParams.get('campaignId')
  let campaigns = [], assets = [], needsSetup = false

  try {
    const { data, error } = await admin.from('creative_campaigns').select('*')
      .eq('workspace_id', ws.workspaceId).eq('archived', false)
      .order('created_at', { ascending: true })
    if (error && isMissingTable(error)) needsSetup = true
    campaigns = data || []
  } catch (e) { if (isMissingTable(e)) needsSetup = true }

  try {
    let q = admin.from('creative_assets').select('*')
      .eq('workspace_id', ws.workspaceId).order('created_at', { ascending: false })
    if (campaignId) q = q.eq('campaign_id', campaignId)
    const { data, error } = await q
    if (error && isMissingTable(error)) needsSetup = true
    assets = data || []
  } catch (e) { if (isMissingTable(e)) needsSetup = true }

  return NextResponse.json({
    campaigns, assets, needsSetup,
    can: { write: ws.isAdmin || isCollaborator(ws) },
  })
}

// Crea una campagna, oppure registra un file appena caricato.
// Body campagna: { campaign: { name, description? } }
// Body file:     { asset: { campaignId, name, filePath, fileUrl, kind, format, ... } }
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}

  if (b.campaign) {
    const name = String(b.campaign.name || '').trim().slice(0, 120)
    if (!name) return NextResponse.json({ ok: false, error: 'Nome mancante' }, { status: 400 })
    const { data, error } = await admin.from('creative_campaigns').insert({
      workspace_id: ws.workspaceId, name,
      description: b.campaign.description ? String(b.campaign.description).slice(0, 500) : null,
      created_by: ws.memberId,
    }).select('*').single()
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ ok: false, needsSetup: true, error: 'Tabelle creatività assenti' }, { status: 200 })
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }
    return NextResponse.json({ ok: true, campaign: data })
  }

  const a = b.asset
  if (!a?.filePath || !a?.name) return NextResponse.json({ ok: false, error: 'Dati file mancanti' }, { status: 400 })

  // Il percorso deve stare dentro la cartella del workspace: senza il
  // controllo si potrebbe registrare un file di un altro tenant.
  if (!String(a.filePath).startsWith(`${ws.workspaceId}/`)) {
    return NextResponse.json({ ok: false, error: 'Percorso non valido' }, { status: 400 })
  }

  const { data, error } = await admin.from('creative_assets').insert({
    workspace_id: ws.workspaceId,
    campaign_id: a.campaignId || null,
    // Un file può essere la declinazione di una creatività in un formato
    item_id: a.itemId || null,
    name: String(a.name).slice(0, 200),
    kind: KINDS.includes(a.kind) ? a.kind : 'video',
    format: FORMATS.includes(a.format) ? a.format : (a.format ? String(a.format).slice(0, 12) : null),
    language: a.language ? String(a.language).slice(0, 8) : null,
    product: a.product ? String(a.product).slice(0, 160) : null,
    author: a.author ? String(a.author).slice(0, 120) : null,
    status: normStatus(a.status),
    file_path: a.filePath,
    file_url: a.fileUrl || null,
    mime: a.mime || null,
    size_bytes: Number.isFinite(a.size) ? a.size : null,
    notes: a.notes ? String(a.notes).slice(0, 500) : null,
    created_by: ws.memberId,
  }).select('*').single()

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ ok: false, needsSetup: true, error: 'Tabelle creatività assenti' }, { status: 200 })
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  }
  return NextResponse.json({ ok: true, asset: data })
}

// Aggiorna stato/dati di un file o rinomina una campagna.
export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  if (!b.id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })

  if (b.campaign) {
    const patch = {}
    if (typeof b.campaign.name === 'string' && b.campaign.name.trim()) patch.name = b.campaign.name.trim().slice(0, 120)
    if (b.campaign.description !== undefined) patch.description = b.campaign.description ? String(b.campaign.description).slice(0, 500) : null
    if (b.campaign.archived !== undefined) patch.archived = !!b.campaign.archived
    await admin.from('creative_campaigns').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  }

  const patch = { updated_at: new Date().toISOString() }
  if (b.status) patch.status = normStatus(b.status)
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 200)
  if (b.notes !== undefined) patch.notes = b.notes ? String(b.notes).slice(0, 500) : null
  if (b.campaignId !== undefined) patch.campaign_id = b.campaignId || null
  if (b.format !== undefined) patch.format = b.format || null
  if (b.product !== undefined) patch.product = b.product || null
  await admin.from('creative_assets').update(patch).eq('id', b.id).eq('workspace_id', ws.workspaceId)
  return NextResponse.json({ ok: true })
}

// Elimina un file (anche dallo storage) o una campagna (i file restano,
// scollegati: cancellare i file insieme alla campagna farebbe sparire lavoro
// per un riordino dell'archivio).
export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(ws.isAdmin || isCollaborator(ws))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const type = url.searchParams.get('type') || 'asset'
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })

  if (type === 'campaign') {
    await admin.from('creative_campaigns').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  }

  const { data: asset } = await admin.from('creative_assets').select('file_path')
    .eq('id', id).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (asset?.file_path) {
    try { await admin.storage.from(BUCKET).remove([asset.file_path]) } catch {}
  }
  await admin.from('creative_assets').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
  return NextResponse.json({ ok: true })
}
