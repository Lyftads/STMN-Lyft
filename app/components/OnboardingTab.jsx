'use client'

import { Suspense } from 'react'
import { OnboardingInner } from '../onboarding/page'

// La tab "Onboarding" in-app riusa ESATTAMENTE il wizard di /onboarding (un solo
// modulo ovunque → identico per clienti diretti e agency). `embedded` mantiene
// l'utente nella tab e, anche a onboarding completato, lascia il wizard accessibile
// per ricollegare/cambiare le integrazioni.
export default function OnboardingTab() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner embedded />
    </Suspense>
  )
}
