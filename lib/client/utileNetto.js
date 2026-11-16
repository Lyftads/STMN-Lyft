'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { leggi, inMemoria } from '../clientCache'
import { calcolaUtile, serveIlMix } from '../conto/utile'

// ============================================================================
//  L'utile netto del periodo scelto, per la Dashboard e KPI Brain.
//
//  Mette insieme tre cose:
//   · le cifre di Shopify del periodo (/api/utile-netto);
//   · le impostazioni dei costi del Conto economico (le stesse, non una copia);
//   · la spesa pubblicitaria che la pagina ha gia' in mano — piu' quella delle
//     campagne per i negozi fisici, che dalle metriche e' scorporata ma dal
//     conto economico no: e' un costo vero dell'azienda.
//  Il conto lo fa lib/conto/utile.js, identico a quello della tab Conto economico.
// ============================================================================

const CHIAVE_LOCALE = 'lyft_pnl_cfg'   // dove la tab Conto economico tiene le impostazioni appena cambiate
const leggiLocale = () => { try { return localStorage.getItem(CHIAVE_LOCALE) } catch { return null } }

// Le impostazioni dei costi. Prima il server (sono del cliente che si sta
// guardando); la copia nel browser vale solo se e' cambiata DOPO l'apertura
// della pagina, cioe' se qualcuno le ha appena ritoccate nel Conto economico:
// cosi' la modifica si vede subito, senza portarsi dietro quelle di un altro cliente.
function useImpostazioniCosti(sveglia) {
  const [cfg, setCfg] = useState(null)
  const vista = useRef(undefined)
  useEffect(() => {
    let vivo = true
    vista.current = leggiLocale()
    fetch('/api/pnl/config', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (vivo) setCfg(j?.config && typeof j.config === 'object' ? j.config : {}) })
      .catch(() => { if (vivo) setCfg({}) })
    return () => { vivo = false }
  }, [])
  useEffect(() => {
    if (vista.current === undefined) return
    const ora = leggiLocale()
    if (ora && ora !== vista.current) {
      vista.current = ora
      try { setCfg(JSON.parse(ora) || {}) } catch {}
    }
  }, [sveglia])
  return cfg
}

function useDati(url) {
  const [dati, setDati] = useState(() => (url ? inMemoria(url) : null))
  useEffect(() => {
    if (!url) { setDati(null); return }
    let vivo = true
    setDati(inMemoria(url))
    leggi(url, { onUpdate: (j) => { if (vivo) setDati(j) } }).then(j => { if (vivo) setDati(j) }).catch(() => {})
    return () => { vivo = false }
  }, [url])
  return dati
}

const urlUtile = (r, mix) => (r?.since && r?.until ? `/api/utile-netto?since=${r.since}&until=${r.until}${mix ? '&mode=mix' : ''}` : null)
const urlNegozi = (r) => (r?.since && r?.until ? `/api/drive-to-store?since=${r.since}&until=${r.until}` : null)

/**
 * @param range, prevRange   { since, until } del periodo e di quello di confronto
 * @param spesa, spesaPrima  pubblicita' online dei due periodi (la cifra che la pagina mostra)
 * @param marketplace, marketplacePrima  fatturato del marketplace dei due periodi
 * @param confronto          false = niente periodo prima (su «Oggi» il confronto e' a pari ora,
 *                           e l'utile a pari ora non si puo' ricostruire)
 * @param attivo             la scheda e' a schermo: fuori dalle tab che la mostrano non si legge nulla
 * @param sveglia            cambia quando si torna sulla tab: si rileggono le impostazioni dei costi
 */
export function useUtileNetto({ range, prevRange, spesa, spesaPrima, marketplace = 0, marketplacePrima = 0, confronto = true, attivo = true, sveglia }) {
  const cfg = useImpostazioniCosti(sveglia)
  const pronto = attivo && cfg != null
  const mix = pronto && serveIlMix(cfg)
  const ora = useDati(pronto ? urlUtile(range, mix) : null)
  const prima = useDati(pronto && confronto ? urlUtile(prevRange, mix) : null)
  const negozi = useDati(pronto ? urlNegozi(range) : null)
  const negoziPrima = useDati(pronto && confronto ? urlNegozi(prevRange) : null)

  return useMemo(() => {
    const conto = (d, r, ads, dts, mk) => {
      // La risposta deve essere di QUESTO periodo: cambiando periodo, per un attimo
      // in mano c'e' ancora quella di prima.
      if (!d?.vendite || d.range?.since !== r?.since || d.range?.until !== r?.until) return null
      const negoziFisici = dts?.attivo !== false && dts?.range?.since === r.since && dts?.range?.until === r.until ? Number(dts.spesa) || 0 : 0
      const c = calcolaUtile({
        vendite: d.vendite, cogsShopify: d.cogs, cogsRatio: d.cogsRatio, feeReale: d.feeReale, gatewayMix: d.gatewayMix,
        cfg: cfg || {}, ads: (Number(ads) || 0) + negoziFisici, marketplace: mk, since: r.since, until: r.until,
      })
      return c ? { ...c, negoziFisici } : null
    }
    const corrente = pronto ? conto(ora, range, spesa, negozi, marketplace) : null
    const precedente = pronto && confronto ? conto(prima, prevRange, spesaPrima, negoziPrima, marketplacePrima) : null
    return {
      conto: corrente,
      utile: corrente?.utile ?? null,
      pct: corrente?.pct ?? null,
      prima: precedente?.utile ?? null,
      pctPrima: precedente?.pct ?? null,
      nonCollegato: ora?.configured === false,
    }
  }, [pronto, cfg, ora, prima, negozi, negoziPrima, range?.since, range?.until, prevRange?.since, prevRange?.until, spesa, spesaPrima, marketplace, marketplacePrima, confronto])
}
