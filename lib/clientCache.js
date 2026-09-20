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

// Obiettivo: una volta caricato un timeframe, i dati RESTANO in memoria per la
// sessione e NON spariscono (niente spinner/blank dopo qualche minuto). Oltre il
// TTL si fa solo revalidate silenzioso in background; refresh duro = bottone "Aggiorna".
const TTL_MS = 5 * 60_000              // 5min: dati "freschi" → nessuna chiamata
const STALE_OK_MS = 24 * 60 * 60_000   // 24h (≈ sessione): mostra SEMPRE il cached + revalida in bg, mai sync/blank

const cache = new Map() // key → { data, ts, day, inflight: Promise|null }

// Giorno corrente (locale). Le chiavi sono RELATIVE — "metrics:yesterday",
// "metrics:today", "metrics:last_7d" — quindi a mezzanotte cambiano significato
// pur restando la stessa stringa. Con una tolleranza di 24h, chi lasciava la
// scheda aperta la mattina dopo vedeva sotto l'etichetta "ieri" il valore del
// giorno prima, finche' la revalidate in background non arrivava. Segnalato il
// 7 ago: "ieri legge 1840, in verita' era 1449,38".
const dayStamp = () => new Date().toDateString()

/**
 * Ritorna i dati in cache se ancora utilizzabili (entro STALE_OK_MS).
 * @returns {{ data: any, fresh: boolean } | null}
 */
export function getCached(key) {
  const hit = cache.get(key)
  if (!hit || hit.data == null) return null
  // Giorno diverso da quando e' stato salvato → il dato si riferisce a un altro
  // periodo, anche se la chiave e' identica. Si butta e si rilegge.
  if (hit.day && hit.day !== dayStamp()) { cache.delete(key); return null }
  const age = Date.now() - hit.ts
  if (age > STALE_OK_MS) return null
  return { data: hit.data, fresh: age < TTL_MS }
}

/** Setta valore in cache (timestamp = adesso) */
export function setCached(key, data) {
  const prev = cache.get(key) || {}
  cache.set(key, { ...prev, data, ts: Date.now(), day: dayStamp(), inflight: null })
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
    // Chi non passa da `leggi` (Dashboard, CRO, P&L…) riceve lo stesso trattamento: risposta
    // parziale = resta in memoria ma gia' SCADUTA (alla prossima visita si richiede), lo si dice
    // nella barra e si riprova da soli dopo 30 s.
    if (data && (data.datiParziali || data.inRitardo?.length) && typeof window !== 'undefined') {
      const cur = cache.get(key); if (cur) cache.set(key, { ...cur, ts: 0 })
      const st = inSospeso.get(key) || { giri: 0, timer: null }
      inSospeso.set(key, st); annuncia()
      if (!st.timer && st.giri < 3) st.timer = setTimeout(() => { st.timer = null; st.giri++; swrFetch({ key, fetcher, onUpdate, forceRefresh: true }).then(r => { if (r?.data && !r.data.datiParziali && !r.data.inRitardo?.length) onUpdate?.(r.data) }).catch(() => {}) }, 30000)
      else if (st.giri >= 3) { inSospeso.delete(key); annuncia() }
    } else datiArrivati(key)
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

// ============================================================================
//  LETTURA PER URL — per le tab che chiamano una rotta e basta.
//
//  Regola del prodotto: una tab, una volta caricata, RESTA in memoria. Tornarci
//  non deve rifare il caricamento ne' mostrare l'attesa: si vede subito
//  l'ultimo dato, e se e' vecchio di piu' di cinque minuti si aggiorna da solo
//  in background. Le tab nate dopo questa regola chiamavano fetch() a ogni
//  apertura: qui c'e' il pezzo unico che le mette in linea.
//
//    const j = await leggi(url, { onUpdate: setData })   // al posto di fetch+json
//    useState(() => inMemoria(url))                       // niente attesa al ritorno
//    precarica([url1, url2, …])                           // in fila, a riposo
//
//  Un URL con refresh=1 (il tasto "Aggiorna") salta la memoria ma la RISCRIVE:
//  la chiave e' l'URL senza quel parametro.
// ============================================================================

const chiaveUrl = (url) => 'url:' + String(url)
  .replace(/([?&])(?:refresh|fresh)=1(&|$)/g, (_, a, c) => (c ? a : ''))
  .replace(/[?&]$/, '')

/** L'ultimo dato letto per questo URL, se c'e' (anche non freschissimo). */
export function inMemoria(url) {
  if (!url) return null
  return getCached(chiaveUrl(url))?.data ?? null
}

// Una risposta d'errore non si mette in memoria: alla prossima apertura si
// riprova, invece di rivedere l'errore per tutta la sessione.
// ── Dati parziali: si dice e si riprova da soli ─────────────────────────────────────────────
// Quando il server avverte che un pezzo manca (Shopify o Klaviyo hanno detto "aspetta"), la
// pagina mostra quel che c'e', la barra in alto dice "dati in aggiornamento" (evento
// `lyft:dati-parziali`, ascoltato da AppShell) e qui si richiede da soli dopo 30 s, fino a tre
// volte. Appena la risposta arriva intera va in memoria, chi ha passato `onUpdate` si aggiorna
// sotto gli occhi, e l'avviso sparisce.
const inSospeso = new Map()   // url → { giri, timer }
function annuncia() { try { window.dispatchEvent(new CustomEvent('lyft:dati-parziali', { detail: { quanti: inSospeso.size } })) } catch {} }
export function segnalaParziale(chiave) { if (typeof window === 'undefined') return; if (!inSospeso.has(chiave)) inSospeso.set(chiave, { giri: 0, timer: null }); annuncia() }
export function datiArrivati(chiave) { if (typeof window === 'undefined') return; const s = inSospeso.get(chiave); if (!s) return; clearTimeout(s.timer); inSospeso.delete(chiave); annuncia() }
function riprovaPiuTardi(url, onUpdate, opzioni) {
  if (typeof window === 'undefined') return
  const s = inSospeso.get(url) || { giri: 0, timer: null }
  inSospeso.set(url, s); annuncia()
  if (s.timer || s.giri >= 3) { if (s.giri >= 3) { inSospeso.delete(url); annuncia() } return }
  s.timer = setTimeout(async () => {
    s.timer = null; s.giri++
    try { const j = await leggi(url, { forza: true, opzioni }); if (j && !j.datiParziali && !j.inRitardo?.length && j.ok !== false) onUpdate?.(j) } catch {}
  }, 30000)
}

class RispostaNonValida extends Error {
  constructor(corpo) { super('risposta non valida'); this.corpo = corpo }
}

export async function leggi(url, { forza = false, onUpdate, opzioni } = {}) {
  const forzato = forza || /[?&](?:refresh|fresh)=1(?:&|$)/.test(String(url))
  const fetcher = async () => {
    const res = await fetch(url, { cache: 'no-store', ...(opzioni || {}) })
    const j = await res.json().catch(() => null)
    if (!res.ok || !j || j.ok === false) throw new RispostaNonValida(j || { ok: false, error: `HTTP ${res.status}` })
    // Risposta PARZIALE (il server dice che un pezzo e' in ritardo): si mostra, ma non si tiene
    // in memoria — al prossimo passaggio sulla tab si richiede, invece di riservire il buco.
    if (j.datiParziali || j.inRitardo?.length) { riprovaPiuTardi(url, onUpdate, opzioni); throw new RispostaNonValida(j) }
    datiArrivati(url)
    return j
  }
  try {
    const { data } = await swrFetch({ key: chiaveUrl(url), fetcher, onUpdate, forceRefresh: forzato })
    return data
  } catch (e) {
    if (e instanceof RispostaNonValida) return e.corpo
    throw e
  }
}

/**
 * Scalda la memoria per una lista di URL: UNO ALLA VOLTA e con una pausa,
 * quando il browser e' a riposo. In parallelo si finisce contro i limiti di
 * Shopify (ShopifyQL li segnala dentro una risposta 200) e si rallenta proprio
 * la tab che l'utente sta guardando.
 */
let filaPrecarico = Promise.resolve()
export function precarica(urls, { pausaMs = 900 } = {}) {
  if (typeof window === 'undefined') return
  const aRiposo = () => new Promise(r => (window.requestIdleCallback ? window.requestIdleCallback(() => r(), { timeout: 4000 }) : setTimeout(r, 300)))
  for (const url of (urls || []).filter(Boolean)) {
    filaPrecarico = filaPrecarico.then(async () => {
      if (getCached(chiaveUrl(url))) return
      if (document.visibilityState !== 'visible') return
      await aRiposo()
      // Si dichiara lavoro di sottofondo: dove le chiamate verso l'esterno sono contate
      // (Shopify Analytics: ~30 al minuto) cede il posto alla tab che si sta guardando.
      await leggi(url, { opzioni: { headers: { 'x-lyft-sfondo': '1' } } }).catch(() => null)
      await new Promise(r => setTimeout(r, pausaMs))
    })
  }
}
