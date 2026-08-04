export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../lib/tenant/credentials'

export async function GET(req) {
  return withTenantContext(req, async () => {
  const SHOPIFY_STORE = getShopify().storeUrl
  if (!SHOPIFY_STORE) return NextResponse.json({})
  try {
    // Catalogo PAGINATO. Prima si leggeva una pagina sola (250 prodotti): su un
    // catalogo grande restava senza miniatura tutto il resto — Anna Virgili ha
    // 2.336 prodotti, quindi ne copriva circa il 10%. Ci si ferma quando la
    // pagina torna corta (fine catalogo) o al tetto di sicurezza.
    const MAX_PAGES = 20              // tetto di sicurezza: fino a 5.000 prodotti
    const PER_PAGE = 250
    const fetchPage = async (page) => {
      try {
        const res = await fetch(`https://${SHOPIFY_STORE}/products.json?limit=${PER_PAGE}&page=${page}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
            Cookie: 'localization=IT; cart_currency=EUR',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return null
        const data = await res.json()
        return data.products || []
      } catch { return null }
    }

    const products = []
    const first = await fetchPage(1)
    if (first) products.push(...first)
    // Pagine successive a gruppi PARALLELI: in sequenza un catalogo da 2.300
    // prodotti costava una decina di secondi di attesa per le miniature.
    if (first && first.length === PER_PAGE) {
      outer: for (let start = 2; start <= MAX_PAGES; start += 5) {
        const batch = await Promise.all(
          Array.from({ length: 5 }, (_, i) => start + i).filter(n => n <= MAX_PAGES).map(fetchPage)
        )
        for (const b of batch) {
          if (!b) break outer                 // errore/rate limit: tieni quello che hai
          products.push(...b)
          if (b.length < PER_PAGE) break outer // fine catalogo
        }
      }
    }

    if (!products.length) return NextResponse.json({})

    const map = {}

    for (const p of products) {
      const title = p.title || ''
      const image = p.images?.[0]?.src || ''
      if (!title || !image) continue

      // Exact title
      map[title] = image
      // Lowercase
      map[title.toLowerCase()] = image
      // Without quotes and special chars
      map[title.replace(/["'"]/g, '').trim()] = image
      map[title.replace(/["'"]/g, '').trim().toLowerCase()] = image

      // Also index by variant titles (order line items often include variant)
      for (const v of (p.variants || [])) {
        if (v.title && v.title !== 'Default Title') {
          map[`${title} - ${v.title}`] = image
          map[`${title} - ${v.title}`.toLowerCase()] = image
          map[`${title} / ${v.title}`] = image
        }
      }
    }

    return NextResponse.json(map, {
      // MAI 'public, s-maxage' su risposte PER-TENANT (URL uguale per tutti,
      // la CDN non varia sul cookie → immagini dello store di un tenant
      // servite a un altro).
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({})
  }
  })
}
