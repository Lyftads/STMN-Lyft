'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'

// Lyft — il cervello generale del prodotto. La pagina vive in public/lyft-core e qui la si mostra
// in una cornice: ha un foglio di stile suo, ma prende tema, colori e carattere dal prodotto
// (li legge da questo documento e li rilegge quando cambia il tema), ha lo sfondo trasparente
// e si da' da sola l'altezza del contenuto, cosi' scorre con la tab come ogni altra. L'altezza
// scritta qui sotto vale solo finche' la pagina non si e' misurata. Parla col cervello del
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
  // Il tema chiaro da' a ogni iframe un fondo bianco pieno (serve alle anteprime delle email): questa
  // cornice invece deve lasciar vedere lo sfondo della tab, e solo uno stile in linea «important» lo vince.
  useEffect(() => { cornice.current?.style.setProperty('background', 'transparent', 'important') }, [])
  return (
    <iframe ref={cornice} onLoad={avvisa} title={t('tab.lyft', null, 'Lyft')} src={`/lyft-core/index.html?l=${encodeURIComponent(lingua.current)}`} allow="microphone; fullscreen"
      style={{ display: 'block', width: '100%', height: 'calc(100dvh - 132px)', border: 0, background: 'transparent' }} />
  )
}
