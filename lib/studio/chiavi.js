// ============================================================================
//  Le chiavi del cliente: ChatGPT (OpenAI), Claude (Anthropic), Higgsfield e
//  la casella di posta. Le inserisce un amministratore dalla tab Integrazioni.
//
//  Tre regole, tutte e tre per lo stesso motivo (sono i soldi e la posta di un
//  altro):
//   1. in tabella il valore e' CIFRATO (AES-256-GCM); senza la variabile
//      STUDIO_CHIAVE_SEGRETI non si salva niente — mai un ripiego "in chiaro";
//   2. una chiave salvata non torna piu' al browser: si mostra solo la coda;
//   3. prima di salvarla la si PROVA dal fornitore: una chiave sbagliata si
//      scopre qui, non alle cinque di mattina quando il ciclo non produce.
// ============================================================================
import crypto from 'node:crypto'
import tls from 'node:tls'
import dns from 'node:dns/promises'
import net from 'node:net'
import { createClient } from '@supabase/supabase-js'

export const SERVIZI = ['openai', 'anthropic', 'higgsfield', 'posta']

let _c = null
const db = () => _c || (_c = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))

export class ErroreChiavi extends Error { constructor(messaggio, stato = 400, codice = 'errore') { super(messaggio); this.stato = stato; this.codice = codice } }

// ---- cifratura -------------------------------------------------------------
function segreto() {
  const v = String(process.env.STUDIO_CHIAVE_SEGRETI || '').trim()
  const b = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, 'hex') : Buffer.from(v, 'base64')
  if (b.length !== 32) throw new ErroreChiavi('cifratura non configurata: manca STUDIO_CHIAVE_SEGRETI (32 byte)', 500, 'cifratura')
  return b
}
export function cifra(oggetto) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', segreto(), iv)
  const corpo = Buffer.concat([c.update(JSON.stringify(oggetto), 'utf8'), c.final()])
  return 'v1.' + Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64')
}
export function decifra(testo) {
  const [v, dati] = String(testo || '').split('.')
  if (v !== 'v1' || !dati) throw new Error('formato sconosciuto')
  const b = Buffer.from(dati, 'base64')
  const d = crypto.createDecipheriv('aes-256-gcm', segreto(), b.subarray(0, 12))
  d.setAuthTag(b.subarray(12, 28))
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'))
}
const coda = (k) => { const s = String(k || ''); return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : '…' }

// ---- lettura ---------------------------------------------------------------
// Per l'interfaccia: quali servizi sono collegati, senza nessun valore segreto.
export async function statoChiavi(ws) {
  const { data, error } = await db().from('studio_chiavi').select('servizio, etichetta, verificata_il, aggiornata_il').eq('workspace_id', ws)
  if (error) return { pronto: false, servizi: {} }   // tabella non ancora creata
  return { pronto: true, servizi: Object.fromEntries((data || []).map(r => [r.servizio, { etichetta: r.etichetta, verificata: !!r.verificata_il, aggiornata_il: r.aggiornata_il }])) }
}
// Per il server: i valori veri di UN cliente. Una riga illeggibile (segreto cambiato) vale "non collegato".
export async function chiaviDi(ws) {
  const out = {}
  try {
    const { data } = await db().from('studio_chiavi').select('servizio, dati_cifrati').eq('workspace_id', ws)
    for (const r of data || []) { try { out[r.servizio] = decifra(r.dati_cifrati) } catch {} }
  } catch {}
  return out
}

// ---- prove dal fornitore ---------------------------------------------------
async function provaHttp(url, headers, nome) {
  let r
  try { r = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) }) }
  catch { throw new ErroreChiavi(`${nome} non risponde: riprova fra poco`, 502, 'rete') }
  if (r.status === 401 || r.status === 403) throw new ErroreChiavi(`${nome} rifiuta la chiave: controlla di averla copiata intera`, 400, 'rifiutata')
  if (!r.ok) throw new ErroreChiavi(`${nome} ha risposto ${r.status}`, 502, 'rete')
}

const privato = (ip) => {
  if (net.isIPv6(ip)) return /^(::1$|fc|fd|fe80|::ffff:(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.))/i.test(ip)
  return /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip)
}
// L'indirizzo del server lo scrive il cliente: non deve poter puntare dentro la nostra rete.
async function ospiteLecito(host) {
  if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)) throw new ErroreChiavi('indirizzo del server non valido', 400, 'server')
  let ind
  try { ind = await dns.lookup(host, { all: true }) } catch { throw new ErroreChiavi(`il server ${host} non esiste`, 400, 'server') }
  if (!ind.length || ind.some(a => privato(a.address))) throw new ErroreChiavi('indirizzo del server non ammesso', 400, 'server')
  return ind[0].address
}
// Accesso IMAP vero (TLS, porta 993): e' l'unico modo di sapere se indirizzo e password aprono la casella.
async function provaImap({ host, utente, password }) {
  const ip = await ospiteLecito(host)
  const tra = (s) => `"${String(s).replace(/[\\"]/g, '\\$&')}"`
  await new Promise((ok, no) => {
    let buf = '', fase = 0
    const s = tls.connect({ host: ip, port: 993, servername: host, timeout: 12000 })
    const fine = (e) => { try { s.destroy() } catch {} ; e ? no(e) : ok() }
    s.on('timeout', () => fine(new ErroreChiavi('il server di posta non risponde', 502, 'rete')))
    s.on('error', () => fine(new ErroreChiavi('non riesco a collegarmi al server di posta (IMAP, porta 993)', 502, 'rete')))
    s.on('data', (d) => {
      buf += d.toString('utf8')
      if (fase === 0 && /^\* OK/m.test(buf)) { fase = 1; buf = ''; s.write(`a1 LOGIN ${tra(utente)} ${tra(password)}\r\n`) }
      else if (fase === 1 && /^a1 OK/m.test(buf)) fine()
      else if (fase === 1 && /^a1 (NO|BAD)/m.test(buf)) fine(new ErroreChiavi('la casella rifiuta l\'accesso: serve la password per le app, non quella normale', 400, 'rifiutata'))
    })
  })
}

// Controlla la forma, prova dal fornitore, restituisce cio' che si salva.
async function prepara(servizio, c = {}) {
  const t = (x) => String(x || '').trim()
  if (servizio === 'openai') {
    const chiave = t(c.chiave)
    if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(chiave)) throw new ErroreChiavi('una chiave OpenAI inizia con «sk-»', 400, 'forma')
    await provaHttp('https://api.openai.com/v1/models', { authorization: `Bearer ${chiave}` }, 'OpenAI')
    return { dati: { chiave }, etichetta: coda(chiave), verificata: true }
  }
  if (servizio === 'anthropic') {
    const chiave = t(c.chiave)
    if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(chiave)) throw new ErroreChiavi('una chiave Claude inizia con «sk-ant-»', 400, 'forma')
    await provaHttp('https://api.anthropic.com/v1/models', { 'x-api-key': chiave, 'anthropic-version': '2023-06-01' }, 'Claude')
    return { dati: { chiave }, etichetta: coda(chiave), verificata: true }
  }
  if (servizio === 'higgsfield') {
    const id = t(c.id), segretoHf = t(c.segreto)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ErroreChiavi('l\'ID della chiave Higgsfield ha la forma xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx: forse hai invertito ID e segreto', 400, 'forma')
    if (!/^[0-9a-f]{24,}$/i.test(segretoHf)) throw new ErroreChiavi('il segreto Higgsfield e\' una stringa lunga di lettere e cifre', 400, 'forma')
    // Higgsfield non ha una chiamata gratuita per provare la coppia: si salva dopo il controllo della forma
    // e l'interfaccia lo dice ("salvata, non provata"). La prima generazione dira' se funziona.
    return { dati: { id, segreto: segretoHf }, etichetta: coda(id), verificata: false }
  }
  if (servizio === 'posta') {
    const indirizzo = t(c.indirizzo).toLowerCase(), password = String(c.password || '').replace(/\s+/g, '')
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(indirizzo)) throw new ErroreChiavi('scrivi l\'indirizzo della casella', 400, 'forma')
    if (password.length < 8) throw new ErroreChiavi('incolla la password per le app', 400, 'forma')
    const gmail = !t(c.imap)
    const imap = (t(c.imap) || 'imap.gmail.com').toLowerCase(), smtp = (t(c.smtp) || 'smtp.gmail.com').toLowerCase()
    if (!gmail) await ospiteLecito(smtp)
    await provaImap({ host: imap, utente: indirizzo, password })
    return { dati: { indirizzo, password, imap, smtp }, etichetta: indirizzo, verificata: true }
  }
  throw new ErroreChiavi('servizio sconosciuto', 400, 'servizio')
}

export async function salvaChiavi(ws, servizio, campi, chi) {
  if (!SERVIZI.includes(servizio)) throw new ErroreChiavi('servizio sconosciuto', 400, 'servizio')
  segreto() // prima di interrogare il fornitore: senza cifratura non si va avanti
  const p = await prepara(servizio, campi)
  const { error } = await db().from('studio_chiavi').upsert({
    workspace_id: ws, servizio, dati_cifrati: cifra(p.dati), etichetta: p.etichetta,
    verificata_il: p.verificata ? new Date().toISOString() : null, aggiornata_il: new Date().toISOString(), aggiornata_da: chi || null,
  }, { onConflict: 'workspace_id,servizio' })
  if (error) throw new ErroreChiavi(/studio_chiavi/.test(error.message || '') ? 'archivio delle chiavi non ancora creato (supabase/studio/02_chiavi.sql)' : error.message, 500, 'archivio')
  return { etichetta: p.etichetta, verificata: p.verificata }
}

export async function togliChiavi(ws, servizio) {
  if (!SERVIZI.includes(servizio)) throw new ErroreChiavi('servizio sconosciuto', 400, 'servizio')
  const { error } = await db().from('studio_chiavi').delete().eq('workspace_id', ws).eq('servizio', servizio)
  if (error) throw new ErroreChiavi(error.message, 500, 'archivio')
}
