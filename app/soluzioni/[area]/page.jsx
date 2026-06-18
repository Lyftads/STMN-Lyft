import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { AREAS, getArea, getMarketing } from '../../../lib/marketing/solutions'
import SolutionPage from '../../components/marketing/SolutionPage'

export function generateStaticParams() {
  return AREAS.map(a => ({ area: a.id }))
}

async function resolveLang() {
  try {
    const c = await cookies()
    const l = c.get('lyftai_lang')?.value
    return ['it', 'en', 'es', 'fr', 'de'].includes(l) ? l : 'it'
  } catch { return 'it' }
}

export async function generateMetadata({ params }) {
  const { area } = await params
  const ar = getArea(area)
  if (!ar) return { title: 'LyftAI' }
  const lang = await resolveLang()
  const { hero } = getMarketing(area, lang)
  const title = `${hero?.h1 || hero?.eyebrow || 'LyftAI'} · LyftAI`
  const description = hero?.sub || ''
  const url = `https://lyftai.io/soluzioni/${area}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'LyftAI' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function Page({ params }) {
  const { area } = await params
  if (!getArea(area)) notFound()
  const lang = await resolveLang()
  return <SolutionPage area={area} lang={lang} />
}
