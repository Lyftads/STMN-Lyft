'use client'

import { useEffect } from 'react'

// ============================================================================
//  L'intestazione delle tabelle resta in vista mentre si scorre.
//
//  Il modo semplice (position: sticky sul <th>) qui non funziona, MISURATO: ogni
//  tabella vive dentro un contenitore con lo scorrimento laterale (overflow: auto), e
//  quel contenitore diventa il riferimento dello sticky — che pero' in verticale non
//  scorre mai. Dare un'altezza fissa ai contenitori vorrebbe dire due barre di
//  scorrimento una dentro l'altra.
//
//  Quindi UNA intestazione galleggiante per tutta l'app: quando la testa di una tabella
//  esce dall'alto dello schermo, se ne mostra una copia fissa in cima, con le stesse
//  larghezze di colonna e lo stesso scorrimento laterale. E' solo da guardare
//  (aria-hidden, niente click): per ordinare si torna su, com'e' sempre stato.
//  Solo su computer: su telefono la prima colonna e' gia' ferma e lo spazio e' poco.
// ============================================================================
export default function IntestazioniFerme() {
  useEffect(() => {
    const main = document.querySelector('.app-main')
    if (!main) return
    let barra = null, tabellaAttiva = null, attesa = 0

    const togli = () => { if (barra) { barra.remove(); barra = null; tabellaAttiva = null } }

    const aggiorna = () => {
      attesa = 0
      if (window.innerWidth <= 900) return togli()
      const alto = main.getBoundingClientRect().top
      // la tabella la cui testa e' uscita in alto ma il cui corpo e' ancora in vista
      let scelta = null
      for (const t of main.querySelectorAll('table.tab-lyft, table.reg-tab')) {
        const th = t.tHead; if (!th || !t.tBodies[0] || t.tBodies[0].rows.length < 6) continue
        const r = t.getBoundingClientRect(), rh = th.getBoundingClientRect()
        if (rh.bottom < alto + 4 && r.bottom > alto + rh.height + 60) { scelta = t; break }
      }
      if (!scelta) return togli()

      const contenitore = scelta.parentElement
      const rc = contenitore.getBoundingClientRect()
      // Se la tabella e' COPERTA da un velo a tutto schermo (la lavagna di un flusso Klaviyo, un
      // popup) la testata non deve restare li' sopra: si guarda che cosa c'e' davvero in quel
      // punto dello schermo. La barra stessa non conta (pointer-events: none).
      const sopra = document.elementFromPoint(Math.min(window.innerWidth - 2, Math.max(0, rc.left) + 24), Math.max(0, alto) + scelta.tHead.getBoundingClientRect().height + 30)
      if (sopra && !contenitore.contains(sopra)) return togli()
      if (scelta !== tabellaAttiva) {
        togli()
        barra = document.createElement('div')
        barra.className = 'ly-testa-ferma'
        barra.setAttribute('aria-hidden', 'true')
        const copia = document.createElement('table')
        copia.className = scelta.className
        copia.appendChild(scelta.tHead.cloneNode(true))
        barra.appendChild(copia)
        document.body.appendChild(barra)
        tabellaAttiva = scelta
      }
      const copia = barra.firstChild
      barra.style.cssText = `top:${Math.max(0, alto)}px;left:${rc.left}px;width:${contenitore.clientWidth}px`
      // La copia si mette dove sta DAVVERO la tabella nel contenitore: scorrimento laterale e
      // margini interni compresi (in Inventario il contenitore ha 20px di margine: era fuori di 20).
      copia.style.cssText = `width:${scelta.offsetWidth}px;min-width:${scelta.offsetWidth}px;table-layout:fixed;border-collapse:collapse;transform:translateX(${scelta.getBoundingClientRect().left - rc.left}px)`
      // Le larghezze si fissano con un <colgroup> preso dalle colonne del CORPO: con le fasce
      // colorate la prima riga dell'intestazione ha celle unite, e con table-layout: fixed le
      // larghezze date alle celle della seconda riga venivano ignorate (misurato: 20–34px fuori).
      const riga = [...scelta.tBodies[0].rows].find(r => [...r.cells].every(c => c.colSpan === 1))
      if (riga) {
        let cg = copia.querySelector('colgroup')
        if (!cg || cg.children.length !== riga.cells.length) {
          cg?.remove(); cg = document.createElement('colgroup')
          for (let k = 0; k < riga.cells.length; k++) cg.appendChild(document.createElement('col'))
          copia.insertBefore(cg, copia.firstChild)
        }
        ;[...riga.cells].forEach((c, k) => { cg.children[k].style.width = `${c.getBoundingClientRect().width}px` })
      }
    }
    const chiedi = () => { if (!attesa) attesa = requestAnimationFrame(aggiorna) }

    main.addEventListener('scroll', chiedi, { passive: true })
    window.addEventListener('resize', chiedi)
    // lo scorrimento LATERALE dei contenitori non risale fino a main: lo si ascolta in cattura
    main.addEventListener('scroll', chiedi, { passive: true, capture: true })
    // cambio di tab, di pagina dell'elenco, di ordinamento: la tabella cambia sotto i piedi
    const oss = new MutationObserver(() => { tabellaAttiva = null; chiedi() })
    oss.observe(main, { childList: true, subtree: true })
    return () => { main.removeEventListener('scroll', chiedi); main.removeEventListener('scroll', chiedi, { capture: true }); window.removeEventListener('resize', chiedi); oss.disconnect(); cancelAnimationFrame(attesa); togli() }
  }, [])
  return null
}
