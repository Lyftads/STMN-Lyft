// ============================================================================
//  CHIAMATE ALLE ROUTE SORELLE — e l'identita' che devono portarsi dietro.
//
//  Chi chiama puo' essere una persona (cookie di sessione) o un cron (precaricamento del
//  mattino, misura notturna). Si inoltra l'una o l'altra identita', MAI nessuna: e' la lezione
//  del 19 set — una chiamata interna rifiutata in silenzio torna 401, chi chiama la legge come
//  "dati vuoti" e li mette in cache; da li' in poi la tab mostra zeri e nessuno vede un errore.
//
//  MULTI-CLIENTE. In questo prodotto non basta "essere autorizzati": bisogna dire ANCHE di quale
//  cliente si parla, o la route chiamata risolve un tenant diverso da quello di chi chiede.
//   · con la persona si inoltra il cookie, e la route risolve da sola il workspace effettivo
//     (anche quando un'agenzia e' switchata su un cliente: e' lo stesso cookie a dirlo);
//   · col cron servono DUE intestazioni insieme, il segreto e il workspace — `x-lyft-workspace`
//     vale solo se accompagnato da `x-internal-cron` (vedi withTenantContext in
//     lib/tenant/credentials.js). Mandare il segreto senza il workspace fa cadere la route sulle
//     credenziali delle variabili d'ambiente: nel migliore dei casi zeri, nel peggiore i numeri
//     di un altro negozio scritti nella cache di questo. Non si chiama mai senza.
//
//  Gli errori non si lanciano: tornano come `{ error }`, cosi' chi chiama puo' mostrare quello
//  che ha e segnare la fonte mancante invece di far fallire tutta la pagina.
// ============================================================================
export function chiamaInterna(req, percorso, { attesaMs = 55_000 } = {}) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''
  const headers = cookie ? { cookie, 'x-lyft-sfondo': req.headers.get('x-lyft-sfondo') || '' } : {
    'x-internal-cron': req.headers.get('x-internal-cron') || (req.headers.get('authorization') || '').replace(/^Bearer /, ''),
    'x-lyft-workspace': req.headers.get('x-lyft-workspace') || '',
  }
  return fetch(`${origin}${percorso}`, { cache: 'no-store', headers, signal: AbortSignal.timeout(attesaMs) })
    .then(async r => (r.ok ? r.json() : { error: `HTTP ${r.status}` }))
    .catch(e => ({ error: e?.message || 'non risponde' }))
}
