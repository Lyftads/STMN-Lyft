'use client'

import Icon from './Icon'
import { useEffect, useMemo, useState } from 'react'

// ============================================================================
//  Elenchi lunghi: ricerca per nome, filtro per marchio, pagine.
//
//  Le tabelle dei prodotti crescevano all'infinito verso il basso: con duemila
//  righe trovare un articolo voleva dire scorrere e sperare. Qui le stesse tre
//  cose per tutte le tab che elencano prodotti, scritte una volta sola:
//    - una casella che cerca nel nome (tutte le parole, in qualunque ordine);
//    - i marchi come pastiglie: se ne accendono quanti se ne vuole;
//    - le pagine, da 25, 50 o 100 righe — la scelta resta ricordata.
//
//  L'ordinamento resta alla tab: qui arrivano righe GIA' ordinate, e si
//  filtrano e si tagliano soltanto. Cosi' "dal migliore al peggiore" continua
//  a valere su tutto l'elenco, non sulla pagina che si sta guardando.
// ============================================================================

const pulisci = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const TAGLIE = [25, 50, 100]
export const SENZA_MARCHIO = '—'

// Una ricerca "prenotata" da fuori (la ricerca rapida ⌘K): la tab la trova
// gia' impostata quando si apre; se e' gia' aperta, la riceve con l'evento.
const prenotate = new Map()
export function prenotaRicerca(chiave, testo) {
  prenotate.set(chiave, testo)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('elenco:ricerca', { detail: { chiave, testo } }))
}
export function prendiRicerca(chiave) {
  const t = prenotate.get(chiave) || ''
  prenotate.delete(chiave)
  return t
}
export function useRicercaPrenotata(chiave, imposta) {
  useEffect(() => {
    const arriva = (e) => { if (e.detail?.chiave === chiave) { prenotate.delete(chiave); imposta(e.detail.testo || '') } }
    window.addEventListener('elenco:ricerca', arriva)
    return () => window.removeEventListener('elenco:ricerca', arriva)
  }, [chiave]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useElenco(righe, { nome, marchio, chiave = 'elenco', altriCampi } = {}) {
  const [ricerca, setRicerca] = useState(() => prendiRicerca(chiave))
  useRicercaPrenotata(chiave, setRicerca)
  const [marchiScelti, setMarchiScelti] = useState(() => new Set())
  const [pagina, setPagina] = useState(1)
  const [perPagina, setPerPaginaStato] = useState(25)

  // La grandezza della pagina si ricorda per tab: e' una comodita', e se il
  // browser non lo permette (finestra privata) si resta a 25 senza rompere nulla.
  useEffect(() => {
    try { const v = parseInt(localStorage.getItem(`elenco:${chiave}`) || '', 10); if (TAGLIE.includes(v)) setPerPaginaStato(v) } catch {}
  }, [chiave])
  const setPerPagina = (n) => {
    setPerPaginaStato(n); setPagina(1)
    try { localStorage.setItem(`elenco:${chiave}`, String(n)) } catch {}
  }

  const tutte = Array.isArray(righe) ? righe : []
  const marchioDi = (r) => (marchio ? String(marchio(r) || '').trim() : '') || SENZA_MARCHIO

  // I marchi si contano su TUTTE le righe: il numero accanto al nome dice
  // quanti prodotti ha quel marchio, non quanti ne restano dopo la ricerca.
  const marchi = useMemo(() => {
    if (!marchio) return []
    const conta = new Map()
    for (const r of tutte) { const m = marchioDi(r); conta.set(m, (conta.get(m) || 0) + 1) }
    return [...conta.entries()].map(([nomeMarchio, quanti]) => ({ nome: nomeMarchio, quanti }))
      .sort((a, b) => (a.nome === SENZA_MARCHIO) - (b.nome === SENZA_MARCHIO) || b.quanti - a.quanti || a.nome.localeCompare(b.nome))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutte])

  const filtrate = useMemo(() => {
    const parole = pulisci(ricerca).split(/\s+/).filter(Boolean)
    return tutte.filter(r => {
      if (marchiScelti.size && !marchiScelti.has(marchioDi(r))) return false
      if (!parole.length) return true
      // Anche il marchio: chi scrive "guess" nella casella si aspetta i prodotti Guess.
      const testo = pulisci(`${nome ? nome(r) : ''} ${altriCampi ? altriCampi(r) : ''} ${marchio ? marchioDi(r) : ''}`)
      return parole.every(p => testo.includes(p))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutte, ricerca, marchiScelti])

  const pagine = Math.max(1, Math.ceil(filtrate.length / perPagina))
  // Cambiando filtro si torna in cima: restare a pagina 7 di un elenco che ora
  // ne ha 2 mostrerebbe una tabella vuota.
  useEffect(() => { setPagina(1) }, [ricerca, marchiScelti])
  const paginaValida = Math.min(pagina, pagine)
  const da = (paginaValida - 1) * perPagina
  const visibili = filtrate.slice(da, da + perPagina)

  const alternaMarchio = (m) => setMarchiScelti(s => { const n = new Set(s); n.has(m) ? n.delete(m) : n.add(m); return n })
  const azzera = () => { setRicerca(''); setMarchiScelti(new Set()) }

  return {
    ricerca, setRicerca, marchi, marchiScelti, alternaMarchio, azzera,
    pagina: paginaValida, setPagina, pagine, perPagina, setPerPagina,
    visibili, filtrate, totale: tutte.length, da, a: Math.min(da + perPagina, filtrate.length),
    filtriAttivi: !!ricerca || marchiScelti.size > 0,
  }
}

// La casella di ricerca e i marchi, sopra la tabella.
export function FiltriElenco({ elenco, tr, segnaposto, senzaRicerca = false, style }) {
  const [tutti, setTutti] = useState(false)
  const LIMITE = 14
  const daMostrare = tutti ? elenco.marchi : elenco.marchi.slice(0, LIMITE)
  return (
    <div className="el-filtri" style={style}>
      {!senzaRicerca && <div className="el-cerca">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={elenco.ricerca} onChange={e => elenco.setRicerca(e.target.value)}
          placeholder={segnaposto || tr('el.search', null, 'Cerca per nome o SKU…')} aria-label={tr('el.search', null, 'Cerca per nome o SKU…')} />
        {elenco.ricerca && <button className="senza-tocco" onClick={() => elenco.setRicerca('')} aria-label={tr('el.clear', null, 'Cancella')}><Icon name="close" size={13} /></button>}
      </div>}
      {elenco.marchi.length > 1 && (
        <div className="el-marchi">
          <span className="el-etichetta">{tr('el.brands', null, 'Marchi')}</span>
          {daMostrare.map(m => {
            const acceso = elenco.marchiScelti.has(m.nome)
            return (
              <button key={m.nome} aria-pressed={acceso} className={`el-marchio senza-tocco${acceso ? ' acceso' : ''}`} onClick={() => elenco.alternaMarchio(m.nome)}>
                {m.nome === SENZA_MARCHIO ? tr('el.noBrand', null, 'Senza marchio') : m.nome}<i>{m.quanti}</i>
              </button>
            )
          })}
          {elenco.marchi.length > LIMITE && (
            <button className="el-altro senza-tocco" onClick={() => setTutti(v => !v)}>
              {tutti ? tr('el.fewer', null, 'Meno marchi') : tr('el.more', { n: elenco.marchi.length - LIMITE }, `+${elenco.marchi.length - LIMITE} marchi`)}
            </button>
          )}
          {elenco.filtriAttivi && <button className="el-altro senza-tocco" onClick={elenco.azzera}>{tr('el.reset', null, 'Togli i filtri')}</button>}
        </div>
      )}
    </div>
  )
}

// Esporta in CSV le righe FILTRATE (ricerca e marchi accesi), nell'ordine in
// cui si vedono, tutte le pagine. Punto e virgola e virgola decimale: e' quello
// che Excel in italiano apre senza chiedere niente. Il BOM serve per gli accenti.
export function scaricaCsv(nomeFile, colonne, righe) {
  const cella = (v) => {
    if (v == null) return ''
    const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const testo = [colonne.map(c => cella(c[0])).join(';'), ...righe.map(r => colonne.map(c => cella(c[1](r))).join(';'))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + testo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${nomeFile}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Le pagine e la grandezza della pagina, sotto la tabella.
// `esporta` = { nome, colonne: [[intestazione, riga => valore], …] } aggiunge il tasto CSV.
export function Paginazione({ elenco, tr, cosa, style, esporta }) {
  const { pagina, pagine, setPagina } = elenco
  const nome = cosa || tr('el.products', null, 'prodotti')
  // Prima, ultima e le vicine a quella aperta: con ottanta pagine non servono
  // ottanta bottoni.
  const numeri = []
  for (let p = 1; p <= pagine; p++) if (p === 1 || p === pagine || Math.abs(p - pagina) <= 1) numeri.push(p)
  const conBuchi = []
  numeri.forEach((p, k) => { if (k > 0 && p - numeri[k - 1] > 1) conBuchi.push(`…${p}`); conBuchi.push(p) })
  return (
    <div className="el-piede" style={style}>
      <span className="el-conto">
        {elenco.filtrate.length === 0
          ? tr('el.none', { x: nome }, `Nessun risultato fra i ${nome}`)
          : tr('el.range', { a: elenco.da + 1, b: elenco.a, n: elenco.filtrate.length, x: nome }, `${elenco.da + 1}–${elenco.a} di ${elenco.filtrate.length} ${nome}`)}
        {elenco.filtriAttivi && elenco.filtrate.length !== elenco.totale && <em> · {tr('el.ofTotal', { n: elenco.totale }, `su ${elenco.totale} in tutto`)}</em>}
      </span>
      {pagine > 1 && (
        <div className="el-pagine">
          <button className="senza-tocco" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} aria-label={tr('el.prev', null, 'Pagina precedente')}>‹</button>
          {conBuchi.map(p => typeof p === 'number'
            ? <button key={p} className={`senza-tocco${p === pagina ? ' aperta' : ''}`} aria-current={p === pagina ? 'page' : undefined} onClick={() => setPagina(p)}>{p}</button>
            : <span key={p}>…</span>)}
          <button className="senza-tocco" disabled={pagina >= pagine} onClick={() => setPagina(pagina + 1)} aria-label={tr('el.next', null, 'Pagina successiva')}>›</button>
        </div>
      )}
      {esporta && elenco.filtrate.length > 0 && (
        <button className="el-csv senza-tocco" onClick={() => scaricaCsv(esporta.nome, esporta.colonne, elenco.filtrate)}
          title={tr('el.csvHint', { n: elenco.filtrate.length }, `Scarica le ${elenco.filtrate.length} righe filtrate`)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" /></svg>
          CSV
        </button>
      )}
      <label className="el-taglia">
        {tr('el.show', null, 'Mostra')}
        <select value={elenco.perPagina} onChange={e => elenco.setPerPagina(parseInt(e.target.value, 10))}>
          {TAGLIE.map(n => <option key={n} value={n}>{n} {nome}</option>)}
        </select>
      </label>
    </div>
  )
}
