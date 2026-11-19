import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { analizzaUrl, seguiLink, attesa, RITMO_MS } from '../../../../../lib/motore/link'
import { getShopifyCreds, fetchHandleProdotti } from '../../../../../lib/motore/shopify'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  try {
    const { data: cre } = await db().from('ce_creatives')
      .select('id, name, link_url, product_id').eq('workspace_id', ws)
      .not('link_url', 'is', null).range(0, 999)
    const { data: prodotti } = await db().from('ce_products')
      .select('id, slug, name, shopify_id').eq('workspace_id', ws)

    // Handle Shopify → prodotto, CHIESTI a Shopify e non dedotti dal titolo:
    // "10 Litri - Olio extravergine Italiano 2025/26" ha handle
    // "olio-novello-2-bag-in-box-da-5-litri", che col titolo non c'entra nulla.
    const perHandle = new Map()
    try {
      const sc = await getShopifyCreds(ws)
      if (sc.storeUrl && sc.adminToken) {
        const handles = await fetchHandleProdotti(sc)
        const perShopifyId = new Map((prodotti || []).map(p => [p.shopify_id, p]))
        for (const h of handles) {
          const p = perShopifyId.get(h.id)
          if (p) perHandle.set(h.handle, p)
        }
      }
    } catch {}

    let analizzati = 0, rotti = 0, attribuiti = 0, limitati = 0
    const tipi = {}, destinazioni = {}
    for (const c of cre || []) {
      const a = analizzaUrl(c.link_url)
      const r = await seguiLink(c.link_url)
      const finale = r.finale ? analizzaUrl(r.finale) : a
      const handle = finale.handle || a.handle
      tipi[finale.tipo] = (tipi[finale.tipo] || 0) + 1
      if (handle) destinazioni[handle] = (destinazioni[handle] || 0) + 1
      if (r.stato === 429) limitati++
      else if (r.stato && r.stato >= 400) rotti++

      const patch = {
        link_tipo: finale.tipo, link_handle: handle || null,
        link_finale: r.finale || null,
        ...(r.stato === 429 ? {} : { link_stato: r.stato }),
        link_utm: finale.utm || a.utm || null,
      }
      // Il prodotto dal link vince su tutto: l'handle è un fatto, non una
      // deduzione. Si scrive solo se la creatività non ne ha già uno.
      if (handle) {
        const p = perHandle.get(handle)
        if (p) { patch.product_id = p.id; attribuiti++ }
      }
      await db().from('ce_creatives').update(patch).eq('id', c.id).eq('workspace_id', wsMotore())
      analizzati++
      await attesa(RITMO_MS)   // il sito ci limita se lo martelliamo
    }
    return NextResponse.json({ ok: true, analizzati, rotti, limitati, attribuitiDalLink: attribuiti, tipi,
      destinazioni: Object.entries(destinazioni).sort((a,b)=>b[1]-a[1]).slice(0,10) })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'analisi link fallita' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
