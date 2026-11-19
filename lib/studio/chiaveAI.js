// ============================================================================
//  Con quale chiave OpenAI lavora il cervello per QUESTA richiesta.
//
//  Regola di Marino (18 nov 2026): Saracino usa la chiave della piattaforma
//  (la sua); tutti gli altri clienti usano la LORO, quella inserita nella tab
//  Integrazioni. Chi non l'ha inserita non riceve una chiave di riserva: il
//  cervello dice di collegare ChatGPT. Altrimenti il consumo di un cliente
//  finirebbe sul conto di un altro senza che nessuno se ne accorga.
//
//  I workspace che possono usare la chiave della piattaforma stanno nella
//  variabile STUDIO_CHIAVE_PIATTAFORMA (id separati da virgola).
//
//  La chiave viaggia in un AsyncLocalStorage: chi chiama OpenAI la legge con
//  chiaveOpenAI() senza sapere di chi e'. Fuori da una richiesta di una persona
//  (i cron della piattaforma) vale la chiave della piattaforma.
// ============================================================================
import { AsyncLocalStorage } from 'node:async_hooks'
import { getEffectiveTenantId } from '../tenant/credentials'
import { chiaviDi } from './chiavi'
import { studioAttivo, STUDIO_SPENTO } from './attivo'

const als = globalThis.__chiaveAiAls || (globalThis.__chiaveAiAls = new AsyncLocalStorage())
const piattaforma = () => process.env.OPENAI_API_KEY || null
export const usaChiavePiattaforma = (ws) => !!ws && String(process.env.STUDIO_CHIAVE_PIATTAFORMA || '').split(',').map(x => x.trim()).filter(Boolean).includes(ws)

export const MANCA_CHIAVE = 'ChatGPT non collegato: inserisci la tua chiave API nella tab Integrazioni'

// Due livelli, perche' dentro LyftAI convivono due cose diverse:
//  · l'assistente che ogni cliente di LyftAI ha gia' (chat, report, raccomandazioni) e' compreso nel piano: se
//    l'azienda non ha inserito una chiave sua, lavora con quella della piattaforma, com'e' sempre stato;
//  · le funzioni Studio che costano molto di piu' (voce in tempo reale, navigazione, Motore Creativo) sono
//    STRETTE: chiave dell'azienda, oppure quella della piattaforma solo per chi sta in STUDIO_CHIAVE_PIATTAFORMA.
export async function chiavePerWorkspace(ws, { stretta = false } = {}) {
  if (!ws) return piattaforma()                       // nessuna persona dietro la richiesta: lavori della piattaforma
  if (usaChiavePiattaforma(ws)) return piattaforma()
  // Non stretta = il cervello che LyftAI ha gia': NON cambia, resta sulla chiave della piattaforma anche se
  // l'azienda ne ha inserita una sua (scelta di Marino, 19 nov 2026: «nel SaaS il cervello attuale lascialo»).
  if (!stretta) return piattaforma()
  return (await chiaviDi(ws)).openai?.chiave || null
}

// La chiave della richiesta in corso. Fuori da conChiaveDelCliente vale quella della piattaforma.
export function chiaveOpenAI() {
  const s = als.getStore()
  return s ? s.chiave : piattaforma()
}

export async function conChiaveDelCliente(fn, { stretta = false, soloStudio = false } = {}) {
  if (als.getStore() && !stretta && !soloStudio) return fn()   // gia' decisa piu' in alto nella stessa richiesta
  let ws = null
  try { ws = await getEffectiveTenantId() } catch {}
  // Le rotte delle sezioni Studio non rispondono dove Studio e' spento (la voce nascosta nel menu non basta).
  if (soloStudio && ws && !studioAttivo(ws)) return Response.json({ errore: STUDIO_SPENTO, error: STUDIO_SPENTO }, { status: 403 })
  return als.run({ ws, chiave: await chiavePerWorkspace(ws, { stretta }) }, fn)
}
