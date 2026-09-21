'use client'

import { soldi } from '../../lib/client/soldi'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Icon from './ui/Icon'
import { localeNumeri } from '../../lib/client/numeri'

// ============================================================================
//  La lavagna di un flusso: cosa contiene, in che ordine, dove si biforca.
//
//  Sola lettura: serve a CAPIRE un flusso senza aprire Klaviyo, non a
//  modificarlo. Si trascina per spostarsi, si ingrandisce con la rotella o con
//  i comandi in basso a destra. Un clic su un'email apre la stessa anteprima
//  con rapporto che si apre dalle newsletter.
//
//  La disposizione e' un albero: ogni passo sta sotto il precedente, e una
//  suddivisione apre due rami affiancati, Si' a sinistra e No a destra, larghi
//  quanto serve a non far sovrapporre quello che contengono.
// ============================================================================

const LARGO = 272          // larghezza di una scheda
const STRETTO = 192        // le attese sono piu' strette, come passi di servizio
const VUOTO = 150          // spazio tenuto da un ramo che finisce subito
const SPAZIO_X = 56
const SPAZIO_Y = 58
const ALTEZZA = { innesco: 112, attesa: 62, attesaLunga: 82, email: 150, messaggio: 120, bivio: 96, altro: 70, fine: 30 }

const ZOOM_MIN = 0.25, ZOOM_MAX = 2

function disponi(dati) {
  const perId = new Map((dati.passi || []).map(p => [p.id, p]))
  const larghezze = new Map()
  const inCorso = new Set()

  // Quanto spazio orizzontale serve a un passo e a tutto cio' che gli sta sotto.
  const larghezzaDi = (id) => {
    if (!id || !perId.has(id)) return VUOTO
    if (larghezze.has(id)) return larghezze.get(id)
    if (inCorso.has(id)) return LARGO          // un legame che torna indietro non deve far girare in tondo
    inCorso.add(id)
    const p = perId.get(id)
    let w
    if (p.tipo === 'bivio') w = Math.max(LARGO, larghezzaDi(p.seSi) + SPAZIO_X + larghezzaDi(p.seNo))
    else w = Math.max(LARGO, larghezzaDi(p.prossimo))
    inCorso.delete(id)
    larghezze.set(id, w)
    return w
  }

  const nodi = [], archi = []
  const visti = new Set()
  const altezzaDi = (p) => p.tipo === 'attesa' ? (p.sotto ? ALTEZZA.attesaLunga : ALTEZZA.attesa) : (ALTEZZA[p.tipo] || ALTEZZA.altro)

  const posa = (id, cx, y, giorno, daArco) => {
    if (!id || !perId.has(id) || visti.has(id)) {
      // Il ramo finisce qui: un puntino, cosi' si vede che e' una fine voluta.
      const fine = { id: `fine-${nodi.length}`, tipo: 'fine', x: cx, y, w: 0, h: ALTEZZA.fine }
      nodi.push(fine)
      if (daArco) archi.push({ ...daArco, a: { x: cx, y } })
      return
    }
    visti.add(id)
    const p = perId.get(id)
    const w = p.tipo === 'attesa' ? STRETTO : LARGO
    const h = altezzaDi(p)
    const nodo = { ...p, x: cx, y, w, h, giorno: p.tipo === 'email' || p.tipo === 'messaggio' ? giorno : null }
    nodi.push(nodo)
    if (daArco) archi.push({ ...daArco, a: { x: cx, y } })
    const sotto = y + h
    const giornoDopo = giorno + (p.tipo === 'attesa' ? (p.giorni || 0) : 0)
    if (p.tipo === 'bivio') {
      const wSi = larghezzaDi(p.seSi), wNo = larghezzaDi(p.seNo)
      const tot = wSi + SPAZIO_X + wNo
      const xSi = cx - tot / 2 + wSi / 2, xNo = cx + tot / 2 - wNo / 2
      const yRami = sotto + SPAZIO_Y + 26
      posa(p.seSi, xSi, yRami, giornoDopo, { da: { x: cx, y: sotto }, ramo: 'si' })
      posa(p.seNo, xNo, yRami, giornoDopo, { da: { x: cx, y: sotto }, ramo: 'no' })
    } else {
      posa(p.prossimo, cx, sotto + SPAZIO_Y, giornoDopo, { da: { x: cx, y: sotto }, ramo: null })
    }
  }

  // L'innesco non e' un passo della definizione: lo mettiamo in cima.
  const innesco = { id: 'innesco', tipo: 'innesco', x: 0, y: 0, w: LARGO, h: ALTEZZA.innesco, ...dati.innesco }
  nodi.push(innesco)
  posa(dati.ingresso, 0, ALTEZZA.innesco + SPAZIO_Y, 0, { da: { x: 0, y: ALTEZZA.innesco }, ramo: null })

  const minX = Math.min(...nodi.map(n => n.x - Math.max(n.w, 40) / 2)), maxX = Math.max(...nodi.map(n => n.x + Math.max(n.w, 40) / 2))
  const maxY = Math.max(...nodi.map(n => n.y + n.h))
  return { nodi, archi, limiti: { minX, maxX, minY: 0, maxY, w: maxX - minX, h: maxY } }
}

// Il tratto che unisce due passi: dritto, oppure a gomito quando apre un ramo.
function tracciato(arco) {
  const { da, a } = arco
  if (Math.abs(da.x - a.x) < 1) return `M ${da.x} ${da.y} L ${a.x} ${a.y}`
  const yMezzo = da.y + 30, r = 12, verso = a.x > da.x ? 1 : -1
  return `M ${da.x} ${da.y} L ${da.x} ${yMezzo - r} Q ${da.x} ${yMezzo} ${da.x + r * verso} ${yMezzo} L ${a.x - r * verso} ${yMezzo} Q ${a.x} ${yMezzo} ${a.x} ${yMezzo + r} L ${a.x} ${a.y}`
}

const giornoLabel = (g, tr) => {
  // Giorni interi trascorsi dall'ingresso nel flusso: due ore dopo e' ancora
  // il giorno 0, come lo conta Klaviyo.
  const n = Math.floor(g + 1e-9)
  return tr('klaviyo.flowDay', { n }, `Giorno ${n}`)
}

export default function FlussoLavagna({ flusso, giorni = 30, tr, onClose, onApriEmail }) {
  const [montato, setMontato] = useState(false)
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState(null)
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 })
  const telaRef = useRef(null)
  const trascina = useRef(null)

  useEffect(() => { setMontato(true) }, [])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!flusso?.id) return
    let annullato = false
    setDati(null); setErrore(null)
    fetch(`/api/klaviyo/flusso?id=${encodeURIComponent(flusso.id)}&days=${giorni}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (annullato) return; if (!j?.ok) setErrore(j?.error || 'Klaviyo'); else setDati(j) })
      .catch(e => { if (!annullato) setErrore(e?.message || 'Errore di rete') })
    return () => { annullato = true }
  }, [flusso?.id, giorni])

  const piano = useMemo(() => (dati ? disponi(dati) : null), [dati])

  // Adatta la mappa allo schermo: tutta visibile se ci sta, altrimenti parte
  // dall'alto a grandezza leggibile (un flusso lungo rimpicciolito a formica
  // non si legge comunque).
  const adatta = useCallback(() => {
    const tela = telaRef.current
    if (!tela || !piano) return
    const W = tela.clientWidth
    // Si adatta alla LARGHEZZA, non all'altezza: un flusso lungo fatto stare
    // tutto in uno schermo diventa illeggibile. Si parte dall'alto a grandezza
    // leggibile e si scende trascinando.
    const kLargo = (W - 80) / Math.max(piano.limiti.w, 1)
    const k = Math.max(0.8, Math.min(1, kLargo))
    const centroX = (piano.limiti.minX + piano.limiti.maxX) / 2
    setVista({ k, x: W / 2 - centroX * k, y: 40 })
  }, [piano])
  useEffect(() => { adatta() }, [adatta])

  // Zoom attorno a un punto: quello sotto il cursore resta fermo.
  const zoomSu = useCallback((fattore, px, py) => {
    setVista(v => {
      const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * fattore))
      const f = k / v.k
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }
    })
  }, [])
  const zoomCentro = (fattore) => {
    const t = telaRef.current
    if (t) zoomSu(fattore, t.clientWidth / 2, t.clientHeight / 2)
  }

  // La rotella va ascoltata in modo NON passivo, o il browser scorre la pagina
  // sotto invece di ingrandire la mappa.
  useEffect(() => {
    const tela = telaRef.current
    if (!tela) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = tela.getBoundingClientRect()
      zoomSu(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top)
    }
    tela.addEventListener('wheel', onWheel, { passive: false })
    return () => tela.removeEventListener('wheel', onWheel)
  }, [zoomSu, piano])

  const giu = (e) => {
    if (e.target.closest('[data-scheda]') || e.target.closest('[data-comandi]')) return
    trascina.current = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const muovi = (e) => {
    const t = trascina.current
    if (!t) return
    setVista(v => ({ ...v, x: t.vx + (e.clientX - t.x), y: t.vy + (e.clientY - t.y) }))
  }
  const su = () => { trascina.current = null }

  if (!montato) return null

  const STATI = { live: [tr('klaviyo.flowLive', null, 'Attivo'), '#22c55e'], draft: [tr('klaviyo.flowDraft', null, 'Bozza'), '#9ca3af'], manual: [tr('klaviyo.flowManual', null, 'Manuale'), '#f59e0b'] }
  const pillStato = (s) => {
    const [et, col] = STATI[s] || [s, '#9ca3af']
    if (!s) return null
    return <span className="fl-stato"><i style={{ background: col }} />{et}</span>
  }
  const euro = (v) => soldi(v || 0)

  return (
    <div className="fl-velo">
      <div className="fl-testata">
        <div style={{ minWidth: 0 }}>
          <div className="fl-titolo">{flusso?.name || dati?.flusso?.nome || ''}</div>
          <div className="fl-sotto">
            {dati ? (
              <>
                {pillStato(dati.flusso.stato)}
                <span>{tr('klaviyo.flowTotals', { d: dati.periodoGiorni, i: (dati.totali.invii || 0).toLocaleString(localeNumeri(), { useGrouping: 'always' }), o: dati.totali.ordini, e: euro(dati.totali.entrate) },
                  `Ultimi ${dati.periodoGiorni} giorni · ${(dati.totali.invii || 0).toLocaleString(localeNumeri(), { useGrouping: 'always' })} invii · ${dati.totali.ordini} ordini · ${euro(dati.totali.entrate)}`)}</span>
                {dati.avvisoStatistiche && <span style={{ color: '#f59e0b' }}>{dati.avvisoStatistiche}</span>}
              </>
            ) : <span>{tr('klaviyo.flowReadOnly', null, 'Mappa del flusso · sola lettura')}</span>}
          </div>
        </div>
        <button onClick={onClose} aria-label={tr('common.close', null, 'Chiudi')} className="fl-chiudi riga-tocco"><Icon name="close" size={13} /></button>
      </div>

      <div ref={telaRef} className="fl-tela" onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={su}
        style={{ cursor: trascina.current ? 'grabbing' : 'grab' }}>
        {!dati && !errore && <div className="fl-messaggio">{tr('klaviyo.flowLoading', null, 'Leggo il flusso…')}</div>}
        {errore && <div className="fl-messaggio" style={{ color: '#ef4444' }}>{tr('klaviyo.flowError', { e: errore }, `Flusso non disponibile: ${errore}`)}</div>}

        {piano && (
          <div className="fl-piano" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})` }}>
            <svg className="fl-linee" style={{ left: piano.limiti.minX - 40, top: -20, width: piano.limiti.w + 80, height: piano.limiti.h + 60 }}
              viewBox={`${piano.limiti.minX - 40} -20 ${piano.limiti.w + 80} ${piano.limiti.h + 60}`}>
              {piano.archi.map((a, i) => <path key={i} d={tracciato(a)} />)}
            </svg>

            {piano.archi.filter(a => a.ramo).map((a, i) => (
              <span key={`r${i}`} className={`fl-ramo ${a.ramo}`} style={{ left: a.a.x, top: a.da.y + 30 }}>
                {a.ramo === 'si' ? tr('klaviyo.flowYes', null, 'Sì') : tr('klaviyo.flowNo', null, 'No')}
              </span>
            ))}

            {piano.nodi.map(n => {
              const stile = { left: n.x - n.w / 2, top: n.y, width: n.w, minHeight: n.h }
              if (n.tipo === 'fine') return <span key={n.id} className="fl-fine" style={{ left: n.x, top: n.y }} title={tr('klaviyo.flowEnd', null, 'Il ramo finisce qui')} />
              if (n.tipo === 'innesco') return (
                <div key={n.id} data-scheda className="fl-scheda" style={stile}>
                  <div className="fl-riga"><span className="fl-icona scura"><Icon name="bolt" size={14} /></span><b>{tr('klaviyo.flowTrigger', null, 'Innesco')}</b></div>
                  <div className="fl-testo">{n.testo}</div>
                  <div className="fl-etichette">
                    {n.filtriEvento && <em>{tr('klaviyo.flowEventFilters', null, 'Filtri sull’evento')}</em>}
                    {n.filtriProfilo && <em>{tr('klaviyo.flowProfileFilters', null, 'Filtri del profilo')}</em>}
                  </div>
                </div>
              )
              if (n.tipo === 'attesa') return (
                <div key={n.id} data-scheda className="fl-scheda attesa" style={stile}>
                  <div className="fl-riga"><span className="fl-icona"><Icon name="clock" size={14} /></span><b>{n.titolo}</b></div>
                  {n.sotto && <div className="fl-nota">{n.sotto}</div>}
                </div>
              )
              if (n.tipo === 'bivio') return (
                <div key={n.id} data-scheda className="fl-scheda" style={stile}>
                  <div className="fl-riga"><span className="fl-icona"><Icon name="funnel" size={14} /></span><b>{n.titolo}</b></div>
                  <div className="fl-testo">{n.sotto}</div>
                </div>
              )
              if (n.tipo === 'email' || n.tipo === 'messaggio') {
                const apribile = n.tipo === 'email' && n.messaggioId
                return (
                  <div key={n.id} style={{ position: 'absolute', left: stile.left, top: stile.top, width: n.w }}>
                    <button data-scheda className={`fl-scheda email${apribile ? ' apribile' : ''}`} style={{ position: 'relative', left: 0, top: 0, width: '100%', minHeight: n.h }}
                      onClick={() => apribile && onApriEmail({ id: n.messaggioId, flowMessageId: n.messaggioId, name: n.titolo })}
                      title={apribile ? tr('klaviyo.flowOpenEmail', null, 'Apri anteprima e rapporto') : undefined}>
                      <div className="fl-riga"><span className="fl-icona blu"><Icon name="mail" size={14} /></span><b>{n.titolo}</b></div>
                      {n.sotto && <div className="fl-testo">{n.sotto}</div>}
                      <div className="fl-piede">
                        <div className="fl-etichette">{(n.etichette || []).map(e => <em key={e}>{e}</em>)}</div>
                        {pillStato(n.stato)}
                      </div>
                      {!n.statistiche && n.senzaInvii && (
                        <div className="fl-numeri vuoti">{tr('klaviyo.flowNoSends', null, 'Nessun invio nel periodo')}</div>
                      )}
                      {n.statistiche && (
                        <div className="fl-numeri">
                          <span><b>{(n.statistiche.destinatari || 0).toLocaleString(localeNumeri(), { useGrouping: 'always' })}</b>{tr('klaviyo.flowSent', null, 'invii')}</span>
                          <span><b>{n.statistiche.aperturePct ?? '—'}%</b>{tr('klaviyo.flowOpens', null, 'aperture')}</span>
                          <span><b>{n.statistiche.clicPct ?? '—'}%</b>{tr('klaviyo.flowClicks', null, 'clic')}</span>
                          <span><b>{euro(n.statistiche.entrate)}</b>{tr('klaviyo.flowRevenue', null, 'entrate')}</span>
                        </div>
                      )}
                    </button>
                    {n.giorno != null && <div className="fl-giorno"><Icon name="bolt" size={11} /> {giornoLabel(n.giorno, tr)}</div>}
                  </div>
                )
              }
              return (
                <div key={n.id} data-scheda className="fl-scheda" style={stile}>
                  <div className="fl-riga"><span className="fl-icona"><Icon name="gear" size={14} /></span><b>{n.titolo}</b></div>
                </div>
              )
            })}
          </div>
        )}

        <div data-comandi className="fl-comandi">
          <button onClick={() => zoomCentro(1.2)} aria-label={tr('klaviyo.flowZoomIn', null, 'Ingrandisci')}>+</button>
          <span>{Math.round(vista.k * 100)}%</span>
          <button onClick={() => zoomCentro(1 / 1.2)} aria-label={tr('klaviyo.flowZoomOut', null, 'Rimpicciolisci')}>−</button>
          <button onClick={adatta} aria-label={tr('klaviyo.flowFit', null, 'Adatta allo schermo')} title={tr('klaviyo.flowFit', null, 'Adatta allo schermo')} style={{ fontSize: 13 }}>⤢</button>
        </div>
        <div className="fl-aiuto">{tr('klaviyo.flowHint', null, 'Trascina per spostarti · rotella per ingrandire · clic su un’email per anteprima e rapporto')}</div>
      </div>
    </div>
  )
}
