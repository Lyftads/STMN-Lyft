// Il ponte fra la pagina di Lyft e l'estensione.
//
// Gira SOLO sulle pagine del prodotto (vedi "matches" nel manifest): nessun altro sito puo' chiedere
// all'estensione di aprire o leggere schede. La pagina parla con window.postMessage, il ponte gira la
// richiesta al cuore dell'estensione (sfondo.js) e riporta l'esito. Si accettano solo messaggi nati da
// questa stessa finestra e da questa stessa origine.
(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome
  const annuncia = () => window.postMessage({ da: 'lyft-estensione', tipo: 'pronta', versione: api.runtime.getManifest().version }, location.origin)
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return
    const m = e.data
    if (!m || m.a !== 'lyft-estensione') return
    if (m.comando === 'ci-sei') return annuncia()
    if (typeof m.id !== 'string' || typeof m.comando !== 'string') return
    Promise.resolve(api.runtime.sendMessage({ comando: m.comando, dati: m.dati || {} }))
      .then(esito => window.postMessage({ da: 'lyft-estensione', id: m.id, esito: esito || { errore: 'nessuna risposta' } }, location.origin))
      .catch(err => window.postMessage({ da: 'lyft-estensione', id: m.id, esito: { errore: String(err && err.message || err) } }, location.origin))
  })
  annuncia()
})()
