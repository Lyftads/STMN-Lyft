'use client'

// Schermo intero per un riquadro (il funnel 3D).
// NON si usa l'API Fullscreen del browser: a schermo intero nativo si vede
// SOLO quell'elemento, e il cassetto della creativita' restava invisibile
// (lezione di LyftAI: «a tutto schermo il pop up non compare»).
// Il riquadro diventa fisso e copre la finestra, SOTTO il livello del
// cassetto (.drawer-bg sta a 50): cosi' il dettaglio si apre sopra al 3D
// anche a schermo intero. Esc lo riporta a posto, se non c'e' un cassetto aperto.
// Si monta sul BODY con un portale: un `fixed` dentro a un contenitore con
// z-index proprio resterebbe sotto l'intestazione.

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function usaSchermoIntero() {
  const [pieno, setPieno] = useState(false)
  const cambia = useCallback(() => setPieno(p => !p), [])

  useEffect(() => {
    if (!pieno) return
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.drawer-bg')) setPieno(false) }
    document.addEventListener('keydown', onKey)
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prima }
  }, [pieno])

  const stile = pieno ? { position: 'fixed', inset: 0, zIndex: 45, height: '100vh', minHeight: 0, borderRadius: 0 } : null
  const Portale = useCallback(({ children }) => (pieno && typeof document !== 'undefined' ? createPortal(children, document.body) : children), [pieno])
  return { pieno, cambia, stile, Portale }
}

// Bottone con le quattro frecce: allarga quando e' chiuso, stringe quando e' pieno.
export function BottoneSchermoIntero({ pieno, onClick, titolo }) {
  return (
    <button type="button" onClick={onClick} title={titolo} aria-label={titolo} style={{
      background: 'var(--glass2)', border: '1px solid var(--border)', color: 'var(--text2)',
      width: 32, height: 32, borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {pieno
          ? <><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></>
          : <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>}
      </svg>
    </button>
  )
}
