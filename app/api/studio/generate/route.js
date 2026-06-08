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

// "Spina dorsale" qualità (Kive-grade): direzione fotografica editoriale/commerciale
// che ogni prompt eredita. Garantisce realismo alto, ottica/luce pro, zero artefatti AI.
const QUALITY_SPINE = 'Render as a high-end editorial/commercial photograph (Kive-grade): photorealistic, shot on a full-frame camera with a fast prime lens, deliberate professional lighting, crisp tack-sharp focus on the subject with natural depth of field, fine micro-detail and realistic textures, natural skin with pores (no plastic/AI look), accurate color and true-to-life materials, balanced composition, premium magazine finish. Avoid: warped anatomy, extra fingers, garbled text or logos, watermarks, lowres, oversharpening, HDR halos, cartoon or 3D-render look.'

// Spina qualità per il path PRODOTTO (Kontext): fedeltà assoluta del prodotto.
// Il modello umano/scena vanno renderizzati SE descritti, ma il prodotto resta identico.
const PRODUCT_QUALITY_SPINE = 'High-end commercial/editorial photograph (Kive-grade): photorealistic, professional lighting, tack-sharp, true-to-life materials and colors, natural skin texture when a person is present, premium finish. The featured product must stay pixel-identical to the input image. Avoid: redesigning/recoloring/reshaping/relabeling the product, garbled or altered text/logos on the product, warped geometry, watermarks, lowres, cartoon or 3D-render look.'

// Potenzia la descrizione libera dell'utente in un prompt immagine forte.
// I modelli rendono meglio in inglese; manteniamo soggetto/brand fedeli.
async function enhancePrompt(userPrompt, style, contextBlock, refImages = [], styleRefs = []) {
  if (!OPENAI_KEY) return [style, userPrompt, QUALITY_SPINE].filter(Boolean).join('. ')
  try {
    const ctx = contextBlock ? `\n\nCLIENT CONTEXT (ground the visual in this brand — products, colors, tone, what converts):\n${contextBlock}` : ''
    // Mystic-style: distingue reference di STRUTTURA/soggetto da reference di STILE.
    const styleSet = new Set((styleRefs || []).filter(Boolean))
    const subjectRefs = (refImages || []).filter(u => u && !styleSet.has(u))
    const visionRefs = [...subjectRefs, ...styleSet].slice(0, 4)
    const hasRefs = visionRefs.length > 0
    const refInstr = styleSet.size > 0
      ? `The FIRST ${subjectRefs.length} reference image(s) define the SUBJECT/structure — preserve their product/subject, shape and composition faithfully. The LAST ${styleSet.size} reference image(s) are STYLE references — adopt their aesthetic, color palette, lighting, texture and mood, but do NOT copy their subject.`
      : `Use the attached reference image(s) as visual reference: replicate the product/subject, style, colors and framing faithfully.`
    // Con immagini di riferimento → GPT-4o vision le analizza e ne incorpora
    // soggetto/stile/colori nel prompt. Senza → gpt-4o-mini testuale.
    const userContent = hasRefs
      ? [
          { type: 'text', text: `Style: ${style || 'commercial advertising photography'}\nRequest: ${userPrompt}${ctx}\n\n${refInstr}` },
          ...visionRefs.map(u => ({ type: 'image_url', image_url: { url: u } })),
        ]
      : `Style: ${style || 'commercial advertising photography'}\nRequest: ${userPrompt}${ctx}`
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: hasRefs ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are an elite prompt engineer for top-tier image models, producing campaign-quality results on par with Kive. Rewrite the user request as ONE vivid, richly detailed English image prompt. Be specific and concrete about: subject and styling, environment/set, composition and framing, camera and lens (e.g. 50mm/85mm full-frame), the exact lighting setup, mood and color palette. When a Style is provided, treat it as the AUTHORITATIVE art direction and build the whole scene around it. Honor the brand identity, real products and palette from the client context when relevant. If reference images are attached, describe and faithfully preserve their subject, materials, colors and framing. Keep any product/brand/text exactly faithful. End the prompt by appending these quality requirements verbatim: "${QUALITY_SPINE}" No preamble, output only the final prompt.` },
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
        max_tokens: 420,
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
  const aspect = fmt.id === 'vertical' ? '9:16' : fmt.id === 'landscape' ? '16:9' : fmt.id === 'portrait' ? '4:5' : '1:1'
  const body = model.useAspect
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

// FLUX Kontext: inserisce il PRODOTTO REALE nella scena descritta mantenendolo
// pixel-identico (fedeltà tipo Kive). Con PIÙ foto del prodotto usa l'endpoint
// multi-immagine (più angoli = più precisione). instruction = scena.
async function genKontext(model, instruction, refUrls) {
  if (!FAL_KEY) return { error: 'FAL_KEY non configurata su Vercel.' }
  const urls = (refUrls || []).filter(Boolean).slice(0, 4)
  const multi = urls.length > 1 && model.falModelMulti
  const endpoint = multi ? model.falModelMulti : model.falModel
  const body = multi ? { prompt: instruction, image_urls: urls } : { prompt: instruction, image_url: urls[0] }
  try {
    const res = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${FAL_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    })
    if (!res.ok) return { error: `${model.name} ${res.status}: ${(await res.text()).slice(0, 180)}` }
    const d = await res.json()
    const url = d.images?.[0]?.url || d.image?.url || null
    return url ? { url } : { error: `${model.name}: nessuna immagine` }
  } catch (e) { return { error: e.message } }
}

async function generateOne(model, prompt, fmt, refUrls) {
  if (model.provider === 'fal-kontext') return genKontext(model, prompt, refUrls)
  return model.provider === 'openai' ? genOpenAI(prompt, fmt) : genFal(model, prompt, fmt)
}

// Istruzione di scena per Kontext. INVARIANTE: il prodotto in input resta
// pixel-identico. Modello/persona e scena vanno RIPRODOTTI se descritti nel
// prompt (o impliciti nell'ambiente): la persona indossa/usa il prodotto in modo
// naturale, ma il prodotto non cambia mai. Se nessuno è descritto → product shot pulito.
async function buildKontextInstruction(userPrompt, style, contextBlock) {
  const hardRules = 'The featured product from the input image must remain 100% identical: exact same geometry, proportions, colors, materials, finish, label and logos — never redesign, recolor, reshape, relabel or restyle the product itself. CRITICAL: any printed graphic, slogan, artwork or text on the product must be reproduced EXACTLY as in the input — same wording, lettering, font, size, placement and colors; never simplify, remove, blur, crop, distort or restyle the print. If the request or environment describes a person/model (appearance, outfit, pose, location), render that person faithfully and have them wear/hold/use the product naturally at correct scale, perspective and lighting — but the product and its print stay pixel-identical to the reference. If no person is described, keep it a clean product shot without adding random people.'
  if (!OPENAI_KEY) {
    const scene = [userPrompt, style].filter(Boolean).join('. ') || 'a clean premium commercial set'
    return [`Edit the input image into this scene: ${scene}.`, hardRules, PRODUCT_QUALITY_SPINE].filter(Boolean).join(' ')
  }
  try {
    const ctx = contextBlock ? `\n\nBRAND CONTEXT:\n${contextBlock}` : ''
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You write ONE detailed English editing instruction for FLUX Kontext, with campaign quality comparable to Kive.
The single hard invariant: the featured product from the input image stays pixel-identical (never redesign, recolor, reshape, relabel or restyle it).
Everything else follows the request and environment: if the user describes a model/person (their look, outfit, pose) and/or a location, faithfully render that person and scene, and place the product naturally worn/held/used by them at correct scale, perspective and integrated lighting. If a portrait-style environment is given, you may include a fitting model. If no person is described or implied, keep it a clean product still-life — do NOT invent a random person.
Describe the subject (if any), the outfit/styling, the setting/background, surface and the precise lighting.
ABSOLUTE RULES (state them explicitly in the instruction): ${hardRules}
End the instruction by appending these quality requirements verbatim: "${PRODUCT_QUALITY_SPINE}" Output only the instruction.` },
          { role: 'user', content: `Request: ${userPrompt || 'clean premium commercial product scene'}\nEnvironment/Style: ${style || 'commercial product photography studio'}${ctx}` },
        ],
        temperature: 0.55, max_tokens: 400,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return [userPrompt, hardRules].filter(Boolean).join(' ')
    const d = await res.json()
    return d.choices?.[0]?.message?.content?.trim() || [userPrompt, hardRules].filter(Boolean).join(' ')
  } catch { return [userPrompt, hardRules].filter(Boolean).join(' ') }
}

export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return json({ error: 'Non autenticato' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'Body non valido' }, 400) }

  const rawPrompt = (body?.prompt || '').trim()
  const refList = Array.isArray(body?.refImages) ? body.refImages.filter(Boolean) : []
  const styleRefList = Array.isArray(body?.styleRefImages) ? body.styleRefImages.filter(Boolean) : []
  const model = getImageModel(body?.model) || getImageModel('flux-pro')
  const isKontext = model.provider === 'fal-kontext'

  // Kontext richiede l'immagine del prodotto; gli altri richiedono una descrizione.
  if (isKontext && !refList.length) return json({ error: 'Per "Prodotto fedele" seleziona un prodotto o allega un\'immagine.' }, 400)
  if (!isKontext && !rawPrompt && !body?.style) return json({ error: 'Descrivi cosa vuoi generare o scegli uno Studio' }, 400)

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
    prompt = isKontext
      ? await buildKontextInstruction(rawPrompt, body?.style, contextBlock)
      : await enhancePrompt(rawPrompt, body?.style, contextBlock, refList, styleRefList)
  } else if (isKontext && !prompt) {
    prompt = 'Place the product in a clean premium commercial scene; keep the product identical.'
  }
  const results = []
  for (let i = 0; i < count; i++) {
    results.push(await generateOne(model, prompt, fmt, refList))
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
