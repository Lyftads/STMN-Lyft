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
// Ritorna array ordinato per similarity desc.
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
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.log('[memory] recall threw:', e?.message)
    return []
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
export async function extractMemoriesFromData({ data, agentId, timeframe, userId }) {
  const key = process.env.OPENAI_API_KEY
  if (!key || !data || !userId) return []
  if (shouldThrottleExtraction(userId, agentId, timeframe)) return []

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
