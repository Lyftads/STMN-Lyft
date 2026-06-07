export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { aiLangSystemMessage } from '../../../../lib/i18n/aiLang'
import { buildBrandContext } from '../../../../lib/tenant/brand'

// Orchestratore (Performance Agent → azioni). Legge i dati live (metrics) + il
// brand context e propone azioni CONCRETE e cross-canale, nella forma della
// Coda Azioni. Non accoda nulla: restituisce proposte che l'utente accoda.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

const CHANNELS = ['meta', 'klaviyo', 'shopify', 'other']
const TYPES = ['pause_campaign', 'scale_budget', 'shift_budget', 'refresh_creative', 'create_campaign', 'custom']
const PRIOS = ['urgent', 'high', 'medium', 'low']

const SYSTEM_PROMPT = `Sei il "direttore d'orchestra" di un brand DTC: vedi tutti i dati (Shopify, Meta, Klaviyo, sito) e proponi azioni operative concrete.
Dai dati forniti, proponi da 2 a 5 azioni CONCRETE, cross-canale ed eseguibili. Evita banalità: ogni azione deve essere motivata dai numeri.
Rispondi SOLO con JSON: { "actions": [ { "channel": "...", "type": "...", "target_name": "...", "summary": "...", "priority": "...", "why": "..." } ] }
- channel ∈ meta | klaviyo | shopify | other
- type ∈ pause_campaign | scale_budget | shift_budget | refresh_creative | create_campaign | custom
- priority ∈ urgent | high | medium | low
- "summary" = l'azione all'imperativo, NELLA LINGUA DELL'UTENTE (es. "Sposta budget dalla campagna X alla Y")
- "why" = una frase di motivazione basata sui dati, nella lingua dell'utente
Non aggiungere testo fuori dal JSON.`

function compactMetrics(m) {
  if (!m) return null
  return {
    shopifyRange: m.shopifyRange,
    shopifyPrevRange: m.shopifyPrevRange,
    metaRange: m.metaRange,
    metaPrevRange: m.metaPrevRange,
    aovLive: m.aovLive,
    ordersLive: m.ordersLive,
    topProducts: (m.shopifyTopProducts || []).slice(0, 6).map(p => ({ name: p.label || p.product, revenue: p.value || p.revenue, orders: p.orders })),
    marketingSources: (m.shopifyMarketingSources || []).slice(0, 6),
    metaSpend: m.metaSpend,
  }
}

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })

  let b = {}
  try { b = await req.json() } catch {}
  const metrics = compactMetrics(b.metrics)

  let brand = ''
  try { brand = await buildBrandContext() } catch {}

  try {
    const langMsg = aiLangSystemMessage(b.locale)
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(langMsg ? [langMsg] : []),
          ...(brand ? [{ role: 'system', content: `BRAND:\n${String(brand).slice(0, 2000)}` }] : []),
          ...(Array.isArray(b.exclude) && b.exclude.length
            ? [{ role: 'system', content: `Azioni GIÀ in coda — NON riproporle né suggerirne di equivalenti:\n- ${b.exclude.slice(0, 30).map(String).join('\n- ').slice(0, 2000)}` }]
            : []),
          { role: 'user', content: `DATI LIVE (usa SOLO questi numeri):\n${JSON.stringify(metrics).slice(0, 6000)}` },
        ],
      }),
      signal: AbortSignal.timeout(42000),
    })
    const j = await r.json()
    if (!r.ok) return NextResponse.json({ ok: false, error: j?.error?.message || `HTTP ${r.status}` }, { status: 502 })
    let parsed = {}
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}') } catch {}
    const raw = Array.isArray(parsed.actions) ? parsed.actions : []
    const suggestions = raw.slice(0, 5).map(a => ({
      channel: CHANNELS.includes(a.channel) ? a.channel : 'other',
      type: TYPES.includes(a.type) ? a.type : 'custom',
      target_name: a.target_name ? String(a.target_name).slice(0, 160) : null,
      summary: String(a.summary || '').slice(0, 300),
      priority: PRIOS.includes(a.priority) ? a.priority : 'medium',
      why: a.why ? String(a.why).slice(0, 300) : null,
    })).filter(a => a.summary)
    return NextResponse.json({ ok: true, suggestions })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
