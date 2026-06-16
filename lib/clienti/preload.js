// Preload + cache client della tab Clienti. Modulo leggero (niente recharts):
// può essere importato dallo shell per scaldare i dati appena entri nel sito,
// anche se sei in un'altra tab. Cache in memoria (sopravvive ai cambi tab) +
// sessionStorage (sopravvive anche al reload della pagina). Dedup via in-flight.

let cache = null
let inflight = null
const SS_KEY = 'lyft_clienti_v2'

export function getClientiCache() {
  if (cache) return cache
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem(SS_KEY) : null
    if (raw) { cache = JSON.parse(raw); return cache }
  } catch {}
  return null
}

export function setClientiCache(j) {
  cache = j
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(j)) } catch {}
}

// Carica /api/customers una sola volta (dedup). `force` bypassa cache e SWR.
export async function preloadClienti(force = false) {
  if (!force && cache) return cache
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const r = await fetch(`/api/customers${force ? '?refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (j && j.ok) setClientiCache(j)
      return j
    } catch (e) {
      return { ok: false, error: e?.message || 'Errore' }
    } finally { inflight = null }
  })()
  return inflight
}
