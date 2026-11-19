'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'

// Lyft — il cervello generale del prodotto, con l'aspetto del centro di comando da cui nasce
// (nucleo animato al centro, pannelli attorno, voce a sinistra). La pagina vive in
// public/lyft-core con il suo foglio di stile scuro, quindi qui la si mostra in una cornice:
// cosi' il suo stile non tocca il resto del prodotto e viceversa. Parla col cervello del
// prodotto (/api/agent) e legge i dati del cliente in cui si e' entrati.
//
// La cornice resta montata anche quando si guarda un'altra tab (la tiene viva page.js): tornare
// su Lyft non ricarica niente. `attiva` le dice se e' in vista, cosi' da nascosta aggiorna i
// pannelli di rado invece che ogni minuto.
export default function LyftTab({ attiva = true }) {
  const { t } = useI18n()
  const cornice = useRef(null)
  const lingua = useRef(getClientLocale() || 'it')   // fissata alla prima apertura: cambiarla ricaricherebbe la pagina
  const avvisa = () => { try { cornice.current?.contentWindow?.postMessage({ tipo: 'lyft:vista', attiva }, window.location.origin) } catch {} }
  useEffect(avvisa, [attiva])
  return (
    <iframe ref={cornice} onLoad={avvisa} title={t('tab.lyft', null, 'Lyft')} src={`/lyft-core/index.html?l=${encodeURIComponent(lingua.current)}`} allow="microphone; fullscreen"
      style={{ display: 'block', width: '100%', height: 'calc(100dvh - 132px)', minHeight: 620, border: 0, borderRadius: 16, background: '#02060b' }} />
  )
}
