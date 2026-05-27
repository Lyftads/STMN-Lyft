export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL || 'stamina-fitness3.myshopify.com'

export async function GET() {
  try {
    const res = await fetch(`https://${SHOPIFY_STORE}/products.json?limit=250`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
        Cookie: 'localization=IT; cart_currency=EUR',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return NextResponse.json({})

    const data = await res.json()
    const map = {}

    for (const p of (data.products || [])) {
      const title = p.title || ''
      const image = p.images?.[0]?.src || ''
      if (title && image) {
        map[title] = image
      }
    }

    return NextResponse.json(map, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch {
    return NextResponse.json({})
  }
}
