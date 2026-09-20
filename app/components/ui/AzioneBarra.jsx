'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

// ============================================================================
//  Le azioni di una tab (Aggiorna, Scarica il PDF…) stanno SEMPRE nella barra in
//  alto, accanto al periodo, come nella Dashboard — e sono bottoni con la sola
//  ICONA: cosa fanno lo dice il suggerimento al passaggio del mouse.
//  (Marino, 19 set 2026: "in ogni tab si trovano in una posizione diversa… non
//  e' meglio avere solo l'icona e se ci passi sopra ti dice cosa fanno?")
//
//  Stesso trucco di PeriodoInBarra: la tab continua a possedere l'azione, ma il
//  bottone viene disegnato nel punto d'arrivo della cornice (#barra-azioni).
//
//    <AzioneBarra icona="refresh" titolo="Aggiorna" onClick={…} disabled={…} gira={loading} />
// ============================================================================
export function BottoneIcona({ icona, titolo, onClick, disabled = false, gira = false, children, ...resto }) {
  return (
    <button type="button" className="ly-icona-btn senza-tocco" onClick={onClick} disabled={disabled}
      aria-label={titolo} data-suggerimento={titolo} {...resto}>
      <span style={{ display: 'inline-flex', animation: gira ? 'spin 1s linear infinite' : 'none' }}>
        {children || <Icon name={icona} size={16} />}
      </span>
    </button>
  )
}

export default function AzioneBarra(props) {
  const [arrivo, setArrivo] = useState(null)
  useEffect(() => { setArrivo(document.getElementById('barra-azioni')) }, [])
  if (!arrivo) return null
  return createPortal(<BottoneIcona {...props} />, arrivo)
}
