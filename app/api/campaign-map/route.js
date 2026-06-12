export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { fetchAllCampaignSpend, suggestProduct } from '../../../lib/ads/campaignSpend'

const isoDay = (d) => d.toISOString().slice(0, 10)

async function fetchProducts(store, token) {
  const out = []
  let cursor = null
  for (let p = 0; p < 30; p++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
      method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ query: `{ products(first: 200${after}, query: "status:active") { pageInfo { hasNextPage endCursor } edges { node { legacyResourceId title isGiftCard } } } }` }),
    })
    if (!res.ok) break
    const json = await res.json()
    const conn = json?.data?.products
    for (const { node: n } of (conn?.edges || [])) { if (!n.isGiftCard) out.push({ id: String(n.legacyResourceId), title: n.title }) }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return out
}

// Mappatura salvata { "platform:campaign_id": row }
async function loadMapping(workspaceId) {
  const admin = getAdminSupabase()
  if (!admin || !workspaceId) return new Map()
  try {
    const { data } = await admin.from('campaign_product_map').select('*').eq('workspace_id', workspaceId)
    const m = new Map()
    for (const r of (data || [])) m.set(`${r.platform}:${r.campaign_id}`, r)
    return m
  } catch { return new Map() }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl: store, adminToken: token } = getShopify()
    if (!store || !token) return NextResponse.json({ ok: false, error: 'Shopify non configurato' }, { status: 400 })
    const sp = new URL(req.url).searchParams
    const until = sp.get('until') || isoDay(new Date())
    const since = sp.get('since') || isoDay(new Date(Date.now() - 90 * 86400000))
    try {
      const ws = await resolveWorkspace()
      const [campaigns, products, mapping] = await Promise.all([
        fetchAllCampaignSpend(since, until),
        fetchProducts(store, token),
        loadMapping(ws?.workspaceId),
      ])
      const rows = campaigns
        .filter(c => c.spend > 0)
        .sort((a, b) => b.spend - a.spend)
        .map(c => {
          const saved = mapping.get(`${c.platform}:${c.campaign_id}`)
          const sug = saved ? null : suggestProduct(c.campaign_name, products)
          return {
            platform: c.platform,
            campaign_id: c.campaign_id,
            campaign_name: c.campaign_name,
            spend: Math.round(c.spend * 100) / 100,
            product_id: saved ? (saved.product_id || null) : null,
            product_title: saved?.product_title || null,
            mapped: !!saved,
            suggestedProductId: sug?.id || null,
            suggestedTitle: sug?.title || null,
            suggestedScore: sug?.score || null,
          }
        })
      return NextResponse.json({ ok: true, range: { since, until }, campaigns: rows, products, savedAvailable: !!ws })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message || 'Errore' }, { status: 500 })
    }
  })
}

export async function POST(req) {
  return withTenantContext(req, async () => {
    const ws = await resolveWorkspace()
    if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
    const admin = getAdminSupabase()
    if (!admin) return NextResponse.json({ ok: false, error: 'Storage non disponibile' }, { status: 500 })
    let body = {}
    try { body = await req.json() } catch {}
    const mappings = Array.isArray(body.mappings) ? body.mappings : []
    const rows = mappings
      .filter(m => m && m.platform && m.campaign_id)
      .map(m => ({
        workspace_id: ws.workspaceId,
        platform: String(m.platform),
        campaign_id: String(m.campaign_id),
        campaign_name: m.campaign_name || null,
        product_id: m.product_id ? String(m.product_id) : null,
        product_title: m.product_title || null,
        updated_at: new Date().toISOString(),
      }))
    if (!rows.length) return NextResponse.json({ ok: true, saved: 0 })
    try {
      const { error } = await admin.from('campaign_product_map').upsert(rows, { onConflict: 'workspace_id,platform,campaign_id' })
      if (error) throw error
      return NextResponse.json({ ok: true, saved: rows.length })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message || 'Errore salvataggio (hai eseguito campaign_product_map.sql?)' }, { status: 500 })
    }
  })
}
