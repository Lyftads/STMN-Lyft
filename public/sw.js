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

// Web Push: mostra la notifica di sistema.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  const title = data.title || 'LyftAI'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { tab: data.tab || 'tasks' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Click sulla notifica: porta in primo piano l'app (o la apre).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
