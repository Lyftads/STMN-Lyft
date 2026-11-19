// ============================================================================
//  Analisi della destinazione di una creatività.
//
//  Due cose in una:
//   1) verifica che il link funzioni davvero (un 404 su un'inserzione attiva è
//      spesa buttata che nessuno vede finché non la si cerca);
//   2) legge l'handle del prodotto dall'URL — è il segnale più affidabile per
//      capire cosa pubblicizza una creatività, molto più di riconoscere una
//      confezione in fotografia.
// ============================================================================

export function analizzaUrl(url) {
  try {
    const u = new URL(url)
    const parti = u.pathname.split('/').filter(Boolean)
    // /products/<handle>  ·  /collections/<h>/products/<handle>
    const iProd = parti.indexOf('products')
    const iColl = parti.indexOf('collections')
    const tipo =
      iProd >= 0 ? 'prodotto' :
      iColl >= 0 ? 'collezione' :
      parti.length === 0 ? 'home' : 'altro'
    const handle =
      iProd >= 0 ? (parti[iProd + 1] || null) :
      iColl >= 0 ? (parti[iColl + 1] || null) : null
    const utm = {}
    for (const [k, v] of u.searchParams) if (k.startsWith('utm_')) utm[k] = v
    return { tipo, handle, host: u.host, utm: Object.keys(utm).length ? utm : null }
  } catch { return { tipo: 'altro', handle: null, host: null, utm: null } }
}

// Segue i redirect: un link può passare da uno shortener o da una vecchia URL
// che rimanda altrove. Conta dove si ATTERRA, non dove si parte.
// 429 NON è un link rotto: è il sito che si difende da noi. Segnalarlo come
// rotto farebbe scattare allarmi su inserzioni sane — e peggio, nasconderebbe
// i 404 veri in mezzo al rumore.
export const RITMO_MS = Number(process.env.CE_LINK_PAUSA_MS || 700)
export const attesa = (ms) => new Promise(r => setTimeout(r, ms))

export async function seguiLink(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow', method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    })
    return { finale: res.url || url, stato: res.status, limitato: res.status === 429 }
  } catch {
    return { finale: null, stato: null }
  }
}
