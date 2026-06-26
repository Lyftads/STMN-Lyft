// ── Shopify Bulk Operations (export massivo, no throttling, no paginazione) ──
// Il modo corretto e veloce per leggere TUTTI i clienti/ordini di uno store,
// indipendentemente dalla dimensione. Una sola operazione async lato-Shopify
// produce un file JSONL che scarichiamo e parsiamo. Tenant-agnostico.
//
// Note:
//  - Una sola bulk query per app/shop alla volta: se ne è già in corso una,
//    facciamo polling su quella (nel nostro uso è dello stesso tipo → sicuro).
//  - Richiediamo solo campi scalari/oggetto (no sub-connection) → ogni record
//    è UNA riga JSONL completa, niente stitching di figli.

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ADMIN = (store) => `https://${store}/admin/api/2024-01/graphql.json`

async function gql(store, token, query) {
  const res = await fetch(ADMIN(store), {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`Shopify ${res.status}`)
  const j = await res.json()
  if (j?.errors) throw new Error(j.errors[0]?.message || 'GraphQL error')
  return j.data
}

async function currentBulk(store, token) {
  const d = await gql(store, token, `{ currentBulkOperation(type: QUERY) { id status errorCode objectCount url } }`)
  return d?.currentBulkOperation || null
}

async function startBulk(store, token, innerQuery) {
  const m = `mutation { bulkOperationRunQuery(query: ${JSON.stringify(innerQuery)}) { bulkOperation { id status } userErrors { field message } } }`
  const d = await gql(store, token, m)
  const ue = d?.bulkOperationRunQuery?.userErrors || []
  if (ue.length) { const msg = ue.map(e => e.message).join('; '); const err = new Error(msg); err.userError = true; throw err }
  return d?.bulkOperationRunQuery?.bulkOperation || null
}

// Avvia (o riusa) una bulk query e ritorna l'URL del JSONL a operazione COMPLETATA.
async function runBulkQuery(store, token, innerQuery, deadline) {
  try {
    await startBulk(store, token, innerQuery)
  } catch (e) {
    // Operazione già in corso → faremo polling su quella esistente.
    if (!e.userError || !/already in progress/i.test(e.message || '')) throw e
  }
  while (Date.now() < deadline) {
    const cur = await currentBulk(store, token)
    if (cur) {
      if (cur.status === 'COMPLETED') return cur.url || null // url null = 0 oggetti
      if (cur.status === 'FAILED' || cur.status === 'CANCELED') throw new Error(`Bulk ${cur.status} ${cur.errorCode || ''}`.trim())
    }
    await sleep(2500)
  }
  throw new Error('Bulk timeout')
}

async function downloadJsonl(url) {
  if (!url) return []
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) })
  if (!res.ok) throw new Error(`Download ${res.status}`)
  const text = await res.text()
  const out = []
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s) continue
    try { out.push(JSON.parse(s)) } catch {}
  }
  return out
}

// TUTTI i clienti (aggregati lifetime). Shape compatibile con toBuyers/fetchAggregates.
// ADATTIVO sui Protected Customer Data di Shopify: prova con i campi PII
// (displayName/email) → se l'app NON è approvata Shopify rifiuta la query
// ("not approved to use the X field") → riprova SENZA PII. Così le app approvate
// (es. token custom) hanno nomi/email completi, le altre (es. OAuth Nango non
// approvata) ottengono comunque la segmentazione, con clienti anonimi.
export async function fetchAllCustomersBulk(store, token, deadline = Date.now() + 120000) {
  const buildQ = (pii) => `{ customers { edges { node { id ${pii ? 'displayName email ' : ''}numberOfOrders amountSpent { amount currencyCode } createdAt lastOrder { createdAt } } } } }`
  try {
    const url = await runBulkQuery(store, token, buildQ(true), deadline)
    return await downloadJsonl(url)
  } catch (e) {
    if (/not approved to use|protected customer data/i.test(e?.message || '')) {
      const url = await runBulkQuery(store, token, buildQ(false), deadline)
      return await downloadJsonl(url)
    }
    throw e
  }
}

// TUTTI gli ordini (per la ricostruzione storica). → [{ cid, ts, total }]
export async function fetchAllOrdersBulk(store, token, deadline = Date.now() + 120000) {
  const q = `{ orders { edges { node { createdAt customer { id } currentTotalPriceSet { shopMoney { amount } } } } } }`
  const url = await runBulkQuery(store, token, q, deadline)
  const rows = await downloadJsonl(url)
  return rows
    .map(o => ({ cid: o.customer?.id || null, ts: new Date(o.createdAt).getTime(), total: Number(o.currentTotalPriceSet?.shopMoney?.amount) || 0 }))
    .filter(o => o.cid && Number.isFinite(o.ts))
}
