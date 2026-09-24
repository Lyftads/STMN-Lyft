'use client'

// Qual e' il tema acceso adesso, 'light' o 'dark'.
//
// Serve dove il colore non lo puo' scegliere il CSS: dentro i grafici (Recharts
// scrive fill e stroke negli attributi SVG, e li' var() non vale) e nelle
// tavolozze calcolate in JavaScript. Ovunque altro si usano i token del tema.
//
// Legge l'attributo data-theme di <html>, ascolta l'evento 'lyft-theme-change'
// dell'interruttore giorno/notte e, per sicurezza, guarda anche l'attributo:
// il tema puo' cambiare anche da fuori (AutoTheme all'avvio, preferenza di
// sistema). Parte da 'dark' come il resto del prodotto, cosi' il primo disegno
// sul server e quello nel browser combaciano.
import { useEffect, useState } from 'react'

export default function useTema() {
  const [tema, setTema] = useState('dark')
  useEffect(() => {
    const leggi = () => setTema(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
    leggi()
    const daEvento = (e) => setTema(e?.detail?.theme === 'light' ? 'light' : 'dark')
    window.addEventListener('lyft-theme-change', daEvento)
    const occhio = new MutationObserver(leggi)
    occhio.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { window.removeEventListener('lyft-theme-change', daEvento); occhio.disconnect() }
  }, [])
  return tema
}
