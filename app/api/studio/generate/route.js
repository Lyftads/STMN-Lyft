export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getImageModel, getFormat } from '../../../../lib/studio/models'
import { getAuthUser, getBalance, spendCredits, addCredits } from '../../../../lib/studio/credits'
import { buildStudioContext } from '../../../../lib/studio/context'
import { persistMedia, saveGeneration } from '../../../../lib/studio/persist'

const OPENAI_KEY = process.env.OPENAI_API_KEY
const FAL_KEY = process.env.FAL_KEY

const json = (d, s = 200) => NextResponse.json(d, { status: s })

// Potenzia la descrizione libera dell'utente in un prompt immagine forte.
// I modelli rendono meglio in inglese; manteniamo soggetto/brand fedeli.
async function enhancePrompt(userPrompt, style, contextBlock, refImages = []) {
  if (!OPENAI_KEY) return userPrompt
  try {
    const ctx = contextBlock ? `\n\nCLIENT CONTEXT (ground the visual in this brand — products, colors, tone, what converts):\n${contextBlock}` : ''
    const hasRefs = Array.isArray(refImages) && refImages.length > 0
    // Con immagini di riferimento → GPT-4o vision le analizza e ne incorpora
    // soggetto/stile/colori nel prompt. Senza → gpt-4o-mini testuale.
    const userContent = hasRefs
      ? [
          { type: 'text', text: `Style: ${style || 'commercial advertising photography'}\nRequest: ${userPrompt}${ctx}\n\nUse the attached reference image(s) as visual reference: replicate the product/subject, style, colors and framing faithfully.` },
          ...refImages.slice(0, 3).map(u => ({ type: 'image_url', image_url: { url: u } })),
        ]
      : `Style: ${style || 'commercial advertising photography'}\nRequest: ${userPrompt}${ctx}`
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: hasRefs ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a prompt engineer for image generation models. Rewrite the user request as ONE vivid, detailed English image prompt (subject, composition, lighting, lens, mood, color). Honor the brand identity, real products and palette from the client context when relevant. If reference images are attached, describe and preserve their subject/style/colors. Keep any product/brand/text faithful. No preamble, output only the prompt.' },
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 260,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return userPrompt
    const d = await res.json()
    return d.choices?.[0]?.message?.content?.trim() || userPrompt
  } catch { return userPrompt }
}

async function genFal(model, prompt, fmt) {
  if (!FAL_KEY) return { error: 'FAL_KEY non configurata su Vercel.' }
  const aspect = fmt.id === 'vertical' ? '9:16' : fmt.id === 'landscape' ? '16:9' : '1:1'
  const body = model.id === 'imagen-4'
    ? { prompt, aspect_ratio: aspect }
    : { prompt, image_size: fmt.falSize, num_images: 1 }
  try {
    const res = await fetch(`https://fal.run/${model.falModel}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    })
    if (!res.ok) {
      const t = await res.text()
      return { error: `${model.name} ${res.status}: ${t.slice(0, 180)}` }
    }
    const d = await res.json()
    const url = d.images?.[0]?.url || d.image?.url || d.data?.[0]?.url || null
    return url ? { url } : { error: `${model.name}: nessuna immagine` }
  } catch (e) { return { error: e.message } }
}

async function genOpenAI(prompt, fmt) {
  if (!OPENAI_KEY) return { error: 'OPENAI_API_KEY non configurata.' }
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: fmt.openaiSize }),
      signal: AbortSignal.timeout(180000),
    })
    if (!res.ok) {
      const t = await res.text()
      return { error: `GPT Image ${res.status}: ${t.slice(0, 180)}` }
    }
    const d = await res.json()
    const url = d.data?.[0]?.url
    const b64 = d.data?.[0]?.b64_json
    return { url: url || (b64 ? `data:image/png;base64,${b64}` : null) }
  } catch (e) { return { error: e.message } }
}

async function generateOne(model, prompt, fmt) {
  return model.provider === 'openai' ? genOpenAI(prompt, fmt) : genFal(model, prompt, fmt)
}

export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'Body non valido' }, 400) }

  const rawPrompt = (body?.prompt || '').trim()
  if (!rawPrompt) return json({ error: 'Descrivi cosa vuoi generare' }, 400)

  const model = getImageModel(body?.model) || getImageModel('flux-pro')
  const fmt = getFormat(body?.format)
  const count = Math.min(4, Math.max(1, parseInt(body?.count || '1')))
  const cost = model.credits * count

  // 1) Scala i crediti PRIMA di generare (atomico)
  const ref = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const spend = await spendCredits(user.id, cost, model.id, ref)
  if (!spend.ok) {
    if (spend.error === 'insufficient') {
      return json({ error: 'insufficient_credits', balance: spend.balance, needed: cost }, 402)
    }
    return json({ error: 'Errore crediti: ' + (spend.error || 'sconosciuto') }, 500)
  }

  // 2) Potenzia il prompt — grounded sul contesto del cliente (brand, prodotti,
  //    performance) — poi genera.
  let prompt = rawPrompt
  if (body?.enhance !== false) {
    const origin = req.headers.get('origin') || (req.headers.get('host') ? `https://${req.headers.get('host')}` : '')
    const cookie = req.headers.get('cookie') || ''
    let contextBlock = ''
    try { contextBlock = (await buildStudioContext({ origin, cookie })).contextBlock } catch {}
    prompt = await enhancePrompt(rawPrompt, body?.style, contextBlock, Array.isArray(body?.refImages) ? body.refImages : [])
  }
  const results = []
  for (let i = 0; i < count; i++) {
    results.push(await generateOne(model, prompt, fmt))
  }

  // 3) Rimborsa la quota fallita
  const failed = results.filter(r => r.error).length
  let balance = spend.balance
  if (failed > 0) {
    balance = await addCredits(user.id, model.credits * failed, 'refund', ref, model.id)
  }

  const ok = results.filter(r => r.url)
  if (!ok.length) {
    return json({ error: results[0]?.error || 'Generazione fallita', balance }, 502)
  }

  // 4) Persisti i media su Storage (URL permanenti) e salva le generazioni
  const images = []
  for (const r of ok) {
    const url = await persistMedia(user.id, r.url, 'image')
    images.push({ url })
    await saveGeneration({
      user_id: user.id, type: 'image', status: 'done', url,
      model: model.id, model_name: model.name, prompt, format: fmt.id,
      source: 'text', ref, credits: model.credits,
    })
  }

  return json({
    images,
    prompt,
    model: model.id,
    modelName: model.name,
    format: fmt.id,
    creditsSpent: model.credits * (count - failed),
    balance,
    partial: failed > 0,
    generatedAt: new Date().toISOString(),
  })
}
