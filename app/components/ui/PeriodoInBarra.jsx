'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import BmTimeframe from './BmTimeframe'

// ============================================================================
//  Il selettore del periodo sta SEMPRE nello stesso punto: nella barra in alto
//  a destra, dove lo ha la Dashboard. (Marino, 19 set 2026: "vorrei che ogni
//  tab abbia il timeframe sempre nello stesso punto".)
//
//  Prima ogni tab lo metteva dove capitava — a sinistra sotto il titolo, a
//  destra in una riga di strumenti, dentro un pannello — e per cambiare periodo
//  bisognava cercarlo. Qui la tab continua a possedere il suo periodo (stato,
//  onChange, memoria), ma il bottone viene disegnato nella barra della cornice:
//  <PeriodoInBarra …/> ha le stesse proprieta' di BmTimeframe e si mette al suo
//  posto. La cornice espone il punto d'arrivo con id="barra-periodo".
// ============================================================================
export default function PeriodoInBarra(props) {
  const [arrivo, setArrivo] = useState(null)
  useEffect(() => { setArrivo(document.getElementById('barra-periodo')) }, [])
  if (!arrivo) return null
  return createPortal(<BmTimeframe {...props} />, arrivo)
}
