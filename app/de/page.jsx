import LandingPage from '../welcome/LandingPage'
import { landingMetadata } from '../welcome/seoMeta'

export const metadata = landingMetadata('de')

export default function Page() {
  return <LandingPage initialLang="de" />
}
