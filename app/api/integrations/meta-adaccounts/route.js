export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../../lib/tenant/credentials'

// Elenca TUTTI gli ad account Meta raggiungibili col token del tenant:
//  - /me/adaccounts            → account legati direttamente al profilo
//  - /me/businesses → owned_ad_accounts + client_ad_accounts → account dei
//    Business Manager (richiede scope business_management)
// Deduplica per id. Serve per verifica accesso + selezione ad account.
async function graphGet(v, path, token, fields) {
  try {
    const url = `https://graph.facebook.com/${v}/${path}?fields=${encodeURIComponent(fields)}&limit=200&access_token=${encodeURIComponent(token)}`
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
    const j = await r.json()
    if (j.error) return { error: j.error.message, data: [] }
    return { data: Array.isArray(j.data) ? j.data : [] }
  } catch (e) {
    return { error: e?.message, data: [] }
  }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { accessToken, graphVersion } = getMeta()
    if (!accessToken) return NextResponse.json({ error: 'Meta non collegato', accounts: [] }, { status: 200 })
    const v = graphVersion || 'v20.0'
    const acctFields = 'id,name,account_id,currency,account_status'

    const byId = new Map()
    const add = (rows, bizName) => {
      for (const a of (rows || [])) {
        if (!a?.id) continue
        if (!byId.has(a.id)) {
          byId.set(a.id, {
            id: a.id, accountId: a.account_id, name: a.name,
            currency: a.currency, status: a.account_status,
            business: bizName || a.business?.name || null,
          })
        }
      }
    }
    const errors = []

    // 1) Account diretti del profilo
    const personal = await graphGet(v, 'me/adaccounts', accessToken, `${acctFields},business`)
    if (personal.error) errors.push(`me/adaccounts: ${personal.error}`)
    add(personal.data)

    // 2) Account dei Business Manager
    const biz = await graphGet(v, 'me/businesses', accessToken, 'id,name')
    if (biz.error) errors.push(`me/businesses: ${biz.error}`)
    for (const b of biz.data.slice(0, 50)) {
      const [owned, client] = await Promise.all([
        graphGet(v, `${b.id}/owned_ad_accounts`, accessToken, acctFields),
        graphGet(v, `${b.id}/client_ad_accounts`, accessToken, acctFields),
      ])
      add(owned.data, b.name)
      add(client.data, b.name)
    }

    const accounts = [...byId.values()]
    return NextResponse.json({
      count: accounts.length,
      businesses: biz.data.map(b => b.name),
      accounts,
      ...(errors.length ? { warnings: errors } : {}),
    })
  })
}
