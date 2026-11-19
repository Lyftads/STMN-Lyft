import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { getShopifyCreds, fetchVenditePerProdotto, fetchHandleProdotti } from '../../../../../lib/motore/shopify'
import { allocaProduzione } from '../../../../../lib/motore/allocazione'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
const day = (d) => d.toISOString().slice(0, 10)
const slugDa = (t) => (t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 3).join('-') || 'PROD'

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  const GIORNI = Number(process.env.CE_FINESTRA_GIORNI || 30)
  const until = new Date(Date.now() - 86400000)
  const since = new Date(until.getTime() - (GIORNI - 1) * 86400000)

  try {
    const sc = await getShopifyCreds(ws)
    if (!sc.storeUrl || !sc.adminToken) return NextResponse.json({ error: 'Shopify non collegato' }, { status: 400 })

    const vendite = await fetchVenditePerProdotto({
      storeUrl: sc.storeUrl, adminToken: sc.adminToken, since: day(since), until: day(until),
    })

    // Handle veri da Shopify: da qui esce il link di destinazione.
    // Handle e immagine di prodotto: l'immagine è il nodo radice della board,
    // il punto da cui parte tutta la produzione di quel prodotto.
    const handles = new Map(), immagini = new Map()
    try {
      for (const h of await fetchHandleProdotti(sc)) {
        handles.set(h.id, h.handle)
        if (h.immagine) immagini.set(h.id, h.immagine)
      }
    } catch {}

    const { data: esistenti } = await db().from('ce_products').select('*').eq('workspace_id', ws)
    const perShopify = new Map((esistenti || []).map(p => [p.shopify_id, p]))
    const slugUsati = new Set((esistenti || []).map(p => p.slug))

    const righe = vendite.map(v => {
      const vecchio = perShopify.get(v.id)
      let slug = vecchio?.slug
      if (!slug) {
        slug = slugDa(v.title); let n = 2
        while (slugUsati.has(slug)) slug = `${slugDa(v.title)}-${n++}`
        slugUsati.add(slug)
      }
      return {
        ...(vecchio?.id ? { id: vecchio.id } : {}),
        workspace_id: ws, shopify_id: v.id, name: v.title, slug,
        // Il margine resta quello già impostato sul prodotto: NON si sovrascrive
        // con un default, altrimenti un dato inserito a mano verrebbe perso.
        margin_pct: vecchio?.margin_pct ?? null,
        revenue_30d: +v.revenue.toFixed(2), orders_30d: v.orders, units_30d: v.units,
        handle: handles.get(v.id) || vecchio?.handle || null,
        packshot_url: immagini.get(v.id) || vecchio?.packshot_url || null,
        sales_updated_at: new Date().toISOString(), active: true,
      }
    })
    if (righe.length) {
      const { error } = await db().from('ce_products').upsert(righe, { onConflict: 'workspace_id,slug' })
      if (error) throw new Error(error.message)
    }

    // Allocazione: quanta produzione spetta a ogni prodotto.
    const [{ data: prodotti }, { data: cre }] = await Promise.all([
      db().from('ce_products').select('*').eq('workspace_id', ws),
      db().from('ce_creatives').select('id, product_id, funnel').eq('workspace_id', ws).range(0, 999),
    ])
    const alloc = allocaProduzione({
      prodotti: prodotti || [], creativita: cre || [],
      capacitaSettimanale: Number(process.env.CE_CAPACITA_SETTIMANALE || 12),
    })
    for (const p of alloc.prodotti) {
      await db().from('ce_products').update({
        quota_margine: +p.quotaMargine.toFixed(4),
        quota_creativita: p.creativitaSettimana,
      }).eq('id', p.id).eq('workspace_id', wsMotore())
    }

    return NextResponse.json({
      ok: true, prodottiVenduti: vendite.length, salvati: righe.length,
      allocazione: alloc.prodotti.slice(0, 12).map(p => ({
        prodotto: p.name?.slice(0, 46), slug: p.slug,
        fatturato30gg: p.revenue_30d, ordini: p.orders_30d,
        quotaMargine: +(p.quotaMargine * 100).toFixed(1),
        quotaProduzione: +(p.quotaProduzione * 100).toFixed(1),
        creativitaSettimana: p.creativitaSettimana,
        copertura: p.copertura, fasiPrioritarie: p.fasiPrioritarie.map(f => f.fase),
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'ingest prodotti fallito' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
