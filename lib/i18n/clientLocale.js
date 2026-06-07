// Locale attivo lato client per le chiamate AI (legge la stessa chiave del
// LanguageSwitcher / I18nProvider). Fallback 'it'. Da spedire nel body delle
// fetch agli agent: `locale: getClientLocale()`.
export function getClientLocale() {
  try {
    if (typeof window === 'undefined') return 'it'
    const v = localStorage.getItem('lyft_lang')
    return v && ['it', 'en', 'es', 'fr', 'de'].includes(v) ? v : 'it'
  } catch { return 'it' }
}
