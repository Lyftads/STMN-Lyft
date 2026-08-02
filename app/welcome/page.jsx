import LandingPage from './LandingPage'
import { landingMetadata } from './seoMeta'

// Landing italiana E porta d'ingresso principale (la home ci reindirizza).
// Qui NON si passa initialLang di proposito: chi arriva su /welcome senza aver
// scelto niente viene ancora auto-rilevato (lingua salvata → browser → paese IP)
// e spostato sulla sua lingua. Le rotte /en /es /fr /de sono invece esplicite:
// la lingua e' nell'URL e non va sovrascritta.
export const metadata = landingMetadata('it')

export default function Page() {
  return <LandingPage />
}
