// ============================================================================
//  Provider adapter — FALLBACK (OpenAI-compatible, configurabile via env).
//
//  Usato dal wrapper `chatWithFallback` quando il provider primario fallisce
//  (429 / 5xx / timeout / rete). Punta a un endpoint OpenAI-compatible diverso
//  (es. OpenRouter → Claude/Gemini, Azure OpenAI, Groq…), così JSON/tools/vision
//  continuano a funzionare con lo stesso formato. Vedi docs/AI_PROVIDER.md.
//
//  Env:
//    AI_FALLBACK_BASE_URL=https://openrouter.ai/api/v1
//    AI_FALLBACK_API_KEY=sk-or-...
//    AI_FALLBACK_MODEL=anthropic/claude-3.5-sonnet
//
//  Se non configurato → isConfigured() false → nessun fallback (comportamento
//  identico a prima).
// ============================================================================

import { chatCompleteCore } from './_openaiCore'

export const id = 'fallback'

export function isConfigured() { return !!(process.env.AI_FALLBACK_API_KEY && process.env.AI_FALLBACK_BASE_URL) }

export function defaultModel() { return process.env.AI_FALLBACK_MODEL || null }

export function chatComplete(params = {}) {
  return chatCompleteCore({
    baseUrl: process.env.AI_FALLBACK_BASE_URL,
    apiKey: process.env.AI_FALLBACK_API_KEY,
    label: 'Fallback',
    ...params,
  })
}
