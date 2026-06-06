'use client'

import TimeTrackingTab from '../components/TimeTrackingTab'

// Pagina Lyftimer a tutto schermo: è la "app time tracking" installabile (PWA
// dedicata). Sfondo coerente con l'estetica del software (glow viola/blu su nero).
export default function LyftimerAppPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      padding: '18px 24px 40px',
      background: 'radial-gradient(1100px 760px at 12% -10%, rgba(123,91,255,0.20), transparent 60%), radial-gradient(1000px 720px at 100% 110%, rgba(91,139,255,0.16), transparent 60%), #07070e',
    }}>
      <TimeTrackingTab standalone />
    </div>
  )
}
