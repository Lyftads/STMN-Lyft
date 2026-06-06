'use client'

import { useEffect } from 'react'
import App from '../page'
import { demoData } from '../../lib/demo/data'

// Monta il SOFTWARE REALE (app/page.js) ma intercetta le chiamate /api/* e
// risponde con dati demo inventati. Non tocca nulla del software reale: la
// patch a window.fetch è attiva SOLO mentre questa pagina è montata.
let _orig = null
function installPatch() {
  if (typeof window === 'undefined' || _orig) return
  _orig = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    let url = ''
    try { url = typeof input === 'string' ? input : (input && input.url) || '' } catch {}
    try {
      const u = new URL(url, window.location.origin)
      if (u.pathname.startsWith('/api/')) {
        const method = ((init && init.method) || 'GET').toUpperCase()
        const data = demoData(u.pathname, u.searchParams, method)
        const body = data === undefined ? { ok: true } : data
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    } catch {}
    return _orig(input, init)
  }
}

// Installa SUBITO (durante il modulo/primo render) così le fetch dei componenti
// figli vengono già intercettate al mount.
installPatch()

export default function DemoApp() {
  useEffect(() => {
    installPatch()
    return () => { if (_orig) { window.fetch = _orig; _orig = null } }
  }, [])

  return (
    <>
      {/* Nastro DEMO */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        padding: '7px 16px', fontSize: 12.5, fontWeight: 700,
        background: 'linear-gradient(90deg,#7b5bff,#5b8bff)', color: '#fff',
      }}>
        <span>🔎 Demo interattiva di LyftAI — dati di esempio, account "Acme Store"</span>
        <a href="/register" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 800 }}>Inizia gratis →</a>
        <a href="/welcome" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>← Torna al sito</a>
      </div>
      <div style={{ paddingTop: 34 }}>
        <App />
      </div>
    </>
  )
}
