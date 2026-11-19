// ============================================================================
//  Di quale cliente e' questa richiesta.
//
//  Il Motore Creativo e' nato per un cliente solo: il workspace stava in una
//  variabile d'ambiente (CE_WORKSPACE_ID) e ogni rotta la leggeva. In un
//  prodotto venduto a piu' clienti il workspace lo decide CHI chiama:
//   · una persona col suo accesso  → il workspace della sua sessione (lo stesso
//     che usano le tab di LyftAI, cambio di cliente dell'agenzia compreso);
//   · un cron autorizzato          → il workspace scritto in ?ws=<uuid>.
//  Chi non e' ne' l'uno ne' l'altro riceve 401 e non tocca nessun dato.
//
//  Il workspace viaggia in un AsyncLocalStorage: le funzioni lo leggono con
//  wsMotore() senza passarselo di mano, e quando il ciclo notturno chiama gli
//  altri passi come funzioni restano tutti sullo stesso cliente.
// ============================================================================
import { AsyncLocalStorage } from 'node:async_hooks'
import { NextResponse } from 'next/server'
import { getEffectiveTenantId, isAuthorizedCron } from '../tenant/credentials'
import { schedaCliente } from './cliente'
import { chiaviDi } from '../studio/chiavi'
import { studioAttivo, STUDIO_SPENTO } from '../studio/attivo'
import { usaChiavePiattaforma } from '../studio/chiaveAI'

const als = globalThis.__motoreAls || (globalThis.__motoreAls = new AsyncLocalStorage())
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Senza workspace si ALZA un errore: una lettura che parte senza sapere di chi
// e' non deve mai ripiegare su "tutti" o su un cliente di riserva.
export function wsMotore() {
  const ws = als.getStore()?.ws
  if (!ws) throw new Error('Motore Creativo: richiesta senza cliente (manca conMotore sulla rotta)')
  return ws
}
// La scheda del cliente (nome, sito, logo, matrice): null fuori da una richiesta.
export const clienteMotore = () => als.getStore()?.cliente || null
// Le chiavi che il cliente ha collegato in Integrazioni (ChatGPT, Higgsfield…). Sono le SUE:
// non c'e' una chiave di riserva della piattaforma, perche' vorrebbe dire far pagare a uno
// il lavoro di un altro. Senza chiave la funzione si ferma e dice cosa collegare.
export const chiaveCliente = (servizio) => als.getStore()?.chiavi?.[servizio] || null

export async function conWorkspace(ws, fn) {
  if (!UUID.test(String(ws || ''))) throw new Error('workspace non valido')
  const [cliente, chiavi] = await Promise.all([schedaCliente(ws), chiaviDi(ws)])
  // Saracino (e chi sta in STUDIO_CHIAVE_PIATTAFORMA) lavora con le chiavi della piattaforma; gli altri solo con le proprie.
  if (usaChiavePiattaforma(ws)) {
    if (!chiavi.openai && process.env.OPENAI_API_KEY) chiavi.openai = { chiave: process.env.OPENAI_API_KEY }
    if (!chiavi.higgsfield && process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_SECRET) chiavi.higgsfield = { id: process.env.HIGGSFIELD_API_KEY, segreto: process.env.HIGGSFIELD_API_SECRET }
  }
  return als.run({ ws, cliente, chiavi }, fn)
}

export function conMotore(handler) {
  return async function rottaMotore(req, ctx) {
    // Chiamata interna (il ciclo che invoca un passo): il cliente e' gia' deciso.
    if (als.getStore()?.ws) return handler(req, ctx)
    let ws = null
    if (isAuthorizedCron(req)) {
      ws = new URL(req.url).searchParams.get('ws')
      if (!UUID.test(String(ws || ''))) return NextResponse.json({ error: 'manca ?ws=<workspace>: un cron deve dire per quale cliente lavora' }, { status: 400 })
    } else {
      try { ws = await getEffectiveTenantId() } catch { ws = null }
    }
    if (!ws) return NextResponse.json({ error: 'devi rientrare' }, { status: 401 })
    if (!studioAttivo(ws)) return NextResponse.json({ error: STUDIO_SPENTO }, { status: 403 })
    return conWorkspace(ws, () => handler(req, ctx))
  }
}
