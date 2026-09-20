// ============================================================================
//  L'UNICA porta verso i RAPPORTI di Klaviyo (campaign-values-reports e
//  flow-values-reports).
//
//  Sono le chiamate piu' contate di Klaviyo: 1 al secondo, 2 AL MINUTO, 225 al
//  giorno. E il rapporto non si puo' chiedere "per una email": torna sempre
//  TUTTE le campagne (o tutti i messaggi dei flussi) del periodo, e chi chiama
//  tiene la sua riga. Prima ogni apertura del dettaglio di un'email rifaceva
//  quel rapporto intero — dieci email guardate = dieci rapporti identici — e al
//  terzo Klaviyo rispondeva 429 ("Request was throttled. Expected available in
//  15 seconds"): numeri a trattino anche se i dati c'erano. La pagina principale
//  ritentava per 4,5 s in tutto e poi dava null.
//
//  Qui: lo stesso rapporto (stesso tipo, periodo, statistiche, metrica) si chiede
//  UNA volta e vale 30 minuti per tutti — istanze e persone (tab_snapshots,
//  chiave kv:<hash>); una sola chiamata in volo; le chiamate vere partono una
//  alla volta e ad almeno 1,2 s l'una dall'altra; al 429 si rispetta l'attesa che
//  Klaviyo dichiara se e' breve, altrimenti si da' l'ULTIMO RAPPORTO BUONO
//  (`stale`); solo se non esiste torna il 429, con `riprovaTraS`.
//
//  Risposta: { status, body, stale, etaMs, riprovaTraS } — come i vecchi kpost.
//
//  UNA DIFFERENZA RISPETTO AL FORK, dove il cliente era uno solo: qui la fila,
//  il passo fra due chiamate e la chiusura dopo un 429 sono PER CLIENTE. Il
//  limite di Klaviyo e' per ACCOUNT, non per la nostra applicazione: con uno
//  stato unico il cliente B avrebbe aspettato in coda dietro al cliente A senza
//  alcun motivo, e un 429 preso da A avrebbe messo a trattino i numeri di B —
//  che dal suo account non ha bussato nemmeno una volta.
// ============================================================================
import { createHash } from 'crypto'
import { getKlaviyo, getTenantInfo } from '../tenant/credentials'
import { getSnapshotStale, setSnapshot } from '../cache/snapshot'

const BASE = 'https://a.klaviyo.com/api'
const VITA_MS = 30 * 60_000
const PASSO_MS = 1_200
const ATTESA_BREVE_S = 9          // oltre, non si tiene ferma la richiesta

const memoria = new Map()
const inVolo = new Map()

// Lo stato della fila, una per cliente (vedi l'intestazione). Vive quanto
// l'istanza serverless e non custodisce dati: quelli stanno nella memoria e
// nello snapshot, che sono gia' per workspace.
const porte = new Map()
const PORTE_MAX = 200

function porta(ws) {
  let p = porte.get(ws)
  if (p) return p
  p = { fila: Promise.resolve(), ultimaPartenza: 0, chiusoFino: 0 }
  // Un'istanza che servisse centinaia di clienti non deve accumulare all'infinito:
  // si butta la piu' vecchia, al massimo quel cliente ricomincia la fila da zero.
  if (porte.size >= PORTE_MAX) porte.delete(porte.keys().next().value)
  porte.set(ws, p)
  return p
}

const attendi = (ms) => new Promise(r => setTimeout(r, ms))

function intestazioni() {
  const k = getKlaviyo()
  const token = k?.apiKey || ''
  return {
    Authorization: k?.isOAuth ? `Bearer ${token}` : `Klaviyo-API-Key ${token}`,
    accept: 'application/json', 'content-type': 'application/json', revision: '2024-10-15',
  }
}

// Quanti secondi chiede Klaviyo: intestazione Retry-After, o il testo dell'errore.
function attesaDichiarata(res, body) {
  const h = Number(res.headers.get('retry-after'))
  if (h > 0) return Math.ceil(h)
  const m = /available in (\d+) second/i.exec(body?.errors?.[0]?.detail || '')
  return m ? Number(m[1]) : 15
}

// Le chiamate vere: una alla volta, distanziate (il limite "a raffica" e' 1 al secondo).
function inFila(p, fn) {
  const giro = p.fila.then(async () => {
    const manca = Math.max(p.ultimaPartenza + PASSO_MS - Date.now(), p.chiusoFino - Date.now())
    if (manca > 0) await attendi(manca)
    p.ultimaPartenza = Date.now()
    return fn()
  })
  p.fila = giro.catch(() => {})
  return giro
}

async function chiama(percorso, corpo, intest) {
  try {
    const res = await fetch(`${BASE}${percorso}`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(25_000), headers: intest, body: JSON.stringify(corpo) })
    const body = await res.json().catch(() => null)
    return { status: res.status, body, attesaS: res.status === 429 ? attesaDichiarata(res, body) : 0 }
  } catch { return { status: 0, body: null, attesaS: 0 } }
}

export async function rapportoValori(tipo, { statistics, start, end, conversionMetricId, filter }) {
  const flusso = tipo === 'flow'
  const percorso = flusso ? '/flow-values-reports' : '/campaign-values-reports'
  const attributes = { statistics: [...statistics], timeframe: { start, end }, conversion_metric_id: conversionMetricId }
  if (filter) attributes.filter = filter
  const corpo = { data: { type: flusso ? 'flow-values-report' : 'campaign-values-report', attributes } }

  const ws = getTenantInfo().userId
  const chiave = 'kv:' + createHash('sha1').update(JSON.stringify({ tipo, s: [...statistics].sort(), start, end, conversionMetricId, filter: filter || null })).digest('hex')
  // Il workspace entra nella chiave di memoria: due clienti che chiedono lo
  // stesso periodo hanno rapporti DIVERSI. Senza questo, il primo che arriva
  // servirebbe i suoi numeri a tutti.
  const chiaveMem = `${ws}|${chiave}`
  // Fuori da withTenantContext (cron, script) le credenziali vengono dalle env:
  // e' un solo account, e la fila e' quella.
  const p = porta(ws || 'env')

  const m = memoria.get(chiaveMem)
  if (m && Date.now() - m.t < VITA_MS) return { status: 200, body: m.body, stale: false, etaMs: Date.now() - m.t }
  if (inVolo.has(chiaveMem)) return inVolo.get(chiaveMem)

  // Le intestazioni si leggono ORA: in fila si perde il contesto della richiesta.
  // In multi-cliente non e' una comodita' ma una condizione: la chiave di Klaviyo
  // sta nel contesto del tenant, e leggerla dopo l'attesa significherebbe
  // chiedere il rapporto di un cliente con la chiave di un altro.
  const intest = intestazioni()

  const lavoro = (async () => {
    const vecchio = ws ? await getSnapshotStale(ws, chiave) : null
    const buono = vecchio?.payload?.body ? vecchio : null
    if (buono && buono.ageMs < VITA_MS) {
      memoria.set(chiaveMem, { t: Date.now() - buono.ageMs, body: buono.payload.body })
      return { status: 200, body: buono.payload.body, stale: false, etaMs: buono.ageMs }
    }
    // Klaviyo ha gia' detto "aspetta" e c'e' un rapporto buono: inutile bussare.
    if (buono && Date.now() < p.chiusoFino) return { status: 200, body: buono.payload.body, stale: true, etaMs: buono.ageMs }

    let esito = null
    for (let giro = 0; giro < 2; giro++) {
      esito = await inFila(p, () => chiama(percorso, corpo, intest))
      if (esito.status === 200) {
        memoria.set(chiaveMem, { t: Date.now(), body: esito.body })
        if (memoria.size > 60) memoria.delete(memoria.keys().next().value)
        if (ws) setSnapshot(ws, chiave, { body: esito.body })
        return { status: 200, body: esito.body, stale: false, etaMs: 0 }
      }
      if (esito.status !== 429) break
      p.chiusoFino = Date.now() + esito.attesaS * 1000
      if (buono) return { status: 200, body: buono.payload.body, stale: true, etaMs: buono.ageMs }
      if (esito.attesaS > ATTESA_BREVE_S) break     // troppo: si dichiara, il client riprova da solo
      // attesa breve: il giro dopo aspetta in inFila() fino a chiusoFino
    }
    if (buono) return { status: 200, body: buono.payload.body, stale: true, etaMs: buono.ageMs }
    return { status: esito?.status ?? 0, body: esito?.body ?? null, stale: false, etaMs: 0, riprovaTraS: esito?.status === 429 ? Math.max(5, esito.attesaS) : 0 }
  })()

  inVolo.set(chiaveMem, lavoro)
  try { return await lavoro } finally { inVolo.delete(chiaveMem) }
}
