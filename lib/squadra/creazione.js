// ============================================================================
//  La squadra si crea dal prodotto.
//
//  Prima ogni cliente era un file scritto a mano nel codice della squadra, un
//  servizio acceso a mano e le chiavi copiate nelle sue variabili. Qui il
//  cliente compila la scheda del brand e sceglie gli agenti; il suo servizio,
//  quando parte, chiede al prodotto «chi sono e con quali chiavi lavoro» e
//  riceve la configurazione e i collegamenti di QUEL workspace.
//
//  Stati di una squadra: bozza (sta compilando) → richiesta (ha premuto «Crea»,
//  il servizio e' in preparazione) → attiva → ferma.
// ============================================================================
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { getTenantCreds } from '../tenant/credentials'
import { statoChiavi, chiaviDi } from '../studio/chiavi'
import { getBrandIdentity } from '../tenant/brand'

let _c = null
const db = () => _c || (_c = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))

export class ErroreCreazione extends Error { constructor(messaggio, stato = 400, codice = 'errore') { super(messaggio); this.stato = stato; this.codice = codice } }

// Gli undici mestieri (gli stessi id del servizio: src/clienti/_base.js). `fisso` = non si spegne:
// senza controllo qualita' e senza archivio i lavori arriverebbero non riletti e non salvati.
export const MESTIERI = [
  { id: 'direttore', nome: 'Lorenzo Riva', fisso: true },
  { id: 'campagne', nome: 'Giulia Serra' },
  { id: 'kpi', nome: 'Davide Fabbri' },
  { id: 'stratega', nome: 'Sara Montanari' },
  { id: 'copy', nome: 'Matteo Longo' },
  { id: 'art', nome: 'Chiara Bassi' },
  { id: 'newsletter', nome: 'Francesca Villa' },
  { id: 'sito', nome: 'Andrea Neri' },
  { id: 'competitor', nome: 'Elena Sala' },
  { id: 'recensioni', nome: 'Marta Gallo' },   // legge le recensioni dei clienti: esiste solo nelle squadre nate dal prodotto
  { id: 'archivista', nome: 'Luca Orlando', fisso: true },
  { id: 'qualita', nome: 'Paolo Ferri', fisso: true },
]
const TETTO_GIRI = 40   // giri al giorno di partenza: ogni giro consuma credito Claude del cliente

const testo = (x, max) => String(x ?? '').replace(/\u0000/g, '').trim().slice(0, max)

// Ripulisce cio' che arriva dal modulo: solo i campi previsti, con le loro lunghezze.
export function pulisciConfigurazione(d = {}) {
  const persone = {}
  for (const m of MESTIERI) {
    const p = d.persone?.[m.id] || {}
    persone[m.id] = { nome: testo(p.nome, 60) || m.nome, acceso: m.fisso ? true : p.acceso !== false }
  }
  const nomi = Object.values(persone).filter(p => p.acceso).map(p => p.nome.toLowerCase())
  if (new Set(nomi).size !== nomi.length) throw new ErroreCreazione('due agenti hanno lo stesso nome', 400, 'nomi')
  return {
    descrizione: testo(d.descrizione, 400), sito: testo(d.sito, 120), nicchia: testo(d.nicchia, 120), titolare: testo(d.titolare, 60),
    regole_brand: testo(d.regole_brand, 3000), pareggio: testo(d.pareggio, 400), conoscenza: testo(d.conoscenza, 60000), persone,
  }
}

// Che cosa serve perche' la squadra possa lavorare, e che cosa c'e' gia'.
export async function controlli(ws) {
  const [creds, chiavi] = await Promise.all([getTenantCreds(ws).catch(() => null), statoChiavi(ws)])
  return [
    { id: 'shopify', ok: !!(creds?.shopify?.adminToken && creds?.shopify?.storeUrl), obbligatorio: true },
    { id: 'meta', ok: !!(creds?.meta?.accessToken && creds?.meta?.adAccountId), obbligatorio: true },
    { id: 'anthropic', ok: !!chiavi.servizi?.anthropic, obbligatorio: true },
    { id: 'klaviyo', ok: !!creds?.klaviyo?.apiKey, obbligatorio: false },
    { id: 'openai', ok: !!chiavi.servizi?.openai, obbligatorio: false },
    { id: 'higgsfield', ok: !!chiavi.servizi?.higgsfield, obbligatorio: false },
  ]
}

export async function leggiSquadra(ws) {
  const { data, error } = await db().from('studio_squadre').select('workspace_id, url, attiva, stato, configurazione, richiesta_il').eq('workspace_id', ws).maybeSingle()
  // colonne non ancora create (supabase/studio/03_squadra_configurazione.sql): la creazione dal prodotto non e' disponibile
  if (error) return { pronto: false, riga: null }
  return { pronto: true, riga: data || null }
}

export async function salvaBozza(ws, dati, chi) {
  const { pronto, riga } = await leggiSquadra(ws)
  if (!pronto) throw new ErroreCreazione('la creazione della squadra non e\' ancora attiva su questo ambiente', 500, 'archivio')
  if (riga && riga.stato === 'attiva') throw new ErroreCreazione('la squadra e\' gia\' attiva', 409, 'attiva')
  const configurazione = pulisciConfigurazione(dati)
  const { error } = await db().from('studio_squadre').upsert({ workspace_id: ws, stato: riga?.stato === 'richiesta' ? 'richiesta' : 'bozza', configurazione, attiva: false, aggiornata_il: new Date().toISOString(), richiesta_da: chi || null }, { onConflict: 'workspace_id' })
  if (error) throw new ErroreCreazione(error.message, 500, 'archivio')
  return configurazione
}

export async function richiediSquadra(ws, dati, chi) {
  const configurazione = await salvaBozza(ws, dati, chi)
  if (configurazione.descrizione.length < 10) throw new ErroreCreazione('scrivi in una riga che cosa vende l\'azienda', 400, 'scheda')
  if (configurazione.regole_brand.length < 10) throw new ErroreCreazione('scrivi almeno una regola del brand: e\' cio\' che gli agenti non devono mai sbagliare', 400, 'scheda')
  const mancanti = (await controlli(ws)).filter(c => c.obbligatorio && !c.ok).map(c => c.id)
  if (mancanti.length) throw new ErroreCreazione(`mancano dei collegamenti: ${mancanti.join(', ')}`, 400, 'collegamenti')
  const { error } = await db().from('studio_squadre').update({ stato: 'richiesta', richiesta_il: new Date().toISOString(), richiesta_da: chi || null }).eq('workspace_id', ws)
  if (error) throw new ErroreCreazione(error.message, 500, 'archivio')
  return { stato: 'richiesta' }
}

// ---- il servizio della squadra che si presenta ------------------------------
const impronta = (gettone) => crypto.createHash('sha256').update(String(gettone)).digest('hex')
export const nuovoGettone = () => { const g = crypto.randomBytes(32).toString('hex'); return { gettone: g, hash: impronta(g) } }

// Dal gettone al workspace. Un gettone vale per UNA squadra: chi lo presenta non sceglie per chi lavora.
export async function squadraDelGettone(req) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('authorization') || '') || /^([0-9a-f]{64})$/.exec(req.headers.get('x-internal-cron') || '')
  if (!m) return null
  const { data } = await db().from('studio_squadre').select('workspace_id, stato, configurazione, token_hash').eq('token_hash', impronta(m[1])).maybeSingle()
  if (!data?.token_hash) return null
  const a = Buffer.from(data.token_hash), b = Buffer.from(impronta(m[1]))
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { ...data, gettone: m[1] } : null
}

// Cio' che il cervello di LyftAI ha imparato su questa azienda (conversazioni, call, controlli notturni): gli
// agenti lo ricevono all'avvio, dal piu' importante. E' il «tutto cio' che sa il cervello» che deve arrivare a loro;
// per il resto, e per cio' che il cervello imparera' dopo, hanno lo strumento cerca_sapere (rotta /servizio/sapere).
async function ricordiDelCervello(ws) {
  try {
    const { data } = await db().from('agent_memories').select('agent_id, content, importance, created_at').eq('user_id', ws).gte('importance', 5).order('importance', { ascending: false }).order('created_at', { ascending: false }).limit(90)
    const righe = (data || []).map(m => `- [${m.importance}] ${String(m.content || '').replace(/\s+/g, ' ').trim().slice(0, 400)}`).filter(r => r.length > 8)
    if (!righe.length) return ''
    return `\n\nCIÒ CHE IL CERVELLO DI LYFTAI HA IMPARATO SU QUESTA AZIENDA (ricordi, dal più importante; per cercarne altri usa cerca_sapere):\n${righe.join('\n').slice(0, 30000)}`
  } catch { return '' }
}

// Il nome dell'account pubblicitario: il servizio lo riconosce per nome fra quelli del gettone.
async function nomeAccountMeta(token, id, versione) {
  const act = String(id || '').split(',')[0].trim().replace(/^act_/, '')
  if (!token || !act) return ''
  try {
    const r = await fetch(`https://graph.facebook.com/${versione || 'v20.0'}/act_${act}?fields=name&access_token=${encodeURIComponent(token)}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) })
    return r.ok ? String((await r.json()).name || '') : ''
  } catch { return '' }
}

// Tutto cio' che il servizio riceve all'avvio (e ogni 20 minuti, per le chiavi che scadono).
export async function configurazionePerServizio(squadra, origine) {
  const ws = squadra.workspace_id, c = squadra.configurazione || {}
  const [creds, chiavi, identita, ricordi] = await Promise.all([getTenantCreds(ws), chiaviDi(ws), getBrandIdentity(ws).catch(() => null), ricordiDelCervello(ws)])
  // Il contesto del brand deve essere TOTALE: alla scheda scritta per la squadra si aggiunge cio' che
  // l'azienda ha gia' dichiarato nel prodotto (Brand Identity). Il resto (catalogo, recensioni, persone,
  // pareggio) lo costruiscono gli agenti coi primi incarichi, il «dossier del brand».
  const dichiarato = identita && typeof identita === 'object' && Object.values(identita).some(v => v && String(v).length > 2) ? `

BRAND IDENTITY dichiarata dall'azienda nel prodotto:
${JSON.stringify(identita, null, 1).slice(0, 20000)}` : ''
  const persone = {}, senza = []
  for (const m of MESTIERI) { const p = c.persone?.[m.id]; if (p && p.acceso === false && !m.fisso) senza.push(m.id); else persone[m.id] = { nome: p?.nome || m.nome } }
  return {
    cliente: {
      nome: creds.companyName || 'il negozio', sito: c.sito || (creds.shopify?.storeUrl ? `https://${creds.shopify.storeUrl}` : ''),
      descrizione: c.descrizione || '', nicchia: c.nicchia || '', titolare: c.titolare || '', regole_brand: c.regole_brand || '', pareggio: c.pareggio || '', conoscenza: `${c.conoscenza || ''}${dichiarato}${ricordi}`,
      persone, senza,
    },
    ambiente: {
      ANTHROPIC_API_KEY: chiavi.anthropic?.chiave || '',
      OPENAI_API_KEY: chiavi.openai?.chiave || '',
      HF_API_KEY_ID: chiavi.higgsfield?.id || '', HF_API_KEY_SECRET: chiavi.higgsfield?.segreto || '',
      META_TOKEN: creds.meta?.accessToken || '',
      META_ACCOUNT: await nomeAccountMeta(creds.meta?.accessToken, creds.meta?.adAccountId, creds.meta?.graphVersion),
      KLAVIYO_KEY: creds.klaviyo?.apiKey || '',
      SHOPIFY_DOMINIO: creds.shopify?.storeUrl || '', SHOPIFY_TOKEN: creds.shopify?.adminToken || '',
      // I numeri del cliente passano da una rotta del prodotto legata a QUESTO gettone: al servizio non
      // arriva mai il segreto dei cron del prodotto, che aprirebbe i dati di tutti i clienti.
      LYFTAI_URL: `${origine}/api/squadra/servizio/lyftai`, LYFTAI_SECRET: squadra.gettone, LYFTAI_WORKSPACE: ws,
      SQUADRA_PUBBLICAZIONI: 'off',            // solo bozze: l'ultimo passo lo fa una persona
      SQUADRA_MAX_GIRI_GIORNO: String(squadra.stato === 'attiva' ? TETTO_GIRI : 0),   // finche' non e' accesa, nessun giro
    },
  }
}
