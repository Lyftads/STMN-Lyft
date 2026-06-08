export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../../lib/tenant/credentials'

// GET /api/studio/products — prodotti del negozio (tenant) per il selettore
// prodotto del Creative Studio: { id, title, image, price }.
export async function GET(request) {
  return withTenantContext(request, async () => {
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) return NextResponse.json({ products: [] })
    try {
      const res = await fetch(`https://${storeUrl}/admin/api/2024-10/products.json?limit=250&status=active`, {
        headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) return NextResponse.json({ products: [] })
      const data = await res.json()
      const products = (data.products || [])
        .map(p => {
          const images = (p.images || []).map(i => i.src).filter(Boolean)
          return { id: p.id, title: p.title, image: p.image?.src || images[0] || '', images, price: parseFloat(p.variants?.[0]?.price) || 0 }
        })
        .filter(p => p.title && p.image)
      return NextResponse.json({ products })
    } catch {
      return NextResponse.json({ products: [] })
    }
  })
}
