// ============================================================================
//  REGISTRO DELLE MOSSE — il ciclo chiuso: proposta → approvata → eseguita → MISURATA.
//
//  Ogni mossa porta con se' l'effetto PREVISTO (in euro al mese) e, dopo la finestra di
//  misura, l'effetto VERO letto dagli stessi dati che l'avevano fatta nascere. E' il dato
//  che nessun altro ha: non "cosa consiglio", ma "quante volte avevo ragione, e di quanto".
//
//  Sta in tab_snapshots sotto `pilota:registro`, non in una tabella sua: quella tabella c'e'
//  gia' ed e' per workspace_id, quindi il registro nasce separato per cliente senza aspettare
//  nessuna migrazione. Il prezzo e' che il registro di un cliente e' un documento solo — per
//  questo si tiene corto (TIENI) e non ci si scrive dentro a ogni apertura di pagina.
//
//  MULTI-CLIENTE: `ws` e' SEMPRE il tenant effettivo di chi sta guardando (getTenantInfo().userId
//  dentro withTenantContext, oppure il workspace del cron). Senza `ws` non si legge e non si
//  scrive niente: meglio un registro vuoto che le mosse di un altro negozio.
// ============================================================================
import { randomUUID } from 'node:crypto'
import { getSnapshotStale, setSnapshot } from '../cache/snapshot'

const CHIAVE = 'pilota:registro'
const GIORNO = 86_400_000
export const STATI = ['proposta', 'approvata', 'eseguita', 'misurata', 'rifiutata']
export const GIORNI_MISURA = 14          // quanto si aspetta prima di giudicare una mossa
const RIPROPONI_DOPO = 30 * GIORNO        // una mossa rifiutata non torna prima di un mese
const TIENI = 400                         // il registro non cresce all'infinito

export async function leggiRegistro(ws) {
  if (!ws) return { mosse: [] }
  const r = await getSnapshotStale(ws, CHIAVE)
  const mosse = Array.isArray(r?.payload?.mosse) ? r.payload.mosse : []
  return { mosse }
}

export async function scriviRegistro(ws, reg) {
  if (!ws) throw new Error('workspace mancante')
  const mosse = [...reg.mosse].sort((a, b) => String(b.creata).localeCompare(String(a.creata))).slice(0, TIENI)
  await setSnapshot(ws, CHIAVE, { mosse, aggiornato: new Date().toISOString() })
  return { mosse }
}

// Le proposte fresche entrano nel registro senza doppioni: la `chiave` dice "e' la stessa mossa".
//  · gia' proposta  → si aggiornano i numeri (il dato di oggi vale piu' di quello di ieri);
//  · rifiutata da meno di un mese, o in corso (approvata/eseguita non ancora misurata) → non torna;
//  · una proposta che la fonte non genera piu' SPARISCE: il problema si e' risolto da solo.
export function unisci(reg, nuove, fonte, adesso = Date.now()) {
  const mosse = [...reg.mosse]
  const viste = new Set()
  for (const n of nuove) {
    viste.add(n.chiave)
    const stessa = mosse.filter(m => m.chiave === n.chiave)
    const aperta = stessa.find(m => m.stato === 'proposta')
    if (aperta) { Object.assign(aperta, { ...n, id: aperta.id, creata: aperta.creata, stato: 'proposta', aggiornata: new Date(adesso).toISOString() }); continue }
    if (stessa.some(m => m.stato === 'approvata' || m.stato === 'eseguita')) continue
    if (stessa.some(m => m.stato === 'rifiutata' && adesso - Date.parse(m.decisaIl || m.creata) < RIPROPONI_DOPO)) continue
    mosse.push({ id: randomUUID(), creata: new Date(adesso).toISOString(), stato: 'proposta', fonte, ...n })
  }
  return { mosse: mosse.filter(m => !(m.fonte === fonte && m.stato === 'proposta' && !viste.has(m.chiave))) }
}

export function decidi(reg, id, decisione, chi, adesso = Date.now()) {
  const m = reg.mosse.find(x => x.id === id)
  if (!m) throw new Error('mossa non trovata')
  const ora = new Date(adesso).toISOString()
  if (decisione === 'approva') { if (m.stato !== 'proposta') throw new Error('non e\' piu\' una proposta'); Object.assign(m, { stato: 'approvata', decisaIl: ora, decisaDa: chi || null }) }
  else if (decisione === 'rifiuta') { if (m.stato !== 'proposta' && m.stato !== 'approvata') throw new Error('non si puo\' piu\' rifiutare'); Object.assign(m, { stato: 'rifiutata', decisaIl: ora, decisaDa: chi || null }) }
  else if (decisione === 'fatta') {
    if (m.stato !== 'approvata' && m.stato !== 'proposta') throw new Error('gia\' eseguita')
    Object.assign(m, { stato: 'eseguita', decisaIl: m.decisaIl || ora, decisaDa: m.decisaDa || chi || null, eseguitaIl: ora, misuraDal: new Date(adesso + GIORNI_MISURA * GIORNO).toISOString() })
  } else throw new Error('decisione sconosciuta')
  return m
}

// Il bilancio: quante mosse misurate, quante avevano ragione, quanti euro VERI contro i previsti.
export function bilancio(reg) {
  const misurate = reg.mosse.filter(m => m.stato === 'misurata' && m.misura)
  const giuste = misurate.filter(m => m.misura.avevaRagione)
  const somma = (a, f) => Math.round(a.reduce((s, m) => s + (Number(f(m)) || 0), 0))
  return {
    proposte: reg.mosse.filter(m => m.stato === 'proposta').length,
    inCorso: reg.mosse.filter(m => m.stato === 'approvata' || m.stato === 'eseguita').length,
    misurate: misurate.length, giuste: giuste.length,
    precisione: misurate.length ? Math.round((giuste.length / misurate.length) * 100) : null,
    previstoMese: somma(misurate, m => m.previsto?.euroMese), veroMese: somma(misurate, m => m.misura?.euroMese),
    inAttesaMese: somma(reg.mosse.filter(m => m.stato === 'proposta'), m => m.previsto?.euroMese),
  }
}
