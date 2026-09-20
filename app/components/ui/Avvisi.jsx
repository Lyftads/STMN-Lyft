'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Disegna gli avvisi di lib/client/avviso.js. Al massimo tre alla volta.
export default function Avvisi() {
  const [voci, setVoci] = useState([])
  useEffect(() => {
    let n = 0
    const arriva = (e) => {
      const id = ++n
      const { testo, tipo, durataMs } = e.detail || {}
      setVoci(v => [...v.slice(-2), { id, testo, tipo }])
      setTimeout(() => setVoci(v => v.filter(x => x.id !== id)), durataMs || 3200)
    }
    window.addEventListener('lyft:avviso', arriva)
    return () => window.removeEventListener('lyft:avviso', arriva)
  }, [])
  if (typeof document === 'undefined' || voci.length === 0) return null
  return createPortal(
    <div className="ly-avvisi" role="status" aria-live="polite">
      {voci.map(v => (
        <div key={v.id} className={`ly-avviso ${v.tipo || ''}`} onClick={() => setVoci(x => x.filter(y => y.id !== v.id))}>
          {v.tipo === 'errore' && <span className="ly-avviso-segno">!</span>}
          {v.tipo === 'ok' && <span className="ly-avviso-segno">✓</span>}
          {v.testo}
        </div>
      ))}
    </div>,
    document.body
  )
}
