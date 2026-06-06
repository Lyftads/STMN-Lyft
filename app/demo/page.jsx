'use client'

import dynamic from 'next/dynamic'

// Demo pubblica: monta il software reale con dati demo (no SSR per via della
// patch a window.fetch lato client).
const DemoApp = dynamic(() => import('./DemoApp'), { ssr: false })

export default function DemoPage() {
  return <DemoApp />
}
