// ============================================================================
//  Loop function-calling con STREAMING (fase 3 del cervello stile Sidekick).
//
//  Ogni chiamata OpenAI è in stream: i token di CONTENUTO vengono inoltrati
//  subito a `onDelta` (→ SSE verso il client), mentre le tool_calls vengono
//  riassemblate dai delta ed eseguite (in parallelo) tra un round e l'altro.
//  Con gpt-4o contenuto e tool_calls non si mischiano quasi mai nello stesso
//  messaggio: nel caso limite il client vede una frase parziale e poi la
//  risposta vera al round successivo — accettabile.
// ============================================================================

async function oaiStreamCall(payload, { onDelta } = {}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true, stream_options: { include_usage: true } }),
    signal: AbortSignal.timeout(90000),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    const e = new Error(`OpenAI ${res.status}: ${t.slice(0, 180)}`)
    e.status = res.status
    throw e
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = '', content = '', usage = null
  const toolCalls = [] // per index: { id, type, function: { name, arguments } }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const l = line.trim()
      if (!l.startsWith('data:')) continue
      const data = l.slice(5).trim()
      if (!data || data === '[DONE]') continue
      let j; try { j = JSON.parse(data) } catch { continue }
      if (j.usage) usage = j.usage
      const delta = j.choices?.[0]?.delta
      if (!delta) continue
      if (delta.content) {
        content += delta.content
        try { onDelta?.(delta.content) } catch {}
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const i = tc.index ?? 0
          if (!toolCalls[i]) toolCalls[i] = { id: tc.id || `call_${i}`, type: 'function', function: { name: '', arguments: '' } }
          if (tc.id) toolCalls[i].id = tc.id
          if (tc.function?.name) toolCalls[i].function.name += tc.function.name
          if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments
        }
      }
    }
  }
  return { content, toolCalls: toolCalls.filter(Boolean), usage }
}

// body = payload OpenAI SENZA messages (model, temperature, penalties…).
// Ritorna { content, usage, rounds } dopo aver inoltrato i delta a onDelta.
export async function runToolLoopStream({ body, messages, tools = null, onToolCall = null, maxRounds = 3, onDelta }) {
  let msgs = messages
  let rounds = 0
  while (true) {
    const useTools = !!(tools && onToolCall) && rounds < maxRounds
    const out = await oaiStreamCall(
      { ...body, messages: msgs, ...(useTools ? { tools, tool_choice: 'auto' } : {}) },
      { onDelta },
    )
    if (useTools && out.toolCalls.length) {
      const assistantMsg = { role: 'assistant', content: out.content || null, tool_calls: out.toolCalls }
      // Tool in parallelo (come nel loop non-stream del gateway)
      const results = await Promise.all(out.toolCalls.map(async (tc) => {
        let args = {}; try { args = JSON.parse(tc.function.arguments || '{}') } catch {}
        let result
        try { result = await onToolCall(tc.function.name, args) } catch (e) { result = { error: String(e?.message || e) } }
        return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) }
      }))
      msgs = [...msgs, assistantMsg, ...results]
      rounds++
      continue
    }
    return { content: out.content, usage: out.usage, rounds }
  }
}
