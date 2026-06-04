export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../../lib/tenant/credentials'

// Elenca gli ad account Meta raggiungibili col token del tenant (da Nango o env).
// Serve a: (1) verificare che il token abbia accesso ads ai Business Manager,
// (2) far scegliere al tenant quale ad account usare (→ companies.meta_account_id).
export async function GET(req) {
  return withTenantContext(req, async () => {
    const { accessToken, graphVersion } = getMeta()
    if (!accessToken) return NextResponse.json({ error: 'Meta non collegato', accounts: [] }, { status: 200 })
    const v = graphVersion || 'v20.0'
    try {
      const url = `https://graph.facebook.com/${v}/me/adaccounts`
        + `?fields=id,name,account_id,currency,account_status,business`
        + `&limit=200&access_token=${encodeURIComponent(accessToken)}`
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      const j = await r.json()
      if (j.error) return NextResponse.json({ error: j.error.message, accounts: [] }, { status: 200 })
      const accounts = (j.data || []).map(a => ({
        id: a.id,                    // es. act_123
        accountId: a.account_id,     // es. 123
        name: a.name,
        currency: a.currency,
        status: a.account_status,
        business: a.business?.name || null,
      }))
      return NextResponse.json({ count: accounts.length, accounts })
    } catch (e) {
      return NextResponse.json({ error: e?.message || 'Errore Meta', accounts: [] }, { status: 200 })
    }
  })
}
