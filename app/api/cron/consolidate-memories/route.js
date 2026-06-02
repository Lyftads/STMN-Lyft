export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'

// ============================================================================
//  Cron settimanale consolidate-memories (Batch C — autoalimentazione agent)
//
//  Ogni domenica notte (~05:00 Europe/Rome):
//   1) Per ogni tenant: trova cluster di memorie SIMILI per agent (sim > 0.85)
//   2) Sintetizza ogni cluster di 3+ memorie in 1 fact piu' forte via gpt-4o-mini
//   3) Marca le originali con role='consolidated_into' (escluse dal recall)
//   4) Demote memorie stale (use_count=0 + 60gg + importance > 3): importance -= 2
//
//  Risultato: la knowledge cresce senza esplodere di rumore.
//
//  Auth: Bearer CRON_SECRET (stesso usato dal cron auto-scan).
// ============================================================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const SIM_THRESHOLD = 0.85
const MIN_CLUSTER_SIZE = 3

function isAuthorized(req) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

// Sintesi LLM di un cluster di memorie simili → 1 fact piu' forte
async function synthesizeCluster(memories) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  const items = memories.map((m, i) => `${i + 1}. [${m.role}, imp ${m.importance}] ${m.content}`).join('\n')
  const sysPrompt = `Sei un sintetizzatore di memorie agent. Ricevi ${memories.length} osservazioni semanticamente simili che il consulente AI ha accumulato nel tempo.
Comprimile in UNA singola memoria piu' forte che cattura il pattern. Se sono variazioni di un dato che oscilla, cattura range/trend. Se sono ripetizioni dello stesso fatto, cattura la versione piu' completa.
Output JSON: { "summary": "...", "role": "fact|insight|preference", "importance": 1-10 }
La nuova memoria deve essere piu' compatta e referenziabile delle originali.`

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: items },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content || '{}')
    if (!parsed?.summary || typeof parsed.summary !== 'string') return null
    return {
      content: parsed.summary.trim(),
      role: ['fact', 'insight', 'preference'].includes(parsed.role) ? parsed.role : 'fact',
      importance: Number.isFinite(parsed.importance)
        ? Math.max(1, Math.min(10, Math.round(parsed.importance)))
        : Math.max(...memories.map(m => m.importance || 5)),
    }
  } catch {
    return null
  }
}

// Genera embedding per la sintesi (usato poi nel salvataggio)
async function embedText(text) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data?.[0]?.embedding || null
  } catch {
    return null
  }
}

// Cosine similarity tra 2 vettori (per clustering locale)
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// Greedy clustering: per ogni memory non ancora cluster-ata, trova tutte
// quelle simili sopra threshold e formano un cluster.
function clusterMemories(memories) {
  const used = new Set()
  const clusters = []
  for (let i = 0; i < memories.length; i++) {
    if (used.has(memories[i].id)) continue
    const cluster = [memories[i]]
    used.add(memories[i].id)
    for (let j = i + 1; j < memories.length; j++) {
      if (used.has(memories[j].id)) continue
      const sim = cosineSim(memories[i].embedding, memories[j].embedding)
      if (sim >= SIM_THRESHOLD) {
        cluster.push(memories[j])
        used.add(memories[j].id)
      }
    }
    if (cluster.length >= MIN_CLUSTER_SIZE) {
      clusters.push(cluster)
    }
  }
  return clusters
}

async function processUserAgent({ admin, userId, agentId }) {
  // Carica memorie attive (non consolidate, con embedding)
  const { data: memories, error } = await admin
    .from('agent_memories')
    .select('id, role, content, embedding, importance')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .neq('role', 'consolidated_into')
    .not('embedding', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error || !memories || memories.length < MIN_CLUSTER_SIZE) {
    return { clusters: 0, consolidated: 0 }
  }

  const clusters = clusterMemories(memories)
  if (clusters.length === 0) return { clusters: 0, consolidated: 0 }

  let consolidated = 0

  for (const cluster of clusters) {
    const synthesis = await synthesizeCluster(cluster)
    if (!synthesis) continue
    const emb = await embedText(synthesis.content)
    if (!emb) continue

    // Insert sintesi
    const { error: insError } = await admin.from('agent_memories').insert({
      user_id: userId,
      agent_id: agentId,
      role: synthesis.role,
      content: synthesis.content,
      embedding: emb,
      importance: synthesis.importance,
      source: 'consolidated',
    })
    if (insError) {
      console.log('[consolidate] insert error:', insError.message)
      continue
    }

    // Marca originali come consolidated_into (cosi' il recall le esclude)
    const ids = cluster.map(m => m.id)
    const { error: updError } = await admin
      .from('agent_memories')
      .update({ role: 'consolidated_into' })
      .in('id', ids)

    if (!updError) consolidated += ids.length
  }

  return { clusters: clusters.length, consolidated }
}

// Demote memorie stale: importance -= 2 (cap 1) per memorie che:
// - use_count = 0
// - created_at > 60 giorni fa
// - importance > 3 (sotto 3 sono gia' marginali, evita di flagellarle)
async function demoteStale(admin, userId) {
  const cutoff = new Date(Date.now() - 60 * 86400 * 1000).toISOString()
  const { data, error } = await admin
    .from('agent_memories')
    .select('id, importance')
    .eq('user_id', userId)
    .lt('created_at', cutoff)
    .eq('use_count', 0)
    .gt('importance', 3)
    .limit(500)
  if (error || !data || data.length === 0) return 0

  // Update in batch
  const updates = data.map(m => ({
    id: m.id,
    importance: Math.max(1, m.importance - 2),
  }))
  // Postgres non supporta bulk update di valori diversi facilmente — facciamo loop
  let demoted = 0
  for (const u of updates) {
    const { error: e } = await admin
      .from('agent_memories')
      .update({ importance: u.importance })
      .eq('id', u.id)
    if (!e) demoted++
  }
  return demoted
}

export async function GET(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 })

  // Trova utenti con almeno 30 memorie (sotto soglia minima di consolidamento)
  const { data: users, error } = await admin
    .from('agent_memories')
    .select('user_id, agent_id')
    .neq('role', 'consolidated_into')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dedup per (user_id, agent_id)
  const pairs = new Map()
  for (const r of (users || [])) {
    const key = `${r.user_id}|${r.agent_id}`
    pairs.set(key, { userId: r.user_id, agentId: r.agent_id })
  }

  const results = []
  for (const { userId, agentId } of pairs.values()) {
    try {
      const { clusters, consolidated } = await processUserAgent({ admin, userId, agentId })
      results.push({ userId, agentId, clusters, consolidated })
    } catch (e) {
      results.push({ userId, agentId, error: e?.message })
    }
  }

  // Demote stale per ogni user (una volta, non per agent)
  const userIds = new Set(Array.from(pairs.values()).map(p => p.userId))
  let totalDemoted = 0
  for (const uid of userIds) {
    try {
      totalDemoted += await demoteStale(admin, uid)
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    runAt: new Date().toISOString(),
    pairsProcessed: pairs.size,
    results,
    totalDemoted,
  })
}

export const POST = GET
