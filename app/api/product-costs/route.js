export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

async function shopifyGql(store, token, query) {
  const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(req) {
  return withTenantContext(req, async () => {
  const { storeUrl: STORE, adminToken: TOKEN } = getShopify()
  if (!STORE || !TOKEN) {
    return NextResponse.json({ error: 'Shopify not configured' }, { status: 500 })
  }

  try {
    const data = await shopifyGql(STORE, TOKEN, `{
      products(first: 100, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            handle
            productType
            status
            totalInventory
            variants(first: 5) {
              edges {
                node {
                  title
                  price
                  compareAtPrice
                  inventoryQuantity
                  sku
                  inventoryItem {
                    unitCost {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`)

    const products = (data?.data?.products?.edges || []).map(({ node: p }) => {
      const variants = (p.variants?.edges || []).map(({ node: v }) => ({
        title: v.title,
        price: parseFloat(v.price || '0'),
        compareAtPrice: parseFloat(v.compareAtPrice || '0'),
        cost: v.inventoryItem?.unitCost?.amount ? parseFloat(v.inventoryItem.unitCost.amount) : null,
        currency: v.inventoryItem?.unitCost?.currencyCode || 'EUR',
        inventory: v.inventoryQuantity || 0,
        sku: v.sku,
      }))

      const mainVariant = variants[0] || {}
      const price = mainVariant.price || 0
      const cost = mainVariant.cost
      const margin = cost != null && price > 0 ? ((price - cost) / price) * 100 : null
      const markup = cost != null && cost > 0 ? ((price - cost) / cost) * 100 : null

      return {
        title: p.title,
        handle: p.handle,
        type: p.productType || '',
        status: p.status,
        totalInventory: p.totalInventory || 0,
        price,
        cost,
        margin: margin != null ? Math.round(margin * 10) / 10 : null,
        markup: markup != null ? Math.round(markup * 10) / 10 : null,
        variants: variants.length > 1 ? variants : undefined,
      }
    })

    const withCost = products.filter(p => p.cost != null && p.cost > 0)
    const avgMargin = withCost.length > 0 ? withCost.reduce((s, p) => s + p.margin, 0) / withCost.length : null
    const avgCost = withCost.length > 0 ? withCost.reduce((s, p) => s + p.cost, 0) / withCost.length : null
    const avgPrice = products.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / (products.filter(p => p.price > 0).length || 1)
    const totalInventory = products.reduce((s, p) => s + p.totalInventory, 0)

    const lowMargin = withCost.filter(p => p.margin < 50).sort((a, b) => a.margin - b.margin).slice(0, 5)
    const highMargin = withCost.filter(p => p.margin >= 50).sort((a, b) => b.margin - a.margin).slice(0, 5)

    return NextResponse.json({
      products,
      summary: {
        totalProducts: products.length,
        productsWithCost: withCost.length,
        avgMargin: avgMargin != null ? Math.round(avgMargin * 10) / 10 : null,
        avgCost: avgCost != null ? Math.round(avgCost * 100) / 100 : null,
        avgPrice: Math.round(avgPrice * 100) / 100,
        totalInventory,
        lowMarginProducts: lowMargin,
        highMarginProducts: highMargin,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
  })
}
