// ============================================================================
//  Provider adapter — OpenAI (Chat Completions), sul core OpenAI-compatible.
//  Comportamento identico all'originale. Vedi docs/AI_PROVIDER.md.
// ============================================================================

import { chatCompleteCore } from './_openaiCore'

export const id = 'openai'

export function isConfigured() { return !!process.env.OPENAI_API_KEY }

export function chatComplete(params = {}) {
  return chatCompleteCore({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    label: 'OpenAI',
    ...params,
  })
}
