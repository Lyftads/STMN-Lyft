import { db } from './db'
import { getNangoToken } from './nango'

const SHOP_INTEGRATION = process.env.NANGO_INTEGRATION_SHOPIFY || 'shopify'
const API = process.env.SHOPIFY_API_VERSION || '2024-10'

// Credenziali Shopify: Nango prima di tutto. Il token salvato su companies può
// essere stantio — è già successo su Saracino con shopify_admin_token.
export async function getShopifyCreds(workspaceId) {
  const { data } = await db().from('companies').select('*').eq('user_id', workspaceId).maybeSingle()
  const conns = (data?.nango_connections && typeof data.nango_connections === 'object') ? data.nango_connections : {}
  const connId = conns[SHOP_INTEGRATION] || null

  let token = null, store = null
  if (connId) {
    const host = process.env.NANGO_HOST || 'https://api.nango.dev'
    try {
      const res = await fetch(`${host}/connection/${encodeURIComponent(connId)}?provider_config_key=${encodeURIComponent(SHOP_INTEGRATION)}&refresh_token=true`,
        { headers: { Authorization: `Bearer ${process.env.NANGO_SECRET_KEY}` }, cache: 'no-store', signal: AbortSignal.timeout(12000) })
      if (res.ok) {
        const c = await res.json()
        token = c?.credentials?.access_token || null
        const sub = c?.connection_config?.subdomain
        if (sub) store = `${sub}.myshopify.com`
      }
    } catch {}
  }
  return {
    storeUrl: (store || data?.shopify_store_url || '').replace(/^https?:\/\//, '') || null,
    adminToken: token || data?.shopify_admin_token || null,
    viaNango: !!token,
  }
}

async function gql(storeUrl, token, query, variables) {
  const res = await fetch(`https://${storeUrl}/admin/api/${API}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j?.errors) throw new Error(j?.errors?.[0]?.message || `Shopify HTTP ${res.status}`)
  return j.data
}

// Ordini giorno per giorno via Admin GraphQL.
// NON si usa ShopifyQL: ha una latenza di aggregazione di ~5-7 giorni e sui
// giorni recenti torna zero o parziale — proprio la finestra che ci serve.
// `customer.numberOfOrders` è il conteggio lifetime: <=1 ⇒ cliente nuovo.
export async function fetchOrdersByDay({ storeUrl, adminToken, since, until }) {
  const q = `created_at:>=${since} created_at:<=${until}T23:59:59Z`
  const query = `
    query($q: String!, $cursor: String) {
      orders(first: 250, query: $q, after: $cursor, sortKey: CREATED_AT) {
        edges { cursor node {
          createdAt
          currentTotalPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          customer { numberOfOrders }
        } }
        pageInfo { hasNextPage }
      }
    }`

  const giorni = {}
  let cursor = null, pagine = 0
  do {
    const d = await gql(storeUrl, adminToken, query, { q, cursor })
    const edges = d?.orders?.edges || []
    for (const e of edges) {
      const n = e.node
      const day = (n.createdAt || '').slice(0, 10)
      if (!day) continue
      const g = giorni[day] || (giorni[day] = { revenue: 0, orders: 0, new_customers: 0, returning_customers: 0 })
      const lordo = Number(n.currentTotalPriceSet?.shopMoney?.amount) || 0
      const reso  = Number(n.totalRefundedSet?.shopMoney?.amount) || 0
      g.revenue += lordo - reso
      g.orders += 1
      const cnt = n.customer?.numberOfOrders
      // Senza cliente associato (ordini ospite) non si indovina: non conta né di qua né di là.
      if (cnt != null) (Number(cnt) <= 1 ? g.new_customers++ : g.returning_customers++)
    }
    cursor = d?.orders?.pageInfo?.hasNextPage ? edges[edges.length - 1]?.cursor : null
  } while (cursor && ++pagine < 40)

  return giorni
}

// Vendite per PRODOTTO negli ultimi N giorni: ricavo, ordini, unità.
// Serve a distribuire la produzione in proporzione a quanto un prodotto pesa
// davvero, invece che in parti uguali.
export async function fetchVenditePerProdotto({ storeUrl, adminToken, since, until }) {
  const q = `created_at:>=${since} created_at:<=${until}T23:59:59Z`
  const query = `
    query($q: String!, $cursor: String) {
      orders(first: 100, query: $q, after: $cursor, sortKey: CREATED_AT) {
        edges { cursor node {
          id
          lineItems(first: 50) { edges { node {
            quantity
            product { id title }
            originalTotalSet { shopMoney { amount } }
            totalDiscountSet { shopMoney { amount } }
          } } }
        } }
        pageInfo { hasNextPage }
      }
    }`
  const prod = {}
  let cursor = null, pagine = 0
  do {
    const d = await gql(storeUrl, adminToken, query, { q, cursor })
    const edges = d?.orders?.edges || []
    for (const e of edges) {
      // Un ordine conta UNA volta per prodotto, anche con più righe dello
      // stesso: altrimenti il numero di ordini si gonfia.
      const visti = new Set()
      for (const li of e.node.lineItems?.edges || []) {
        const n = li.node
        const pid = n.product?.id; if (!pid) continue
        const p = prod[pid] || (prod[pid] = { id: pid, title: n.product.title, revenue: 0, units: 0, orders: 0 })
        const lordo = Number(n.originalTotalSet?.shopMoney?.amount) || 0
        const sconto = Number(n.totalDiscountSet?.shopMoney?.amount) || 0
        p.revenue += lordo - sconto
        p.units += Number(n.quantity) || 0
        if (!visti.has(pid)) { p.orders += 1; visti.add(pid) }
      }
    }
    cursor = d?.orders?.pageInfo?.hasNextPage ? edges[edges.length - 1]?.cursor : null
  } while (cursor && ++pagine < 60)
  return Object.values(prod).sort((a, b) => b.revenue - a.revenue)
}

// Fuso orario del negozio: gli orari degli ordini vanno letti lì, non in UTC.
export async function fusoNegozio({ storeUrl, adminToken }) {
  try {
    const d = await gql(storeUrl, adminToken, `query { shop { ianaTimezone } }`, {})
    return d?.shop?.ianaTimezone || 'Europe/Rome'
  } catch { return 'Europe/Rome' }
}

// Ordini e fatturato per giorno della settimana e per ora, nel fuso del negozio.
export async function fetchTiming({ storeUrl, adminToken, since, until, fuso }) {
  const q = `created_at:>=${since} created_at:<=${until}T23:59:59Z`
  const query = `
    query($q: String!, $cursor: String) {
      orders(first: 250, query: $q, after: $cursor, sortKey: CREATED_AT) {
        edges { cursor node {
          createdAt
          currentTotalPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
        } }
        pageInfo { hasNextPage }
      }
    }`
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuso, weekday: 'short', hour: '2-digit', hour12: false,
  })
  const GG = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const giorni = {}, ore = {}
  let cursor = null, pagine = 0
  do {
    const d = await gql(storeUrl, adminToken, query, { q, cursor })
    const edges = d?.orders?.edges || []
    for (const e of edges) {
      const n = e.node
      const netto = (Number(n.currentTotalPriceSet?.shopMoney?.amount) || 0)
                  - (Number(n.totalRefundedSet?.shopMoney?.amount) || 0)
      const parti = fmt.formatToParts(new Date(n.createdAt))
      const wd = GG[parti.find(p => p.type === 'weekday')?.value]
      const hh = Number(parti.find(p => p.type === 'hour')?.value)
      if (wd != null) { const g = giorni[wd] || (giorni[wd] = { orders: 0, revenue: 0 }); g.orders++; g.revenue += netto }
      if (!Number.isNaN(hh)) { const o = ore[hh] || (ore[hh] = { orders: 0, revenue: 0 }); o.orders++; o.revenue += netto }
    }
    cursor = d?.orders?.pageInfo?.hasNextPage ? edges[edges.length - 1]?.cursor : null
  } while (cursor && ++pagine < 60)
  return { giorni, ore, fuso }
}

// ---------------------------------------------------------------- ShopifyQL --
// Il tasso di conversione va preso da QUI, non da GA4: le sessioni Shopify e
// gli ordini Shopify vengono dallo stesso sistema e si contano allo stesso
// modo. Mescolare sessioni GA4 e ordini Shopify significa dividere due numeri
// che non parlano la stessa lingua (bot, consenso, attribuzione diversi).
// È l'approccio di /api/cro in LyftAI.
async function shopifyql(storeUrl, token, q) {
  // NB: shopifyqlQuery NON accetta frammenti inline su TableResponse, il campo
  // è `rows` (non rowData) e serve una API version recente. È la stessa forma
  // usata da /api/cro in LyftAI, l'unica che funziona.
  const query = `query($q: String!) { shopifyqlQuery(query: $q) { tableData { columns { name } rows } parseErrors } }`
  const ver = process.env.SHOPIFY_QL_VERSION || '2026-04'
  const attesa = (ms) => new Promise(r => setTimeout(r, ms))
  for (let tent = 1; tent <= 4; tent++) {
    const res = await fetch(`https://${storeUrl}/admin/api/${ver}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { q } }),
      signal: AbortSignal.timeout(30000),
    })
    const j = await res.json().catch(() => null)
    const errs = j?.errors || []
    const cost = j?.extensions?.cost?.throttleStatus
    const throttled = res.status === 429
      || errs.some(e => /throttl/i.test(e?.message || '') || e?.extensions?.code === 'THROTTLED')
      || (cost && cost.currentlyAvailable === 0)
    if (throttled && tent < 4) { await attesa(900 * tent); continue }
    if (!res.ok || errs.length) throw new Error(errs[0]?.message || `ShopifyQL HTTP ${res.status}`)
    const pay = j?.data?.shopifyqlQuery
    if (pay?.parseErrors?.length) throw new Error(`ShopifyQL: ${JSON.stringify(pay.parseErrors[0])}`)
    const cols = (pay?.tableData?.columns || []).map(c => c.name)
    return (pay?.tableData?.rows || []).map(r =>
      Array.isArray(r) ? Object.fromEntries(cols.map((c, i) => [c, r[i]])) : r)
  }
  return []
}

const n = (v) => { const x = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(x) ? x : 0 }

// Funnel giornaliero: sessioni, aggiunte al carrello, checkout raggiunti.
export async function fetchFunnelGiornaliero({ storeUrl, adminToken, since, until }) {
  const righe = await shopifyql(storeUrl, adminToken,
    `FROM sessions SHOW sessions, sessions_with_cart_additions, sessions_that_reached_checkout `
    + `GROUP BY day SINCE ${since} UNTIL ${until} ORDER BY day`)
  const out = {}
  for (const r of righe) {
    const g = String(r.day || r.Day || '').slice(0, 10)
    if (!g) continue
    out[g] = {
      sessions: n(r.sessions),
      addToCart: n(r.sessions_with_cart_additions),
      checkout: n(r.sessions_that_reached_checkout),
    }
  }
  return out
}

// Sessioni per ORA: da qui il CR orario, che dice in quale fascia il traffico
// converte davvero — la domanda vera dello scaling intraday.
export async function fetchSessioniPerOra({ storeUrl, adminToken, since, until }) {
  const righe = await shopifyql(storeUrl, adminToken,
    `FROM sessions SHOW sessions GROUP BY hour SINCE ${since} UNTIL ${until}`)
  const out = {}
  for (const r of righe) {
    const h = Number(String(r.hour ?? r.Hour ?? '').slice(0, 2))
    if (Number.isNaN(h)) continue
    out[h] = (out[h] || 0) + n(r.sessions)
  }
  return out
}

// Handle reali dei prodotti. Ricostruirli normalizzando il titolo NON funziona:
// "10 Litri - Olio extravergine Italiano 2025/26" ha handle
// "olio-novello-2-bag-in-box-da-5-litri", che col titolo non c'entra nulla.
// Gli handle vanno chiesti, non dedotti.
export async function fetchHandleProdotti({ storeUrl, adminToken }) {
  const query = `query($cursor: String) {
    products(first: 250, after: $cursor) {
      edges { cursor node { id handle title featuredImage { url } } } 
      pageInfo { hasNextPage }
    } }`
  const out = []
  let cursor = null, pagine = 0
  do {
    const d = await gql(storeUrl, adminToken, query, { cursor })
    const edges = d?.products?.edges || []
    for (const e of edges) out.push({ id: e.node.id, handle: e.node.handle, title: e.node.title, immagine: e.node.featuredImage?.url || null })
    cursor = d?.products?.pageInfo?.hasNextPage ? edges[edges.length - 1]?.cursor : null
  } while (cursor && ++pagine < 20)
  return out
}
