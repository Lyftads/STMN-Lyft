export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getTenantInfo } from '../../../lib/tenant/credentials'
import { shopifyql } from '../../../lib/shopify/shopifyql'
import { whereSenzaCanali } from '../../../lib/shopify/koongo'
import { oggiNegozio, piuGiorni } from '../../../lib/periodi'
import { traiettoria, resaMarginale } from '../../../lib/pilota/traiettoria'
import { proposteDaGoogle } from '../../../lib/pilota/proposte'
import { leggiRegistro, scriviRegistro, unisci, bilancio } from '../../../lib/pilota/registro'
import { chiamaInterna } from '../../../lib/pilota/interne'
import { canaliEsclusiCliente } from '../../../lib/pilota/cliente'
import { getSnapshot, setSnapshot } from '../../../lib/cache/snapshot'

// ============================================================================
//  IL PILOTA — la sala di controllo in una risposta sola:
//    traiettoria del mese (dove si arriva, con la fascia) · resa di un euro in piu' ·
//    le mosse proposte con l'effetto previsto · il bilancio di quelle gia' misurate.
//  La parte pesante (serie giornaliere, verdetti) si conserva 15 minuti; il REGISTRO si legge
//  sempre fresco: approvare una mossa deve vedersi subito, non alla scadenza della cache.
//
//  MULTI-CLIENTE. Due cose che sul fork erano scritte nel codice qui vengono dal cliente:
//   · i canali di vendita da togliere dai conti di efficienza (i marketplace): elenco vuoto =
//     nessun filtro, cioe' il negozio "normale";
//   · le proposte nascono dai verdetti dei prodotti Google. Se quella route non risponde — non
//     esiste ancora, il cliente non ha Google collegato, la finestra e' vuota — il pilota resta
//     SENZA MOSSE, non rotto: traiettoria e resa si mostrano lo stesso.
// ============================================================================
const VITA = 15 * 60_000
const TAB = 'pilota@1'
const num = (v) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0

async function calcola(req, ws) {
  const oggi = oggiNegozio(), da = piuGiorni(oggi, -125)
  // I canali esclusi sono di QUESTO cliente. Senza elenco la WHERE non c'e' proprio: la domanda
  // a Shopify torna quella semplice, e il fatturato e' tutto il fatturato.
  const dove = whereSenzaCanali('', await canaliEsclusiCliente(ws))
  const domanda = ['FROM sales SHOW total_sales', dove, `GROUP BY day SINCE ${da} UNTIL ${oggi} ORDER BY day ASC`].filter(Boolean).join(' ')
  const [vendite, meta, google, gpv] = await Promise.all([
    shopifyql(domanda).catch(e => ({ errore: e.message })),
    chiamaInterna(req, '/api/meta-kpi?preset=last_90d'),
    chiamaInterna(req, '/api/google-kpi?preset=last_90d'),
    // stesso indirizzo che aprono la tab e il precaricamento notturno: cosi' si legge la LORO cache
    chiamaInterna(req, `/api/google-product-verdicts?since=${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}&until=${new Date().toISOString().slice(0, 10)}`),
  ])
  const righe = Array.isArray(vendite) ? vendite : (vendite?.rows || [])
  const fatturato = righe.map(r => ({ data: String(r.day || '').slice(0, 10), valore: num(r.total_sales) })).filter(g => g.data)
  const perData = new Map()
  for (const g of [...(meta?.daily || []), ...(google?.daily || [])]) { if (g?.date) perData.set(g.date, (perData.get(g.date) || 0) + num(g.spend)) }
  const spesa = [...perData].map(([data, valore]) => ({ data, valore })).sort((a, b) => a.data.localeCompare(b.data))
  const errori = [vendite?.errore && `Shopify: ${vendite.errore}`, meta?.error && `Meta: ${meta.error}`, google?.error && `Google: ${google.error}`, gpv?.error && `Prodotti Google: ${gpv.error}`].filter(Boolean)
  // mese scorso intero e stesso tratto del mese scorso: i due confronti che danno senso al numero
  const inizioMese = `${oggi.slice(0, 7)}-01`, fineScorso = piuGiorni(inizioMese, -1), inizioScorso = `${fineScorso.slice(0, 7)}-01`
  const somma = (a, b) => Math.round(fatturato.filter(g => g.data >= a && g.data <= b).reduce((s, g) => s + g.valore, 0))
  const giornoDelMese = Number(oggi.slice(8, 10))
  return {
    traiettoria: fatturato.length >= 28 ? traiettoria({ fatturato, spesa, oggi }) : null,
    resa: resaMarginale(fatturato, spesa, oggi),
    meseScorso: { totale: somma(inizioScorso, fineScorso), stessoTratto: somma(inizioScorso, piuGiorni(inizioScorso, giornoDelMese - 1)), inizio: inizioScorso, fine: fineScorso },
    proposte: gpv?.error ? null : proposteDaGoogle(gpv),
    errori, calcolato: new Date().toISOString(),
  }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const ws = getTenantInfo().userId
    if (!ws) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    const forza = new URL(req.url).searchParams.get('fresco') === '1'
    let pesante = forza ? null : await getSnapshot(ws, TAB, VITA).catch(() => null)
    if (!pesante) {
      pesante = await calcola(req, ws)
      // un calcolo zoppo (una fonte non ha risposto) si mostra ma NON si conserva
      if (!pesante.errori.length && pesante.traiettoria) await setSnapshot(ws, TAB, pesante).catch(() => {})
    }
    let reg = await leggiRegistro(ws)
    if (Array.isArray(pesante.proposte)) {
      const prima = JSON.stringify(reg.mosse)
      reg = unisci(reg, pesante.proposte, 'google-prodotti')
      if (JSON.stringify(reg.mosse) !== prima) reg = await scriviRegistro(ws, reg)
    }
    const ordine = { proposta: 0, approvata: 1, eseguita: 2, misurata: 3, rifiutata: 4 }
    const mosse = [...reg.mosse].sort((a, b) => (ordine[a.stato] - ordine[b.stato]) || ((b.previsto?.euroMese || 0) - (a.previsto?.euroMese || 0)))
    return NextResponse.json({ ok: true, traiettoria: pesante.traiettoria, resa: pesante.resa, meseScorso: pesante.meseScorso, mosse, bilancio: bilancio(reg), errori: pesante.errori, calcolato: pesante.calcolato, ...(pesante.errori.length ? { datiParziali: true } : {}) })
  })
}
