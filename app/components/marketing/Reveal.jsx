'use client'

import { useEffect, useRef, useState } from 'react'

// Stessa logica del Reveal della landing: fade/scale/blur allo scroll
// (IntersectionObserver). Le classi .reveal* sono definite nella pagina.
export default function Reveal({ children, delay = 0, variant = '', style }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setVisible(true) }),
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const base = variant === 'zoom' ? 'reveal-zoom' : variant === 'blur' ? 'reveal-blur' : 'reveal'
  return (
    <div ref={ref} className={`${base} ${visible ? 'in' : ''}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}
