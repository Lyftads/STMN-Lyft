// Service worker LyftAI — abilita l'installazione PWA su desktop e mobile.
// Volutamente minimale: nessun caching aggressivo di JS/HTML (così l'app resta
// sempre aggiornata). Le notifiche push verranno aggiunte in una fase successiva.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Fetch handler passthrough: necessario perché il browser consideri l'app
// installabile. Lascia gestire le richieste normalmente (network).
self.addEventListener('fetch', () => {})
