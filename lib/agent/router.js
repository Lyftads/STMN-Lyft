// ============================================================================
//  ROUTER per tier — sceglie provider + modello in base al "tier" della skill.
//
//  Tre tier:
//   - cheap:  estrazione / traduzione / classificazione (modello economico)
//   - smart:  insight / agenti / chat (default)
//   - reason: strategia complessa / ragionamento profondo
//
//  Mapping via env "provider:model" (default → OpenAI, modello attuale):
//    AI_TIER_CHEAP=openai:gpt-4o-mini
//    AI_TIER_SMART=openai:gpt-4o
//    AI_TIER_REASON=openai:gpt-4o
//
//  Retrocompatibile: se la skill (o la call) passa un `model` esplicito, il
//  router NON viene usato (lo decide il gateway). Se non c'è env, lo `smart`
//  default = OPENAI_MODEL||gpt-4o → comportamento identico a prima.
//  Vedi docs/AI_PROVIDER.md.
// ============================================================================

import * as openai from './providers/openai'
import * as fallback from './providers/fallback'

// Registro provider disponibili. `fallback` è un provider OpenAI-compatible
// configurabile via env (può anche essere targettato da un tier, es.
// AI_TIER_REASON=fallback:anthropic/claude-3.5-sonnet).
const PROVIDERS = { openai, fallback }

// Errore "ritentabile" sul provider secondario: rete/timeout (no status),
// rate limit (429) o errori server (5xx). Gli errori 4xx (es. prompt/quota
// definitiva) NON si ritentano.
function isRetryable(e) {
  const s = e?.status
  return !s || s === 429 || s >= 500
}

// chatWithFallback(provider, params) → prova il primario; se fallisce in modo
// ritentabile e il fallback è configurato, ritenta sul provider di fallback col
// SUO modello. Se anche il fallback fallisce, propaga l'errore ORIGINALE.
export async function chatWithFallback(provider, params) {
  try {
    return await provider.chatComplete(params)
  } catch (e) {
    if (provider.id === 'fallback' || !isRetryable(e) || !fallback.isConfigured()) throw e
    try {
      const out = await fallback.chatComplete({ ...params, model: fallback.defaultModel() || params.model })
      out.__fallback = true
      return out
    } catch {
      throw e // se anche il fallback fallisce, l'errore originale è più utile
    }
  }
}

const ENV_BY_TIER = { cheap: 'AI_TIER_CHEAP', smart: 'AI_TIER_SMART', reason: 'AI_TIER_REASON' }

function smartDefault() { return `openai:${process.env.OPENAI_MODEL || 'gpt-4o'}` }
const DEFAULTS = {
  get cheap() { return 'openai:gpt-4o-mini' },
  get smart() { return smartDefault() },
  get reason() { return smartDefault() },
}

// "provider:model" → { providerId, model }. Senza ":" assume openai.
function parseSpec(spec) {
  const s = String(spec || '').trim()
  if (!s) return null
  const i = s.indexOf(':')
  if (i === -1) return { providerId: 'openai', model: s }
  return { providerId: s.slice(0, i).trim() || 'openai', model: s.slice(i + 1).trim() }
}

// resolveTier(tier) → { provider, providerId, model, tier }
export function resolveTier(tier = 'smart') {
  const t = ENV_BY_TIER[tier] ? tier : 'smart'
  const parsed = parseSpec(process.env[ENV_BY_TIER[t]]) || parseSpec(DEFAULTS[t]) || parseSpec(smartDefault())
  const provider = PROVIDERS[parsed.providerId] || PROVIDERS.openai
  return { provider, providerId: PROVIDERS[parsed.providerId] ? parsed.providerId : 'openai', model: parsed.model, tier: t }
}

export const KNOWN_PROVIDERS = PROVIDERS

// ---------------------------------------------------------------------------
//  complete() — chiamata LLM "grezza" per le route che costruiscono da sole il
//  loro prompt/contesto (NON passano da callBrain) ma vogliono comunque il
//  tiering del router e, in Fase 3, il fallback cross-provider. Sostituisce le
//  fetch dirette a OpenAI senza toccare i prompt: stesso output del modello.
//
//   complete({ tier='smart', model?, messages, temperature?, topP?, json?,
//              tools?, maxTokens?, signal? }) → { message, content, toolCalls, usage, raw }
//
//  `model` esplicito → OpenAI con quel modello; altrimenti il router sceglie
//  provider+modello in base al tier.
// ---------------------------------------------------------------------------
export async function complete({ tier = 'smart', model = null, ...rest } = {}) {
  const r = model ? { provider: PROVIDERS.openai, model } : resolveTier(tier)
  const out = await chatWithFallback(r.provider, { model: r.model, ...rest })
  return { ...out, model: out.__fallback ? (fallback.defaultModel() || r.model) : r.model }
}
