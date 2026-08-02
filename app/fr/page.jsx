import LandingPage from '../welcome/LandingPage'
import { landingMetadata } from '../welcome/seoMeta'

export const metadata = landingMetadata('fr')

export default function Page() {
  return <LandingPage initialLang="fr" />
}
