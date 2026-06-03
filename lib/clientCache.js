// ============================================================================
//  Client-side SWR cache per le fetch del dashboard.
//
//  Pattern: stale-while-revalidate.
//    - hit fresh (< TTL_MS):  ritorna subito i dati cached, nessun fetch
//    - hit stale (TTL_MS .. STALE_OK_MS): ritorna cached SUBITO +
//      revalidate in background (silent), notifica via onUpdate
//    - hit oltre STALE_OK_MS: scartato, fetch sync
//    - miss: fetch sync, salva cache
//
//  Dedupe: se due chiamate concorrenti partono per la stessa key, la
//  seconda riusa la Promise in volo (no doppio network).
//
//  Vive in memoria del tab del browser: niente persistence cross-session
//  (volutamente — i dati possono essere cambiati da Shopify mentre eri via).
// ============================================================================

const TTL_MS = 60_000              // 60s: dati considerati "freschi"
const STALE_OK_MS = 5 * 60_000     // 5min: oltre, refetch sincrono

const cache = new Map() // key → { data, ts, inflight: Promise|null }

/**
 * Ritorna i dati in cache se ancora utilizzabili (entro STALE_OK_MS).
 * @returns {{ data: any, fresh: boolean } | null}
 */
export function getCached(key) {
  const hit = cache.get(key)
  if (!hit || hit.data == null) return null
  const age = Date.now() - hit.ts
  if (age > STALE_OK_MS) return null
  return { data: hit.data, fresh: age < TTL_MS }
}

/** Setta valore in cache (timestamp = adesso) */
export function setCached(key, data) {
  const prev = cache.get(key) || {}
  cache.set(key, { ...prev, data, ts: Date.now(), inflight: null })
}

/** Cancella una entry o tutta la cache */
export function invalidate(key) {
  if (key) cache.delete(key)
  else cache.clear()
}

/**
 * SWR fetch principale.
 *
 * @param {object} opts
 * @param {string} opts.key                Chiave cache (es. "metrics:last_7d")
 * @param {() => Promise<any>} opts.fetcher Funzione che esegue la fetch reale
 * @param {(data: any) => void} [opts.onUpdate] Chiamato quando la revalidate
 *                                              background completa con nuovi dati
 * @param {boolean} [opts.forceRefresh]    true = bypass cache, fetch sync
 *
 * @returns {Promise<{ data: any, fromCache: boolean }>}
 */
export async function swrFetch({ key, fetcher, onUpdate, forceRefresh = false }) {
  if (!forceRefresh) {
    const hit = getCached(key)
    if (hit) {
      // Se stale, lancia revalidate background (non bloccante)
      if (!hit.fresh) revalidate({ key, fetcher, onUpdate })
      return { data: hit.data, fromCache: true }
    }
  }

  // Miss o force: fetch sincrono. Dedupe se inflight gia' presente.
  const existing = cache.get(key)
  if (!forceRefresh && existing?.inflight) {
    const data = await existing.inflight
    return { data, fromCache: false }
  }

  const promise = fetcher().then(data => {
    setCached(key, data)
    return data
  }).catch(err => {
    // Rimuovi inflight ma non corrompere cache esistente
    const cur = cache.get(key)
    if (cur) cache.set(key, { ...cur, inflight: null })
    throw err
  })

  cache.set(key, {
    ...(existing || { data: null, ts: 0 }),
    inflight: promise,
  })

  const data = await promise
  return { data, fromCache: false }
}

/**
 * Revalida in background senza bloccare. Notifica onUpdate quando i dati
 * arrivano (anche se diversi da quelli cached).
 */
async function revalidate({ key, fetcher, onUpdate }) {
  const existing = cache.get(key)
  if (existing?.inflight) return // gia' in corso, no-op

  const promise = fetcher()
  cache.set(key, { ...existing, inflight: promise })

  try {
    const data = await promise
    setCached(key, data)
    if (onUpdate) {
      try { onUpdate(data) } catch {}
    }
  } catch {
    // Mantieni cache stale, prossimo tentativo riprovera'
    const cur = cache.get(key)
    if (cur) cache.set(key, { ...cur, inflight: null })
  }
}

/**
 * Prefetch silent: warma la cache in background. Se gia' fresco no-op.
 * Errori swallowed.
 */
export async function prefetch({ key, fetcher }) {
  const hit = getCached(key)
  if (hit && hit.fresh) return // gia' cached fresh
  const existing = cache.get(key)
  if (existing?.inflight) return // gia' in volo

  try {
    const promise = fetcher()
    cache.set(key, { ...(existing || { data: null, ts: 0 }), inflight: promise })
    const data = await promise
    setCached(key, data)
  } catch {
    const cur = cache.get(key)
    if (cur) cache.set(key, { ...cur, inflight: null })
  }
}
