import { getServerSupabase } from '../supabase/server'
import { buildBrandContext } from './brand'
import { recall, formatMemoriesForPrompt, extractMemoriesFromTurn, rememberBatch } from './agentMemory'

// ============================================================================
//  Agent Context Combinator — unico entry point per gli agent.
//
//  buildAgentContext({ agentId, query }) → blocco da prepend al system prompt:
//
//      [BRAND CONTEXT]                 ← da brand_identity
//      Azienda: STMN Fitness
//      Categoria: Fitness
//      ...
//
//      [MEMORIE RILEVANTI]             ← da agent_memories (recall semantico)
//      ⚙️ preferenza: risposte concise
//      📌 fatto: MER target 2.5x
//      💡 insight: Picsil promo il 15
//
//  Defensive: se Supabase down o non autenticato → ritorna fallback (default
//  brand STMN + no memorie). Gli agent funzionano sempre, magari meno
//  verticali.
// ============================================================================

async function currentUserId() {
  try {
    const sb = getServerSupabase()
    const { data: { user } } = await sb.auth.getUser()
    return user?.id || null
  } catch {
    return null
  }
}

export async function buildAgentContext({ agentId, query, memoryLimit = 6 }) {
  const userId = await currentUserId()

  // Esegui brand + memory in parallelo per minimizzare latenza
  const [brandBlock, memories] = await Promise.all([
    buildBrandContext(),
    userId && query
      ? recall({ userId, agentId, query, limit: memoryLimit })
      : Promise.resolve([]),
  ])

  const memBlock = formatMemoriesForPrompt(memories)

  const parts = []
  if (brandBlock) {
    parts.push(`## CONTESTO BRAND\n${brandBlock}`)
  }
  if (memBlock) {
    parts.push(`## MEMORIE RILEVANTI (apprese da conversazioni precedenti)\n${memBlock}`)
  }

  return {
    userId,
    contextBlock: parts.length ? parts.join('\n\n') + '\n' : '',
    memoriesUsed: memories.length,
  }
}

// Aggancia all'agent come post-step: estrai memorie dall'ultimo turn e
// salvale in DB. Fire-and-forget (non blocca la response).
export async function persistTurnMemory({ agentId, userId, userMessage, assistantMessage }) {
  if (!userId || !userMessage || !assistantMessage) return
  try {
    const memories = await extractMemoriesFromTurn({ userMessage, assistantMessage, agentId })
    if (memories.length === 0) return
    await rememberBatch(memories.map(m => ({
      userId, agentId,
      content: m.content,
      role: m.role,
      importance: m.importance,
      source: 'extracted',
    })))
  } catch (e) {
    console.log('[agentContext] persistTurnMemory threw:', e?.message)
  }
}
