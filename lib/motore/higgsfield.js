import { chiaveCliente } from './workspace'
// ============================================================================
//  Generazione scene lato server — API Higgsfield.
//
//  Endpoint e schema NON documentati pubblicamente: ricavati interrogando
//  l'API il 30 agosto 2026. Sono scritti qui perché la prossima persona non
//  debba rifare lo stesso lavoro a tentoni:
//
//    POST /v1/text2image/seedream
//      { params: { prompt, input_images:[{type:'image_url', image_url}],
//                  quality: 'basic'|'high',
//                  aspect_ratio: '1:1'|'9:16'|'4:3'|'16:9'|'3:2'|'21:9'|'3:4'|'2:3' } }
//      → { id, jobs:[{ id, status }] }
//    GET  /v1/job-sets/{id}
//      → jobs[0].status ∈ queued|in_progress|completed|failed
//        jobs[0].results.raw.url  (jpeg piena)   .min.url (webp ridotta)
//
//  Intestazioni: hf-api-key (lo UUID) e hf-secret (la stringa esadecimale).
//  Invertirle NON dà un errore di autenticazione chiaro: dà 404
//  "model_not_found", che manda a cercare nel posto sbagliato.
//
//  Non esiste un endpoint per il SALDO CREDITI: va aggiornato a mano con
//  POST /api/crediti. Il banner in cima alla board mostra sempre l'età del
//  dato proprio per questo.
// ============================================================================

const BASE = 'https://platform.higgsfield.ai/v1'
export const COSTO_SCENA = 3          // crediti per immagine, misurati sulle transazioni

function chiavi() {
  const c = chiaveCliente('higgsfield')
  const k = c?.id, s = c?.segreto
  if (!k || !s) throw new Error('Higgsfield non collegato: inserisci le chiavi nella tab Integrazioni (la generazione delle scene resta manuale)')
  return { k, s }
}

async function chiama(path, opzioni = {}) {
  const { k, s } = chiavi()
  const r = await fetch(BASE + path, {
    ...opzioni,
    headers: { 'Content-Type': 'application/json', 'hf-api-key': k, 'hf-secret': s, ...(opzioni.headers || {}) },
  })
  const testo = await r.text()
  let j; try { j = JSON.parse(testo) } catch { j = { grezzo: testo } }
  if (!r.ok) {
    const d = j.detail
    const msg = Array.isArray(d) ? d.map(e => `${e.loc?.join('.')}: ${e.msg}`).join(' · ') : (d || testo)
    throw new Error(`Higgsfield ${r.status} su ${path}: ${String(msg).slice(0, 220)}`)
  }
  return j
}

export async function saldo() {
  throw new Error('saldo non disponibile via API: Higgsfield non espone un endpoint crediti, va aggiornato a mano da POST /api/crediti')
}

const RAPPORTI = { '1x1': '1:1', '9x16': '9:16' }

// `riferimenti` sono gli URL dei packshot. Senza, il modello disegna un
// prodotto generico — è il difetto già visto in produzione, dove nella scena
// del frantoio compariva un cartone marrone qualunque al posto della bag.
export async function avviaScena({ prompt, riferimenti = [], ratio = '9x16', qualita = 'high' }) {
  const j = await chiama('/text2image/seedream', {
    method: 'POST',
    body: JSON.stringify({
      params: {
        prompt,
        input_images: riferimenti.filter(Boolean).slice(0, 4).map(u => ({ type: 'image_url', image_url: u })),
        quality: qualita,
        aspect_ratio: RAPPORTI[ratio] || ratio,
      },
    }),
  })
  const id = j.id
  if (!id) throw new Error('Higgsfield ha accettato la richiesta ma non ha restituito un id')
  return id
}

export async function attendiScena(jobSetId, { timeoutMs = 240000, passoMs = 5000 } = {}) {
  const fine = Date.now() + timeoutMs
  let ultimo = 'queued'
  while (Date.now() < fine) {
    const j = await chiama(`/job-sets/${jobSetId}`)
    const lav = j.jobs?.[0]
    ultimo = lav?.status || 'sconosciuto'
    if (ultimo === 'completed') {
      // Si prende la RAW: la `min` è una webp ridotta, e comporre il livello
      // di brand sopra un'immagine già compressa si vede.
      const url = lav.results?.raw?.url || lav.results?.min?.url
      if (!url) throw new Error('job completato ma senza URL immagine')
      return url
    }
    if (ultimo === 'failed') throw new Error(`job fallito: ${lav?.error || 'senza dettaglio'}`)
    await new Promise(r => setTimeout(r, passoMs))
  }
  throw new Error(`job ${jobSetId}: scaduto dopo ${timeoutMs / 1000}s, ultimo stato "${ultimo}"`)
}

export async function generaScena(opts) {
  return attendiScena(await avviaScena(opts))
}
