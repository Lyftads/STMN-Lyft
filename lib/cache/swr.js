// Wrapper SWR (stale-while-revalidate) sopra la cache L2 (tab_snapshots).
//
// Obiettivo: rendere ogni tab analitica istantanea dopo il primo calcolo, per
// OGNI account (la cache è per workspace_id → multi-tenant per costruzione).
//
// Comportamento per una GET:
//  - nessun workspace (utente non loggato) → calcolo live, nessuna cache.
//  - snapshot fresco (età < ttl)           → ritorno immediato, zero ricalcolo.
//  - snapshot scaduto (stale)              → ritorno SUBITO lo stale e rinfresco
//                                            in background (waitUntil) → la prossima
//                                            apertura è fresca. Niente spinner.
//  - nessuno snapshot / ?refresh=1         → calcolo inline + salvo.
//
// La chiave include i parametri di "vista" (periodo, account, ecc.) così non si
// serve mai un periodo per un altro. I payload di errore non vengono cachati
// (compute deve ritornare { __noCache: true, ... }).

import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { resolveWorkspace } from '../team/workspace'
import { getSnapshotStale, setSnapshot } from './snapshot'

const DEFAULT_TTL = 30 * 60 * 1000 // 30 min

// Parametri che definiscono la "vista" → entrano nella chiave di cache.
const KEY_PARAMS = [
  'preset', 'since', 'until', 'months', 'days', 'range', 'window',
  'account', 'account_id', 'accountId', 'customer', 'customerId',
  'property', 'propertyId', 'metric', 'channel', 'status', 'segment', 'flow',
]

function rangeKey(url) {
  const sp = url.searchParams
  const parts = []
  for (const k of KEY_PARAMS) {
    const v = sp.get(k)
    if (v != null && v !== '') parts.push(`${k}=${v}`)
  }
  return parts.join('&') || 'default'
}

export async function swrSnapshot(req, { tab, ttlMs = DEFAULT_TTL, compute }) {
  const url = new URL(req.url)
  const force = url.searchParams.get('refresh') === '1'

  let ws = null
  try { ws = await resolveWorkspace() } catch {}
  const wsId = ws?.workspaceId

  // compute() può segnalare un payload non cachabile (errore) con __noCache:true
  const runCompute = async () => {
    const data = await compute()
    if (data && data.__noCache) { const { __noCache, ...clean } = data; return { data: clean, cacheable: false } }
    return { data: data || {}, cacheable: true }
  }

  // Utente non loggato → nessuna cache per-workspace possibile: calcolo live.
  if (!wsId) {
    const { data } = await runCompute()
    return NextResponse.json({ ...data, _cache: { hit: false, stale: false } })
  }

  const cacheTab = `${tab}:${rangeKey(url)}`

  if (!force) {
    const snap = await getSnapshotStale(wsId, cacheTab)
    if (snap) {
      const stale = snap.ageMs > ttlMs
      if (stale) {
        // Servo lo stale e rinfresco in background: la GET resta velocissima.
        waitUntil((async () => {
          try {
            const { data, cacheable } = await runCompute()
            if (cacheable) await setSnapshot(wsId, cacheTab, data)
          } catch {}
        })())
      }
      return NextResponse.json({ ...snap.payload, _cache: { hit: true, stale, ageMs: snap.ageMs } })
    }
  }

  // Cache miss o refresh forzato → calcolo inline e salvo.
  const { data, cacheable } = await runCompute()
  if (cacheable) { try { await setSnapshot(wsId, cacheTab, data) } catch {} }
  return NextResponse.json({ ...data, _cache: { hit: false, stale: false, refreshed: force } })
}
