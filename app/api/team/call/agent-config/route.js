export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../../lib/tenant/credentials'
import { CALL_AGENTS } from '../../../../../lib/agent/callAgents'

// ============================================================================
//  Diagnostica/configurazione degli agent ElevenLabs (SOLO owner).
//  GET  → legge la config di ogni agente e ne estrae la sezione overrides
//         (serve a capire quale permesso abilita il custom LLM extra body).
//  POST → abilita gli override necessari su TUTTI gli agenti della squadra.
// ============================================================================

const EL = 'https://api.elevenlabs.io/v1/convai/agents'

async function ownerOnly() {
  // Identità REALE: col tenant effettivo qualunque membro/guest del
  // workspace owner passava il gate (e poteva riconfigurare gli agenti).
  const uid = await getCurrentUserId().catch(() => null)
  return !!(uid && uid === process.env.LYFT_OWNER_USER_ID)
}

export async function GET(req) {
  if (!(await ownerOnly())) return NextResponse.json({ error: 'solo owner' }, { status: 403 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return NextResponse.json({ error: 'ELEVENLABS_API_KEY mancante' }, { status: 500 })

  const only = new URL(req.url).searchParams.get('agent') // es. ceo
  const entries = Object.entries(CALL_AGENTS).filter(([k]) => !only || k === only)
  const out = {}
  for (const [name, id] of entries) {
    try {
      const r = await fetch(`${EL}/${id}`, { headers: { 'xi-api-key': key }, cache: 'no-store' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { out[name] = { error: `${r.status}: ${JSON.stringify(j).slice(0, 200)}` }; continue }
      const ps = j.platform_settings || {}
      out[name] = {
        id,
        // Chiavi dell'oggetto overrides così come le espone l'API (serve a
        // scoprire il nome esatto del permesso per l'extra body).
        overridesKeys: Object.keys(ps.overrides || {}),
        overrides: ps.overrides || null,
        llm: j.conversation_config?.agent?.prompt?.llm || null,
        customLlmUrl: j.conversation_config?.agent?.prompt?.custom_llm?.url || null,
        customLlmKeys: Object.keys(j.conversation_config?.agent?.prompt?.custom_llm || {}),
      }
    } catch (e) {
      out[name] = { error: String(e?.message || e) }
    }
  }
  return NextResponse.json({ agents: out }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req) {
  if (!(await ownerOnly())) return NextResponse.json({ error: 'solo owner' }, { status: 403 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return NextResponse.json({ error: 'ELEVENLABS_API_KEY mancante' }, { status: 500 })

  let body = {}
  try { body = await req.json() } catch {}
  // patch: oggetto da mergiare in platform_settings.overrides
  const patch = body.overrides && typeof body.overrides === 'object' ? body.overrides : null
  if (!patch) return NextResponse.json({ error: 'overrides mancante' }, { status: 400 })

  const results = {}
  for (const [name, id] of Object.entries(CALL_AGENTS)) {
    try {
      const curRes = await fetch(`${EL}/${id}`, { headers: { 'xi-api-key': key }, cache: 'no-store' })
      if (!curRes.ok) {
        // Senza la config attuale la PATCH cancellerebbe platform_settings
        // (widget, privacy, evaluation): meglio saltare questo agente.
        results[name] = { ok: false, error: `lettura config fallita: ${curRes.status}` }
        continue
      }
      const cur = await curRes.json()
      if (!cur?.platform_settings) {
        results[name] = { ok: false, error: 'platform_settings assente: PATCH annullata' }
        continue
      }
      const merged = { ...(cur.platform_settings.overrides || {}), ...patch }
      const r = await fetch(`${EL}/${id}`, {
        method: 'PATCH',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_settings: { ...(cur.platform_settings || {}), overrides: merged } }),
      })
      const j = await r.json().catch(() => ({}))
      results[name] = r.ok
        ? { ok: true, overrides: j.platform_settings?.overrides || merged }
        : { ok: false, error: `${r.status}: ${JSON.stringify(j).slice(0, 200)}` }
    } catch (e) {
      results[name] = { ok: false, error: String(e?.message || e) }
    }
  }
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } })
}
