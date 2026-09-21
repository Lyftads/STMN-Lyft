'use client'

import { useEffect, useRef, useState } from 'react'
import { PlatformBadges } from '../PlatformIcon'
import { Fonte } from './FasceTabella'
import { localeNumeri } from '../../../lib/client/numeri'

// ============================================================================
//  I MATTONI — i pezzi con cui si costruisce una tab (stili in lyft-system.css).
//
//  Una tab nuova non si inventa un titolo, una scheda KPI, un filtro o un
//  bottone: prende questi. E' l'unico modo perche' quaranta tab sembrino un
//  prodotto solo, e perche' il tema chiaro non vada rincorso pezzo per pezzo.
// ============================================================================

// Il colore dice DA DOVE arriva il numero: la stessa metrica ha lo stesso colore
// in ogni tab. Verde = vendite, giallo = pubblicita', viola = traffico, blu = resa.
const FAMIGLIE = {
  vendite: ['revenue', 'fatturato', 'orders', 'ordini', 'purchases', 'acquisti', 'aov', 'convValue', 'conversions', 'nc', 'rc', 'customers', 'clienti', 'ltv', 'units'],
  pub: ['spend', 'spesa', 'cost', 'cpm', 'cpc', 'cpc_link', 'cpa', 'cpo', 'cac', 'cost_per_result', 'costPerConv', 'budget'],
  traffico: ['impressions', 'reach', 'clicks', 'click_link', 'ctr', 'ctr_link', 'frequency', 'sessions', 'sessioni', 'convRate', 'cro'],
  resa: ['roas', 'mer', 'amer', 'poas', 'margin', 'margine', 'ratio', 'retention', 'repeat'],
}
export function famigliaDi(chiave) {
  const k = String(chiave || '')
  for (const [fam, lista] of Object.entries(FAMIGLIE)) if (lista.includes(k)) return fam
  return undefined
}
// Gli sparkline sono NEUTRI, tutti uguali: un grigio che regge su fondo chiaro e
// scuro. Niente colore per famiglia sulle schede (scelta di Marino: "zero colori,
// piu' minimale possibile"). Esadecimale perche' finisce in attributi SVG, dove
// var(--…) non vale. La firma resta per chi chiama.
export const COLORE_FAMIGLIA = {}
export const coloreFamiglia = () => '#8e8e98'

// ── Il numero che scorre ─────────────────────────────────────────────────
// Quando un valore cambia (nuovo periodo, dato aggiornato) le cifre scorrono
// dal vecchio al nuovo in meno di mezzo secondo: si VEDE che e' cambiato, e in
// che direzione. Lavora sul testo gia' formattato ("€1.082", "4,23%", "2,24×",
// "1.06"): ne riconosce il numero e lo riscrive nello stesso formato. Se non lo
// riconosce, o se l'utente ha chiesto meno movimento, mostra il testo com'e'.
function leggiNumero(testo) {
  const m = /^(.*?)(\d[\d.,]*)(.*)$/s.exec(testo)
  if (!m) return null
  const [, prima, cifre, dopo] = m
  const negativo = /[-−]\s*[^\d]*$/.test(prima)
  let decimali = 0, italiano = true, valore
  if (cifre.includes(',')) { decimali = cifre.split(',')[1].length; valore = parseFloat(cifre.replace(/\./g, '').replace(',', '.')) }
  else if (/^\d{1,3}(\.\d{3})+$/.test(cifre)) { valore = parseFloat(cifre.replace(/\./g, '')) }
  else if (cifre.includes('.')) { italiano = false; decimali = cifre.split('.')[1].length; valore = parseFloat(cifre) }
  else valore = parseFloat(cifre)
  if (!Number.isFinite(valore)) return null
  return { prima, dopo, valore: negativo ? -valore : valore, negativo, decimali, italiano }
}
function scrivi(n, modello) {
  const a = Math.abs(n)
  const cifre = modello.italiano
    ? a.toLocaleString('it-IT', { minimumFractionDigits: modello.decimali, maximumFractionDigits: modello.decimali, useGrouping: 'always' })
    : a.toFixed(modello.decimali)
  return `${modello.prima}${cifre}${modello.dopo}`
}
export function NumeroAnimato({ children }) {
  const testo = typeof children === 'string' || typeof children === 'number' ? String(children) : null
  const [mostrato, setMostrato] = useState(testo)
  const precedente = useRef(null)
  useEffect(() => {
    if (testo == null) return
    const nuovo = leggiNumero(testo), vecchio = precedente.current
    precedente.current = nuovo
    const fermo = typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Al primo arrivo il numero compare e basta; scorre solo quando CAMBIA.
    if (!nuovo || !vecchio || fermo || vecchio.valore === nuovo.valore || vecchio.negativo !== nuovo.negativo) { setMostrato(testo); return }
    let vivo = true
    const da = vecchio.valore, a = nuovo.valore, t0 = performance.now(), DURATA = 420
    const passo = (ora) => {
      if (!vivo) return
      const k = Math.min(1, (ora - t0) / DURATA), e = 1 - Math.pow(1 - k, 3)
      if (k >= 1) { setMostrato(testo); return }
      setMostrato(scrivi(da + (a - da) * e, nuovo))
      requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
    return () => { vivo = false }
  }, [testo])
  if (testo == null) return children
  return mostrato
}

export function Live({ testo = 'LIVE' }) {
  return <span className="ly-live">{testo}</span>
}

// Il titolo di una tab: nome, da dove arrivano i dati, se sono vivi, e a
// destra i comandi (periodo, aggiorna, scarica).
export function TitoloTab({ titolo, sotto, fonti, live = false, children, azioni }) {
  return (
    <div className="ly-testa">
      <div className="ly-testa-sx">
        <div className="ly-titolo-riga">
          <h1 className="ly-titolo">{titolo}</h1>
          {fonti?.length > 0 && <PlatformBadges sources={fonti} size={24} />}
          {live && <Live />}
          {children}
        </div>
        {sotto && <p className="ly-sotto">{sotto}</p>}
      </div>
      {azioni && <div className="ly-azioni barra-strumenti">{azioni}</div>}
    </div>
  )
}

export function Scheda({ children, className = '', style }) {
  return <div className={`ly-scheda ${className}`} style={style}>{children}</div>
}

// Una variazione percentuale col suo giudizio: verde se e' una buona notizia.
// `inverso` = quando scendere e' meglio (CPA, costo per risultato, resi).
export function Variazione({ delta, inverso = false, suffisso = '%' }) {
  if (delta == null || !Number.isFinite(Number(delta))) return null
  const d = Number(delta)
  const buono = inverso ? d < 0 : d > 0
  const tono = Math.abs(d) < 0.005 ? '' : buono ? 'positivo' : 'negativo'
  return (
    <span className={`ly-pastiglia ${tono}`}>
      {d > 0 ? '▲' : d < 0 ? '▼' : ''} {Math.abs(d).toLocaleString(localeNumeri(), { maximumFractionDigits: 2 })}{suffisso}
    </span>
  )
}

// LA scheda KPI. `famiglia` colora il filo in alto e dice da dove arriva il
// numero (vendite · pub · traffico · resa); `tono` lo usa per un allarme
// (negativo · attenzione · positivo). `grafico` e' lo sparkline, se c'e'.
// `spiega`: la descrizione che compare al passaggio del mouse (ui/Spiegazioni).
export function Kpi({ etichetta, valore, nota, delta, inverso, famiglia, tono, fonti, grafico, children, onClick, title, classe, spiega }) {
  // `famiglia` e `tono` restano nella firma ma non colorano piu' nulla.
  const classi = classe ? `ly-kpi ${classe}` : 'ly-kpi'
  return (
    <div className={classi} onClick={onClick} title={title} data-spiega={spiega || undefined} style={onClick ? { cursor: 'pointer' } : undefined}
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e) } } : undefined}>
      <div className="ly-kpi-testa">
        <span className="ly-kpi-et">{etichetta}</span>
        {fonti?.length > 0 && <Fonte loghi={fonti} size={12} dopo />}
      </div>
      <div className="ly-kpi-corpo">
        <div className="ly-kpi-val"><NumeroAnimato>{valore}</NumeroAnimato></div>
        {grafico && <div className="ly-kpi-grafico">{grafico}</div>}
      </div>
      {(delta != null || children) && (
        <div className="ly-kpi-piede"><Variazione delta={delta} inverso={inverso} />{children}</div>
      )}
      {nota && <div className="ly-kpi-nota">{nota}</div>}
    </div>
  )
}
export function GrigliaKpi({ children, min = 180, style }) {
  return <div className="ly-kpi-griglia" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, ...style }}>{children}</div>
}

export function Pastiglia({ tono, children, title }) {
  return <span className={`ly-pastiglia ${tono || ''}`} title={title}>{children}</span>
}

// Filtri a pastiglia: voci = [{ id, label, n, colore, spiega }] (`spiega` = descrizione al passaggio del mouse).
export function Filtri({ voci = [], valore, onChange, style }) {
  return (
    <div className="ly-filtri" style={style}>
      {voci.map(v => (
        <button key={v.id} type="button" aria-pressed={valore === v.id} onClick={() => onChange?.(v.id)} data-spiega={v.spiega || undefined}
          className={`ly-filtro senza-tocco${valore === v.id ? ' acceso' : ''}`} style={v.colore ? { '--ly-col': v.colore } : undefined}>
          {v.colore && <span className="ly-filtro-punto" />}
          {v.label}
          {v.n != null && <span className="ly-filtro-n">{v.n}</span>}
        </button>
      ))}
    </div>
  )
}

// Linguette: si cambia vista dentro la stessa tab. voci = [{ id, label, n }].
export function Linguette({ voci = [], valore, onChange, style }) {
  return (
    <div className="ly-linguette" role="tablist" style={style}>
      {voci.map(v => (
        <button key={v.id} type="button" role="tab" aria-selected={valore === v.id} onClick={() => onChange?.(v.id)}
          className={`ly-linguetta senza-tocco${valore === v.id ? ' aperta' : ''}`}>
          {v.label}{v.n != null && <i>({v.n})</i>}
        </button>
      ))}
    </div>
  )
}

export function Bottone({ tipo = 'secondario', children, className = '', ...resto }) {
  return <button type="button" className={`ly-btn ${tipo === 'secondario' ? '' : tipo} ${className}`} {...resto}>{children}</button>
}

// Niente da mostrare: si dice cosa succede e, se si puo', cosa fare.
export function Vuoto({ titolo, testo, children }) {
  return (
    <div className="ly-vuoto">
      <div className="ly-vuoto-icona">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></svg>
      </div>
      {titolo && <b>{titolo}</b>}
      {testo && <span>{testo}</span>}
      {children}
    </div>
  )
}

// L'attesa ha gia' la forma di quello che arriva: la pagina non salta.
export function Scheletro({ kpi = 4, righe = 8 }) {
  return (
    <div className="ly-scheletro" aria-busy="true">
      {kpi > 0 && (
        <div className="ly-scheletro-kpi">
          {Array.from({ length: kpi }).map((_, i) => <span key={i} className="ly-osso" style={{ height: 92, borderRadius: 16 }} />)}
        </div>
      )}
      {righe > 0 && (
        <div className="ly-scheda" style={{ padding: '6px 18px' }}>
          {Array.from({ length: righe }).map((_, i) => (
            <div key={i} className="ly-scheletro-riga">
              <span className="ly-osso" style={{ width: 36, height: 36, flexShrink: 0 }} />
              <span className="ly-osso" style={{ height: 12, flex: `0 1 ${32 - (i % 3) * 6}%` }} />
              <span style={{ flex: 1 }} />
              <span className="ly-osso" style={{ height: 12, width: 64 }} />
              <span className="ly-osso" style={{ height: 12, width: 64 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
