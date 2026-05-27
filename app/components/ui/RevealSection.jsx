'use client'

import useReveal from './useReveal'

export default function RevealSection({ children, className = 'reveal', stagger = false, style }) {
  const ref = useReveal()
  return (
    <div ref={ref} className={stagger ? `stagger ${className}` : className} style={style}>
      {children}
    </div>
  )
}
