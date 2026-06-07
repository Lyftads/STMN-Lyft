'use client'

// ============================================================================
//  i18n leggero e a prova di errore per la dashboard (client-heavy, SPA-like).
//
//  - Locale di default = 'it' (lingua sorgente). Il dizionario it contiene le
//    stringhe ORIGINALI → quando locale='it' l'output è identico a prima.
//  - t(key, vars, fallback): cerca key nella lingua attiva → poi in italiano →
//    poi `fallback` → poi la key stessa. Una traduzione mancante mostra
//    l'italiano, MAI una stringa vuota o un crash.
//  - Nessun routing per locale (niente /en/...): la lingua sta in stato React +
//    localStorage, e (best-effort) sul profilo per il binding "per cliente".
// ============================================================================

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { LOCALES, DEFAULT_LOCALE, LOCALE_INTL } from './locales'
import { browserToLocale } from './geoLocale'
import it from './dictionaries/it'
import en from './dictionaries/en'
import es from './dictionaries/es'
import fr from './dictionaries/fr'
import de from './dictionaries/de'

const DICTS = { it, en, es, fr, de }
const STORAGE_KEY = 'lyft_lang'

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k, _v, fb) => fb ?? k,
  intlLocale: LOCALE_INTL[DEFAULT_LOCALE],
})

export function I18nProvider({ children, initialLocale }) {
  // SSR e primo render client = DEFAULT_LOCALE → nessun mismatch di idratazione.
  const [locale, setLocaleState] = useState(
    initialLocale && LOCALES.includes(initialLocale) ? initialLocale : DEFAULT_LOCALE
  )

  // Se l'utente cambia lingua manualmente, la scelta di sessione vince sul
  // valore che arriva (async) dal DB — evita di "riscrivergli" la lingua sotto.
  const userChosen = useRef(false)

  // Catena di priorità al mount (se non forzato da prop):
  //   1. scelta esplicita per-cliente sul DB (companies.language) → autorevole
  //   2. cache di device (localStorage)
  //   3. auto-rilevamento: lingua del browser → poi paese dell'IP
  //   4. default 'it'
  useEffect(() => {
    if (initialLocale) return
    let alive = true

    const apply = (lang, persist = true) => {
      if (!alive || userChosen.current || !LOCALES.includes(lang)) return
      setLocaleState(lang)
      if (persist) { try { localStorage.setItem(STORAGE_KEY, lang) } catch {} }
      if (typeof document !== 'undefined') { try { document.documentElement.lang = lang } catch {} }
    }

    // 2) cache di device — applicata subito per evitare flash.
    let hadLocal = false
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && LOCALES.includes(saved)) { hadLocal = true; setLocaleState(saved) }
    } catch {}

    ;(async () => {
      // 1) lingua esplicita per-cliente dal DB (vince su tutto il resto).
      let dbLang = null
      try {
        const r = await fetch('/api/profile')
        if (r.ok) { const j = await r.json(); if (j?.language && LOCALES.includes(j.language)) dbLang = j.language }
      } catch {}
      if (!alive || userChosen.current) return
      if (dbLang) { apply(dbLang); return }
      if (hadLocal) return  // device cache già applicata → rispettala

      // 3) auto-rilevamento (solo cliente nuovo, nessuna scelta salvata).
      let auto = null
      try { auto = browserToLocale(navigator.language || (navigator.languages && navigator.languages[0])) } catch {}
      if (!auto) {
        try {
          const r = await fetch('/api/geo')
          if (r.ok) { const j = await r.json(); if (j?.suggested && LOCALES.includes(j.suggested)) auto = j.suggested }
        } catch {}
      }
      if (auto) apply(auto)
    })()

    return () => { alive = false }
  }, [initialLocale])

  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return
    userChosen.current = true
    setLocaleState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    // Persisti sul profilo (per-cliente) — best effort, non blocca nulla.
    try {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: next }),
      }).catch(() => {})
    } catch {}
    if (typeof document !== 'undefined') {
      try { document.documentElement.lang = next } catch {}
    }
  }, [])

  const t = useCallback((key, vars, fallback) => {
    const active = DICTS[locale] || DICTS[DEFAULT_LOCALE]
    let str = active[key]
    if (str == null) str = DICTS[DEFAULT_LOCALE][key]
    if (str == null) str = fallback != null ? fallback : key
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.split(`{${k}}`).join(String(vars[k]))
      }
    }
    return str
  }, [locale])

  const value = { locale, setLocale, t, intlLocale: LOCALE_INTL[locale] || LOCALE_INTL[DEFAULT_LOCALE] }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

// Hook comodo quando serve solo la funzione di traduzione.
export function useT() {
  return useContext(I18nContext).t
}
