'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'lyft-theme'
// Si parte dal tema chiaro (scelta di Marino): resta scuro solo chi l'ha scelto.
const normalizeTheme = value => value === 'dark' ? 'dark' : 'light'

function applyTheme(theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = theme === 'light' ? '#f5f5f5' : '#0c0c0c'
  window.dispatchEvent(new CustomEvent('lyft-theme-change', { detail: { theme } }))
}

// "Automatico": segue il sistema (chiaro di giorno, scuro di sera se il computer fa cosi').
// La SCELTA (light | dark | auto) sta in localStorage; il tema APPLICATO e' sempre light o dark.
const delSistema = () => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
export function sceltaTema() { try { const v = localStorage.getItem(STORAGE_KEY); return v === 'dark' || v === 'auto' ? v : 'light' } catch { return 'light' } }
let ascoltoSistema = null
function seguiIlSistema(attivo) {
  const mq = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null
  if (!mq) return
  if (ascoltoSistema) { mq.removeEventListener('change', ascoltoSistema); ascoltoSistema = null }
  if (attivo) { ascoltoSistema = () => applyTheme(delSistema()); mq.addEventListener('change', ascoltoSistema) }
}

// Per cambiare tema da un altro punto dell'app (il pop-up del profilo).
// Passando da Giorno a Notte tutta l'interfaccia sfuma insieme in 280 ms, invece di scattare a
// pezzi (prima solo poche superfici avevano una transizione di colore: il resto cambiava di botto).
// Si usa la stessa tecnologia del cambio tab; dove il browser non la sostiene, o se l'utente ha
// chiesto meno movimento, il tema cambia e basta come prima.
export function impostaTema(next) {
  const scelta = next === 'auto' ? 'auto' : normalizeTheme(next)
  const applica = () => {
    applyTheme(scelta === 'auto' ? delSistema() : scelta)
    seguiIlSistema(scelta === 'auto')
    try { localStorage.setItem(STORAGE_KEY, scelta) } catch {}
  }
  const calmo = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (typeof document === 'undefined' || !document.startViewTransition || calmo) return applica()
  document.documentElement.classList.add('cambio-tema')
  const t = document.startViewTransition(applica)
  t.finished.finally(() => document.documentElement.classList.remove('cambio-tema'))
}
export function temaCorrente() {
  if (typeof document === 'undefined') return 'light'
  return normalizeTheme(document.documentElement.dataset.theme)
}

export default function AutoTheme({ embedded = false }) {
  const [theme, setTheme] = useState('light')
  useEffect(() => {
    let initial = normalizeTheme(document.documentElement.dataset.theme)
    try { const v = localStorage.getItem(STORAGE_KEY); initial = v === 'auto' ? delSistema() : normalizeTheme(v); seguiIlSistema(v === 'auto') } catch {}
    setTheme(initial)
    applyTheme(initial)
    const sync = event => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      const next = event.newValue === 'auto' ? delSistema() : normalizeTheme(event.newValue)
      setTheme(next)
      applyTheme(next)
    }
    const syncLocal = event => setTheme(normalizeTheme(event.detail?.theme))
    window.addEventListener('storage', sync)
    window.addEventListener('lyft-theme-change', syncLocal)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('lyft-theme-change', syncLocal)
    }
  }, [])

  const selectTheme = next => {
    setTheme(next)
    applyTheme(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }

  return (
    <div role="group" aria-label="Seleziona tema" className={`theme-switcher${embedded ? " theme-switcher--embedded" : ""}`}>
      <button type="button" aria-label="Tema giorno" title="Tema giorno" aria-pressed={theme === 'light'} onClick={() => selectTheme('light')}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </svg>
      </button>
      <button type="button" aria-label="Tema notte" title="Tema notte" aria-pressed={theme === 'dark'} onClick={() => selectTheme('dark')}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 14.3A9 9 0 0 1 9.7 3.2 9 9 0 1 0 20.8 14.3Z" />
        </svg>
      </button>
    </div>
  )
}
