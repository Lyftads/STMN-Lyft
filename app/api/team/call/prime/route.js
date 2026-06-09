export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../../lib/team/workspace'

// "Innesca" i dati reali per la call: il browser dell'owner (autenticato) chiama
// questo endpoint prima di avviare la call. Qui carichiamo l'agent-context con il
// COOKIE di sessione (percorso provato → dati reali) e lo salviamo in call_context.
// Il cervello della call (server-to-server, senza sessione) lo legge da lì.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'no db' }, { status: 500 })

  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''
  let data = null
  try {
    const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, { cache: 'no-store', headers: cookie ? { cookie } : {} })
    if (r.ok) data = await r.json()
  } catch {}
  if (!data) return NextResponse.json({ ok: false, error: 'agent-context non disponibile' })

  try {
    await admin.from('call_context').upsert({ workspace_id: ws.workspaceId, data, updated_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'upsert fallito' })
  }
  return NextResponse.json({ ok: true, hasData: !!(data?.shopify || data?.metaAds || data?.creatives) })
}
