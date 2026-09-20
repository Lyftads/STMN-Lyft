'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { prenotaRicerca } from './Elenco'

// ============================================================================
//  Ricerca rapida (⌘K / Ctrl+K).
//
//  La barra laterale ha piu' di quaranta voci in sette gruppi: per andare su
//  "Corrispettivi" bisognava ricordarsi in quale gruppo sta e aprirlo. Qui si
//  scrive e si va. Scrivendo il nome di un prodotto, di un marchio o uno SKU
//  si salta direttamente nella tabella giusta con la ricerca gia' impostata.
// ============================================================================

const pulisci = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Le tabelle dei prodotti in cui ha senso cercare un articolo: tab + chiave
// dell'elenco (la stessa passata a useElenco in quella tab).
const ELENCHI = [
  { tab: 'productPerformance', chiave: 'performanceProdotti' },
  { tab: 'inventory', chiave: 'inventarioCerca' },
  { tab: 'googleVerdicts', chiave: 'performanceGoogle' },
  { tab: 'googleProducts', chiave: 'prodottiGoogle' },
  { tab: 'productCosts', chiave: 'costiProdotto' },
]

export default function RicercaRapida({ gruppi = [], azioni = [], onVai, t }) {
  const [aperta, setAperta] = useState(false)
  const velo = useRef(null)
  const [testo, setTesto] = useState('')
  const [scelta, setScelta] = useState(0)
  const campo = useRef(null)
  const lista = useRef(null)

  // Entra ed esce come il pop-up unico, invece di comparire e sparire di scatto.
  const chiudi = useCallback(() => {
    const calmo = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (calmo || !velo.current) return setAperta(false)
    velo.current.classList.add('via')
    setTimeout(() => setAperta(false), 120)
  }, [])

  useEffect(() => {
    const tasto = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAperta(v => !v) }
      else if (e.key === 'Escape') chiudi()
    }
    const apri = () => setAperta(true)
    window.addEventListener('keydown', tasto)
    window.addEventListener('lyft:ricerca-rapida', apri)
    return () => { window.removeEventListener('keydown', tasto); window.removeEventListener('lyft:ricerca-rapida', apri) }
  }, [chiudi])

  // Il testo si azzera sia aprendo sia chiudendo: altrimenti chi riapre e scrive subito si ritrova
  // la ricerca di prima attaccata davanti.
  useEffect(() => { setTesto(''); setScelta(0); if (aperta) setTimeout(() => campo.current?.focus(), 30) }, [aperta])

  const voci = useMemo(() => {
    const tutte = gruppi.flatMap(g => g.items.map(i => ({ tipo: 'tab', id: i.id, nome: i.label, gruppo: g.title, icona: i.icon })))
    const parole = pulisci(testo).split(/\s+/).filter(Boolean)
    if (!parole.length) return tutte
    // I COMANDI (periodo, tema, profilo, aggiorna…): ⌘K non porta solo in un posto, fa le cose.
    const comandi = azioni.filter(a => parole.every(p => pulisci(`${a.nome} ${a.parole || ''}`).includes(p))).map(a => ({ tipo: 'azione', id: a.id, nome: a.nome, gruppo: a.gruppo, icona: a.icona, esegui: a.esegui }))
    // Una domanda vera (tre parole o piu') si puo' girare all'assistente.
    const domanda = parole.length >= 3 ? [{ tipo: 'chiedi', id: 'chiedi', nome: testo.trim(), gruppo: t('rr.assistant', null, 'Assistente'), icona: null }] : []
    const trovate = tutte.filter(v => parole.every(p => pulisci(`${v.nome} ${v.gruppo}`).includes(p)))
    // Cercare un articolo: una voce per ogni tabella dei prodotti che si puo' aprire.
    const perNome = new Map(tutte.map(v => [v.id, v]))
    const cerca = testo.trim().length >= 2
      ? ELENCHI.filter(e => perNome.has(e.tab)).map(e => ({ tipo: 'cerca', id: e.tab, chiave: e.chiave, nome: perNome.get(e.tab).nome, gruppo: perNome.get(e.tab).gruppo, icona: perNome.get(e.tab).icona }))
      : []
    // Una domanda vera va per prima ("quanto ho speso ieri?"); "borsa hobo nera" resta una ricerca.
    const eDomanda = /\?\s*$/.test(testo) || /^(quant|com|perch|cosa|che cosa|qual|chi|dove|quando|how|what|why|which|who|where|when|cu[aá]nt|c[oó]mo|por qu|qu[eé]|combien|comment|pourquoi|quel|wie|was|warum|welch|wer|wo|wann)/i.test(testo.trim())
    return eDomanda ? [...domanda, ...comandi, ...trovate, ...cerca] : [...comandi, ...trovate, ...cerca, ...domanda]
  }, [gruppi, azioni, testo])

  useEffect(() => { setScelta(0) }, [testo])
  useEffect(() => { lista.current?.querySelector('[data-scelta="1"]')?.scrollIntoView({ block: 'nearest' }) }, [scelta])

  const vai = (v) => {
    if (!v) return
    setAperta(false)
    if (v.tipo === 'azione') { v.esegui?.(); return }
    if (v.tipo === 'chiedi') { window.dispatchEvent(new CustomEvent('lyft:chiedi', { detail: { testo: v.nome } })); return }
    if (v.tipo === 'cerca') prenotaRicerca(v.chiave, testo.trim())
    onVai?.(v.id)
  }

  if (!aperta || typeof document === 'undefined') return null
  return createPortal(
    <div className="rr-velo" ref={velo} onMouseDown={chiudi}>
      <div className="rr-scheda" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={t('rr.title', null, 'Ricerca rapida')}>
        <div className="rr-campo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input ref={campo} autoFocus value={testo} onChange={e => setTesto(e.target.value)}
            placeholder={t('rr.placeholder', null, 'Vai a una sezione, o cerca un prodotto, un marchio, uno SKU…')}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setScelta(s => Math.min(s + 1, voci.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setScelta(s => Math.max(s - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); vai(voci[scelta]) }
            }} />
          <kbd>esc</kbd>
        </div>
        <div className="rr-lista" ref={lista}>
          {voci.length === 0 && <div className="rr-vuoto">{t('rr.none', null, 'Nessuna sezione con questo nome.')}</div>}
          {voci.map((v, k) => (
            <button key={`${v.tipo}:${v.id}`} data-scelta={k === scelta ? '1' : '0'} className={`rr-voce senza-tocco${k === scelta ? ' scelta' : ''}`}
              onMouseEnter={() => setScelta(k)} onClick={() => vai(v)}>
              <span className="rr-icona">{v.icona}</span>
              <span className="rr-nome">
                {v.tipo === 'cerca'
                  ? <>{t('rr.searchIn', { q: testo.trim() }, `Cerca «${testo.trim()}» in`)} <b>{v.nome}</b></>
                  : v.tipo === 'chiedi' ? <>{t('rr.ask', null, 'Chiedi all’assistente:')} <b>{v.nome}</b></>
                  : v.nome}
              </span>
              <span className="rr-gruppo">{v.gruppo}</span>
            </button>
          ))}
        </div>
        <div className="rr-piede"><span><kbd>↑</kbd><kbd>↓</kbd> {t('rr.move', null, 'per scegliere')}</span><span><kbd>↵</kbd> {t('rr.go', null, 'per aprire')}</span></div>
      </div>
    </div>,
    document.body
  )
}
