'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

// ============================================================================
//  IL pop-up di dettaglio: centrato, come le finestre di KPI Brain. (La prima
//  versione scivolava da destra: a Marino non piaceva. Il nome del file resta.)
//
//  Prima ogni click apriva una finestra diversa (provincia, marchio, paese,
//  conto del prodotto, creativita', email…): venticinque finestre scritte a
//  mano, ognuna con le sue misure, la sua chiusura, il suo scorrimento. Il
//  dettaglio e' il gesto che si fa piu' spesso: deve comportarsi sempre uguale.
//
//    <Pannello titolo sotto immagine onClose onPrecedente onSuccessiva posizione="3 di 80">
//    (`altezza` = misura fissa: per i pop-up a schede, che non devono cambiare taglia a ogni scheda)
//      …contenuto…
//    </Pannello>
//
//  Esc o un click fuori lo chiudono; ← → (o ↑ ↓) passano alla riga prima e dopo
//  SENZA chiuderlo, cosi' si scorre un elenco guardando i dettagli.
// ============================================================================
// I pop-up aperti, dal primo all'ultimo: la tastiera la ascolta solo quello in cima.
const pila = []

export default function Pannello({ titolo, sotto, immagine, onClose, onPrecedente, onSuccessiva, posizione, larghezza = 760, altezza, piede, children }) {
  const corpo = useRef(null)
  const velo = useRef(null)
  const inUscita = useRef(false)

  // Il pop-up entrava in .2 s e si smontava di colpo. Ora esce come e' entrato: il velo sfuma e la
  // scheda rientra di un soffio (140 ms). Si aggiunge una classe e si chiude DOPO l'animazione;
  // se l'utente ha chiesto meno movimento, o se qualcosa va storto, si chiude subito come prima.
  const chiudi = useCallback(() => {
    if (inUscita.current) return
    const calmo = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (calmo || !velo.current) return onClose?.()
    inUscita.current = true
    velo.current.classList.add('via')
    setTimeout(() => onClose?.(), 140)
  }, [onClose])

  useEffect(() => {
    const io = {}
    pila.push(io)
    const tasto = (e) => {
      if (pila[pila.length - 1] !== io) return   // c'e' un altro pop-up sopra: tocca a lui
      if (e.key === 'Escape') { e.preventDefault(); chiudi() }
      // dentro un campo di testo le frecce servono a scrivere
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return
      if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && onSuccessiva) { e.preventDefault(); onSuccessiva() }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && onPrecedente) { e.preventDefault(); onPrecedente() }
    }
    window.addEventListener('keydown', tasto)
    return () => { window.removeEventListener('keydown', tasto); const k = pila.indexOf(io); if (k >= 0) pila.splice(k, 1) }
  }, [chiudi, onPrecedente, onSuccessiva])

  // Cambiando riga si riparte dall'alto.
  useEffect(() => { if (corpo.current) corpo.current.scrollTop = 0 }, [titolo])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="ly-pannello-velo" ref={velo} onMouseDown={chiudi}>
      <aside className="ly-pannello" role="dialog" aria-modal="true" aria-label={typeof titolo === 'string' ? titolo : undefined}
        style={{ width: `min(${larghezza}px, 100%)`, ...(altezza ? { height: `min(${altezza}px, 88vh)` } : null) }} onMouseDown={e => e.stopPropagation()}>
        <header className="ly-pannello-testa">
          {immagine && <img src={immagine} alt="" className="ly-pannello-foto" />}
          <div className="ly-pannello-titoli">
            <div className="ly-pannello-titolo">{titolo}</div>
            {sotto && <div className="ly-pannello-sotto">{sotto}</div>}
          </div>
          <div className="ly-pannello-comandi">
            {(onPrecedente || onSuccessiva) && (
              <>
                {posizione && <span className="ly-pannello-posizione">{posizione}</span>}
                <button type="button" className="ly-pannello-btn senza-tocco" onClick={onPrecedente} disabled={!onPrecedente} aria-label="Precedente">‹</button>
                <button type="button" className="ly-pannello-btn senza-tocco" onClick={onSuccessiva} disabled={!onSuccessiva} aria-label="Successivo">›</button>
              </>
            )}
            <button type="button" className="ly-pannello-btn senza-tocco" onClick={chiudi} aria-label="Chiudi"><Icon name="close" size={14} /></button>
          </div>
        </header>
        <div className="ly-pannello-corpo" ref={corpo}>{children}</div>
        {piede && <footer className="ly-pannello-piede">{piede}</footer>}
      </aside>
    </div>,
    document.body
  )
}
