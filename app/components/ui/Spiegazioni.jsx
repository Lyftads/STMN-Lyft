'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '../../../lib/i18n/I18nProvider'
import { trovaVoce } from '../../../lib/glossario'

// ============================================================================
//  LE SPIEGAZIONI AL PASSAGGIO DEL MOUSE — una sola nuvoletta per TUTTA l'app.
//
//  Marino: "deve essere cosi' per tutte le tab, per ogni cosa: una persona, anche se non ci capisce
//  nulla, quando ci passa sopra col mouse deve capire che cosa vuol dire quel dato e come si calcola".
//  Tre fonti, nell'ordine (vince sempre la piu' VICINA al puntatore: il numero batte la cella, la
//  cella batte la riga):
//   1. `data-spiega="…"` — la descrizione scritta apposta (nelle celle: il conto coi numeri veri);
//   2. `title="…"` — le ~1.100 descrizioni gia' scritte nell'app: si convertono al volo, cosi' non
//      compare piu' il fumetto lento e piccolo del browser ma questo;
//   3. il GLOSSARIO (lib/glossario.js) — in automatico, senza toccare le tab: l'intestazione di una
//      tabella, la cella (tramite la sua colonna, o la prima cella della riga nei conti per periodi),
//      il riquadro di un KPI, un'etichetta breve. Dice che cos'e' e come si calcola, nella lingua
//      dell'utente (chiavi gl.<id>).
//  I TITOLI DEI PRODOTTI restano muti (Marino, 20 set: "sui titoli dei prodotti non serve che appare
//  il pop up"): la cella della colonna Prodotto/Articolo non mostra niente — ne' glossario, ne' la
//  descrizione della riga; il title si toglie lo stesso, o partirebbe il fumetto del browser.
//  Compare in ~0,2 s, sta sul body in posizione fissa (nessun overflow la taglia), sopra l'elemento o
//  sotto se in alto non c'e' posto. Sui dispositivi a tocco non c'e' "passaggio": li' non si attiva.
//  Montata una volta in AppShell, come IntestazioniFerme.
//
//  MULTI-CLIENTE. Qui non si legge niente di nessun cliente: nessuna chiamata, nessun tenant, solo
//  testo dal dizionario della lingua. Percio' vale per tutti i clienti senza interruttori.
//  L'UNICA cosa che serve fuori da questo file e' `data-tab` sul <main className="app-main">, che
//  dice in che tab siamo: serve alle poche voci in cui la stessa sigla vuol dire due cose (in Email
//  "CR" e' il click rate, altrove sarebbe il tasso di conversione). Se `data-tab` manca, la tab
//  risulta vuota e quelle voci vengono SALTATE: si perde una spiegazione, non se ne mostra una
//  sbagliata. E' la degradazione giusta — meglio muti che bugiardi.
// ============================================================================
const RITARDO = 180
const CONTENITORI = 'th, td, .ly-kpi, .prov-kpi, .ly-sintesi-numero, .mc-lati > div'

// l'intestazione della colonna di una cella, contando le celle unite
function intestazioneDi(td) {
  const tr = td.parentElement, tabella = td.closest('table')
  if (!tr || !tabella || !tabella.tHead || !tabella.tHead.rows.length) return null
  let indice = 0
  for (const c of tr.cells) { if (c === td) break; indice += c.colSpan || 1 }
  const righe = [...tabella.tHead.rows]
  const riga = righe.slice().reverse().find(r => r.cells.length > 1) || righe[righe.length - 1]
  let k = 0
  for (const th of riga.cells) { const largo = th.colSpan || 1; if (indice < k + largo) return th; k += largo }
  return null
}
const primaRiga = (el) => String(el?.innerText || el?.textContent || '').trim().split('\n')[0].trim()

export default function Spiegazioni() {
  const { t } = useI18n()
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia && !window.matchMedia('(hover: hover)').matches) return
    let nuvola = null, bersaglio = null, timer = 0
    const definizione = (voce) => (voce ? tRef.current('gl.' + voce.id, null, '') : '')
    const tabAttuale = () => document.querySelector('.app-main')?.getAttribute('data-tab') || ''

    // 3) il glossario: che cosa dire di questo elemento, se se ne sa qualcosa
    const dalGlossario = (el) => {
      if (!el.closest('.app-main, .ly-pannello') || el.closest('.recharts-wrapper, canvas, .dashboard-globe, input, textarea, select')) return ''
      const tab = tabAttuale()
      const scatola = el.closest(CONTENITORI)
      if (scatola) {
        if (scatola.tagName === 'TH') return definizione(trovaVoce(primaRiga(scatola), tab))
        if (scatola.tagName === 'TD') {
          const th = intestazioneDi(scatola), etichettaCol = th ? primaRiga(th) : ''
          const col = etichettaCol ? trovaVoce(etichettaCol, tab) : null
          const primaCella = scatola.parentElement?.cells?.[0]
          const etichettaRiga = primaCella && primaCella !== scatola ? primaRiga(primaCella) : ''
          const riga = etichettaRiga ? trovaVoce(etichettaRiga, tab) : null
          // nei conti per periodi la colonna e' una data: la cosa da spiegare e' la RIGA
          if (riga && (!col || col.id === 'periodo' || col.id === 'annoPrima' || col.id === 'voce' || col.id === 'scenario' || col.id === 'totale' || col.id === 'prec')) return `${etichettaRiga}: ${definizione(riga)}`
          if (col && col.id !== 'periodo') return `${etichettaCol.replace(/[▾▴↑↓]/g, '').trim()}: ${definizione(col)}`
          if (primaCella === scatola) return definizione(trovaVoce(primaRiga(scatola), tab))
          return ''
        }
        const et = scatola.querySelector('.ly-kpi-et, .prov-kpi-et, .ly-sintesi-et, dt')
        return definizione(trovaVoce(primaRiga(et || scatola), tab))
      }
      // un'etichetta breve fuori da tabelle e riquadri (le schede scritte a mano delle tab piu' vecchie)
      if (el.closest('button, a, nav, label')) return ''
      for (let e = el, giri = 0; e && giri < 4; e = e.parentElement, giri++) {
        if (e.childElementCount > 8 || (e.textContent || '').length > 140) break
        const righe = String(e.innerText || '').split('\n').map(x => x.trim()).filter(Boolean)
        if (righe.length > 5) break
        for (const r of righe.slice(0, 2)) { const v = trovaVoce(r, tab); if (v && v.id !== 'periodo' && v.id !== 'annoPrima') return definizione(v) }
      }
      return ''
    }

    // 1) e 2): la descrizione scritta a mano sull'elemento; il title si converte (niente fumetto del browser)
    const scritta = (el) => {
      if (!el || !el.getAttribute) return ''
      const titolo = el.getAttribute('title')
      if (titolo && titolo.trim()) { el.setAttribute('data-spiega', titolo); el.removeAttribute('title') }
      return (el.getAttribute('data-spiega') || '').trim()
    }

    // la cella col nome del prodotto: si riconosce dalla sua colonna ("Prodotto", "Articolo"…) o dalle classi
    const titoloProdotto = (el) => {
      const td = el.closest('td')
      if (!td) return false
      if (td.matches('.gp-prodotto, .gpv-prodotto')) return true
      const th = intestazioneDi(td)
      const v = th ? trovaVoce(primaRiga(th), tabAttuale()) : null
      return !!v && v.id === 'prodotto'
    }

    const togli = () => { clearTimeout(timer); bersaglio = null; if (nuvola) { nuvola.remove(); nuvola = null } }

    const mostra = (el, esterno) => {
      if (!document.body.contains(el)) return
      const testo = scritta(el) || dalGlossario(el) || (esterno ? scritta(esterno) : '')
      if (!testo) return
      if (!nuvola) { nuvola = document.createElement('div'); nuvola.className = 'ly-spiega'; nuvola.setAttribute('role', 'tooltip'); document.body.appendChild(nuvola) }
      nuvola.textContent = testo
      const r = el.getBoundingClientRect(), n = nuvola.getBoundingClientRect(), bordo = 8
      const x = Math.min(window.innerWidth - n.width - bordo, Math.max(bordo, r.left + r.width / 2 - n.width / 2))
      const sopra = r.top - n.height - bordo
      const y = sopra >= bordo ? sopra : Math.min(window.innerHeight - n.height - bordo, r.bottom + bordo)
      nuvola.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
      nuvola.classList.add('vista')
    }

    const entra = (e) => {
      const p = e.target
      if (!p || !p.closest) return
      if (p.closest('.ly-icona-btn[data-suggerimento]')) return            // hanno gia' la loro etichetta
      const conTesto = p.closest('[data-spiega], [title]')
      const scatola = p.closest(CONTENITORI)
      // il piu' interno dei due e' il bersaglio; l'altro resta come ripiego
      const interno = conTesto && scatola ? (conTesto.contains(scatola) && conTesto !== scatola ? scatola : conTesto) : (conTesto || scatola || p)
      const esterno = interno === scatola ? conTesto : null
      if (interno === bersaglio) return
      togli()
      bersaglio = interno
      // il title va tolto SUBITO, o nel frattempo parte il fumetto del browser
      if (conTesto) scritta(conTesto)
      if (titoloProdotto(p)) return                                        // sui titoli dei prodotti niente nuvoletta
      timer = setTimeout(() => mostra(interno, esterno), RITARDO)
    }
    const esce = (e) => { if (bersaglio && !(e.relatedTarget && bersaglio.contains && bersaglio.contains(e.relatedTarget))) togli() }
    const tasto = (e) => { if (e.key === 'Escape') togli() }

    document.addEventListener('mouseover', entra, true)
    document.addEventListener('mouseout', esce, true)
    document.addEventListener('focusin', entra, true)
    document.addEventListener('focusout', togli, true)
    document.addEventListener('mousedown', togli, true)
    document.addEventListener('keydown', tasto, true)
    window.addEventListener('scroll', togli, true)
    window.addEventListener('resize', togli)
    return () => {
      document.removeEventListener('mouseover', entra, true)
      document.removeEventListener('mouseout', esce, true)
      document.removeEventListener('focusin', entra, true)
      document.removeEventListener('focusout', togli, true)
      document.removeEventListener('mousedown', togli, true)
      document.removeEventListener('keydown', tasto, true)
      window.removeEventListener('scroll', togli, true)
      window.removeEventListener('resize', togli)
      togli()
    }
  }, [])
  return null
}
