// Wrapper SWR (stale-while-revalidate) sopra la cache L2 (tab_snapshots).
//
// Obiettivo: rendere ogni tab analitica istantanea dopo il primo calcolo, per
// OGNI account (la cache è per workspace_id → multi-tenant per costruzione).
//
// Comportamento per una GET:
//  - nessun workspace (utente non loggato) → calcolo live, nessuna cache.
//  - snapshot fresco (età < ttl)           → ritorno immediato, zero ricalcolo.
//  - snapshot scaduto (stale)              → ritorno SUBITO lo stale e rinfresco
//                                            in background (waitUntil) → la prossima
//                                            apertura è fresca. Niente spinner.
//  - nessuno snapshot / ?refresh=1         → calcolo inline + salvo.
//
// `?fresco=1` o intestazione `x-lyft-fresco: 1` (i PDF, che non hanno un "dopo" in cui rinfrescare): uno
// snapshot si serve SOLO se e' fresco e salvato oggi; altrimenti si ricalcola
// subito. Uno stale in un documento e' un numero vecchio stampato come di oggi.
//
// La chiave include i parametri di "vista" (periodo, account, ecc.) così non si
// serve mai un periodo per un altro. I payload di errore non vengono cachati
// (compute deve ritornare { __noCache: true, ... }).

import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getEffectiveTenantId } from '../tenant/credentials'
import { getSnapshotStale, setSnapshot } from './snapshot'
import { FUSO_PREDEFINITO } from '../periodi'

const DEFAULT_TTL = 30 * 60 * 1000 // 30 min

// Oltre questa soglia lo snapshot non si serve piu', nemmeno come stale: si
// ricalcola e basta. Il rinfresco in background e' best-effort e i suoi errori
// sono muti — se fallisce sempre (o se cambia il SIGNIFICATO di un campo e
// nessuno se ne accorge), senza questo tetto si continua a mostrare per
// settimane un numero vecchio con l'aria di essere quello di oggi. Trovato
// il 10 set 2026: la tab email serviva ancora uno snapshot del 1 agosto.
const MAX_STALE_MS = 24 * 60 * 60 * 1000 // 24 ore

// Il giorno di calendario del NEGOZIO di un istante: i periodi dell'app sono giorni del negozio,
// non giorni UTC. Stesso fuso di lib/periodi.js (oggiNegozio), da cambiare li' e non qui.
const giornoNegozio = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_PREDEFINITO }).format(new Date(ms))

// Uno snapshot salvato quando l'ultimo giorno del periodo (`until`) NON era
// ancora finito descrive un periodo a meta'. Finche' il periodo e' aperto e'
// quello che si vede adesso; appena si chiude non vale piu' — ne' come fresco
// ne' come stale. Trovato il 21 set 2026: il PDF "settimana scorsa" di lunedi'
// mattina ha stampato 2.687 € di spesa Google, cioe' la settimana 14-20 come
// era domenica alle 17 (snapshot di un report di domenica pomeriggio, servito
// lunedi' come stale). A settimana chiusa erano 3.025 €.
function periodoChiusoDopo(url, snap) {
  const until = url.searchParams.get('until')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until || '')) return false
  if (giornoNegozio(Date.now()) <= until) return false            // il periodo e' ancora aperto
  return giornoNegozio(Date.now() - snap.ageMs) <= until           // salvato prima che finisse
}

// Parametri che definiscono la "vista" → entrano nella chiave di cache.
const KEY_PARAMS = [
  'preset', 'since', 'until', 'months', 'days', 'range', 'window',
  'account', 'account_id', 'accountId', 'customer', 'customerId',
  'property', 'propertyId', 'metric', 'channel', 'status', 'segment', 'flow', 'part',
  'baseline_window', 'site', 'mode', 'type', 'horizon', 'history_days', 'locale',
]

function rangeKey(url) {
  const sp = url.searchParams
  const parts = []
  for (const k of KEY_PARAMS) {
    const v = sp.get(k)
    if (v != null && v !== '') parts.push(`${k}=${v}`)
  }
  return parts.join('&') || 'default'
}

export async function swrSnapshot(req, { tab, ttlMs = DEFAULT_TTL, compute, cacheable = true }) {
  const url = new URL(req.url)
  const force = url.searchParams.get('refresh') === '1' || url.searchParams.get('force') === '1'

  // Chiave cache = TENANT EFFETTIVO (rispetta active_workspace dell'agency).
  // PRIMA usava resolveWorkspace() che legge getCurrentUserId() (= owner) e IGNORA
  // il cookie active_workspace → con l'owner switchato su un cliente la cache veniva
  // letta/scritta sotto la chiave dell'OWNER: primo load = snapshot STMN stale,
  // e il refresh in background corrompeva pure la cache dell'owner coi dati del
  // cliente. getEffectiveTenantId combacia col tenant usato da compute().
  let wsId = null
  try { wsId = await getEffectiveTenantId() } catch {}

  // compute() può segnalare un payload non cachabile (errore) con __noCache:true
  const runCompute = async () => {
    const data = await compute()
    if (data && data.__noCache) { const { __noCache, ...clean } = data; return { data: clean, store: false } }
    return { data: data || {}, store: true }
  }

  // Utente non loggato o vista esplicitamente non cachabile → calcolo live.
  if (!wsId || !cacheable) {
    const { data } = await runCompute()
    return NextResponse.json({ ...data, _cache: { hit: false, stale: false } })
  }

  const cacheTab = `${tab}:${rangeKey(url)}`

  const fresco = url.searchParams.get('fresco') === '1' || req.headers?.get?.('x-lyft-fresco') === '1'
  if (!force) {
    const snap = await getSnapshotStale(wsId, cacheTab)
    const valido = snap && snap.ageMs <= MAX_STALE_MS && !periodoChiusoDopo(url, snap)
      && !(fresco && (snap.ageMs > ttlMs || giornoNegozio(Date.now() - snap.ageMs) !== giornoNegozio(Date.now())))
    if (valido) {
      const stale = snap.ageMs > ttlMs
      if (stale) {
        // Servo lo stale e rinfresco in background: la GET resta velocissima.
        waitUntil((async () => {
          try {
            const { data, store } = await runCompute()
            if (store) await setSnapshot(wsId, cacheTab, data)
          } catch {}
        })())
      }
      return NextResponse.json({ ...snap.payload, _cache: { hit: true, stale, ageMs: snap.ageMs } })
    }
  }

  // Cache miss o refresh forzato → calcolo inline e salvo.
  const { data, store } = await runCompute()
  if (store) { try { await setSnapshot(wsId, cacheTab, data) } catch {} }
  return NextResponse.json({ ...data, _cache: { hit: false, stale: false, refreshed: force } })
}
