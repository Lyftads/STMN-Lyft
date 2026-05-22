// app/api/metrics/route.js
// Aggrega Shopify + Meta + Google e calcola LTV, CAC, ratio
import { NextResponse } from 'next/server'

const GROSS_MARGIN = parseFloat(process.env.GROSS_MARGIN || '0.40') // default 40%
const BASE_URL     = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

export async function GET() {
  try {
    // Fetch parallelo da tutte le sorgenti
    const [shopifyRes, metaRes, googleRes] = await Promise.allSettled([
      fetch(`${BASE_URL}/api/shopify`, { next: { revalidate: 3600 } }),
      fetch(`${BASE_URL}/api/meta`,    { next: { revalidate: 3600 } }),
      fetch(`${BASE_URL}/api/google`,  { next: { revalidate: 3600 } }),
    ])

    const shopify = shopifyRes.status === 'fulfilled' && shopifyRes.value.ok
      ? await shopifyRes.value.json() : null
    const meta = metaRes.status === 'fulfilled' && metaRes.value.ok
      ? await metaRes.value.json() : null
    const google = googleRes.status === 'fulfilled' && googleRes.value.ok
      ? await googleRes.value.json() : null

    if (!shopify) {
      return NextResponse.json({ error: 'Shopify non disponibile' }, { status: 500 })
    }

    // ── Calcolo LTV ────────────────────────────────────────────
    const aov               = shopify.aov || 0
    const purchaseFrequency = shopify.purchaseFrequency || 0
    const customerLifespan  = shopify.customerLifespan || 0
    const ltvGross          = aov * purchaseFrequency * customerLifespan
    const ltvNet            = ltvGross * GROSS_MARGIN

    // ── Calcolo CAC ────────────────────────────────────────────
    const metaSpend   = meta?.totalSpend   || 0
    const googleSpend = google?.totalSpend || 0
    const totalAdSpend = metaSpend + googleSpend
    const newCustomers = shopify.newCustomers || 1
    const cac = totalAdSpend > 0 ? totalAdSpend / newCustomers : null

    // ── Ratio LTV:CAC ──────────────────────────────────────────
    const ratio = cac && cac > 0 ? ltvNet / cac : null

    // ── Status ─────────────────────────────────────────────────
    let ratioStatus = 'no_data'
    if (ratio !== null) {
      if (ratio < 1)      ratioStatus = 'critical'
      else if (ratio < 3) ratioStatus = 'warning'
      else if (ratio <= 7) ratioStatus = 'good'
      else                 ratioStatus = 'excellent'
    }

    // ── Trend mensile combinato ────────────────────────────────
    const monthlyShopify = shopify.monthly || []
    const monthlyMeta    = meta?.monthly   || []
    const monthlyGoogle  = google?.monthly || []

    const monthlyMap = {}
    for (const m of monthlyShopify) {
      monthlyMap[m.month] = { ...m, metaSpend: 0, googleSpend: 0, totalSpend: 0 }
    }
    for (const m of monthlyMeta) {
      if (monthlyMap[m.month]) monthlyMap[m.month].metaSpend = m.spend
      else monthlyMap[m.month] = { month: m.month, metaSpend: m.spend, googleSpend: 0, totalSpend: m.spend }
    }
    for (const m of monthlyGoogle) {
      if (monthlyMap[m.month]) monthlyMap[m.month].googleSpend = m.spend
      else monthlyMap[m.month] = { month: m.month, metaSpend: 0, googleSpend: m.spend, totalSpend: m.spend }
    }
    const monthly = Object.values(monthlyMap)
      .map(m => ({
        ...m,
        totalSpend: (m.metaSpend || 0) + (m.googleSpend || 0),
        cac: m.customers > 0 && ((m.metaSpend||0) + (m.googleSpend||0)) > 0
          ? Math.round(((m.metaSpend||0)+(m.googleSpend||0)) / (m.customers||1) * 100) / 100
          : null,
      }))
      .sort((a,b) => a.month.localeCompare(b.month))

    return NextResponse.json({
      // LTV
      aov,
      purchaseFrequency: Math.round(purchaseFrequency * 100) / 100,
      customerLifespan:  Math.round(customerLifespan * 100) / 100,
      grossMargin:       GROSS_MARGIN,
      ltvGross:          Math.round(ltvGross * 100) / 100,
      ltvNet:            Math.round(ltvNet * 100) / 100,
      // CAC
      metaSpend:         Math.round(metaSpend * 100) / 100,
      googleSpend:       Math.round(googleSpend * 100) / 100,
      totalAdSpend:      Math.round(totalAdSpend * 100) / 100,
      newCustomers,
      cac:               cac ? Math.round(cac * 100) / 100 : null,
      // Ratio
      ratio:             ratio ? Math.round(ratio * 100) / 100 : null,
      ratioStatus,
      // Shopify details
      totalOrders:       shopify.totalOrders,
      uniqueCustomers:   shopify.uniqueCustomers,
      churnRate:         shopify.churnRate,
      retentionRate:     shopify.retentionRate,
      returningRate:     shopify.returningRate,
      // Sorgenti attive
      sources: {
        shopify: !!shopify && !shopify.error,
        meta:    !!meta    && !meta.error,
        google:  !!google  && !google.error,
      },
      monthly,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
