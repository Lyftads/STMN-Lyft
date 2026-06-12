export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUserId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'

// Lista i workspace accessibili dall'utente: il proprio + gli eventuali
// workspace cliente (se è un'agency). Usato dal login-picker e dallo switcher.
export async function GET() {
  const uid = await getCurrentUserId()
  if (!uid) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ workspaces: [], activeId: uid, isAgency: false })

  const workspaces = []
  let isAgency = false
  try {
    const { data: self } = await admin
      .from('companies')
      .select('user_id, company_name, is_agency, is_client_workspace')
      .eq('user_id', uid)
      .maybeSingle()
    isAgency = !!self?.is_agency
    if (self && !self.is_client_workspace) {
      workspaces.push({ id: uid, label: self.company_name || 'Il mio account', isSelf: true })
    }

    const { data: maps } = await admin
      .from('agency_clients')
      .select('client_user_id, label')
      .eq('agency_user_id', uid)
    if (maps?.length) {
      isAgency = true
      const ids = maps.map(m => m.client_user_id)
      const { data: comps } = await admin.from('companies').select('user_id, company_name').in('user_id', ids)
      const nameById = Object.fromEntries((comps || []).map(c => [c.user_id, c.company_name]))
      for (const m of maps) {
        workspaces.push({ id: m.client_user_id, label: m.label || nameById[m.client_user_id] || 'Cliente', isSelf: false })
      }
    }
  } catch (e) {
    return NextResponse.json({ workspaces: [{ id: uid, label: 'Il mio account', isSelf: true }], activeId: uid, isAgency: false })
  }

  const cookieActive = cookies().get('active_workspace')?.value || null
  const activeId = (cookieActive && workspaces.some(w => w.id === cookieActive)) ? cookieActive : uid
  return NextResponse.json({ workspaces, activeId, isAgency })
}
