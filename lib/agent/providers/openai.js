// ============================================================================
//  Provider adapter — OpenAI (Chat Completions), sul core OpenAI-compatible.
//  Comportamento identico all'originale. Vedi docs/AI_PROVIDER.md.
// ============================================================================

import { chatCompleteCore } from './_openaiCore'
import { chiaveOpenAI } from '../../studio/chiaveAI'

export const id = 'openai'

export function isConfigured() { return !!chiaveOpenAI() }

export function chatComplete(params = {}) {
  return chatCompleteCore({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: chiaveOpenAI(),
    label: 'OpenAI',
    ...params,
  })
}
