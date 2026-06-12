export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify, getMeta } from '../../../lib/tenant/credentials'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { fetchAllCampaignSpend, suggestProduct } from '../../../lib/ads/campaignSpend'
import { buildShopifyMaps, fetchMetaCampaignProducts } from '../../../lib/ads/campaignProducts'

const isoDay = (d) => d.toISOString().slice(0, 10)

async function fetchProducts(store, token) {
  const out = []
  let cursor = null
  for (let p = 0; p < 30; p++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
      method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ query: `{ products(first: 200${after}, query: "status:active") { pageInfo { hasNextPage endCursor } edges { node { legacyResourceId title handle isGiftCard variants(first: 100) { edges { node { legacyResourceId sku } } } } } } }` }),
    })
    if (!res.ok) break
    const json = await res.json()
    const conn = json?.data?.products
    for (const { node: n } of (conn?.edges || [])) { if (!n.isGiftCard) out.push({ id: String(n.legacyResourceId), title: n.title, handle: n.handle, variants: (n.variants?.edges || []).map(({ node: v }) => ({ variant_id: String(v.legacyResourceId), sku: v.sku || '' })) }) }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return out
}

// Normalizza i prodotti salvati di una riga → [{id, title}] (gestisce legacy)
function normalizeProducts(row) {
  if (Array.isArray(row?.products) && row.products.length) return row.products.map(p => ({ id: String(p.id), title: p.title || '' })).filter(p => p.id)
  if (row?.product_id) return [{ id: String(row.product_id), title: row.product_title || '' }]
  return []
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
      const { accessToken: metaToken, adAccountId } = getMeta()
      const accounts = String(adAccountId || '').split(',').map(s => s.trim()).filter(Boolean).map(a => a.startsWith('act_') ? a : `act_${a}`)
      const [campaigns, products, mapping] = await Promise.all([
        fetchAllCampaignSpend(since, until),
        fetchProducts(store, token),
        loadMapping(ws?.workspaceId),
      ])
      // Solo Meta: Google è già attribuito in automatico ESATTO per prodotto
      // (shopping_performance_view) in Performance prodotti → niente mappatura.
      const metaCampaigns = campaigns.filter(c => c.platform === 'meta' && c.spend > 0)

      // Auto-derivazione Meta: product set (catalogo) + link creatività (dirette)
      const maps = buildShopifyMaps(products)
      // lite=true: solo catalogo (product set), niente query ads pesante → carica veloce.
      // Le campagne dirette hanno comunque il suggerimento per nome.
      const metaProducts = metaToken ? await fetchMetaCampaignProducts(metaToken, accounts, maps, true).catch(() => new Map()) : new Map()
      const titleById = new Map(products.map(p => [String(p.id), p.title]))

      const rows = metaCampaigns
        .sort((a, b) => b.spend - a.spend)
        .map(c => {
          const saved = mapping.get(`meta:${c.campaign_id}`)
          const selected = saved ? normalizeProducts(saved) : []
          const der = metaProducts.get(String(c.campaign_id))
          const auto = der ? [...der.productIds].map(id => ({ id, title: titleById.get(id) || '' })) : []
          const sug = (selected.length || auto.length) ? null : suggestProduct(c.campaign_name, products)
          return {
            platform: 'meta',
            campaign_id: c.campaign_id,
            campaign_name: c.campaign_name,
            spend: Math.round(c.spend * 100) / 100,
            selected,                       // [{id, title}] già salvati
            mapped: selected.length > 0,
            auto,                           // [{id, title}] derivati in automatico
            autoKind: der?.kind || null,    // 'catalog' | 'direct'
            suggestedProductId: sug?.id || null,
            suggestedTitle: sug?.title || null,
            suggestedScore: sug?.score || null,
          }
        })
      return NextResponse.json({ ok: true, range: { since, until }, campaigns: rows, products, savedAvailable: !!ws, googleAuto: true })
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
      .map(m => {
        const products = Array.isArray(m.products) ? m.products.filter(p => p && p.id).map(p => ({ id: String(p.id), title: p.title || '' })) : []
        return {
          workspace_id: ws.workspaceId,
          platform: String(m.platform),
          campaign_id: String(m.campaign_id),
          campaign_name: m.campaign_name || null,
          product_id: products[0]?.id || null,      // legacy (primo prodotto)
          product_title: products[0]?.title || null,
          products,
          updated_at: new Date().toISOString(),
        }
      })
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
