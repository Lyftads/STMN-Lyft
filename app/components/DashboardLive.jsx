'use client'

import { useEffect, useState } from 'react'
import { leggi, inMemoria } from '../../lib/clientCache'
import { soldi } from '../../lib/client/soldi'
import { miniatura } from '../../lib/client/miniatura'

// ============================================================================
//  Due riquadri della Dashboard "in stile Live View" (19 set 2026).
//
//  Marino: "la Dashboard e' troppo confusionaria, troppe cose. Piu' chiara e minimale, come
//  la Live View di Shopify, con in piu' la spesa di Meta e di Google. I dati non si perdono:
//  quello che esce va in KPI Brain."
//  Qui: il COMPORTAMENTO DEI CLIENTI (sessioni → carrello → check-out → acquisto, dal CRO del
//  periodo scelto) e le VENDITE PER PRODOTTO (i piu' venduti del periodo).
// ============================================================================
const IT = (n) => Number(n || 0).toLocaleString('it-IT', { useGrouping: 'always' })

export function ComportamentoClienti({ since, until, t }) {
  const url = since && until ? `/api/cro?since=${since}&until=${until}` : null
  const [d, setD] = useState(() => (url ? inMemoria(url) : null))
  useEffect(() => {
    if (!url) return
    let vivo = true
    setD(inMemoria(url))
    leggi(url, { onUpdate: (j) => { if (vivo) setD(j) } }).then(j => { if (vivo && j) setD(j) }).catch(() => {})
    return () => { vivo = false }
  }, [url])
  const f = d?.funnel
  const passi = [
    [t('lv.carts', null, 'Aggiunte al carrello'), f?.addToCart],
    [t('lv.checkout', null, 'Al check-out'), f?.checkout],
    [t('lv.purchase', null, 'Acquisto completato'), f?.purchase],
  ]
  const base = f?.sessions > 0 ? f.sessions : null
  return (
    <section className="lv-scheda">
      <h3>{t('lv.behaviour', null, 'Comportamento dei clienti')}</h3>
      <div className="lv-passi">
        {passi.map(([nome, v]) => (
          <div key={nome}>
            <span>{nome}</span>
            <b>{v != null ? IT(v) : '—'}</b>
            <i>{base && v != null ? `${((v / base) * 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })}% ${t('lv.ofSessions', null, 'delle sessioni')}` : ' '}</i>
          </div>
        ))}
      </div>
    </section>
  )
}

export function VenditePerProdotto({ righe = [], t }) {
  const top = (righe || []).filter(r => (r.revenue ?? r.value) > 0).slice(0, 5)
  // Le righe arrivano da Shopify Analytics, che non porta le immagini: si prendono dalla mappa
  // titolo → foto gia' precaricata per KPI Brain (/api/product-images), con le stesse varianti
  // di scrittura del titolo.
  const [foto, setFoto] = useState(() => inMemoria('/api/product-images') || {})
  useEffect(() => { let vivo = true; leggi('/api/product-images').then(m => { if (vivo && m && typeof m === 'object') setFoto(m) }).catch(() => {}); return () => { vivo = false } }, [])
  const fotoDi = (nome) => { const n = String(nome || ''), p = n.replace(/["'"]/g, '').trim(); return foto[n] || foto[n.toLowerCase()] || foto[p] || foto[p.toLowerCase()] || null }
  return (
    <section className="lv-scheda">
      <h3>{t('lv.byProduct', null, 'Vendite per prodotto')}</h3>
      {top.length === 0
        ? <p className="lv-vuoto">{t('lv.noSales', null, 'Nessuna vendita nel periodo.')}</p>
        : <ul className="lv-prodotti">{top.map((r, k) => (
            <li key={k}>
              {(r.image || fotoDi(r.label || r.product)) ? <img src={miniatura(r.image || fotoDi(r.label || r.product), 36)} alt="" loading="lazy" /> : <span className="lv-segnaposto" aria-hidden="true" />}
              <span className="lv-nome">{r.label || r.product}</span>
              <span className="lv-pezzi">{r.quantity ?? r.orders ?? ''}{(r.quantity ?? r.orders) != null ? ' pz' : ''}</span>
              <b>{soldi(r.revenue ?? r.value)}</b>
            </li>
          ))}</ul>}
    </section>
  )
}
