'use client'

import { useEffect } from 'react'

// Mobile keyboards shrink the visual viewport, not necessarily 100vh/100dvh.
// Keep dialogs and composers in the visible area without blocking page zoom.
export default function ViewportFrame() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    let frame
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (viewport.scale !== 1) return
        root.style.setProperty('--app-viewport-height', `${viewport.height}px`)
        root.style.setProperty('--app-viewport-top', `${viewport.offsetTop}px`)
      })
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.removeProperty('--app-viewport-height')
      root.style.removeProperty('--app-viewport-top')
    }
  }, [])
  return null
}
