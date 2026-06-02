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
