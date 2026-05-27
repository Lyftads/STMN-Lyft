'use client'

import { useEffect, useRef, useState } from 'react'

export default function AnimatedNumber({ value, format, duration = 800, className = '' }) {
  const [display, setDisplay] = useState('—')
  const prevRef = useRef(0)
  const frameRef = useRef(null)

  useEffect(() => {
    const num = Number(value)
    if (!Number.isFinite(num) || num === 0) {
      setDisplay('—')
      prevRef.current = 0
      return
    }

    const from = prevRef.current
    const to = num
    const start = performance.now()

    const tick = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (to - from) * eased

      setDisplay(format ? format(current) : Math.round(current).toLocaleString('it-IT'))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        prevRef.current = to
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, format, duration])

  return <span className={className}>{display}</span>
}
