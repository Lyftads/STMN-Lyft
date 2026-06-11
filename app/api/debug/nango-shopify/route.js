export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'
import { getNangoConnection, NANGO_INTEGRATIONS } from '../../../../lib/tenant/nango'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// DIAGNOSTICO TEMPORANEO — struttura della connection Shopify su Nango per
// l'utente loggato. Ritorna SOLO nomi di campo + booleani (nessun segreto).
// Da rimuovere dopo aver allineato lib/tenant/credentials.js.
export async function GET() {
  const uid = await getCurrentUserId()
  if (!uid) return NextResponse.json({ error: 'unauth' }, { status: 401 })
  const admin = getAdminSupabase()
  const { data: c } = await admin.from('companies').select('nango_connections').eq('user_id', uid).maybeSingle()
  const conns = c?.nango_connections || {}
  const connId = conns[NANGO_INTEGRATIONS.shopify] || null
  if (!connId) return NextResponse.json({ connId: null, savedKeys: Object.keys(conns), shopifyKey: NANGO_INTEGRATIONS.shopify })

  const conn = await getNangoConnection({ integrationId: NANGO_INTEGRATIONS.shopify, connectionId: connId, timeoutMs: 8000 })
  if (!conn) return NextResponse.json({ connId, fetched: false, reason: 'getNangoConnection null (NANGO_SECRET_KEY o timeout?)' })

  return NextResponse.json({
    connId,
    fetched: true,
    topKeys: Object.keys(conn),
    credentialKeys: Object.keys(conn.credentials || {}),
    connection_config: conn.connection_config || null, // per Shopify = solo subdomain (non segreto)
    hasAccessToken: !!(conn.credentials?.access_token),
    metadataKeys: Object.keys(conn.metadata || {}),
  })
}
