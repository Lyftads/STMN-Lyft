// ============================================================================
//  Il ponte verso la Squadra agent del cliente.
//
//  Ogni cliente ha il SUO servizio (i dati di due aziende non stanno mai nello
//  stesso processo). Il prodotto sa dove risponde quello del workspace della
//  richiesta (tabella studio_squadre) e gli parla da server a server con la
//  chiave della sua pagina. Il browser vede solo /api/squadra/*.
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { resolveWorkspace } from '../team/workspace'
import { studioAttivo, STUDIO_SPENTO } from '../studio/attivo'

let _c = null
const db = () => _c || (_c = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))

export class ErroreSquadra extends Error { constructor(messaggio, stato = 500, codice = 'errore') { super(messaggio); this.stato = stato; this.codice = codice } }

// Chi chiama e per quale workspace: la stessa risoluzione delle altre tab (agenzia e membri compresi).
export async function chiChiama() {
  const chi = await resolveWorkspace().catch(() => null)
  if (!chi?.workspaceId) throw new ErroreSquadra('devi rientrare', 401, 'accesso')
  if (!studioAttivo(chi.workspaceId)) throw new ErroreSquadra(STUDIO_SPENTO, 403, 'studio_spento')
  return chi
}

export async function servizioDi(ws) {
  let { data, error } = await db().from('studio_squadre').select('url, chiave, attiva, stato').eq('workspace_id', ws).maybeSingle()
  // prima della colonna «stato» (supabase/studio/03_…sql) vale solo l'interruttore
  if (error) ({ data, error } = await db().from('studio_squadre').select('url, chiave, attiva').eq('workspace_id', ws).maybeSingle())
  // Tabella non ancora creata o nessuna riga: per chi usa il prodotto e' la stessa cosa, "non c'e' una squadra".
  if (error || !data || !data.attiva || !data.url || !data.chiave || (data.stato && data.stato !== 'attiva')) throw new ErroreSquadra('questo cliente non ha ancora una squadra', 404, 'senza_squadra')
  const url = String(data.url || '').replace(/\/+$/, '')
  // in sviluppo si puo' provare con un servizio acceso su questo computer
  const locale = process.env.NODE_ENV !== 'production' && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(url)
  if ((!locale && !/^https:\/\/[a-z0-9.-]+$/i.test(url)) || !/^[0-9a-f]{16,64}$/i.test(data.chiave || '')) throw new ErroreSquadra('collegamento della squadra scritto male', 500, 'configurazione')
  return { url, chiave: data.chiave }
}

// Chiamata al servizio del cliente. `percorso` parte sempre da /squadra/.
export async function chiama(ws, percorso, { metodo = 'GET', corpo = null, grezzo = false, attesa = 20000 } = {}) {
  const s = await servizioDi(ws)
  let r
  try {
    r = await fetch(`${s.url}${percorso}`, {
      method: metodo,
      headers: { cookie: `jarvis_squadra=${s.chiave}`, ...(corpo ? { 'content-type': 'application/json' } : {}) },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      cache: 'no-store', signal: AbortSignal.timeout(attesa),
    })
  } catch { throw new ErroreSquadra('la squadra non risponde', 502, 'spenta') }
  if (r.status === 401) throw new ErroreSquadra('la squadra rifiuta la chiave', 502, 'chiave')
  if (grezzo) return r
  if (!r.ok) throw new ErroreSquadra(`la squadra ha risposto ${r.status}`, 502, 'spenta')
  return r.json()
}

export const rispostaErrore = (e) => Response.json({ ok: false, errore: e?.message || 'errore', codice: e?.codice || 'errore' }, { status: e?.stato || 500, headers: { 'Cache-Control': 'private, no-store' } })
