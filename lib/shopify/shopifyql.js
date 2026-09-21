// ============================================================================
//  L'UNICA porta verso Shopify Analytics (ShopifyQL).
//
//  MISURATO il 19 set 2026 su un negozio vero (route di prova, poi cancellata):
//    · un'interrogazione, leggera o pesante, dura ~400 ms; 8 insieme passano;
//    · il limite NON e' la contemporaneita' ne' il "costo" GraphQL (2 punti su
//      4000): sono ~30 INTERROGAZIONI AL MINUTO per tutto il negozio — tutte le
//      persone, tutte le istanze del server, i cron;
//    · superato, Shopify risponde 200 con "Rate limited. Please retry later."
//      e riapre solo dopo 40–60 s, quando la finestra e' scorsa.
//  Prima c'erano 41 interrogazioni in 13 file, ognuna col suo ritento (15 s in
//  tutto: MAI abbastanza) o senza; la sola apertura dell'app ne faceva una
//  trentina; /api/metrics non riconosceva "Rate limited" e tornava [] → zeri
//  silenziosi in Dashboard.
//
//  Quindi la cura non e' una coda: e' FARNE MENO e non mostrare mai il rifiuto.
//    1. cache PER INTERROGAZIONE, condivisa fra istanze e persone (tab_snapshots,
//       chiave ql:<hash>): la stessa domanda non si rifa' — 12 h se il periodo e'
//       chiuso da almeno due giorni, 1 h se finisce ieri, 5 min se comprende oggi;
//    2. una sola chiamata in volo per la stessa domanda;
//    3. passo per istanza: mai piu' di PER_MINUTO al minuto, il lavoro di
//       sottofondo (precaricamento, cron) si ferma prima e cede il posto a chi
//       sta guardando;
//    4. se Shopify rifiuta si smette di chiamarlo per un po' (chiamare durante il
//       blocco non serve) e si da' l'ULTIMO DATO BUONO, segnato `stale`; solo se
//       non esiste si aspetta la riapertura, e alla fine si lancia un errore con
//       `limitato = true` — mai un elenco vuoto spacciato per "zero".
//
//  PORTATO SUL SAAS (20 set 2026). Nel fork c'era UN negozio solo; qui sulla
//  stessa istanza ci sono tutti i clienti, ma il limite di Shopify e' PER
//  NEGOZIO. Con un contatore unico il cliente B avrebbe aspettato per le domande
//  fatte dal cliente A, e un rifiuto ricevuto da A avrebbe zittito anche B: il
//  passo, le chiamate in volo e il blocco sono quindi tenuti PER `storeUrl`
//  (vedi `passo()`). La cache, come prima, e' per workspace.
// ============================================================================
import { createHash } from 'crypto'
import * as tenant from '../tenant/credentials'
import { getSnapshotStale, setSnapshot } from '../cache/snapshot'

const GQL = 'query Q($q:String!){ shopifyqlQuery(query:$q){ tableData{ columns{ name dataType displayName } rows } parseErrors } }'
const API = '2026-04'

const PER_MINUTO = 24        // per istanza e per negozio, sotto i ~30 del negozio
const RISERVA_PRIMO_PIANO = 8 // il sottofondo si ferma a PER_MINUTO - RISERVA
const IN_VOLO_MAX = 6
// Una richiesta NON puo' aspettare i 40–60 s della finestra di Shopify: le route su Vercel
// vivono 20–60 s. Si aspetta poco (due tentativi), poi tocca all'ultimo dato buono o all'errore
// dichiarato — e il client riprova da solo (vedi `limitato`).
const BLOCCO_MS = 12_000      // dopo un rifiuto: silenzio, poi si riprova
const ATTESA_MAX = 25_000
// Per i PDF: dopo un rifiuto Shopify riapre in 40–60 s, quindi si aspetta oltre quella finestra.
// Il report ha 180 s in tutto (maxDuration), la stampa ne prende una ventina.
const ATTESA_FRESCO = 70_000

const memoria = new Map()   // chiave → { t, dati }
const inVolo = new Map()    // chiave → Promise
const passi = new Map()     // storeUrl → { partenze, aperte, bloccoFino }
let inciampi = 0            // interrogazioni fallite o servite con l'ultimo dato buono (vedi inciampiShopify)

const attendi = (ms) => new Promise(r => setTimeout(r, ms))
const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())

// Il passo di QUEL negozio: orari delle chiamate vere dell'ultimo minuto, quante
// sono in volo, fino a quando Shopify lo sta rifiutando.
function passo(storeUrl) {
  const k = storeUrl || '(negozio non collegato)'
  let p = passi.get(k)
  if (!p) { p = { partenze: [], aperte: 0, bloccoFino: 0 }; passi.set(k, p) }
  return p
}

// Nel fork il lavoro di sottofondo (precaricamento del client, cron) si riconosceva
// da solo con isSfondo() di credentials.js. Qui quella funzione non c'e' ancora —
// credentials.js e' condiviso e lo tocca chi coordina — quindi finche' non compare il
// sottofondo si dichiara da se': shopifyql(q, { sfondo: true }) nei cron e nel
// precaricamento. Letto dal modulo e non importato per nome, cosi' il giorno in cui
// isSfondo() esiste il riconoscimento automatico riparte senza toccare questo file.
function sottofondoAutomatico() {
  try { return typeof tenant.isSfondo === 'function' ? tenant.isSfondo() === true : false } catch { return false }
}

// Quanto puo' vivere la risposta: dipende da quando FINISCE il periodo chiesto.
export function vitaDi(query) {
  const m = /UNTIL\s+(\d{4}-\d{2}-\d{2})/i.exec(query)
  if (!m) return 5 * 60_000                       // today, now, -30min, DURING…: periodo aperto
  const giorni = Math.round((Date.parse(oggiRoma()) - Date.parse(m[1])) / 86_400_000)
  if (giorni >= 2) return 12 * 3_600_000
  if (giorni === 1) return 3_600_000
  return 5 * 60_000
}

function inOggetti(tabella) {
  const colonne = tabella?.columns || []
  return (tabella?.rows || []).map(riga => {
    if (!Array.isArray(riga)) return riga
    const o = {}
    colonne.forEach((c, i) => { o[c.name || c.displayName || `col_${i}`] = riga[i] })
    return o
  })
}

function segna(righe, stale, etaMs) {
  const out = Array.isArray(righe) ? righe.slice() : []
  Object.defineProperty(out, 'stale', { value: !!stale, enumerable: false })
  Object.defineProperty(out, 'etaMs', { value: etaMs || 0, enumerable: false })
  return out
}

function postoLibero(p, sfondo) {
  const ora = Date.now()
  while (p.partenze.length && ora - p.partenze[0] > 60_000) p.partenze.shift()
  const tetto = sfondo ? PER_MINUTO - RISERVA_PRIMO_PIANO : PER_MINUTO
  return ora >= p.bloccoFino && p.aperte < IN_VOLO_MAX && p.partenze.length < tetto
}

async function chiama(query) {
  const { storeUrl, adminToken } = tenant.getShopify()
  if (!storeUrl || !adminToken) { const e = new Error('Shopify non collegato'); e.nonCollegato = true; throw e }
  const p = passo(storeUrl)
  p.partenze.push(Date.now()); p.aperte++
  try {
    const res = await fetch(`https://${storeUrl}/admin/api/${API}/graphql.json`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20_000),
      headers: { 'X-Shopify-Access-Token': adminToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: GQL, variables: { q: query } }),
    })
    const json = await res.json().catch(() => null)
    const errs = json?.errors || []
    const testo = errs.map(e => e?.message || '').join(' | ')
    if (res.status === 429 || /rate limit|throttl/i.test(testo) || errs.some(e => e?.extensions?.code === 'THROTTLED')) {
      p.bloccoFino = Date.now() + BLOCCO_MS
      const e = new Error(testo || 'Rate limited'); e.limitato = true; throw e
    }
    if (!res.ok || errs.length) throw new Error(testo || `Shopify HTTP ${res.status}`)
    const d = json?.data?.shopifyqlQuery
    if (d?.parseErrors?.length) { const e = new Error(`ShopifyQL: ${typeof d.parseErrors[0] === 'string' ? d.parseErrors[0] : JSON.stringify(d.parseErrors[0])}`); e.sintassi = true; throw e }
    return inOggetti(d?.tableData)
  } finally { p.aperte-- }
}

// Righe come oggetti { colonna: valore }. L'array porta `.stale` (true = ultimo dato
// buono servito perche' Shopify rifiutava) ed `.etaMs`. Lancia sempre in caso di
// errore: decidere che "errore = zero" non spetta a questa porta.
//   ttlMs: 0 → niente cache (tempo reale), restano passo e dedup.
//   soloFresco → mai l'ultimo dato buono oltre la sua vita: si aspetta e, se non va, si lancia.
//                Per i documenti che escono dall'azienda (registro dei corrispettivi).
export async function shopifyql(query, { ttlMs, sfondo, soloFresco: soloFrescoOpz = false, attesaMaxMs: attesaOpz } = {}) {
  const q = String(query || '').trim()
  // Una richiesta FRESCA (un PDF) si comporta come il registro dei corrispettivi:
  // niente ultimo dato buono, si aspetta che si liberi un posto — piu' a lungo,
  // perche' un PDF puo' permettersi dieci secondi in piu' ma non un numero vecchio.
  // Il caso vero (21 set): aprendo la tab l'app aveva appena riempito il passo,
  // e il PDF riceveva la serie di domenica invece di quella di lunedi'.
  let fresco = false
  try { fresco = tenant.isFresco() === true } catch {}
  const soloFresco = soloFrescoOpz || fresco
  const attesaMaxMs = attesaOpz ?? (fresco ? ATTESA_FRESCO : ATTESA_MAX)
  const dietro = sfondo ?? sottofondoAutomatico()
  const vita = ttlMs ?? vitaDi(q)
  const { storeUrl } = tenant.getShopify()
  const ws = tenant.getTenantInfo().userId
  const chiave = 'ql:' + createHash('sha1').update(`${storeUrl}|${q}`).digest('hex')
  const chiaveMem = `${ws}|${chiave}`
  const p = passo(storeUrl)

  if (vita > 0) {
    const m = memoria.get(chiaveMem)
    if (m && Date.now() - m.t < vita) return segna(m.dati, false, Date.now() - m.t)
  }
  if (inVolo.has(chiaveMem)) return inVolo.get(chiaveMem)

  const lavoro = (async () => {
    let vecchio = null
    if (vita > 0 && ws) {
      vecchio = await getSnapshotStale(ws, chiave)
      if (vecchio && vecchio.ageMs < vita && Array.isArray(vecchio.payload?.righe)) {
        memoria.set(chiaveMem, { t: Date.now() - vecchio.ageMs, dati: vecchio.payload.righe })
        return segna(vecchio.payload.righe, false, vecchio.ageMs)
      }
    }
    const ultimoBuono = !soloFresco && Array.isArray(vecchio?.payload?.righe) ? vecchio : null
    const scadenza = Date.now() + attesaMaxMs
    let ultimoErrore = null, altri = 0

    while (Date.now() < scadenza) {
      if (!postoLibero(p, dietro)) {
        // Niente posto (passo pieno o Shopify in blocco): chi ha un dato buono lo usa subito.
        if (ultimoBuono) { inciampi++; return segna(ultimoBuono.payload.righe, true, ultimoBuono.ageMs) }
        await attendi(400 + Math.random() * 600)
        continue
      }
      try {
        const righe = await chiama(q)
        if (vita > 0) {
          memoria.set(chiaveMem, { t: Date.now(), dati: righe })
          if (memoria.size > 400) memoria.delete(memoria.keys().next().value)
          if (ws) setSnapshot(ws, chiave, { righe, q: q.slice(0, 300) })   // senza attendere
        }
        return segna(righe, false, 0)
      } catch (e) {
        if (e.sintassi || e.nonCollegato) throw e
        ultimoErrore = e
        if (ultimoBuono) { inciampi++; return segna(ultimoBuono.payload.righe, true, ultimoBuono.ageMs) }
        if (!e.limitato && ++altri >= 3) break            // errore di rete ripetuto: basta
        if (!e.limitato) await attendi(700 * altri + Math.random() * 400)
        // se limitato: il blocco e' gia' armato, il giro dopo aspetta in postoLibero()
      }
    }
    inciampi++
    const fine = new Error(ultimoErrore?.message || 'Shopify Analytics non risponde')
    fine.limitato = !!ultimoErrore?.limitato || Date.now() < p.bloccoFino
    throw fine
  })()

  inVolo.set(chiaveMem, lavoro)
  try { return await lavoro } finally { inVolo.delete(chiaveMem) }
}

// Quante interrogazioni, su questa istanza, sono finite male o con l'ultimo dato buono.
// La cache delle route (lib/cache/swr.js) puo' leggerlo prima e dopo ogni calcolo: se e'
// salito, quel risultato e' PARZIALE e non va conservato. Diverse route, per storia,
// trasformano l'errore in un elenco vuoto: senza questo controllo uno zero finto
// resterebbe in cache per ore.
export function inciampiShopify() { return inciampi }

// Per le prove e per /api/debug: lo stato del passo su QUESTA istanza, per il negozio
// del tenant corrente (il limite e' suo, non dell'istanza).
export function statoShopifyql() {
  const ora = Date.now()
  const { storeUrl } = tenant.getShopify()
  const p = passo(storeUrl)
  return {
    negozio: storeUrl || null,
    nellUltimoMinuto: p.partenze.filter(t => ora - t <= 60_000).length,
    inVolo: p.aperte,
    bloccatoPerMs: Math.max(0, p.bloccoFino - ora),
    inMemoria: memoria.size,
    negoziSeguiti: passi.size,
  }
}
