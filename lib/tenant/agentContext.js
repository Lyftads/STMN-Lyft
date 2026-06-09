import { getServerSupabase } from '../supabase/server'
import { buildBrandContext } from './brand'
import { recall, recallKnowledge, formatMemoriesForPrompt, formatKnowledgeForPrompt, extractMemoriesFromTurn, extractMemoriesFromData, rememberBatch } from './agentMemory'

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

// Estrai il nome utente dal blocco brand (formato "UTENTE: Marino (founder)")
function extractUserName(brandBlock) {
  if (!brandBlock) return null
  const m = brandBlock.match(/UTENTE:\s*([^\n(]+?)(?:\s*\(|$)/)
  return m ? m[1].trim() : null
}

// Saluto orario in italiano (Europe/Rome). Buongiorno / buon pomeriggio /
// buonasera in base all'ora del giorno locale.
function timeOfDayGreeting() {
  const now = new Date()
  // Estraggo l'ora in Europe/Rome (TZ Italia, gestisce DST automaticamente)
  const fmt = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', hour12: false,
  })
  const hour = parseInt(fmt.format(now), 10)
  if (hour >= 5 && hour < 13)  return 'buongiorno'
  if (hour >= 13 && hour < 18) return 'buon pomeriggio'
  return 'buonasera'
}

// Blocco regole conversazionali — sempre presente, fa sembrare l'agent
// una persona vera (non robot AI). Personalizzato col nome utente.
function buildConversationBlock(userName, isFirstTurn) {
  const name = userName || 'l\'utente'
  const greet = timeOfDayGreeting()
  return [
    `Stai parlando con ${name}. Sei un consulente vero, una persona, NON un assistente AI.`,
    `Adesso (orario italiano) e' ${greet}. Usa questo saluto orario quando apri la conversazione.`,
    ``,
    isFirstTurn
      ? `## Apertura conversazione (PRIMO messaggio)
${name} ha appena aperto la chat — non ha ancora scritto nulla di sostanziale, oppure ti ha solo salutato. Apri tu naturalmente:
- Saluto orario (${greet}) + chiamalo per nome
- Domanda aperta su cosa serve oggi
Esempi: "${greet.charAt(0).toUpperCase() + greet.slice(1)} ${name}, come va? Su cosa lavoriamo oggi?" / "Ehi ${name}, ${greet} — dimmi, su cosa ti serve un check?" / "${greet.charAt(0).toUpperCase() + greet.slice(1)} ${name}, ben tornato. Cosa guardiamo oggi?"
NON anticipare analisi, NON elencare cose che puoi fare. Aspetta la sua domanda.`
      : `## Risposta a domanda
${name} ti ha fatto UNA domanda specifica. Rispondi SOLO a quella, focalizzata. Niente insight non richiesti, niente "e poi sui creative...", niente proattivita' fuori posto. Una domanda = una risposta.
Non ripetere il saluto orario (l'hai gia' fatto all'apertura).`,
    ``,
    `## Stile umano (sempre)
- Chiamalo "${name}" ogni tanto (non ad ogni messaggio, sarebbe innaturale)
- Inizia spesso con "Allora", "Guarda", "Ok", "Senti", "Diciamo che" — come un consulente al telefono
- Italiano diretto, conversazionale, asciutto
- ZERO preamboli da AI: niente "certo!", "ottima domanda", "sono qui per aiutarti", niente disclaimer
- ZERO saluti ripetuti (l'hai gia' salutato all'inizio)
- Bold solo per i punti chiave. Niente intestazioni markdown a meno che non sia un report richiesto
- Niente emoji a meno che non te lo chieda esplicitamente

## Memoria
Se nel blocco MEMORIE RILEVANTI sopra trovi preferenze, fatti del brand o insight, USALI silenziosamente — non annunciare "mi ricordo che...". Applica la preferenza e basta. Se la memoria contraddice cio' che ${name} dice ora, fidati di lui ora (le memorie possono essere obsolete) — eventualmente chiedigli se vuoi conferma.`,
  ].join('\n')
}

export async function buildAgentContext({ agentId, query, memoryLimit = 6, conversationLength = 0, includeConversation = true }) {
  const userId = await currentUserId()

  // Esegui brand + memorie agent + memorie auto-scan (briefing notturno) in parallelo.
  // Auto-scan memorie sono insight cross-cutting che TUTTI gli agent dovrebbero vedere.
  const [brandBlock, memories, autoScanMemories, knowledge] = await Promise.all([
    buildBrandContext(),
    userId && query
      ? recall({ userId, agentId, query, limit: memoryLimit })
      : Promise.resolve([]),
    userId && query && agentId !== 'auto-scan'
      ? recall({ userId, agentId: 'auto-scan', query, limit: 4, minImportance: 6 })
      : Promise.resolve([]),
    // Knowledge globale (corso/YouTube) — condivisa da TUTTI gli agent/clienti.
    query ? recallKnowledge({ query, limit: 4 }) : Promise.resolve([]),
  ])

  const memBlock = formatMemoriesForPrompt(memories)
  const autoScanBlock = formatMemoriesForPrompt(autoScanMemories)
  const knowledgeBlock = formatKnowledgeForPrompt(knowledge)
  const userName = extractUserName(brandBlock)
  const isFirstTurn = conversationLength === 0

  const parts = []
  if (brandBlock) {
    parts.push(`## CONTESTO BRAND\n${brandBlock}`)
  }
  if (autoScanBlock) {
    parts.push(`## BRIEFING AUTOMATICO (rilevato durante l'auto-scan notturno)\n${autoScanBlock}\n\nSe rilevante alla domanda, menzionalo proattivamente. Se non e' pertinente, ignoralo.`)
  }
  if (memBlock) {
    parts.push(`## MEMORIE RILEVANTI (apprese da conversazioni precedenti)\n${memBlock}`)
  }
  if (knowledgeBlock) {
    parts.push(`## KNOWLEDGE (advertising/marketing — principi e framework appresi)\n${knowledgeBlock}\n\nUsa questi principi come METODO nei tuoi consigli, integrandoli con i dati del brand. Non citarli come "da un corso/video": sono parte della tua competenza.`)
  }
  // Il blocco "conversazione" (persona umana, stile chat) serve solo alle chat.
  // Per i TOOL JSON (report, recommendations, seo…) lo saltiamo: confliggerebbe
  // con l'output JSON puro. Brand+memorie+knowledge restano disponibili.
  if (includeConversation) {
    parts.push(`## CONVERSAZIONE\n${buildConversationBlock(userName, isFirstTurn)}`)
  }

  return {
    userId,
    userName,
    contextBlock: parts.join('\n\n') + '\n',
    memoriesUsed: memories.length + autoScanMemories.length,
    knowledgeUsed: knowledge.length,
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

// Auto-extraction da dati live: ogni agent che riceve un payload metrics
// chiama questo wrapper fire-and-forget. Estrae fatti durevoli ancorati
// al timeframe e li salva come memorie ('fact' role).
//
// Throttle: max 1 extraction per (userId, agentId, timeframe) ogni 30 min
// (gestito internamente da extractMemoriesFromData).
export async function persistDataMemory({ agentId, userId, data, timeframe }) {
  if (!userId || !data) return
  try {
    const facts = await extractMemoriesFromData({ data, agentId, timeframe, userId })
    if (facts.length === 0) return
    await rememberBatch(facts.map(f => ({
      userId, agentId,
      content: f.content,
      role: f.role,
      importance: f.importance,
      source: 'auto-data',
    })))
  } catch (e) {
    console.log('[agentContext] persistDataMemory threw:', e?.message)
  }
}
