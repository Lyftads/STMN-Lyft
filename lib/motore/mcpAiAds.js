// ============================================================================
//  Client per il server MCP "creative-engine-os" (ai-ads.milonematteo.com).
//
//  Un server MCP nasce per gli agenti, non per le applicazioni: il protocollo
//  e' JSON-RPC su HTTP con risposta in Server-Sent Events. Ma e' HTTP, quindi
//  il motore puo' parlarci dal server — verificato il 11 settembre 2026:
//  `tools/call` risponde con un POST semplice, senza autenticazione e senza
//  nemmeno aver fatto `initialize`. Server: creative-engine-os 3.10.0.
//
//  COSA SI PRENDE DA QUI, e perche' non tutto:
//    - `analyze_creative` + `quality_gate`: un secondo parere INDIPENDENTE su
//      una creativita' finita. Guarda cose che il nostro verificatore non
//      guarda — safe zone di Meta, contrasto del testo, gerarchia, adattamento
//      al posizionamento. Alla prima prova ha trovato un difetto vero che
//      avevamo da sempre: su Story il logo cade dentro l'header di Instagram e
//      la CTA dentro la barra di risposta.
//    - le librerie di strategia (33 tattiche di hook, 70 formati visivi, 8
//      meccaniche, 25 pattern di voce): tassonomia vera con fit di funnel e
//      awareness, dove i nostri angoli erano inventati a mano.
//
//  COSA NON SI PRENDE, deliberatamente:
//    - `generate_image`: le scene le facciamo con gpt-image-2 e un contratto
//      di prompt tarato sulla fedelta' del prodotto piu' la verifica di scala.
//      Passare da qui vorrebbe dire perdere entrambi per avere lo stesso
//      modello.
//    - `fidelity_test`: vuole uno `slug` cliente e un `ad_id` gia' dentro il
//      loro database. Non si applica alle nostre immagini.
//    - `create_meta_creatives`: serve `ads_management`, che non abbiamo.
// ============================================================================

const URL_MCP = process.env.MCP_AI_ADS_URL || 'https://ai-ads.milonematteo.com/mcp'

// La risposta arriva come Server-Sent Events anche per una singola chiamata:
// una o piu' righe `data: {...}`. Si prende l'ultimo oggetto JSON valido.
function daSSE(testo) {
  const righe = String(testo || '').split('\n')
  let ultimo = null
  for (const r of righe) {
    if (!r.startsWith('data:')) continue
    try { ultimo = JSON.parse(r.slice(5).trim()) } catch { /* riga parziale */ }
  }
  if (ultimo) return ultimo
  // Se un giorno rispondesse in JSON semplice, si legge comunque.
  try { return JSON.parse(testo) } catch { return null }
}

let contatore = 1

export async function chiamaStrumento(nome, argomenti = {}, { timeoutMs = 120000 } = {}) {
  const r = await fetch(URL_MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: contatore++,
      method: 'tools/call', params: { name: nome, arguments: argomenti },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`MCP ${nome}: HTTP ${r.status} ${testo.slice(0, 160)}`)
  const j = daSSE(testo)
  if (!j) throw new Error(`MCP ${nome}: risposta non interpretabile`)
  if (j.error) throw new Error(`MCP ${nome}: ${j.error.message || JSON.stringify(j.error).slice(0, 160)}`)

  // Il risultato utile sta in content[0].text come JSON dentro una stringa.
  const t = j.result?.content?.[0]?.text
  if (t == null) return j.result
  try { return JSON.parse(t) } catch { return { testo: t } }
}

// Analizza una creativita' finita. `placement` è meta_story per il 9:16 e
// meta_feed per il quadrato: e' il parametro su cui il server giudica le safe
// zone, quindi sbagliarlo vuol dire farsi dire che va tutto bene.
export async function analizzaCreativita({ url, ratio, obiettivo, copy, brand }) {
  return chiamaStrumento('analyze_creative', {
    image_url: url,
    placement: ratio === '9x16' ? 'meta_story' : 'meta_feed',
    ...(obiettivo ? { goal: obiettivo } : {}),
    ...(copy ? { expected_copy: copy } : {}),
    ...(brand ? { brand_context: brand } : {}),
  })
}

// Applica le soglie. Si passa la scorecard che esce dall'analisi.
// Soglie del server: composito >= 7, thumb-stop >= 7, clarity >= 8,
// tipografia >= 7; composito < 5 e' KILL.
export async function cancelloQualita(scorecard, soglie) {
  return chiamaStrumento('quality_gate', { scorecard, ...(soglie ? { thresholds: soglie } : {}) })
}

// Le librerie di strategia. Sono dati statici: si leggono una volta e si
// tengono, non si richiamano a ogni brief.
export const LIBRERIE = {
  hook: 'list_hook_tactics',
  formati: 'list_visual_formats',
  meccaniche: 'list_creative_mechanics',
  voce: 'list_voice_patterns',
  archi: 'list_arcs',
}

export async function libreria(quale, argomenti = {}) {
  const nome = LIBRERIE[quale]
  if (!nome) throw new Error(`libreria sconosciuta: ${quale}`)
  return chiamaStrumento(nome, argomenti)
}
