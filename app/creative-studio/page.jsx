'use client'

import CreativeStudio from '../components/CreativeStudio'

// Creative Studio a tutto schermo — web app dedicata (si apre in una nuova
// finestra). Estetica coerente: glow viola/blu su nero, layout pieno.
export default function CreativeStudioAppPage() {
  return (
    <div style={{
      height: '100dvh',
      overflow: 'hidden',
      background: 'radial-gradient(1100px 760px at 12% -10%, rgba(123,91,255,0.20), transparent 60%), radial-gradient(1000px 720px at 100% 110%, rgba(91,139,255,0.16), transparent 60%), #07070e',
    }}>
      <CreativeStudio standalone />
    </div>
  )
}
