const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'

export default function sitemap() {
  const now = new Date()
  // Solo pagine pubbliche (la dashboard è dietro login).
  const routes = [
    { path: '/welcome', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/login', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/register', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ]
  return routes.map(r => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))
}
