// Context provider del Creative Studio: dà all'agent SEMPRE il contesto
// completo del cliente — brand identity, prodotti, performance.
// Riusa gli endpoint esistenti (metrics, creative) inoltrando il cookie di
// sessione così girano col tenant corretto (cache hit). Tollerante ai
// fallimenti: se una fonte non risponde, il resto del contesto resta valido.
import { buildBrandContext } from '../tenant/brand'

async function safeJson(url, cookie, ms = 8000) {
  try {
    const r = await fetch(url, { cache: 'no-store', headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(ms) })
    return r.ok ? await r.json() : null
  } catch { return null }
}

// Ritorna { brandBlock, products[], topAds[], contextBlock } per il prompt.
export async function buildStudioContext({ origin, cookie } = {}) {
  const [brandBlock, metrics, creative] = await Promise.all([
    buildBrandContext().catch(() => ''),
    origin ? safeJson(`${origin}/api/metrics`, cookie) : null,
    origin ? safeJson(`${origin}/api/creative?preset=last_28d`, cookie) : null,
  ])

  const products = (metrics?.shopifyTopProducts || []).slice(0, 8).map(p => ({
    product: p.product, revenue: p.revenue, orders: p.orders,
  }))

  const topAds = (creative?.rows || [])
    .filter(r => (r.roas || 0) > 0)
    .sort((a, b) => (b.roas || 0) - (a.roas || 0))
    .slice(0, 6)
    .map(r => ({ name: r.name || r.ad_name || '', roas: r.roas || 0, ctr: r.ctr_link || r.ctr || 0 }))

  // Blocco compatto da iniettare nel system prompt dell'enhancer / chat agent.
  const parts = []
  if (brandBlock) parts.push(`[BRAND]\n${brandBlock}`)
  if (products.length) {
    parts.push(`[TOP PRODUCTS] (per fatturato)\n` + products.map(p => `- ${p.product} (€${Math.round(p.revenue || 0)}, ${p.orders || 0} ordini)`).join('\n'))
  }
  if (topAds.length) {
    parts.push(`[BEST CREATIVE] (ROAS più alto — replica ciò che converte)\n` + topAds.map(a => `- ${a.name} · ROAS ${(+a.roas).toFixed(1)} · CTR ${(+a.ctr).toFixed(1)}%`).join('\n'))
  }

  return {
    brandBlock: brandBlock || '',
    products,
    topAds,
    contextBlock: parts.join('\n\n'),
  }
}
