export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'
import { resolveWorkspace } from '../../../lib/team/workspace'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { fetchVariantsForCost, syncShopifyCosts } from '../../../lib/cost/shopifySync'
import { getSnapshot, setSnapshot } from '../../../lib/cache/snapshot'

const SNAP_TTL = 30 * 60 * 1000 // 30 min (cache L2 condivisa)

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

    const force = sp.get('refresh') === '1'
    if (!force) {
      const snap = await getSnapshot(ws?.workspaceId, 'productCosts', SNAP_TTL)
      if (snap) return NextResponse.json({ ...snap, cached: true })
    }

    try {
      const { products, currency } = await fetchVariantsForCost(store, token)

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
      const payload = { ok: true, currency, products: out, savedAvailable: !!ws }
      await setSnapshot(ws?.workspaceId, 'productCosts', payload)
      return NextResponse.json(payload)
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
