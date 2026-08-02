import { LANG_PATH } from './welcome/seoMeta'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

// Sitemap: elenca le cinque landing (una per lingua) e le pagine pubbliche.
// Ogni voce porta con se' i propri alternates, cosi' Google vede il gruppo
// linguistico anche da qui e non solo dai tag in pagina.
export default function sitemap() {
  const now = new Date()
  const languages = Object.fromEntries(Object.entries(LANG_PATH).map(([l, p]) => [l, SITE + p]))
  const landings = Object.entries(LANG_PATH).map(([lang, path]) => ({
    url: SITE + path,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: lang === 'it' ? 1 : 0.9,
    alternates: { languages },
  }))
  const other = ['/demo', '/privacy', '/terms'].map(p => ({
    url: SITE + p,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: p === '/demo' ? 0.8 : 0.3,
  }))
  return [...landings, ...other]
}
