import { getAdminSupabase } from '../supabase/server'

// ============================================================================
//  Agent Memory — persistenza semantica per gli AI agent.
//
//  Pattern (semplificato):
//  1. recall(userId, agentId, query) → top-K memorie rilevanti via cosine sim
//  2. agent risponde con quelle nel system prompt
//  3. remember(userId, agentId, content, role) → salva nuove osservazioni
//
//  Gli embedding usano OpenAI text-embedding-3-small (1536 dim, $0.02/1M tok).
//
//  Defensive: errori OpenAI/Supabase ritornano [] o false → l'agent funziona
//  anche senza memoria.
// ============================================================================

const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_URL = 'https://api.openai.com/v1/embeddings'

// Genera embedding per un testo. Ritorna null su errore.
async function getEmbedding(text) {
  const key = process.env.OPENAI_API_KEY
  if (!key || !text) return null
  try {
    const res = await fetch(EMBED_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: String(text).slice(0, 8000), // limite token reasonable
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.log('[memory] embedding API error:', res.status)
      return null
    }
    const json = await res.json()
    return json?.data?.[0]?.embedding || null
  } catch (e) {
    console.log('[memory] embedding threw:', e?.message)
    return null
  }
}

// Recall top-K memorie semanticamente piu' vicine al query.
// Ranking hybrid (similarity + importance + recency) gestito server-side
// dall'RPC. Side-effect: dopo il recall, fire-and-forget aggiorna
// use_count e last_used_at delle memorie restituite (promotion automatica).
export async function recall({ userId, agentId, query, limit = 5, minImportance = 1 }) {
  if (!userId || !agentId || !query) return []

  const admin = getAdminSupabase()
  if (!admin) return []

  const queryEmb = await getEmbedding(query)
  if (!queryEmb) return []

  try {
    const { data, error } = await admin.rpc('recall_agent_memories', {
      p_user_id: userId,
      p_agent_id: agentId,
      p_query_emb: queryEmb,
      p_limit: limit,
      p_min_imp: minImportance,
    })
    if (error) {
      console.log('[memory] recall RPC error:', error.message)
      return []
    }
    const memories = Array.isArray(data) ? data : []

    // Promotion automatica: incremento use_count + last_used_at = now()
    // per memorie effettivamente usate. Fire-and-forget, non blocca return.
    if (memories.length > 0) {
      const ids = memories.map(m => m.id).filter(Boolean)
      if (ids.length > 0) {
        admin.rpc('track_memory_use', { p_ids: ids }).then(() => {}, () => {})
      }
    }
    return memories
  } catch (e) {
    console.log('[memory] recall threw:', e?.message)
    return []
  }
}

// ── KNOWLEDGE BASE globale (condivisa da tutti gli agent/clienti) ──────────
// Recall top-K note di conoscenza distillate (corso/YouTube), via cosine sim.
// Globale: nessun filtro per-utente.
export async function recallKnowledge({ query, limit = 4, minSim = 0.15 }) {
  if (!query) return []
  const admin = getAdminSupabase()
  if (!admin) return []
  const queryEmb = await getEmbedding(query)
  if (!queryEmb) return []
  try {
    // Fast-fail: se la ricerca vettoriale è lenta (es. indice non ottimale a
    // grande scala), non bloccare la route per 8s aspettando lo statement
    // timeout del DB. Diamo 3s: con un indice HNSW il recall è ~50ms, quindi
    // questo timeout non scatta mai in condizioni sane. Senza indice → [].
    const { data, error } = await Promise.race([
      admin.rpc('match_knowledge', { p_query_emb: queryEmb, p_limit: limit, p_min_sim: minSim }),
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'recall timeout (3s) — verificare indice HNSW su knowledge_base.embedding' } }), 3000)),
    ])
    if (error) { console.log('[knowledge] recall RPC error:', error.message); return [] }
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.log('[knowledge] recall threw:', e?.message)
    return []
  }
}

// Salva una nota nella knowledge globale (usata dallo script di ingestion).
export async function saveKnowledge({ content, topic = null, source = 'course', sourceRef = null, importance = 5 }) {
  if (!content) return null
  const admin = getAdminSupabase()
  if (!admin) return null
  const embedding = await getEmbedding(content)
  try {
    const { data, error } = await admin
      .from('knowledge_base')
      .insert({ content, topic, source, source_ref: sourceRef, importance, embedding })
      .select('id')
      .single()
    if (error) { console.log('[knowledge] insert error:', error.message); return null }
    return data?.id || null
  } catch (e) {
    console.log('[knowledge] insert threw:', e?.message)
    return null
  }
}

// Formatta le note di knowledge per il system prompt.
export function formatKnowledgeForPrompt(items) {
  if (!Array.isArray(items) || items.length === 0) return ''
  const lines = items.map(k => `- ${String(k.content || '').trim()}`).join('\n')
  return `[KNOWLEDGE BASE — principi e framework di advertising/marketing, usali come metodo nei tuoi consigli]\n${lines}`
}

// Helper "tutto incluso" per le route NON-agent (SEO, scanner, recommendations,
// actions, creative-lab, report, social, insights): fa il recall semantico
// della knowledge globale (corso + video) e ritorna un blocco pronto da
// concatenare al loro system prompt. Ritorna '' se non c'è nulla di pertinente
// o in caso di errore (mai rompe la route). Stesso wording usato dagli agent.
export async function buildKnowledgeBlock(query, { limit = 4 } = {}) {
  try {
    const items = await recallKnowledge({ query, limit })
    const block = formatKnowledgeForPrompt(items)
    if (!block) return ''
    return `\n\n## KNOWLEDGE (advertising/marketing — principi e framework appresi)\n${block}\n\nUsa questi principi come METODO nei tuoi consigli/output, integrandoli con i dati del brand. Non citarli come "da un corso/video": sono parte della tua competenza.`
  } catch {
    return ''
  }
}

// Salva una memoria. Ritorna l'id creato o null su errore.
export async function remember({
  userId,
  agentId,
  content,
  role = 'observation', // observation / preference / fact / insight
  importance = 5,
  source = 'auto',
}) {
  if (!userId || !agentId || !content) return null

  const admin = getAdminSupabase()
  if (!admin) return null

  const embedding = await getEmbedding(content)

  try {
    const { data, error } = await admin
      .from('agent_memories')
      .insert({
        user_id: userId,
        agent_id: agentId,
        role,
        content: String(content).slice(0, 4000),
        embedding,
        importance: Math.max(1, Math.min(10, importance)),
        source,
      })
      .select('id')
      .single()
    if (error) {
      console.log('[memory] insert error:', error.message)
      return null
    }
    return data?.id || null
  } catch (e) {
    console.log('[memory] insert threw:', e?.message)
    return null
  }
}

// Salva multiple memorie in batch (best-effort, non blocca su singoli fail).
export async function rememberBatch(items) {
  if (!Array.isArray(items) || items.length === 0) return []
  const results = await Promise.all(items.map(remember))
  return results.filter(Boolean)
}

// Helper: dato un turn user→assistant, estrae osservazioni candidate da
// salvare in memoria. Usa una seconda call a OpenAI con istruzioni di
// estrazione strutturata (JSON output). Ritorna array di { content, role,
// importance }.
//
// Strategy: salviamo SOLO se l'utente ha espresso una preferenza
// ("preferisco risposte concise", "il MER target e' 2.5x"), o se l'agent
// ha prodotto un insight non-banale e referenziabile ("Marino testa
// Picsil ad agosto"). Evita rumore (riepiloghi, parafrasi).
export async function extractMemoriesFromTurn({ userMessage, assistantMessage, agentId }) {
  const key = process.env.OPENAI_API_KEY
  if (!key || !userMessage || !assistantMessage) return []

  const extractorPrompt = `Sei un estrattore di memorie per agent AI. Dato uno scambio user→assistant, identifica fatti DURATURI da ricordare per le prossime conversazioni.

Estrai SOLO se sono:
- PREFERENZE esplicite dell'utente ("preferisco risposte concise", "non mi piacciono le emoji")
- FATTI specifici del brand ("il MER target e' 2.5x", "lanciamo sempre il martedi", "non vendo integratori")
- INSIGHT non-banali e referenziabili ("Picsil promo il 15 di ogni mese", "Velites e' fortissima su rope")
- PATTERN ricorrenti ("Marino guarda sempre i CTR per primi")

NON estrarre:
- Riepiloghi/parafrasi di quanto detto
- Domande generiche
- Saluti, ringraziamenti, follow-up senza contenuto
- Cose gia' ovvie dal contesto della query
- Risposte chat di una tantum

Output JSON: { "memories": [{ "content": "...", "role": "preference|fact|insight|observation", "importance": 1-10 }] }
Se nulla vale la pena di essere ricordato: { "memories": [] }`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: extractorPrompt },
          { role: 'user', content: `Agent: ${agentId}\n\nUSER: ${String(userMessage).slice(0, 2000)}\n\nASSISTANT: ${String(assistantMessage).slice(0, 4000)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const raw = json?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)
    const memories = Array.isArray(parsed?.memories) ? parsed.memories : []
    return memories
      .filter(m => m && typeof m.content === 'string' && m.content.trim().length > 5)
      .map(m => ({
        content: m.content.trim(),
        role: ['preference', 'fact', 'insight', 'observation'].includes(m.role) ? m.role : 'observation',
        importance: Number.isFinite(m.importance) ? Math.max(1, Math.min(10, Math.round(m.importance))) : 5,
      }))
  } catch (e) {
    console.log('[memory] extract threw:', e?.message)
    return []
  }
}

// ============================================================================
//  Auto-extraction da dati live (Batch A — agent autoalimentazione)
//
//  Quando un agent riceve un payload `metrics` dalla dashboard, estraiamo
//  FATTI DURATURI da quel dataset e li salviamo come memorie. Esempio:
//  "MER medio Q3 2026: 2.5x", "Top product: Paracalli Premium €12k".
//
//  Throttle: max 1 extraction per (userId, agentId, timeframe) ogni 30 min
//  per evitare di spammare il DB e bruciare token su dati invariati.
// ============================================================================

const dataExtractionCache = new Map() // key → timestamp
const DATA_EXTRACT_TTL_MS = 30 * 60_000

function shouldThrottleExtraction(userId, agentId, timeframe) {
  const key = `${userId}|${agentId}|${timeframe || 'na'}`
  const last = dataExtractionCache.get(key)
  if (last && Date.now() - last < DATA_EXTRACT_TTL_MS) return true
  dataExtractionCache.set(key, Date.now())
  return false
}

// Estrae fatti durevoli da un payload di metriche.
// Input: data oggetto JSON (metrics, kpiBrain, range, etc) + agentId + timeframe.
// Output: array di { content, role: 'fact', importance }.
//
// Strategia: il prompt invita l'extractor a salvare SOLO fatti specifici e
// numerici legati al timeframe (es: "Settembre 2026: MER 2.8x"). Niente
// generalita' ("le vendite vanno bene"), niente parafrasi.
export async function extractMemoriesFromData({ data, agentId, timeframe, userId, skipThrottle = false }) {
  const key = process.env.OPENAI_API_KEY
  if (!key || !data || !userId) return []
  if (!skipThrottle && shouldThrottleExtraction(userId, agentId, timeframe)) return []

  // Compatta data per stare nei limiti token e ridurre rumore.
  // Strippa array > 30 elementi (top-N basta), strippa null/undefined.
  let compact
  try {
    compact = JSON.stringify(data, (k, v) => {
      if (v == null) return undefined
      if (Array.isArray(v) && v.length > 30) return v.slice(0, 30)
      return v
    })
    if (compact.length > 40_000) compact = compact.slice(0, 40_000) + '...[troncato]'
  } catch {
    return []
  }

  const sysPrompt = `Sei un estrattore di FATTI DURATURI da dati di e-commerce/marketing.
Ricevi un JSON con dati di un periodo (timeframe: ${timeframe || 'unknown'}, agent: ${agentId}).
Estrai SOLO fatti specifici, numerici, ancorati al timeframe — quelli che un consulente vorrebbe ricordarsi per le prossime conversazioni.

ESEMPI BUONI:
- "Settembre 2026: MER medio 2.5x (target brand 2.5x)"
- "Q3 2026: AOV 78€, in crescita +12% vs Q2"
- "Top product settembre 2026: Paracalli Premium €12.4k (3x baseline mensile)"
- "Anomalia: NC scesi del 30% nella settimana 14-20 giugno 2026"
- "Campagna 'Backtobox' Meta Sept 2026: ROAS 3.8x, CTR 1.9%"

ESEMPI DA NON ESTRARRE:
- "le vendite sono andate bene" (vago)
- "ci sono diversi prodotti" (banale)
- "il MER è un KPI" (generico, non ancorato a dati)
- Cose senza data/timeframe specifico
- Riepiloghi generici

Output JSON: { "facts": [{ "content": "...", "importance": 4-8 }] }
importance: 8 per anomalie/milestones, 6 per metriche chiave del periodo, 4 per nice-to-know.
MAX 5 fatti per estrazione (qualita' > quantita').
Se non trovi fatti specifici e ancorati: { "facts": [] }.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: `Timeframe: ${timeframe}\n\nDati:\n${compact}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const raw = json?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)
    const facts = Array.isArray(parsed?.facts) ? parsed.facts : []
    return facts
      .filter(f => f && typeof f.content === 'string' && f.content.trim().length > 10)
      .slice(0, 5)
      .map(f => ({
        content: f.content.trim(),
        role: 'fact',
        importance: Number.isFinite(f.importance) ? Math.max(1, Math.min(10, Math.round(f.importance))) : 6,
      }))
  } catch (e) {
    console.log('[memory] extractFromData threw:', e?.message)
    return []
  }
}

// Analisi cross-timeframe per il cron notturno (Batch B).
// Confronta last_24h vs last_7d vs last_30d ed estrae:
// - ANOMALIE (cali/spike significativi)
// - TREND (3+ giorni stessa direzione)
// - MILESTONE (record/soglie superate)
//
// Output: memorie 'insight' con importance 7-9 (alta, perche' sono
// osservazioni critiche per le decisioni quotidiane).
export async function extractInsightsFromComparison({
  last_24h, last_7d, last_30d,
  meta_detail, klaviyo, ga4,
  userId, date,
}) {
  const key = process.env.OPENAI_API_KEY
  if (!key || !userId) return []

  // Compatta input: estraiamo le metriche rilevanti dai 3 timeframe Shopify
  // + Meta detail + Klaviyo + GA4. Tutto in unico payload per l'extractor.
  const summary = {
    date: date || new Date().toISOString().slice(0, 10),
    shopify: {
      last_24h: pickKeyMetrics(last_24h),
      last_7d: pickKeyMetrics(last_7d),
      last_30d: pickKeyMetrics(last_30d),
    },
    meta_ads: pickMetaMetrics(meta_detail),
    klaviyo: pickKlaviyoMetrics(klaviyo),
    ga4: pickGa4Metrics(ga4),
  }

  const sysPrompt = `Sei un analista che ogni notte scansiona i KPI del brand e seleziona SOLO le 3-7 osservazioni piu' importanti per il founder, per fare un briefing mattutino.

Ricevi 4 dataset:
- Shopify metrics (24h vs 7gg vs 30gg): fatturato, ordini, NC/RC, AOV
- Meta Ads detail (ultimi 7gg): spend, ROAS, top adsets/campaigns, frequency
- Klaviyo (ultimi 7gg): revenue email, KPI flussi
- GA4 (ultimi 7gg): sessioni, top channel, top pages

Devi identificare:

1. ANOMALIE (importance 8-9):
   - Cali >20% di una metrica chiave (fatturato, ordini, NC, MER, ROAS)
   - Spike >30% (positivi o negativi)
   - Spese marketing che esplodono senza ritorno
   - CPM/CTR/CPC fuori controllo
   - Esempi: "Anomalia: NC 24h a 4 vs media 7gg 12 (-67%)", "ROAS Meta 24h crolla a 1.2x da media 2.8x"

2. TREND (importance 6-7):
   - 3+ giorni nella stessa direzione su una metrica
   - Pattern di stagionalita' o saturazione
   - Esempi: "AOV in calo da 4 giorni: 78€ → 71€", "Frequency Meta cresce da 1.8 a 2.4 in 7gg (fatica creative)"

3. MILESTONE (importance 7-8):
   - Record di fatturato/ordini/MER
   - Soglie superate o non raggiunte
   - Esempi: "Settimana record: 142 ordini (best del mese)", "Sotto target MER 2.5x: 7gg a 2.1x"

REGOLE:
- Cita SEMPRE numeri esatti dai dati forniti
- Ancora SEMPRE al timeframe (24h, 7gg, 30gg, data specifica)
- Niente generalita' tipo "le vendite vanno bene"
- Se TUTTO e' normale (nessuna anomalia/trend/milestone): { "insights": [] }
- MAX 7 insight per scansione (qualita' > quantita')

Output JSON: { "insights": [{ "content": "...", "type": "anomaly|trend|milestone", "importance": 5-9 }] }`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: `KPI Snapshot (${summary.date}):\n${JSON.stringify(summary).slice(0, 30_000)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const raw = json?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)
    const insights = Array.isArray(parsed?.insights) ? parsed.insights : []
    return insights
      .filter(i => i && typeof i.content === 'string' && i.content.trim().length > 15)
      .slice(0, 7)
      .map(i => ({
        content: i.content.trim(),
        role: 'insight',
        importance: Number.isFinite(i.importance) ? Math.max(5, Math.min(9, Math.round(i.importance))) : 7,
      }))
  } catch (e) {
    console.log('[memory] extractInsightsFromComparison threw:', e?.message)
    return []
  }
}

function pickKeyMetrics(payload) {
  if (!payload || typeof payload !== 'object') return null
  return {
    revenue: payload?.shopifyRange?.revenue,
    orders: payload?.shopifyRange?.orders,
    aov: payload?.aovLive,
    nc: payload?.shopifyRange?.nc,
    rc: payload?.shopifyRange?.rc,
    sessions: payload?.shopifyRange?.sessions,
    metaSpend: payload?.metaSpend,
    metaImpressions: payload?.metaRange?.impressions,
    metaClicks: payload?.metaRange?.clicks,
    topProducts: (payload?.shopifyTopProducts || []).slice(0, 5).map(p => ({
      name: p.label || p.product, revenue: p.revenue || p.value, orders: p.orders,
    })),
    marketingSources: (payload?.shopifyMarketingSources || []).slice(0, 5).map(s => ({
      source: s.label || s.source, revenue: s.revenue || s.value, orders: s.orders,
    })),
    dayBreakdown: (payload?.shopifyDayBreakdown || []).slice(0, 7),
  }
}

function pickMetaMetrics(payload) {
  if (!payload || typeof payload !== 'object') return null
  // /api/meta-detail ritorna { summary, rows, dailySeries, todos, ... }
  return {
    summary: payload?.summary || null,
    todos: (payload?.todos || []).slice(0, 6),
    topRows: (payload?.rows || []).slice(0, 8).map(r => ({
      name: r.name || r.adset_name || r.campaign_name,
      spend: r.spend, impressions: r.impressions, clicks: r.clicks,
      ctr: r.ctr, cpm: r.cpm, frequency: r.frequency, outboundClicks: r.outbound_clicks,
    })),
  }
}

function pickKlaviyoMetrics(payload) {
  if (!payload || typeof payload !== 'object') return null
  // /api/klaviyo ritorna { metrics, kpis, revenueBreakdown, ... }
  return {
    kpis: payload?.kpis || null,
    revenueBreakdown: payload?.revenueBreakdown || null,
    topMetrics: Array.isArray(payload?.metrics) ? payload.metrics.slice(0, 5) : null,
  }
}

function pickGa4Metrics(payload) {
  if (!payload || typeof payload !== 'object') return null
  // /api/ga4 ritorna { summary, channels, topPages, topCountries, ... }
  return {
    summary: payload?.summary || null,
    topChannels: (payload?.channels || []).slice(0, 5),
    topPages: (payload?.topPages || []).slice(0, 5),
  }
}

// Formatta un array di memorie in un blocco di system prompt.
// Usato dal buildAgentContext per iniettare le memorie recall-ate.
export function formatMemoriesForPrompt(memories) {
  if (!Array.isArray(memories) || memories.length === 0) return ''
  const lines = memories.map((m, i) => {
    const tag = m.role === 'preference' ? '⚙️' :
                m.role === 'fact'       ? '📌' :
                m.role === 'insight'    ? '💡' : '·'
    return `${tag} ${m.content}`
  })
  return lines.join('\n')
}
