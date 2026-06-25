// ============================================================================
//  Provider adapter — OpenAI (Chat Completions).
//
//  Estratto da gateway.js (ex `callOnce`) dietro un'interfaccia normalizzata,
//  così il cervello può domani puntare ad altri backend (Claude/Gemini/open)
//  senza cambiare nulla nel gateway. Vedi docs/AI_PROVIDER.md.
//
//  Comportamento IDENTICO all'originale: stesso endpoint, stesso body, stesso
//  timeout, stessa propagazione errori (Error con .status).
// ============================================================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export const id = 'openai'

// chatComplete({ model, messages, temperature, topP, presencePenalty,
//   frequencyPenalty, json, tools, signal })
//   → { message, content, toolCalls, usage, raw }
export async function chatComplete({
  model,
  messages,
  temperature,
  topP,
  presencePenalty,
  frequencyPenalty,
  json = false,
  tools = null,
  signal,
} = {}) {
  if (!process.env.OPENAI_API_KEY) { const e = new Error('OPENAI_API_KEY non configurata'); e.status = 500; throw e }

  const body = {
    model,
    messages,
    temperature,
    ...(topP != null ? { top_p: topP } : {}),
    ...(presencePenalty != null ? { presence_penalty: presencePenalty } : {}),
    ...(frequencyPenalty != null ? { frequency_penalty: frequencyPenalty } : {}),
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    ...(tools ? { tools, tool_choice: 'auto' } : {}),
  }

  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
    signal,
  })
  if (!r.ok) {
    const t = await r.text()
    const err = new Error(`OpenAI ${r.status}: ${t.slice(0, 400)}`)
    err.status = r.status
    throw err
  }
  const j = await r.json()
  const msg = j?.choices?.[0]?.message || {}
  return {
    message: msg,                  // messaggio assistant grezzo (per il tool-loop)
    content: msg.content || '',
    toolCalls: msg.tool_calls || [],
    usage: j?.usage || null,
    raw: j,
  }
}
