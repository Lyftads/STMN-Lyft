export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { resolveWorkspace } from '../../../lib/team/workspace'

// Accesso al canale: pubblici sempre; privati solo admin o membri.
async function canAccess(admin, ws, channelId) {
  const { data: ch } = await admin.from('channels').select('is_private').eq('id', channelId).eq('workspace_id', ws.workspaceId).maybeSingle()
  if (!ch) return false
  if (!ch.is_private || ws.isAdmin) return true
  const { data: m } = await admin.from('channel_members').select('id').eq('channel_id', channelId).eq('member_id', ws.memberId).maybeSingle()
  return !!m
}

export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ messages: [] }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ messages: [] })
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channel_id')
  const after = searchParams.get('after')
  const threadRoot = searchParams.get('thread_root')
  if (!channelId) return NextResponse.json({ messages: [] })
  try {
    let q = admin.from('channel_messages').select('*')
      .eq('workspace_id', ws.workspaceId)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(300)
    // vista canale: solo top-level; vista thread: solo le risposte del root
    if (threadRoot) q = q.eq('thread_root', threadRoot)
    else q = q.is('thread_root', null)
    if (after) q = q.gt('created_at', after)
    const { data } = await q
    return NextResponse.json({ messages: data || [] })
  } catch (e) {
    return NextResponse.json({ messages: [], error: e.message })
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const channelId = b.channel_id
  const body = String(b.body || '').trim()
  const audioUrl = b.audio_url || null
  const fileUrl = b.file_url || null
  const threadRoot = b.thread_root || null
  if (!channelId || (!body && !audioUrl && !fileUrl)) return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })

  let authorName = 'Utente'
  try {
    const { data: m } = await admin.from('team_members').select('full_name, email').eq('workspace_id', ws.workspaceId).eq('user_id', ws.userId).maybeSingle()
    if (m) authorName = m.full_name || m.email
  } catch {}

  try {
    const { data, error } = await admin
      .from('channel_messages')
      .insert({
        channel_id: channelId, workspace_id: ws.workspaceId, author_id: ws.memberId, author_name: authorName, body,
        reply_to: b.reply_to || null,
        reply_author: b.reply_author ? String(b.reply_author).slice(0, 80) : null,
        reply_excerpt: b.reply_excerpt ? String(b.reply_excerpt).slice(0, 140) : null,
        audio_url: audioUrl,
        file_url: fileUrl,
        file_name: b.file_name ? String(b.file_name).slice(0, 160) : null,
        file_type: b.file_type ? String(b.file_type).slice(0, 80) : null,
        thread_root: threadRoot,
      })
      .select('*').single()
    if (error) throw error
    // incrementa il conteggio risposte sul messaggio radice
    if (threadRoot) {
      try {
        const { data: root } = await admin.from('channel_messages').select('reply_count').eq('id', threadRoot).maybeSingle()
        await admin.from('channel_messages').update({ reply_count: (root?.reply_count || 0) + 1 }).eq('id', threadRoot).eq('workspace_id', ws.workspaceId)
      } catch {}
    }
    return NextResponse.json({ ok: true, message: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}

// Toggle reazione emoji su un messaggio.
export async function PATCH(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  let b = {}
  try { b = await req.json() } catch {}
  const { id, emoji } = b
  if (!id || !emoji) return NextResponse.json({ ok: false, error: 'Dati mancanti' }, { status: 400 })
  try {
    const { data: msg } = await admin.from('channel_messages').select('reactions').eq('id', id).eq('workspace_id', ws.workspaceId).maybeSingle()
    if (!msg) return NextResponse.json({ ok: false }, { status: 404 })
    const reactions = (msg.reactions && typeof msg.reactions === 'object') ? { ...msg.reactions } : {}
    const arr = Array.isArray(reactions[emoji]) ? reactions[emoji] : []
    const mid = ws.memberId
    if (arr.includes(mid)) { const n = arr.filter(x => x !== mid); if (n.length) reactions[emoji] = n; else delete reactions[emoji] }
    else reactions[emoji] = [...arr, mid]
    const { data } = await admin.from('channel_messages').update({ reactions }).eq('id', id).eq('workspace_id', ws.workspaceId).select('*').single()
    return NextResponse.json({ ok: true, message: data })
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 200 }) }
}

// Elimina un messaggio (autore o admin).
export async function DELETE(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
  try {
    const { data: msg } = await admin.from('channel_messages').select('author_id').eq('id', id).eq('workspace_id', ws.workspaceId).maybeSingle()
    if (!msg) return NextResponse.json({ ok: false }, { status: 404 })
    if (!ws.isAdmin && msg.author_id !== ws.memberId) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
    await admin.from('channel_messages').delete().eq('id', id).eq('workspace_id', ws.workspaceId)
    return NextResponse.json({ ok: true })
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 200 }) }
}
