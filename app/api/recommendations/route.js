export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { getServerSupabase, getAdminSupabase } from '../../../lib/supabase/server'
import { buildBrandContext } from '../../../lib/tenant/brand'
import { recall, buildKnowledgeBlock } from '../../../lib/tenant/agentMemory'
import { complete } from '../../../lib/agent/router'

// ============================================================================
//  Proactive Recommendations
//
//  POST { metrics, preset }
//  → Genera 3-6 raccomandazioni concrete e prioritizzate basate su:
//     - dati live (metrics passati dal frontend)
//     - brand context (companies.brand_identity)
//     - memorie precedenti rilevanti (recall semantico)
//     - briefing notturno auto-scan
//  → Output: { recommendations: [{ id, priority, title, action, why,
//             expected_impact, category }] }
//
//  Cache: in-memory per 15 min per evitare di rigenerare ad ogni mount.
//  Key: userId + preset + metrics hash compatto.
// ============================================================================

const cache = new Map() // key → { value, expiresAt }
const TTL_MS = 15 * 60_000

function cacheKey(userId, preset, metrics) {
  const sig = JSON.stringify({
    rev: metrics?.shopifyRange?.revenue,
    ord: metrics?.shopifyRange?.orders,
    spend: metrics?.metaSpend,
    nc: metrics?.shopifyRange?.nc,
  })
  return `${userId}|${preset}|${sig}`
}

function getCache(key) {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  return null
}

function setCache(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS })
}

async function getUserId() {
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  return user?.id || null
}

function compactMetrics(m) {
  if (!m) return null
  return {
    shopifyRange: m.shopifyRange,
    shopifyPrevRange: m.shopifyPrevRange,
    metaRange: m.metaRange,
    metaPrevRange: m.metaPrevRange,
    aovLive: m.aovLive,
    ordersLive: m.ordersLive,
    topProducts: (m.shopifyTopProducts || []).slice(0, 6).map(p => ({
      name: p.label || p.product, revenue: p.value || p.revenue, orders: p.orders,
    })),
    marketingSources: (m.shopifyMarketingSources || []).slice(0, 6),
    metaSpend: m.metaSpend,
  }
}

export async function POST(req) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata' }, { status: 500 })

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const metrics = body?.metrics || null
  const preset = body?.preset || 'last_30d'

  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Cache hit?
  const ck = cacheKey(userId, preset, metrics)
  const cached = getCache(ck)
  if (cached) {
    return NextResponse.json({ ...cached, cached: true })
  }

  // Gather context in parallelo
  const [brandBlock, recentMemories, autoScanMemories] = await Promise.all([
    buildBrandContext(),
    recall({ userId, agentId: 'kpi', query: 'top recommendations priorities', limit: 8 }),
    recall({ userId, agentId: 'auto-scan', query: 'anomalies trends milestones', limit: 8, minImportance: 6 }),
  ])

  const memText = [...recentMemories, ...autoScanMemories]
    .map(m => `[imp ${m.importance}] ${m.content}`)
    .join('\n')

  const sysPrompt = `Sei l'advisor strategico del brand descritto nel CONTESTO BRAND. Hai accesso a:
1. CONTESTO BRAND (chi e' il brand, prodotti, target)
2. MEMORIE PRECEDENTI (cosa hai imparato dalle conversazioni passate + briefing notturno)
3. METRICHE LIVE del periodo selezionato (${preset})

Devi generare 3-6 RACCOMANDAZIONI PROATTIVE: azioni concrete che il founder potrebbe fare nelle prossime 24-72h per migliorare performance, ridurre rischio, o cogliere opportunita'.

ESEMPI BUONI:
- "Pausa adset 'Backtobox Lookalike' (ROAS 1.2x, sotto target 2.5x da 4 giorni)"
- "Testa nuova creative video sul prodotto Paracalli Premium (top revenue questa settimana, vecchia creative ha frequency 3.8 — saturata)"
- "Sposta 30% budget da Audience Cold a Retargeting (CPM cold cresce +40% vs settimana scorsa)"

REGOLE:
- Cita SEMPRE numeri esatti dalle metriche fornite
- Azioni SPECIFICHE (cosa fare, dove, quando, quanto)
- Priorita': 'urgent' (anomalia critica), 'high' (impatto alto), 'medium' (opportunita'), 'low' (nice-to-have)
- Categoria: 'meta_ads', 'shopify_product', 'pricing', 'creative', 'audience', 'klaviyo', 'cro'
- Expected impact: stima qualitativa breve (es: "+15-20% ROAS settimana prossima")
- Why: 1 frase sul motivo (perche' adesso, basato su quale segnale)
- Rispetta il BRAND GUARD del brand context
- Usa le MEMORIE per personalizzare (target MER, prodotti winners, pattern del founder)

Output JSON:
{
  "recommendations": [
    {
      "priority": "urgent|high|medium|low",
      "category": "meta_ads|shopify_product|pricing|creative|audience|klaviyo|cro",
      "title": "azione breve (max 12 parole)",
      "action": "cosa fare esattamente, con numeri (1-2 frasi)",
      "why": "perche' adesso, quale segnale (1 frase)",
      "expected_impact": "stima qualitativa breve"
    }
  ]
}
Se i dati non bastano per raccomandazioni significative: { "recommendations": [] }`

  const userPayload = `## CONTESTO BRAND\n${brandBlock || 'N/A'}\n\n## MEMORIE PRECEDENTI\n${memText || 'Nessuna memoria ancora.'}\n\n## METRICHE LIVE (${preset})\n${JSON.stringify(compactMetrics(metrics)).slice(0, 30_000)}`

  // Knowledge globale (corso + video): principi di advertising/marketing come
  // metodo. Si auto-esclude se non c'è nulla di semanticamente pertinente.
  const kb = await buildKnowledgeBlock(`raccomandazioni performance marketing advertising e-commerce ${preset}`)

  try {
    // tier 'cheap' = gpt-4o-mini di default (identico a prima), ma ora passa dal
    // router → tiering via env + fallback (Fase 3) senza toccare il prompt.
    let res
    try {
      res = await complete({
        tier: 'cheap',
        messages: [
          { role: 'system', content: sysPrompt },
          ...(kb ? [{ role: 'system', content: kb }] : []),
          ...(aiLangSystemMessage(body?.locale) ? [aiLangSystemMessage(body.locale)] : []),
          { role: 'user', content: userPayload },
        ],
        json: true,
        temperature: 0.3,
        maxTokens: 1800,
        signal: AbortSignal.timeout(45_000),
      })
    } catch (e) {
      return NextResponse.json({ error: e?.message || 'OpenAI error' }, { status: 502 })
    }
    const raw = res?.content || '{}'
    const parsed = JSON.parse(raw)
    const recommendations = (Array.isArray(parsed?.recommendations) ? parsed.recommendations : [])
      .filter(r => r && typeof r.title === 'string' && typeof r.action === 'string')
      .slice(0, 6)
      .map((r, i) => ({
        id: `rec-${Date.now()}-${i}`,
        priority: ['urgent', 'high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
        category: typeof r.category === 'string' ? r.category : 'other',
        title: r.title.trim(),
        action: r.action.trim(),
        why: typeof r.why === 'string' ? r.why.trim() : '',
        expected_impact: typeof r.expected_impact === 'string' ? r.expected_impact.trim() : '',
      }))

    const result = {
      recommendations,
      generatedAt: new Date().toISOString(),
      preset,
    }
    setCache(ck, result)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'OpenAI error' }, { status: 500 })
  }
}
