// ============================================================================
//  Ricostruzione dei blocchi prodotto dinamici delle email Klaviyo.
//
//  PERCHE' ESISTE: i template chiamano i blocchi per nome — per esempio
//  `feeds.BestsellerPiuVistiAccessoriAlviero90dd` — ma quei prodotti Klaviyo
//  li sceglie nell'istante dell'invio e non li espone da nessuna API.
//  Verificato: /web-feeds e' vuoto, /product-feeds non esiste, non c'e' alcun
//  endpoint di anteprima del messaggio, e il render del template lascia i
//  blocchi chiusi anche passando un profilo destinatario.
//
//  COSA FA: legge dal NOME del feed il marchio e la categoria, e riempie il
//  blocco con i prodotti piu' venduti di quel marchio/categoria negli ultimi
//  90 giorni, presi dalle vendite vere.
//
//  COSA NON E': non sono i prodotti che il destinatario ha visto. Il feed di
//  Klaviyo ordina anche per articoli piu' VISTI, dato che non abbiamo. Per
//  questo chi chiama deve dichiararlo in pagina: un'anteprima serve a capire
//  com'era fatta l'email, non a certificare cosa vide il singolo cliente.
//
//  MULTI-CLIENTE. Nel fork due cose erano scritte nel codice perche' il negozio
//  era uno solo: la tabella degli alias di marchio e il metafield da cui si
//  legge la categoria di un prodotto. Qui sono DUE IMPOSTAZIONI del cliente
//  (vedi supabase/klaviyo_feed.sql), e se sono vuote — come lo sono di serie
//  per tutti — non si applica nessun alias e non si filtra per categoria: il
//  blocco si riempie col marchio soltanto, che e' esattamente il comportamento
//  prudente. Meglio un blocco vuoto che un blocco pieno dei prodotti sbagliati
//  spacciati per l'email vera.
// ============================================================================

import { getShopify, getTenantInfo } from '../tenant/credentials'
import { getAdminSupabase } from '../supabase/server'
import { shopifyql } from '../shopify/shopifyql'

// Parole del nome che non sono ne' marchi ne' categorie: servono a capire se
// e' rimasto un marchio NON riconosciuto, nel qual caso il blocco si salta.
const RUMORE = ['bestseller', 'bestsellers', 'piuvisti', 'piu', 'visti', 'nuovi', 'novita',
  'feed', 'prodotti', 'products', 'top', 'giorni', 'days', 'dd', 'gg', 'ultimi', 'consigliati']

const GIORNI = 90
const PER_BLOCCO = 8
const VITA_IMPOSTAZIONI_MS = 5 * 60_000

const soldi = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0 }
const normalizza = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const prezzo = (n) => `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const impostazioniCache = new Map()
const IMPOSTAZIONI_VUOTE = { alias: {}, metafield: null }

// Le due impostazioni del cliente. Se le colonne non ci sono ancora, o il
// cliente non ha risposto, si torna "non configurato" e il resto continua a
// funzionare: nessun alias e nessuna categoria non sono un errore, sono il
// comportamento predefinito.
async function impostazioni() {
  const ws = getTenantInfo().userId
  if (!ws) return IMPOSTAZIONI_VUOTE
  const hit = impostazioniCache.get(ws)
  if (hit && hit.scade > Date.now()) return hit.valore

  const admin = getAdminSupabase()
  if (!admin) return IMPOSTAZIONI_VUOTE
  try {
    // Supabase non lancia: se la colonna manca torna `data` nullo e si finisce
    // sulle impostazioni vuote — che e' quello che vogliamo.
    const { data } = await admin
      .from('companies')
      .select('klaviyo_alias_marchi, metafield_categoria')
      .eq('user_id', ws)
      .maybeSingle()

    // { "alviero": "1ª CLASSE" } → chiavi normalizzate, valori ripuliti.
    const alias = {}
    const grezzo = data?.klaviyo_alias_marchi
    if (grezzo && typeof grezzo === 'object' && !Array.isArray(grezzo)) {
      for (const [a, v] of Object.entries(grezzo)) {
        const k = normalizza(a)
        if (k && typeof v === 'string' && v.trim()) alias[k] = v.trim()
      }
    }

    // "pdp.categoria" → { namespace, key }. Il valore finisce dentro una query
    // GraphQL, quindi si accetta solo cio' che Shopify ammette come nome di
    // metafield: niente virgolette, niente parentesi, niente sorprese.
    let metafield = null
    const pezzi = String(data?.metafield_categoria || '').trim().split('.')
    const legale = (x) => /^[A-Za-z0-9_-]+$/.test(x || '')
    if (pezzi.length === 2 && legale(pezzi[0]) && legale(pezzi[1])) {
      metafield = { namespace: pezzi[0], key: pezzi[1] }
    }

    const valore = { alias, metafield }
    impostazioniCache.set(ws, { valore, scade: Date.now() + VITA_IMPOSTAZIONI_MS })
    return valore
  } catch { return IMPOSTAZIONI_VUOTE }
}

async function gql(query, variables) {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return null
  try {
    const res = await fetch(`https://${storeUrl}/admin/api/2026-04/graphql.json`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    const j = await res.json().catch(() => null)
    if (j?.errors?.length) return null
    return j?.data || null
  } catch { return null }
}

async function shopifyQL(q) {
  // Porta unica: qui non c'era alcun ritento. Il feed gira da cron: e' lavoro di sottofondo.
  try { return await shopifyql(q, { sfondo: true }) } catch { return [] }
}

/**
 * Prodotti per i blocchi richiesti.
 * @param {string[]} nomi  nomi dei feed presenti nel template
 * @returns {{feeds: Record<string, object[]>, ricostruiti: string[]}}
 */
export async function ricostruisciFeed(nomi) {
  const vuoto = { feeds: {}, ricostruiti: [] }
  if (!nomi?.length) return vuoto

  const { alias: ALIAS_MARCHIO, metafield: MF_CATEGORIA } = await impostazioni()
  // Il pezzo di query che legge la categoria. Senza impostazione non si chiede
  // nulla a Shopify: la categoria resta vuota per tutti e il filtro non scatta.
  const campoCategoria = MF_CATEGORIA
    ? `categoria: metafield(namespace:"${MF_CATEGORIA.namespace}", key:"${MF_CATEGORIA.key}"){ value }`
    : ''

  const da = new Date(Date.now() - GIORNI * 86400000).toISOString().slice(0, 10)
  const a = new Date().toISOString().slice(0, 10)

  // Piu' venduti del periodo: e' la parte "bestseller" del nome del feed.
  const vendite = await shopifyQL(
    `FROM sales SHOW total_sales, net_items_sold GROUP BY product_id, product_vendor SINCE ${da} UNTIL ${a} ORDER BY total_sales DESC LIMIT 250`
  )
  if (!vendite.length) return vuoto

  const ids = vendite.map(v => String(v.product_id || '')).filter(Boolean).slice(0, 120)
  if (!ids.length) return vuoto

  const dati = await gql(
    `query N($ids:[ID!]!){ shop { primaryDomain { url } } nodes(ids:$ids){ ... on Product {
      id title handle vendor status
      ${campoCategoria}
      featuredImage { url }
      variants(first: 1) { edges { node { price compareAtPrice } } }
    } } }`,
    { ids: ids.map(i => `gid://shopify/Product/${i}`) }
  )
  if (!dati) return vuoto

  const dominio = String(dati.shop?.primaryDomain?.url || '').replace(/\/$/, '')
  const perId = new Map()
  for (const n of (dati.nodes || [])) {
    if (!n?.id) continue
    const v = n.variants?.edges?.[0]?.node || {}
    perId.set(n.id.split('/').pop(), {
      titolo: n.title,
      vendor: n.vendor || '',
      categoria: (n.categoria?.value || '').trim(),
      immagine: n.featuredImage?.url || null,
      url: n.handle && dominio ? `${dominio}/products/${n.handle}` : null,
      prezzo: soldi(v.price),
      prezzoPieno: soldi(v.compareAtPrice) || soldi(v.price),
      attivo: n.status === 'ACTIVE',
    })
  }

  // Classifica: l'ordine delle vendite, con i dettagli del catalogo attaccati.
  const classifica = []
  for (const v of vendite) {
    const p = perId.get(String(v.product_id || ''))
    // Senza immagine il blocco resterebbe con un buco: peggio che ometterlo.
    if (!p || !p.immagine || !p.attivo) continue
    classifica.push(p)
  }

  // I marchi si prendono da TUTTE le vendite, non dai soli prodotti rimasti
  // dopo i filtri: altrimenti un marchio i cui articoli sono esauriti o senza
  // foto risulta sconosciuto, il nome del feed non lo riconosce e il blocco
  // finisce riempito con altri marchi. E' successo: un blocco intitolato a un
  // marchio mostrava i tre marchi concorrenti.
  const marchi = [...new Set(vendite.map(v => String(v.product_vendor || '').trim()).filter(Boolean))]
  const categorie = [...new Set([...perId.values()].map(p => p.categoria).filter(Boolean))]
  const chiaviAlias = Object.keys(ALIAS_MARCHIO)

  const feeds = {}
  const ricostruiti = []
  for (const nome of nomi) {
    const chiave = normalizza(nome)
    // Il marchio si riconosce dalla parola piu' lunga del vendor: "Alviero"
    // dentro "ALVIERO MARTINI 1A CLASSE". Sotto i 4 caratteri si rischiano
    // accoppiamenti casuali.
    let marchio = marchi.find(m => {
      const parole = String(m).split(/\s+/).map(normalizza).filter(x => x.length >= 4)
      return parole.some(x => chiave.includes(x))
    }) || null
    if (!marchio && chiaviAlias.length) {
      // Gli alias servono quando il nome del feed usa il marchio commerciale e
      // il catalogo ne usa un altro (su un negozio "Alviero" aveva vendor
      // "1ª CLASSE"). Vuoto di serie: senza alias il feed si aggancia solo per
      // nome, che e' il comportamento prudente.
      const a = chiaviAlias.find(x => chiave.includes(x))
      // Confronto NORMALIZZATO: ShopifyQL restituisce "1ª CLASSE", il
      // catalogo "1ª Classe". Con l'uguaglianza letterale l'alias non
      // agganciava e il blocco restava vuoto.
      if (a) {
        const cercato = normalizza(ALIAS_MARCHIO[a])
        marchio = marchi.find(m => normalizza(m) === cercato) || ALIAS_MARCHIO[a]
      }
    }
    const categoria = categorie.find(c => normalizza(c).length >= 4 && chiave.includes(normalizza(c))) || null
    if (!marchio && !categoria) continue

    // Se nel nome resta una parola che non e' rumore, non e' la categoria e
    // non e' il marchio riconosciuto, allora un marchio c'e' ma non lo
    // sappiamo leggere: meglio lasciare il blocco vuoto che mostrare articoli
    // di un'altra marca facendoli passare per l'email vera.
    if (!marchio) {
      let resto = chiave
      for (const parola of [...RUMORE, normalizza(categoria)]) {
        if (parola) resto = resto.split(parola).join('')
      }
      resto = resto.replace(/[0-9]/g, '')
      if (resto.length >= 5) continue
    }

    // Anche qui il confronto e' normalizzato: le due fonti scrivono lo stesso
    // marchio con maiuscole diverse.
    const marchioN = marchio ? normalizza(marchio) : null
    const categoriaN = categoria ? normalizza(categoria) : null
    let scelti = classifica.filter(p =>
      (!marchioN || normalizza(p.vendor) === marchioN) &&
      (!categoriaN || normalizza(p.categoria) === categoriaN)
    ).slice(0, PER_BLOCCO)

    // Il marchio e' vincolante: se non ha prodotti adatti il blocco resta
    // vuoto. Riempirlo con un altro marchio sarebbe peggio del vuoto, perche'
    // sembrerebbe l'email vera. Prima pero' si guarda oltre i best seller:
    // il marchio potrebbe semplicemente non aver venduto in questi 90 giorni.
    if (!scelti.length && marchio) {
      const filtro = [`vendor:'${marchio.replace(/'/g, '')}'`, 'status:active'].join(' AND ')
      const extra = await gql(
        `query P($q:String!){ products(first: 30, query:$q, sortKey: UPDATED_AT, reverse: true) { edges { node {
          title handle vendor
          ${campoCategoria}
          featuredImage { url }
          variants(first: 1) { edges { node { price compareAtPrice } } }
        } } } }`, { q: filtro })
      const candidati = (extra?.products?.edges || []).map(({ node: n }) => {
        const v = n.variants?.edges?.[0]?.node || {}
        return {
          titolo: n.title, vendor: n.vendor || '', categoria: (n.categoria?.value || '').trim(),
          immagine: n.featuredImage?.url || null,
          url: n.handle && dominio ? `${dominio}/products/${n.handle}` : null,
          prezzo: soldi(v.price), prezzoPieno: soldi(v.compareAtPrice) || soldi(v.price), attivo: true,
        }
      }).filter(p => p.immagine)
      scelti = candidati.filter(p => !categoriaN || normalizza(p.categoria) === categoriaN).slice(0, PER_BLOCCO)
    }
    if (!scelti.length) continue

    feeds[nome] = scelti.map(p => ({
      title: p.titolo,
      image_full_url: p.immagine,
      url: p.url || '#',
      price: prezzo(p.prezzo),
      regular_price: prezzo(p.prezzoPieno),
      // Alcuni template stampano anche questi: meglio presenti e coerenti.
      brand: p.vendor,
      inventory_quantity: 1,
    }))
    ricostruiti.push(nome)
  }
  return { feeds, ricostruiti }
}
