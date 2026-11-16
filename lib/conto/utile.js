// ============================================================================
//  L'utile netto di un periodo QUALSIASI (oggi, 7 giorni, un mese, date libere).
//
//  E' lo stesso conto della tab Conto economico (PnLTab.jsx, riga «EBIT»), che
//  pero' ragiona a mesi interi. Qui le stesse formule su un intervallo di giorni:
//
//    ricavi netti (senza IVA)
//    − costo dei prodotti
//    − pubblicita'
//    − commissioni di pagamento
//    − commissioni del marketplace
//    − imballo e spedizioni
//    − costi fissi (quelli mensili, ripartiti sui giorni del periodo)
//    = utile netto
//
//  Funzioni pure: niente rete, niente date «di adesso». Chi cambia una formula
//  nel Conto economico deve cambiarla anche qui, o le due cifre si separano.
// ============================================================================

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

const giorniDelMese = (anno, mese0) => new Date(Date.UTC(anno, mese0 + 1, 0)).getUTCDate()

// I costi fissi sono mensili. Su un periodo di giorni se ne prende la quota:
// ogni giorno vale 1/N del suo mese (N = giorni di quel mese). Cosi' un mese
// intero da' esattamente la cifra mensile, come nel Conto economico, e sette
// giorni a cavallo di due mesi pesano ciascuno col mese a cui appartengono.
export function costiFissiNelPeriodo(mensile, since, until) {
  const m = n(mensile)
  if (!m || !since || !until) return 0
  const fine = Date.parse(`${String(until).slice(0, 10)}T00:00:00Z`)
  let t = Date.parse(`${String(since).slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(t) || !Number.isFinite(fine) || fine < t) return 0
  let somma = 0
  for (let giri = 0; t <= fine && giri < 4000; giri++, t += 86_400_000) {
    const d = new Date(t)
    somma += m / giorniDelMese(d.getUTCFullYear(), d.getUTCMonth())
  }
  return somma
}

export const costiFissiMensili = (cfg) => (cfg?.fixedCosts || []).reduce((s, f) => s + n(f?.amount), 0)

/**
 * @param vendite      { netSales, totalSales, orders } del periodo (Shopify, tutti i canali)
 * @param cogsShopify  costo dei prodotti registrato da Shopify nel periodo (null = non letto)
 * @param cogsRatio    ripiego: quota di costo sul netto dai costi prodotto (null = non c'e')
 * @param feeReale     commissioni vere di Shopify Payments nel periodo (null = non disponibili)
 * @param gatewayMix   { mix: { gateway: importo }, total } — quote dei metodi di pagamento
 * @param cfg          impostazioni del Conto economico (companies.pnl_config)
 * @param ads          pubblicita' del periodo, TUTTA (comprese le campagne per i negozi fisici)
 * @param marketplace  fatturato del marketplace nel periodo (per la sua commissione)
 */
export function calcolaUtile({ vendite, cogsShopify = null, cogsRatio = null, feeReale = null, gatewayMix = null, cfg = {}, ads = 0, marketplace = 0, since, until }) {
  if (!vendite) return null
  const net = n(vendite.netSales)
  const base = n(vendite.totalSales)
  const ordini = n(vendite.orders)

  // Costo dei prodotti — stessa precedenza del Conto economico:
  // percentuale impostata a mano → costo vero di Shopify → quota dai costi prodotto.
  const cogsPct = cfg.cogsPct != null && cfg.cogsPct !== '' ? n(cfg.cogsPct) : null
  const cogs = cogsPct != null ? net * (cogsPct / 100)
    : cogsShopify != null ? n(cogsShopify)
    : cogsRatio != null ? net * n(cogsRatio)
    : null
  const margineLordo = cogs != null ? net - cogs : null

  // Commissioni di pagamento: Shopify Payments vere (o stimate sulla sua quota),
  // piu' gli altri metodi con la percentuale impostata, piu' il fisso per ordine.
  const mix = gatewayMix?.mix, totMix = n(gatewayMix?.total)
  let fee
  if (mix && totMix > 0) {
    const eSP = (g) => g === 'shopify_payments'
    const quotaSP = Object.keys(mix).filter(eSP).reduce((a, g) => a + n(mix[g]) / totMix, 0)
    const feeSP = feeReale != null ? n(feeReale) : base * quotaSP * (n(cfg.gatewayPct) / 100)
    let altre = 0
    for (const g of Object.keys(mix)) { if (!eSP(g)) altre += base * (n(mix[g]) / totMix) * (n(cfg.gatewayFees?.[g]) / 100) }
    fee = feeSP + altre + ordini * n(cfg.gatewayFixed)
  } else {
    fee = feeReale != null ? n(feeReale) : (base * n(cfg.gatewayPct) / 100 + ordini * n(cfg.gatewayFixed))
  }

  const imballo = ordini * n(cfg.packagingPerOrder)
  const spedizioni = ordini * n(cfg.shippingPerOrder)
  const pctMarketplace = cfg.marketplaceFeePct != null && cfg.marketplaceFeePct !== '' ? n(cfg.marketplaceFeePct) : 15
  const feeMarketplace = n(marketplace) > 0 ? n(marketplace) * (pctMarketplace / 100) : 0
  const pubblicita = n(ads)
  const fissi = costiFissiNelPeriodo(costiFissiMensili(cfg), since, until)

  const contribuzione = margineLordo != null ? margineLordo - pubblicita - fee - imballo - spedizioni - feeMarketplace : null
  const utile = contribuzione != null ? contribuzione - fissi : null

  return {
    net, cogs, margineLordo, pubblicita, fee, feeMarketplace, pctMarketplace, imballo, spedizioni, fissi,
    contribuzione, utile,
    pct: utile != null && net > 0 ? (utile / net) * 100 : null,
    // Per dirlo a chi guarda, invece di lasciare una cifra che sembra completa:
    cogsMancante: cogsPct == null && net > 0 && !(n(cogs) > 0),   // nessun costo prodotto da nessuna parte
    feeStimata: feeReale == null,
  }
}

// Serve il riparto dei metodi di pagamento solo quando cambia davvero il conto:
// c'e' una percentuale per un metodo esterno, oppure le commissioni di Shopify
// Payments vanno stimate. Leggerlo costa decine di pagine di ordini.
export function serveIlMix(cfg = {}) {
  const esterni = Object.values(cfg.gatewayFees || {}).some(v => n(v) > 0)
  return esterni || n(cfg.gatewayPct) > 0
}
