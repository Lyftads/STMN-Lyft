'use client'

import { useEffect } from 'react'

// Registra il service worker per abilitare l'installazione PWA. Nessuna UI.
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
