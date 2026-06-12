export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { getAdminSupabase } from '../../../lib/supabase/server'

async function fetchVariants(store, token) {
  const products = []
  let cursor = null, currency = 'EUR'
  for (let p = 0; p < 30; p++) {
    const after = cursor ? `, after: "${cursor}"` : ''
    const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
      method: 'POST', headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ query: `{
        products(first: 100${after}, query: "status:active") {
          pageInfo { hasNextPage endCursor }
          edges { node {
            legacyResourceId title isGiftCard featuredImage { url }
            variants(first: 100) { edges { node {
              legacyResourceId title sku
              inventoryItem { unitCost { amount currencyCode } requiresShipping }
            }}}
          }}
        }
      }` }),
    })
    if (!res.ok) break
    const json = await res.json()
    const conn = json?.data?.products
    for (const { node: pr } of (conn?.edges || [])) {
      if (pr.isGiftCard) continue
      const variants = []
      for (const { node: v } of (pr.variants?.edges || [])) {
        if (v.inventoryItem?.requiresShipping === false) continue
        if (v.inventoryItem?.unitCost?.currencyCode) currency = v.inventoryItem.unitCost.currencyCode
        variants.push({
          variant_id: String(v.legacyResourceId),
          sku: v.sku || '',
          size: v.title && v.title !== 'Default Title' ? v.title : 'Taglia unica',
          shopifyCost: v.inventoryItem?.unitCost?.amount != null ? parseFloat(v.inventoryItem.unitCost.amount) : null,
        })
      }
      if (variants.length) products.push({ productId: String(pr.legacyResourceId), title: pr.title, image: pr.featuredImage?.url || null, variants })
    }
    if (!conn?.pageInfo?.hasNextPage) break
    cursor = conn.pageInfo.endCursor
  }
  return { products, currency }
}

// Rileva i cambi di costo Shopify e li registra nello storico (note='shopify').
// Prima volta = baseline silenziosa. Ritorna Map variant_id -> nuovo costo per
// le variazioni rilevate (così la risposta riflette subito il cambiamento).
async function syncShopifyCosts(admin, workspaceId, products) {
  const changed = new Map()
  if (!admin || !workspaceId) return changed
  try {
    // costo Shopify attuale per variante (solo dove definito)
    const current = new Map()
    for (const p of products) for (const v of p.variants) if (v.shopifyCost != null) current.set(v.variant_id, { cost: v.shopifyCost, product_id: p.productId, sku: v.sku })
    if (!current.size) return changed

    const { data: seenRows } = await admin.from('variant_cost_seen').select('variant_id, shopify_cost').eq('workspace_id', workspaceId)
    const seen = new Map((seenRows || []).map(r => [String(r.variant_id), r.shopify_cost == null ? null : Number(r.shopify_cost)]))

    const today = new Date().toISOString().slice(0, 10)
    const histInserts = []   // cambi reali → storico
    const seenUpserts = []   // baseline + aggiornamenti
    for (const [vid, info] of current) {
      const prev = seen.get(vid)
      if (prev === undefined) {
        // baseline silenziosa
        seenUpserts.push({ workspace_id: workspaceId, variant_id: vid, shopify_cost: info.cost, synced_at: new Date().toISOString() })
      } else if (prev == null || Math.abs(prev - info.cost) > 0.005) {
        histInserts.push({ workspace_id: workspaceId, variant_id: vid, product_id: info.product_id, sku: info.sku, landed_cost: info.cost, effective_from: today, note: 'shopify' })
        seenUpserts.push({ workspace_id: workspaceId, variant_id: vid, shopify_cost: info.cost, synced_at: new Date().toISOString() })
        changed.set(vid, info.cost)
      }
    }
    if (histInserts.length) await admin.from('product_landed_cost').insert(histInserts)
    if (seenUpserts.length) await admin.from('variant_cost_seen').upsert(seenUpserts, { onConflict: 'workspace_id,variant_id' })
  } catch {}
  return changed
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { storeUrl: store, adminToken: token } = getShopify()
    if (!store || !token) return NextResponse.json({ ok: false, error: 'Shopify non configurato' }, { status: 400 })
    const sp = new URL(req.url).searchParams
    const ws = await resolveWorkspace()
    const admin = getAdminSupabase()

    // Storico di una singola variante
    const variantId = sp.get('variant_id')
    if (variantId) {
      if (!admin || !ws) return NextResponse.json({ ok: true, history: [] })
      try {
        const { data } = await admin.from('product_landed_cost').select('landed_cost, effective_from, note, created_at')
          .eq('workspace_id', ws.workspaceId).eq('variant_id', variantId)
          .order('effective_from', { ascending: false }).order('created_at', { ascending: false })
        return NextResponse.json({ ok: true, history: data || [] })
      } catch { return NextResponse.json({ ok: true, history: [] }) }
    }

    try {
      const { products, currency } = await fetchVariants(store, token)

      // Sync automatico: registra nello storico i cambi di costo Shopify (tutti i tenant).
      const changed = await syncShopifyCosts(admin, ws?.workspaceId, products)

      // override correnti + conteggio storico per variante
      const latest = new Map(), count = new Map()
      if (admin && ws) {
        try {
          const { data } = await admin.from('product_landed_cost').select('variant_id, landed_cost, effective_from, created_at')
            .eq('workspace_id', ws.workspaceId).order('effective_from', { ascending: false }).order('created_at', { ascending: false })
          for (const r of (data || [])) { const v = String(r.variant_id); count.set(v, (count.get(v) || 0) + 1); if (!latest.has(v)) latest.set(v, Number(r.landed_cost)) }
        } catch {}
      }
      // riflette subito i cambi appena sincronizzati (sono ora il valore corrente)
      for (const [v, cost] of changed) { latest.set(v, cost); if (!count.get(v)) count.set(v, 1) }
      const out = products.map(p => ({
        ...p,
        variants: p.variants.map(v => ({ ...v, landed: latest.has(v.variant_id) ? latest.get(v.variant_id) : null, historyCount: count.get(v.variant_id) || 0 })),
      }))
      return NextResponse.json({ ok: true, currency, products: out, savedAvailable: !!ws })
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
    const entries = Array.isArray(body.entries) ? body.entries : []
    const today = new Date().toISOString().slice(0, 10)
    const rows = entries
      .filter(e => e && e.variant_id && e.landed_cost != null && Number.isFinite(Number(e.landed_cost)))
      .map(e => ({
        workspace_id: ws.workspaceId,
        variant_id: String(e.variant_id),
        product_id: e.product_id ? String(e.product_id) : null,
        sku: e.sku || null,
        landed_cost: Number(e.landed_cost),
        effective_from: e.effective_from || today,
        note: e.note || 'manuale',
      }))
    if (!rows.length) return NextResponse.json({ ok: true, saved: 0 })
    try {
      const { error } = await admin.from('product_landed_cost').insert(rows)
      if (error) throw error
      return NextResponse.json({ ok: true, saved: rows.length })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message || 'Errore salvataggio (hai eseguito product_landed_cost.sql?)' }, { status: 500 })
    }
  })
}
