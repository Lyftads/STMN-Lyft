// ============================================================================
//  La scheda del cliente: cio' che prima era scritto nel codice per Saracino
//  (indirizzo del sito, logo, quale matrice, che cosa vende) e che in un
//  prodotto per piu' clienti deve stare coi dati di ognuno.
//
//  Vive in ce_brand (una riga per workspace), dove gia' stavano tono, termini
//  vietati e formati esclusi. Le colonne nuove arrivano con
//  supabase/motore/migrazione_29_cliente.sql: finche' non c'e', qui si ripiega
//  su cio' che si sa dal collegamento (nome dell'azienda, dominio Shopify) e
//  il resto resta vuoto — nessun cliente riceve mai i valori di un altro.
// ============================================================================
import path from 'node:path'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Client a parte (non lib/motore/db): questo modulo viene caricato PRIMA che
// il cliente della richiesta sia deciso, e db.js dipende da quella decisione.
let _c = null
const base = () => _c || (_c = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))

const CACHE = new Map() // ws → { il, scheda }
const DURATA = 5 * 60 * 1000
const pulisciSito = (x) => { const s = String(x || '').trim().replace(/\/+$/, ''); if (!s) return null; return /^https?:\/\//i.test(s) ? s : `https://${s}` }

export async function schedaCliente(ws) {
  const c = CACHE.get(ws)
  if (c && Date.now() - c.il < DURATA) return c.scheda
  const [brand, azienda] = await Promise.all([
    base().from('ce_brand').select('*').eq('workspace_id', ws).maybeSingle(),
    base().from('companies').select('company_name, shopify_store_url').eq('user_id', ws).maybeSingle(),
  ])
  const b = brand?.data || {}, a = azienda?.data || {}
  const scheda = {
    ws,
    // senza riga in ce_brand il Motore non e' ancora stato acceso per questo cliente
    attivo: !!brand?.data,
    nome: b.nome || a.company_name || null,
    // Il dominio pubblico lo dichiara il cliente; in mancanza vale quello di Shopify, che
    // risponde comunque (reindirizza al dominio vero) e non e' mai il sito di un altro.
    sito: pulisciSito(b.sito) || pulisciSito(a.shopify_store_url),
    logo: b.logo || null,              // URL https oppure nome di un file in assets/motore/logo
    logoScuro: b.logo_scuro || null,
    matrice: b.matrice || null,        // nome dell'insieme in lib/motore/dati (null = nessuna matrice)
    // Una riga su che cosa vende e a chi: entra nei prompt al posto di "un produttore di olio".
    descrizione: b.descrizione || null,
  }
  CACHE.set(ws, { il: Date.now(), scheda })
  return scheda
}
export const dimenticaCliente = (ws) => CACHE.delete(ws)

// Il logo per il compositore: percorso di un file dell'app, oppure i byte scaricati dall'URL.
// null se il cliente non ne ha uno: la creativita' esce senza logo, mai col logo di un altro.
export async function logoDi(valore) {
  if (!valore) return null
  if (/^https:\/\//i.test(valore)) {
    try { const r = await fetch(valore, { signal: AbortSignal.timeout(15000) }); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()) } catch { return null }
  }
  if (!/^[\w.-]+\.(png|webp|svg)$/i.test(valore)) return null
  const f = path.join(process.cwd(), 'assets', 'motore', 'logo', valore)
  return fs.existsSync(f) ? f : null
}
