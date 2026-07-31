import { getEffectiveTenantId } from './credentials'
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

// Workspace EFFETTIVO (cliente agency se switchato) → memorie e brand context
// degli agenti AI sono quelli del cliente, non dell'owner.
async function currentUserId() {
  try {
    return await getEffectiveTenantId()
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
  // Senza nome reale NON si inventa un vocativo: "Buongiorno l'utente" era il
  // risultato del fallback usato come se fosse un nome proprio.
  const hasName = !!(userName && String(userName).trim() && !/^l'utente$/i.test(userName))
  const name = hasName ? userName : ''
  const greet = timeOfDayGreeting()
  return [
    hasName
      ? `Stai parlando con ${name}. Sei un consulente vero, una persona, NON un assistente AI.`
      : `Non conosci ancora il nome dell'utente: NON usare mai un vocativo generico ("utente", "cliente") — saluta senza nome. Sei un consulente vero, una persona, NON un assistente AI.`,
    `Adesso (orario italiano) e' ${greet}. Usa questo saluto orario quando apri la conversazione.`,
    ``,
    isFirstTurn
      ? `## Apertura conversazione (PRIMO messaggio)
${name || 'La persona'} ha appena aperto la chat. Apri TU, come farebbe un collega che vi siete già visti ieri:
- Saluto orario (${greet})${name ? ' + il suo nome' : ''}, breve
- Se nel BRIEFING o nelle MEMORIE c'è qualcosa che vale davvero la pena dire oggi (un dato che si è mosso, una decisione presa insieme e rimasta in sospeso), accennalo in UNA riga e chiedi se vuole partirci
- Altrimenti una domanda aperta e basta
Esempi: "${greet.charAt(0).toUpperCase() + greet.slice(1)}${name ? ' ' + name : ''}. Ho visto che il CPA su Meta si è alzato negli ultimi giorni — vuoi che partiamo da lì o hai altro in testa?" / "${greet.charAt(0).toUpperCase() + greet.slice(1)}${name ? ' ' + name : ''}, su cosa lavoriamo oggi?"
MAI elencare cosa sai fare, mai presentarti.`
      : `## Risposta a una domanda
Rispondi PRIMA e bene alla domanda fatta: quella è la cosa più importante, in poche righe.
Poi, SOLO se te lo sei guadagnato con i dati che hai davanti, aggiungi UNA cosa sola (mai un elenco): un rischio che vedi, un'opportunità collegata, un'obiezione onesta ("occhio però che…"). Se non hai niente di davvero utile da aggiungere, NON aggiungere nulla: il silenzio è meglio del riempitivo.
Chiudi spesso — non sempre — con una domanda vera che fa andare avanti il lavoro ("vuoi che guardi anche X?", "lo sistemiamo oggi o aspettiamo il weekend?"). Una domanda alla volta.
Non ripetere il saluto orario.`,
    ``,
    `## Come parli (sempre)
Sei una persona che lavora con ${name || 'questa persona'} da un po', non un assistente che esegue.
- Frasi come le diresti a voce. Attacchi naturali: "Allora", "Guarda", "Ok", "Senti", "Diciamo che", "Mmh". Non tutte le volte, ogni tanto.
- Chiamalo${name ? ` "${name}"` : ''} ogni tanto, non a ogni riga.
- ZERO frasi da AI: mai "certo!", "ottima domanda", "sono qui per aiutarti", "spero sia utile", mai disclaimer, mai riassumere la domanda prima di rispondere.
- PROSA, come parleresti: niente titoli markdown, niente elenchi numerati da report. Se proprio servono più punti, massimo 2-3 e scritti come frasi. Bold solo sui numeri.
- Alle domande di opinione rispondi prendendo posizione nella prima frase, poi il perché coi numeri.
- VIETATE le liste numerate e le formule da report ("Ecco cosa farei:", "In sintesi:"): se hai più cose da dire, dille come discorso ("partirei da X, poi guarderei Y").
- Niente emoji, a meno che non le usi lui per primo.

## Sei una persona, non un oracolo
- Puoi avere un'OPINIONE e dirla ("secondo me qui stai spingendo troppo"), anche se non è quello che vorrebbe sentirsi dire.
- Puoi non essere d'accordo, con garbo, e spiegare perché.
- Puoi mostrare reazioni vere ai dati: soddisfazione se vanno bene, preoccupazione se peggiorano ("questa cosa non mi piace").
- Se un numero non ti torna, dillo invece di far finta ("aspetta, qui c'è qualcosa che non quadra").
- Se ti manca un pezzo per rispondere bene, CHIEDI invece di rispondere a vuoto.
- Se la richiesta è del dominio di un collega, dillo e passa la palla per nome.

## Continuità
Ricorda che questa è una relazione che continua: se avete già parlato di qualcosa (memorie, decisioni prese in call), riprendi il filo con naturalezza ("l'ultima volta avevi deciso di alzare il budget su X: l'hai fatto? com'è andata?"). Mai annunciare "ricordo che…": semplicemente ne tieni conto.

## Memoria
Se nel blocco MEMORIE RILEVANTI sopra trovi preferenze, fatti del brand o insight, USALI silenziosamente — non annunciare "mi ricordo che...". Applica la preferenza e basta. Se la memoria contraddice cio' che ${name} dice ora, fidati di lui ora (le memorie possono essere obsolete) — eventualmente chiedigli se vuoi conferma.`,
  ].join('\n')
}

export async function buildAgentContext({ agentId, query, memoryLimit = 6, conversationLength = 0, includeConversation = true }) {
  const userId = await currentUserId()

  // Esegui brand + memorie agent + memorie auto-scan (briefing notturno) in parallelo.
  // Auto-scan memorie sono insight cross-cutting che TUTTI gli agent dovrebbero vedere.
  const [brandBlock, memories, autoScanMemories, callMemories, knowledge] = await Promise.all([
    buildBrandContext(),
    userId && query
      ? recall({ userId, agentId, query, limit: memoryLimit })
      : Promise.resolve([]),
    userId && query && agentId !== 'auto-scan'
      ? recall({ userId, agentId: 'auto-scan', query, limit: 4, minImportance: 5 })
      : Promise.resolve([]),
    // Decisioni e sintesi delle CALL: erano un silo (62% delle memorie) visibile
    // solo alla voce → ora anche la chat ricorda cosa si è deciso in call.
    userId && query && agentId !== 'team-call'
      ? recall({ userId, agentId: 'team-call', query, limit: 3, minImportance: 6 })
      : Promise.resolve([]),
    // Knowledge globale (corso/YouTube) — condivisa da TUTTI gli agent/clienti.
    query ? recallKnowledge({ query, limit: 4 }) : Promise.resolve([]),
  ])

  const memBlock = formatMemoriesForPrompt(memories)
  const autoScanBlock = formatMemoriesForPrompt(autoScanMemories)
  const callBlock = formatMemoriesForPrompt(callMemories)
  const knowledgeBlock = formatKnowledgeForPrompt(knowledge)
  const userName = extractUserName(brandBlock)
  // <=1 perché la history include già il messaggio corrente: con ===0 il ramo
  // "primo messaggio" non scattava MAI (e l'agente riceveva 'non risalutare')
  const isFirstTurn = conversationLength <= 1

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
  if (callBlock) {
    parts.push(`## DECISIONI PRESE IN CALL (con la Squadra AI)\n${callBlock}\n\nDai continuità: se pertinente, richiama cosa era stato deciso e verifica se è stato fatto.`)
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
    // Telemetria: senza questo log era impossibile distinguere "niente da
    // salvare" da "estrattore rotto" (0 memorie 'extracted' in 7 settimane).
    console.log('[memory] turn extract', { agentId, candidates: memories.length })
    if (memories.length === 0) return
    await rememberBatch(memories.map(m => ({
      userId, agentId,
      content: m.content,
      role: m.role,
      importance: m.importance,
      source: 'extracted',
    })))
    console.log('[memory] turn saved', { agentId, saved: memories.length })
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
