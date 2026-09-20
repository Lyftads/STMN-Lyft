'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
//  Tela infinita per le creatività.
//
//  Stessi gesti della board del Motore Creativo, perché sono già nelle mani di
//  chi la usa:
//   · rotella = zoom sul puntatore (non sul centro: si zooma dove si guarda)
//   · spazio tenuto / tasto centrale / Alt + trascina = mano per spostarsi
//   · trascinare sul fondo = rettangolo di selezione (shift aggiunge)
//   · destro = menu contestuale
//
//  Trascinare-per-spostare e trascinare-per-selezionare sono lo stesso gesto:
//  vince la SELEZIONE, come in Figma e Canva, e lo spostamento passa a spazio,
//  tasto centrale o Alt.
// ============================================================================

const MIN = 0.25
const MAX = 2

export default function CreativeCanvas({ children, count, onBandSelect, onBackground, onMenu, label }) {
  const box = useRef(null)
  const [z, setZ] = useState(0.85)
  const [pan, setPan] = useState({ x: 40, y: 24 })
  const [space, setSpace] = useState(false)
  const [band, setBand] = useState(null)
  const drag = useRef(null)
  const mark = useRef(null)

  const wheel = useCallback((e) => {
    e.preventDefault()
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    setZ(prev => {
      const next = Math.min(MAX, Math.max(MIN, prev * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
      if (next === prev) return prev
      setPan(p => ({ x: cx - (cx - p.x) * (next / prev), y: cy - (cy - p.y) * (next / prev) }))
      return next
    })
  }, [])

  // Il listener va aggiunto a mano con passive:false, altrimenti il browser
  // ignora preventDefault e la pagina scorre invece di zoomare.
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [wheel])

  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault(); setSpace(true)
    }
    const up = (e) => { if (e.code === 'Space') setSpace(false) }
    // Se la finestra perde il fuoco con lo spazio premuto il keyup non arriva
    // mai e la tela resta bloccata in modalità mano.
    const blur = () => setSpace(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const norm = (m) => ({
    x1: Math.min(m.x0, m.x), x2: Math.max(m.x0, m.x),
    y1: Math.min(m.y0, m.y), y2: Math.max(m.y0, m.y),
  })

  // Il rettangolo si disegna DENTRO la tela, in coordinate sue. Con
  // position:fixed bastava un antenato con un transform o un filtro per farlo
  // partire lontano dal punto in cui si era premuto: qui non puo' succedere,
  // perche' il riferimento e' la tela stessa.
  const locale = (m) => {
    const r = norm(m)
    const b = box.current?.getBoundingClientRect()
    if (!b) return null
    const ox = b.left + (box.current.clientLeft || 0)
    const oy = b.top + (box.current.clientTop || 0)
    return { l: r.x1 - ox, t: r.y1 - oy, w: r.x2 - r.x1, h: r.y2 - r.y1 }
  }

  // Le schede toccate si calcolano sui rettangoli SULLO SCHERMO: così zoom e
  // spostamento sono già dentro il conto e non vanno rifatti a mano.
  const inside = (r) => {
    const out = []
    for (const el of box.current?.querySelectorAll('[data-card]') || []) {
      const b = el.getBoundingClientRect()
      if (b.right >= r.x1 && b.left <= r.x2 && b.bottom >= r.y1 && b.top <= r.y2) out.push(el.getAttribute('data-card'))
    }
    return out
  }

  const onDown = (e) => {
    if (e.button === 2) return
    // Nulla di INTERATTIVO è tela: senza questa uscita il contenitore cattura
    // il puntatore e il clic non arriva mai al comando.
    if (e.target.closest('button, a, input, select, textarea, label, video')) return
    const onCard = !!e.target.closest('[data-card]')
    const hand = space || e.button === 1 || e.altKey
    if (hand) {
      e.preventDefault()
      drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      box.current?.setPointerCapture?.(e.pointerId)
      return
    }
    if (e.button !== 0 || onCard) return
    mark.current = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, add: e.shiftKey }
    setBand(locale(mark.current))
    box.current?.setPointerCapture?.(e.pointerId)
  }

  const onMove = (e) => {
    if (drag.current) { setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); return }
    if (!mark.current) return
    mark.current.x = e.clientX; mark.current.y = e.clientY
    setBand(locale(mark.current))
  }

  const onUp = () => {
    drag.current = null
    if (mark.current) {
      const r = norm(mark.current)
      const moved = Math.abs(r.x2 - r.x1) > 4 || Math.abs(r.y2 - r.y1) > 4
      if (moved) onBandSelect?.(inside(r), mark.current.add)
      else onBackground?.()      // clic secco sul fondo = azzera
      mark.current = null
      setBand(null)
    }
  }

  const zoomTo = (v) => setZ(Math.min(MAX, Math.max(MIN, v)))

  return (
    <div ref={box}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onContextMenu={e => {
        // Il destro su una scheda lo gestisce la scheda. Qui prendiamo solo il
        // fondo: anche su una tela vuota i comandi devono stare da qualche
        // parte, e il posto dove si va a cercarli e' il tasto destro.
        if (e.target.closest('[data-card]')) return
        e.preventDefault()
        onMenu?.(e)
      }}
      style={{
        position: 'relative', width: '100%', height: 'calc(100vh - 300px)', minHeight: 460,
        overflow: 'hidden', borderRadius: 16, touchAction: 'none',
        border: '1px solid rgba(255,255,255,.06)',
        background: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.055) 1px, transparent 0)',
        backgroundSize: `${26 * z}px ${26 * z}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: space ? 'grab' : 'default',
      }}>

      <div style={{
        position: 'absolute', top: 0, left: 0, transformOrigin: '0 0',
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`,
      }}>
        {children}
      </div>

      {band && (
        <div style={{
          position: 'absolute', left: band.l, top: band.t, width: band.w, height: band.h,
          border: '1px solid rgba(41,151,255,.7)', background: 'var(--neutro-bg)',
          borderRadius: 6, pointerEvents: 'none', zIndex: 50,
        }} />
      )}

      {/* Comandi: zoom e ritorno all'origine. Un pannello che si sposta senza
          un modo per tornare indietro è un pannello in cui ci si perde. */}
      <div style={{
        position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 4,
        padding: 4, borderRadius: 999, background: 'var(--surface)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,.08)', zIndex: 20,
      }}>
        <CtlBtn onClick={() => zoomTo(z / 1.2)}>−</CtlBtn>
        <span style={{ fontSize: 11.5, color: 'var(--text3)', minWidth: 42, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(z * 100)}%
        </span>
        <CtlBtn onClick={() => zoomTo(z * 1.2)}>+</CtlBtn>
        <CtlBtn onClick={() => { setZ(0.85); setPan({ x: 40, y: 24 }) }} wide>{label?.reset || 'Centra'}</CtlBtn>
      </div>

      <div style={{
        position: 'absolute', left: 12, bottom: 12, fontSize: 11.5, color: 'var(--text4, #6b7280)',
        padding: '6px 12px', borderRadius: 999, background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,.08)', zIndex: 20,
      }}>
        {count ? `${count} · ` : ''}{label?.hint || 'spazio o Alt per spostarti, rotella per lo zoom'}
      </div>
    </div>
  )
}

function CtlBtn({ children, onClick, wide }) {
  return (
    <button type="button" onClick={onClick} style={{
      minWidth: wide ? 'auto' : 26, height: 26, padding: wide ? '0 12px' : 0,
      borderRadius: 999, border: 'none', background: 'transparent',
      color: 'var(--text2)', fontSize: wide ? 11.5 : 15, fontWeight: 600, cursor: 'pointer', lineHeight: 1,
    }}>{children}</button>
  )
}
