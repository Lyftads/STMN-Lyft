// ============================================================================
//  Calcolo del registro corrispettivi — libreria condivisa.
//
//  La pagina e l'export XLSX chiamano QUESTA funzione. Due implementazioni
//  parallele finirebbero per divergere, e il giorno in cui divergono il
//  commercialista riceve numeri diversi da quelli visti a schermo.
//
//  Le scelte di merito (canali inclusi, paese di spedizione, righe senza
//  paese lasciate in «Da verificare») sono documentate nella route.
// ============================================================================

import { shopifyql } from '../shopify/shopifyql'
import { getShopify } from '../tenant/credentials'
import {
  isoDaNome, aliquotaOrdinaria, perimetroDi, scorpora, nomePaese,
} from './perimetri'

const soldi = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }
const conta = (v) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// ShopifyQL che PROPAGA l'errore. L'helper usato altrove nell'app ritorna un
// elenco vuoto quando la query fallisce: su un registro fiscale "query rotta"
// diventerebbe "nessuna vendita", cioe' un mese a zero consegnato al
// commercialista senza un avviso.
async function shopifyQL(q) {
  // Porta unica, ma `soloFresco`: un registro che va al commercialista non si compila con
  // l'ultimo dato buono. Se Shopify rifiuta si aspetta la riapertura; se non basta, errore.
  return shopifyql(q, { soloFresco: true })
}

// I permessi VERI del token, chiesti a Shopify. Prima la pagina dichiarava
// "manca read_gift_cards" come testo fisso: sarebbe rimasto li' anche dopo
// averlo ottenuto, e un avviso che non sa cosa sta avvisando e' peggio di
// nessun avviso.
async function permessiShopify() {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return []
  try {
    const res = await fetch(`https://${storeUrl}/admin/oauth/access_scopes.json`, {
      headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store',
    })
    if (!res.ok) return []
    const j = await res.json().catch(() => null)
    return (j?.access_scopes || []).map(x => x.handle).filter(Boolean)
  } catch { return [] }
}

// Gift card EMESSE nel periodo. Shopify Analytics le esclude dal totale
// vendite (verificato: il prodotto compare con 2 pezzi e 0 euro di ricavo),
// quindi sarebbero corrispettivo invisibile.
//
// ATTENZIONE, ed e' il motivo per cui qui NON si sommano: la merce pagata con
// una gift card entra normalmente nelle vendite. Aggiungere l'emissione senza
// sottrarre il riscatto tasserebbe due volte la stessa somma. Le date dei
// riscatti richiedono `read_gift_card_transactions`, uno scope diverso da
// `read_gift_cards`. Finche' manca, il registro DICHIARA l'importo invece di
// includerlo a meta'.
// Il paese di un movimento gift card, con la STESSA regola del registro:
// spedizione, e se manca fatturazione.
function paeseOrdine(ordine) {
  const iso = ordine?.shippingAddress?.countryCode || ordine?.billingAddress?.countryCode || null
  return { iso, daFatturazione: !ordine?.shippingAddress?.countryCode && !!ordine?.billingAddress?.countryCode }
}

async function giftCard(periodo, permessi) {
  const vuoto = {
    leggibili: false, riscattiLeggibili: false,
    emesse: 0, riscatti: 0, accrediti: 0, rettifica: 0,
    movimenti: [], perPerimetro: [], nonAttribuiti: 0,
  }
  if (!permessi.includes('read_gift_cards')) return vuoto
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return vuoto
  const conMovimenti = permessi.includes('read_gift_card_transactions')

  const api = async (query) => {
    const res = await fetch(`https://${storeUrl}/admin/api/2026-04/graphql.json`, {
      method: 'POST', cache: 'no-store',
      headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const j = await res.json().catch(() => null)
    if (j?.errors?.length) throw new Error(String(j.errors[0]?.message).slice(0, 160))
    return j?.data
  }

  try {
    // TUTTE le carte, non solo quelle emesse nel mese: un riscatto del mese
    // corrente puo' appartenere a una carta emessa mesi prima — e' il caso
    // reale (200 EUR emessi il 19 luglio, riscattati il 5 settembre).
    const movimentiQL = conMovimenti
      ? 'transactions(first: 50) { edges { node { __typename processedAt amount { amount } } } }'
      : ''
    const dati = await api(`{ giftCards(first: 250) { edges { node {
      createdAt initialValue { amount } balance { amount }
      order { name shippingAddress { countryCode } billingAddress { countryCode } }
      ${movimentiQL}
    } } pageInfo { hasNextPage } } }`)

    const dentro = (g) => g >= periodo.since && g <= periodo.until
    const movimenti = []
    for (const { node: n } of (dati?.giftCards?.edges || [])) {
      const emessa = String(n.createdAt || '').slice(0, 10)
      const { iso, daFatturazione } = paeseOrdine(n.order)
      // L'emissione non e' una transazione: Shopify non la registra fra i
      // movimenti, va presa dalla data di creazione della carta.
      if (dentro(emessa)) {
        movimenti.push({
          giorno: emessa, tipo: 'emissione', importo: soldi(n.initialValue?.amount),
          ordine: n.order?.name || null, iso, daFatturazione,
        })
      }
      for (const { node: t } of (n.transactions?.edges || [])) {
        const g = String(t.processedAt || '').slice(0, 10)
        if (!dentro(g)) continue
        movimenti.push({
          giorno: g,
          tipo: String(t.__typename || '').includes('Debit') ? 'riscatto' : 'accredito',
          importo: Math.abs(soldi(t.amount?.amount)),
          ordine: null, iso: null, daFatturazione: false,
        })
      }
    }

    // Il paese del RISCATTO e' quello dell'ordine in cui la carta e' stata
    // usata, non quello di emissione: la merce pagata con la gift card sta
    // gia' nel registro sotto il suo paese, e la neutralizzazione deve
    // togliere da LI'. Si ritrova cercando, nel giorno del movimento,
    // l'ordine con un pagamento gift card dello stesso importo.
    const daRisolvere = movimenti.filter(m => m.tipo !== 'emissione' && !m.iso)
    const giorni = [...new Set(daRisolvere.map(m => m.giorno))].slice(0, 40)
    for (const giorno of giorni) {
      let ordini = []
      try {
        const d = await api(`{ orders(first: 60, query: "created_at:>=${giorno} AND created_at:<=${giorno}") { edges { node {
          name shippingAddress { countryCode } billingAddress { countryCode }
          transactions(first: 10) { gateway amountSet { shopMoney { amount } } }
        } } } }`)
        ordini = (d?.orders?.edges || []).map(e => e.node)
      } catch { ordini = [] }
      const usati = new Set()
      for (const m of daRisolvere.filter(x => x.giorno === giorno)) {
        const trovato = ordini.find(o => !usati.has(o.name) && (o.transactions || []).some(
          t => /gift/i.test(t.gateway || '') && Math.abs(soldi(t.amountSet?.shopMoney?.amount) - m.importo) < 0.01
        ))
        if (!trovato) continue
        usati.add(trovato.name)
        const { iso, daFatturazione } = paeseOrdine(trovato)
        m.iso = iso; m.daFatturazione = daFatturazione; m.ordine = trovato.name
      }
    }

    // Segno, perimetro e scorporo: l'IVA della gift card si calcola con
    // l'aliquota del paese alla data del movimento, come per le vendite.
    for (const m of movimenti) {
      m.segno = m.tipo === 'riscatto' ? -1 : 1
      m.perimetro = perimetroDi(m.iso)
      m.aliquota = m.perimetro === 'SENZA_PAESE' ? null : aliquotaOrdinaria(m.iso, m.giorno)
      m.paese = nomePaese(m.iso, null)
      const { imponibile, iva } = scorpora(m.importo, m.aliquota)
      m.imponibile = imponibile == null ? null : r2(imponibile * m.segno)
      m.iva = iva == null ? null : r2(iva * m.segno)
      m.effetto = r2(m.importo * m.segno)
    }

    const per = (tipo) => r2(movimenti.filter(m => m.tipo === tipo).reduce((a, m) => a + m.importo, 0))
    const gruppi = new Map()
    for (const m of movimenti) {
      if (!gruppi.has(m.perimetro)) gruppi.set(m.perimetro, { perimetro: m.perimetro, rettifica: 0, imponibile: 0, iva: 0 })
      const g = gruppi.get(m.perimetro)
      g.rettifica = r2(g.rettifica + m.effetto)
      if (m.imponibile != null) { g.imponibile = r2(g.imponibile + m.imponibile); g.iva = r2(g.iva + m.iva) }
    }

    return {
      leggibili: true,
      riscattiLeggibili: conMovimenti,
      troncato: !!dati?.giftCards?.pageInfo?.hasNextPage,
      emesse: per('emissione'), riscatti: per('riscatto'), accrediti: per('accredito'),
      rettifica: r2(movimenti.reduce((a, m) => a + m.effetto, 0)),
      // Quanti movimenti non hanno un paese: restano nel totale del mese ma
      // fuori dai regimi, e vanno dichiarati invece che assegnati a caso.
      nonAttribuiti: movimenti.filter(m => !m.iso).length,
      movimenti: movimenti.sort((a, b) => a.giorno.localeCompare(b.giorno)),
      perPerimetro: [...gruppi.values()].sort((a, b) => Math.abs(b.rettifica) - Math.abs(a.rettifica)),
    }
  } catch (e) {
    return { ...vuoto, leggibili: true, errore: e?.message || 'Errore gift card' }
  }
}

// Il mese richiesto, mai oltre oggi: chiedere giorni futuri a Analytics non
// da' errore, restituisce righe vuote che sembrerebbero giornate senza vendite.
//
// Esportata perche' la route la usa per la CHIAVE DI CACHE: senza un mese
// normalizzato (la richiesta puo' arrivare vuota = mese corrente), a ottobre si
// servirebbe il registro di settembre. Su dati fiscali non e' un fastidio.
export function periodoDelMese(mese) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mese || ''))
  const oggi = new Date()
  const anno = m ? Number(m[1]) : oggi.getFullYear()
  const numero = m ? Number(m[2]) : oggi.getMonth() + 1
  const primo = new Date(Date.UTC(anno, numero - 1, 1))
  const ultimo = new Date(Date.UTC(anno, numero, 0))
  const iso = (d) => d.toISOString().slice(0, 10)
  const oggiISO = iso(oggi)
  const fine = iso(ultimo) > oggiISO ? oggiISO : iso(ultimo)
  return {
    mese: `${anno}-${String(numero).padStart(2, '0')}`,
    since: iso(primo),
    until: fine,
    completo: iso(ultimo) <= oggiISO,
    giorniMese: ultimo.getUTCDate(),
  }
}

// `return_fees` sembra un dettaglio e non lo e': senza, la seconda identita'
// contabile non chiude. Su agosto 2026 mancavano esattamente 42,00 euro.
const METRICHE = 'gross_sales, discounts, returns, net_sales, shipping_charges, taxes, return_fees, total_sales, orders'

export async function calcolaRegistro(mese) {
  const periodo = periodoDelMese(mese)

  // Griglia giorno x paese di spedizione: e' il registro vero e proprio.
  const [righeQL, permessi] = await Promise.all([
    shopifyQL(`FROM sales SHOW ${METRICHE} GROUP BY day, shipping_country, billing_country SINCE ${periodo.since} UNTIL ${periodo.until} LIMIT 5000`),
    permessiShopify(),
  ])
  const gift = await giftCard(periodo, permessi)

  // Totali per canale: informativi, NON un perimetro fiscale. Servono a vedere
  // quanto pesa il marketplace dentro un registro che lo comprende.
  let canali = []
  try {
    const perCanale = await shopifyQL(
      `FROM sales SHOW total_sales, orders GROUP BY sales_channel SINCE ${periodo.since} UNTIL ${periodo.until} LIMIT 50`
    )
    canali = perCanale.map(c => ({
      canale: String(c.sales_channel || 'Online Store'),
      lordo: soldi(c.total_sales),
      ordini: conta(c.orders),
    })).sort((a, b) => b.lordo - a.lordo)
  } catch { canali = [] }

  const righe = []
  let senzaAliquota = 0, lordoDaFatturazione = 0
  for (const q of righeQL) {
    const giorno = String(q.day || '').slice(0, 10)
    if (!giorno) continue
    // Paese di spedizione, con ripiego sulla fatturazione quando manca. Le
    // due dimensioni arrivano dalla STESSA query, quindi non si mescolano due
    // contabilita': e' sempre Analytics, solo un campo diverso della stessa
    // riga. Verificato su agosto 2026: recupera 4.051 EUR su 4.051, cioe'
    // tutto cio' che prima restava senza regime IVA.
    const nomeSpedizione = q.shipping_country == null ? null : String(q.shipping_country).trim() || null
    const nomeFatturazione = q.billing_country == null ? null : String(q.billing_country).trim() || null
    const daFatturazione = !nomeSpedizione && !!nomeFatturazione
    const nomeOriginale = nomeSpedizione || nomeFatturazione
    const iso = isoDaNome(nomeOriginale)
    const perimetro = perimetroDi(iso)
    // ── L'IVA la dice SHOPIFY. Non la ricalcoliamo noi. ──────────────────
    //  Fino al 21 set 2026 questa riga scorporava il lordo con l'aliquota
    //  ORDINARIA del paese (22% per l'Italia). Era una scelta dichiarata nel
    //  glossario, e reggeva finche' il negozio vendeva articoli a un'aliquota
    //  sola. Non regge per un negozio con aliquote diverse per prodotto.
    //
    //  MISURATO il 21 set su 30 giorni di vendite italiane:
    //    Saracino1925 (olio, per lo piu' al 4%)  IVA vera 16.858 EUR,
    //      ricalcolata al 22%: 76.541 EUR  ->  59.683 EUR di troppo, +354%
    //    Anna Virgili (borse, per lo piu' al 22%) IVA vera 4.940 EUR,
    //      ricalcolata: 5.445 EUR  ->  505 EUR di troppo, +10%
    //  Sbagliava anche il negozio "tutto al 22%": spedizioni, vendite OSS e
    //  articoli ad aliquota ridotta non stanno nell'aliquota ordinaria.
    //
    //  L'obiezione che reggeva la vecchia scelta — «le aliquote cambiano nel
    //  tempo, ricostruendo un mese passato serve quella di ALLORA» — e' in
    //  realta' l'argomento piu' forte per leggere Shopify: Shopify ha
    //  registrato l'imposta davvero applicata QUEL giorno, che e' esattamente
    //  il numero che si cerca. Una tabella di aliquote e' una ricostruzione;
    //  questo e' il fatto.
    //
    //  Quando Shopify non da' il dato (colonna assente) si torna allo scorporo
    //  con l'aliquota ordinaria, ma la riga lo DICHIARA in `fonteIva`: chi
    //  firma un registro deve poter distinguere una misura da una stima.
    const lordo = soldi(q.total_sales)
    if (daFatturazione) lordoDaFatturazione = r2(lordoDaFatturazione + lordo)
    // soldi() rende 0 anche per un valore assente: qui serve distinguere
    // «IVA zero» (extra-UE, esente) da «IVA non pervenuta».
    const ivaGrezza = q.taxes == null || String(q.taxes).trim() === '' ? null : soldi(q.taxes)
    // Resta calcolata, ma come CONFRONTO: serve a segnalare uno scostamento,
    // non piu' a produrre il numero.
    const ordinaria = perimetro === 'SENZA_PAESE' ? null : aliquotaOrdinaria(iso, giorno)
    let imponibile, iva, aliquota, fonteIva
    if (ivaGrezza != null) {
      iva = r2(ivaGrezza)
      imponibile = r2(lordo - iva)
      // L'aliquota EFFETTIVA, dedotta dai numeri veri: e' la prova, non l'ipotesi.
      aliquota = imponibile > 0 ? Math.round((iva / imponibile) * 1000) / 10 : (iva === 0 ? 0 : null)
      fonteIva = 'shopify'
    } else {
      ;({ imponibile, iva } = scorpora(lordo, ordinaria))
      aliquota = ordinaria
      fonteIva = ordinaria == null ? 'ignota' : 'ordinaria'
      if (ordinaria == null && perimetro !== 'SENZA_PAESE') senzaAliquota++
    }
    righe.push({
      giorno,
      iso,
      paese: nomePaese(iso, nomeOriginale),
      paeseOriginale: nomeOriginale,
      // Dichiarato riga per riga: un paese dedotto dalla fatturazione non e'
      // l'indirizzo a cui la merce e' andata, e chi firma deve saperlo.
      daFatturazione,
      perimetro,
      aliquota,
      // 'shopify' = imposta registrata da Shopify; 'ordinaria' = scorporata
      // dall'aliquota del paese perche' Shopify non l'ha data; 'ignota' = ne'
      // l'una ne' l'altra. Si mostra: una stima non deve sembrare una misura.
      fonteIva,
      aliquotaOrdinaria: ordinaria,
      lordo,
      imponibile,
      iva,
      vendite: soldi(q.gross_sales),
      sconti: soldi(q.discounts),
      resi: soldi(q.returns),
      netto: soldi(q.net_sales),
      spedizioni: soldi(q.shipping_charges),
      ivaShopify: soldi(q.taxes),
      commissioniReso: soldi(q.return_fees),
      ordini: conta(q.orders),
    })
  }

  // ── Aggregazioni ─────────────────────────────────────────────────────────
  const sommaSu = (elenco) => elenco.reduce((a, r) => ({
    lordo: r2(a.lordo + r.lordo),
    imponibile: r.imponibile == null ? a.imponibile : r2(a.imponibile + r.imponibile),
    iva: r.iva == null ? a.iva : r2(a.iva + r.iva),
    vendite: r2(a.vendite + r.vendite),
    sconti: r2(a.sconti + r.sconti),
    resi: r2(a.resi + r.resi),
    netto: r2(a.netto + r.netto),
    spedizioni: r2(a.spedizioni + r.spedizioni),
    ivaShopify: r2(a.ivaShopify + r.ivaShopify),
    commissioniReso: r2(a.commissioniReso + r.commissioniReso),
    ordini: a.ordini + r.ordini,
    // Quanto lordo non ha un imponibile calcolabile: se e' > 0, i totali di
    // imponibile e IVA sono per forza incompleti e va detto.
    lordoSenzaImponibile: r.imponibile == null ? r2(a.lordoSenzaImponibile + r.lordo) : a.lordoSenzaImponibile,
  }), {
    lordo: 0, imponibile: 0, iva: 0, vendite: 0, sconti: 0, resi: 0,
    netto: 0, spedizioni: 0, ivaShopify: 0, commissioniReso: 0, ordini: 0, lordoSenzaImponibile: 0,
  })

  const raggruppa = (chiave) => {
    const m = new Map()
    for (const r of righe) {
      const k = chiave(r)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    }
    return m
  }

  const perPerimetro = [...raggruppa(r => r.perimetro).entries()].map(([id, elenco]) => ({
    perimetro: id, ...sommaSu(elenco), paesi: new Set(elenco.map(r => r.iso || '—')).size,
  })).sort((a, b) => b.lordo - a.lordo)

  const perPaese = [...raggruppa(r => r.iso || '__senza').entries()].map(([k, elenco]) => ({
    iso: k === '__senza' ? null : k,
    paese: elenco[0].paese,
    perimetro: elenco[0].perimetro,
    // Prima era l'aliquota della PRIMA riga del paese. Con le aliquote lette da
    // Shopify il paese puo' averne piu' d'una (un negozio di alimentari vende al
    // 4, al 10 e al 22 nello stesso giorno), e la prima riga non rappresenta le
    // altre. Qui va quella MEDIA sul paese — imposta totale su imponibile
    // totale: l'unico numero che, moltiplicato per l'imponibile, ridà l'IVA.
    ...(() => {
      const t = sommaSu(elenco)
      // (Qui c'era anche il conto delle aliquote «distinte» delle righe: su Anna
      // Virgili, tutta al 22, ne dava 16 — erano le piccole oscillazioni giorno
      // per giorno dell'aliquota effettiva, 21,3 / 21,8 / 22,0. Misurava il
      // rumore, non le aliquote, e un numero cosi' si legge male. Tolto.)
      return { aliquota: t.imponibile > 0 ? Math.round((t.iva / t.imponibile) * 1000) / 10 : null, ...t }
    })(),
  })).sort((a, b) => b.lordo - a.lordo)

  const perGiorno = [...raggruppa(r => r.giorno).entries()].map(([giorno, elenco]) => ({
    giorno, ...sommaSu(elenco), paesi: elenco.length,
  })).sort((a, b) => a.giorno.localeCompare(b.giorno))

  const totali = sommaSu(righe)

  // ── Quadratura: gli stessi controlli della guida, sui dati veri ──────────
  // Shopify Analytics deve chiudere due identita'. Se non chiudono, il registro
  // non e' consegnabile e il motivo va scritto, non nascosto.
  const TOLLERANZA = 0.02
  const scartoNetto = r2(totali.vendite + totali.sconti + totali.resi - totali.netto)
  const scartoTotale = r2(totali.netto + totali.spedizioni + totali.ivaShopify + totali.commissioniReso - totali.lordo)
  const quadratura = {
    tolleranza: TOLLERANZA,
    nettoAtteso: r2(totali.vendite + totali.sconti + totali.resi),
    nettoRilevato: totali.netto,
    scartoNetto,
    nettoOk: Math.abs(scartoNetto) <= TOLLERANZA,
    totaleAtteso: r2(totali.netto + totali.spedizioni + totali.ivaShopify + totali.commissioniReso),
    totaleRilevato: totali.lordo,
    scartoTotale,
    totaleOk: Math.abs(scartoTotale) <= TOLLERANZA,
  }

  // Corrispettivo fiscale = vendite da report + rettifica gift card.
  // Senza le date dei riscatti la rettifica resta non calcolabile e il
  // corrispettivo coincide col lordo: meglio dichiararlo che stimarlo.
  const rettificaValida = gift.leggibili && gift.riscattiLeggibili
  const corrispettivoFiscale = rettificaValida ? r2(totali.lordo + gift.rettifica) : totali.lordo

  // Totali FISCALI per regime: vendite da report piu' la rettifica gift card
  // dello stesso regime. Le identita' contabili restano calcolate sulle sole
  // righe di Analytics, o non chiuderebbero piu' per l'importo delle gift card.
  const perPerimetroFiscale = perPerimetro.map(p => {
    const g = rettificaValida ? (gift.perPerimetro.find(x => x.perimetro === p.perimetro) || null) : null
    return {
      ...p,
      rettificaGift: g ? g.rettifica : 0,
      corrispettivo: r2(p.lordo + (g ? g.rettifica : 0)),
      imponibileFiscale: p.imponibile == null ? null : r2(p.imponibile + (g ? g.imponibile : 0)),
      ivaFiscale: p.iva == null ? null : r2(p.iva + (g ? g.iva : 0)),
    }
  })

  // Un regime che ha SOLO movimenti gift card (nessuna vendita nel mese) non
  // comparirebbe fra i perimetri, e la sua rettifica sparirebbe dai totali.
  if (rettificaValida) {
    for (const g of gift.perPerimetro) {
      if (perPerimetroFiscale.some(p => p.perimetro === g.perimetro)) continue
      perPerimetroFiscale.push({
        perimetro: g.perimetro, lordo: 0, imponibile: 0, iva: 0, ordini: 0, paesi: 0,
        vendite: 0, sconti: 0, resi: 0, netto: 0, spedizioni: 0, ivaShopify: 0,
        commissioniReso: 0, lordoSenzaImponibile: 0,
        rettificaGift: g.rettifica, corrispettivo: g.rettifica,
        imponibileFiscale: g.imponibile, ivaFiscale: g.iva,
      })
    }
    perPerimetroFiscale.sort((a, b) => b.corrispettivo - a.corrispettivo)
  }

  const senzaPaese = perPerimetro.find(p => p.perimetro === 'SENZA_PAESE') || null

  return {
    ok: true,
    periodo,
    totali,
    quadratura,
    perPerimetro,
    perPaese,
    perGiorno,
    righe,
    canali,
    gift,
    corrispettivoFiscale,
    rettificaValida,
    perPerimetroFiscale,
    qualita: {
      // Quota di lordo senza paese: e' il numero che dice quanto del registro
      // non e' ancora attribuibile a un regime IVA.
      lordoSenzaPaese: senzaPaese ? senzaPaese.lordo : 0,
      quotaSenzaPaesePct: totali.lordo > 0 ? Math.round(((senzaPaese?.lordo || 0) / totali.lordo) * 1000) / 10 : 0,
      ordiniSenzaPaese: senzaPaese ? senzaPaese.ordini : 0,
      // Quanto del mese ha il paese dedotto dalla fatturazione perche' la
      // spedizione mancava: e' corretto, ma non e' un dato di prima scelta.
      lordoDaFatturazione,
      quotaDaFatturazionePct: totali.lordo > 0 ? Math.round((lordoDaFatturazione / totali.lordo) * 1000) / 10 : 0,
      paesiSenzaAliquota: senzaAliquota,
      // Le gift card entrerebbero nel corrispettivo con segno, ma serve lo scope
      // read_gift_cards sul token. Sul negozio dove e' nato il registro non c'era,
      // e li' le carte non si vendevano: i termini valevano zero. Su un altro
      // cliente possono valere molto, per questo il permesso si CHIEDE a Shopify
      // ordine per ordine invece di dichiararlo a mano — quando arriva, l'avviso
      // in pagina sparisce da solo e i movimenti entrano nel conto.
      giftCardLeggibili: permessi.includes('read_gift_cards'),
      giftCardRiscattiLeggibili: permessi.includes('read_gift_card_transactions'),
      ordiniStoriciCompleti: permessi.includes('read_all_orders'),
      permessiLetti: permessi.length,
      meseCompleto: periodo.completo,
    },
    updatedAt: new Date().toISOString(),
  }
}
