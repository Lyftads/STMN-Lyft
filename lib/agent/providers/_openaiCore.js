// ============================================================================
//  Core condiviso per provider OpenAI-compatible (OpenAI, OpenRouter, Azure,
//  Groq, Together, DeepSeek, locale…). Stesso schema body/response → un solo
//  client, parametrizzato per baseUrl + apiKey. Vedi docs/AI_PROVIDER.md.
// ============================================================================

// chatCompleteCore({ baseUrl, apiKey, label, model, messages, temperature,
//   topP, presencePenalty, frequencyPenalty, json, tools, maxTokens, signal })
//   → { message, content, toolCalls, usage, raw }
export async function chatCompleteCore({
  baseUrl,
  apiKey,
  label = 'LLM',
  model,
  messages,
  temperature,
  topP,
  presencePenalty,
  frequencyPenalty,
  json = false,
  tools = null,
  maxTokens = null,
  signal,
}) {
  if (!apiKey) { const e = new Error(`${label}: API key non configurata`); e.status = 500; throw e }
  if (!baseUrl) { const e = new Error(`${label}: base URL non configurata`); e.status = 500; throw e }

  const body = {
    model,
    messages,
    temperature,
    ...(topP != null ? { top_p: topP } : {}),
    ...(presencePenalty != null ? { presence_penalty: presencePenalty } : {}),
    ...(frequencyPenalty != null ? { frequency_penalty: frequencyPenalty } : {}),
    ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    ...(tools ? { tools, tool_choice: 'auto' } : {}),
  }

  const r = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  })
  if (!r.ok) {
    const t = await r.text()
    const err = new Error(`${label} ${r.status}: ${t.slice(0, 400)}`)
    err.status = r.status
    throw err
  }
  const j = await r.json()
  const msg = j?.choices?.[0]?.message || {}
  return {
    message: msg,
    content: msg.content || '',
    toolCalls: msg.tool_calls || [],
    usage: j?.usage || null,
    raw: j,
  }
}
