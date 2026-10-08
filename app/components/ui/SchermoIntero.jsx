'use client'

// Schermo intero per un riquadro (la board del funnel, il 3D…).
// Prima prova l'API Fullscreen del browser sul riquadro stesso; dove manca
// (iPhone) o viene rifiutata, ripiega su un velo fisso che copre la finestra.
// In entrambi i casi il riquadro riceve la classe `schermo-intero` e lo stile
// che lo porta a tutto schermo; Esc o il bottone lo riportano a posto.

import { useCallback, useEffect, useState } from 'react'

export function usaSchermoIntero(ref) {
  const [pieno, setPieno] = useState(false)
  const [nativo, setNativo] = useState(false)

  const cambia = useCallback(async () => {
    const el = ref.current
    if (!el) return
    if (pieno) {
      if (nativo && document.fullscreenElement) { try { await document.exitFullscreen() } catch {} }
      setPieno(false); setNativo(false)
      return
    }
    if (el.requestFullscreen) {
      try { await el.requestFullscreen(); setNativo(true); setPieno(true); return } catch {}
    }
    setNativo(false); setPieno(true)
  }, [ref, pieno, nativo])

  // Uscita nativa (Esc del browser) → si aggiorna lo stato.
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement) { setPieno(p => (nativo ? false : p)); setNativo(false) } }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [nativo])

  // Esc nel ripiego (il browser non lo manda da solo).
  useEffect(() => {
    if (!pieno || nativo) return
    const onKey = e => { if (e.key === 'Escape') setPieno(false) }
    document.addEventListener('keydown', onKey)
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prima }
  }, [pieno, nativo])

  const stile = pieno && !nativo
    ? { position: 'fixed', inset: 0, zIndex: 1200, height: '100vh', minHeight: 0, borderRadius: 0 }
    : pieno ? { height: '100vh', minHeight: 0, borderRadius: 0 } : null

  return { pieno, cambia, stile }
}

// Bottone con le quattro frecce: allarga quando e' chiuso, stringe quando e' pieno.
export function BottoneSchermoIntero({ pieno, onClick, titolo, stile }) {
  return (
    <button type="button" onClick={onClick} title={titolo} aria-label={titolo} style={{
      background: 'var(--glass2)', border: '1px solid var(--border)', color: 'var(--text2)',
      width: 32, height: 32, borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center', ...stile,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {pieno
          ? <><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></>
          : <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>}
      </svg>
    </button>
  )
}
