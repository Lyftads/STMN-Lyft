import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
// Frankfurt: server EU → IP europeo → bypassa il geo-redirect US di Shopify
export const preferredRegion = 'fra1'
export const runtime = 'nodejs'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

// Forza la versione italiana per i siti Shopify Markets.
// I server Microlink free sono US → Shopify rileva geo-IP US e
// ridireziona alla versione US/EN. Append _country=IT&_currency=EUR
// (parametri standard Shopify Markets) bypassa la geo-detection.
function forceItalianLocale(rawUrl) {
  try {
    const u = new URL(rawUrl)
    // Solo se non c'è gia un override di country/locale
    if (!u.searchParams.has('_country')) u.searchParams.set('_country', 'IT')
    if (!u.searchParams.has('_currency')) u.searchParams.set('_currency', 'EUR')
    if (!u.searchParams.has('locale')) u.searchParams.set('locale', 'it')
    return u.toString()
  } catch {
    return rawUrl
  }
}

// ScreenshotOne (preferito quando SCREENSHOTONE_ACCESS_KEY è impostato):
// Free tier 100 screenshot/mese. Supporta header custom (incluso
// Accept-Language) e custom user_agent → bypassa geo-IP redirect Shopify.
function buildScreenshotOneUrl(target) {
  const key = process.env.SCREENSHOTONE_ACCESS_KEY
  if (!key) return null
  let url = target.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  url = forceItalianLocale(url)
  const params = new URLSearchParams({
    access_key: key,
    url,
    viewport_width: '1440',
    viewport_height: '1800',
    device_scale_factor: '1',
    image_quality: '80',
    format: 'png',
    full_page: 'false',
    block_ads: 'true',
    block_cookie_banners: 'true',
    block_trackers: 'true',
    block_chats: 'true',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    cache: 'true',
    cache_ttl: '14400',
  })
  // Header Accept-Language + cookies Shopify per provare a forzare la
  // versione italiana. NOTA: Shopify Markets fa redirect basato su IP
  // a livello CDN — se il geo-IP redirect e' attivo nelle settings di
  // STMN, IP vince su tutto e questi override non bastano.
  params.append('headers', 'Accept-Language: it-IT,it;q=0.9,en;q=0.6')
  // Cookie hint per Shopify
  params.append('cookies', 'localization=IT')
  params.append('cookies', 'cart_currency=EUR')
  params.append('cookies', 'country=IT')
  return `https://api.screenshotone.com/take?${params.toString()}`
}

// Microlink fallback (free, no key richiesta ma redirected su geo-IP US)
function buildMicrolinkUrl(target, { embed = false } = {}) {
  let url = target.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  url = forceItalianLocale(url)
  const params = new URLSearchParams({
    url,
    screenshot: 'true',
    meta: 'false',
    'viewport.width': '1440',
    'viewport.height': '1800',
  })
  if (embed) params.set('embed', 'screenshot.url')
  return `https://api.microlink.io/?${params.toString()}`
}

// PRIMARY: Headless Chromium su Vercel fra1 (Frankfurt) → IP europeo
// → bypassa il geo-IP redirect di Shopify. Stessa esperienza di un
// utente italiano in browser desktop.
async function fetchScreenshotWithChromium(target) {
  // Lazy import: i package sono grossi (~50MB), li carichiamo solo se serve
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ])

  let browser
  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--lang=it-IT,it',
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: { width: 1440, height: 1800, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.6',
    })
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    let url = target.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 28000 })
    // Aspetto un attimo extra per render finale (font, lazy images sopra fold)
    await new Promise(r => setTimeout(r, 1500))

    const buf = await page.screenshot({ type: 'png', fullPage: false })
    return {
      dataUrl: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`,
      publicUrl: null,
      bytes: buf.length,
      provider: 'chromium-fra1',
    }
  } finally {
    if (browser) await browser.close()
  }
}

// Scarica lo screenshot. Cascade di fallback:
// 1) Chromium headless su Vercel fra1 (Frankfurt) → IP EU, bypass geo-IP
// 2) ScreenshotOne (US server con Accept-Language IT)
// 3) Microlink (US server, no override)
async function fetchScreenshotAsDataUrl(target) {
  // Provo subito Chromium (EU IP) — soluzione vera al geo-redirect
  try {
    return await fetchScreenshotWithChromium(target)
  } catch (chromiumErr) {
    console.log('Chromium failed, fallback:', chromiumErr?.message)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const screenshotOneUrl = buildScreenshotOneUrl(target)

    if (screenshotOneUrl) {
      // ScreenshotOne ritorna DIRETTAMENTE l'immagine (no JSON wrapper)
      const imgRes = await fetch(screenshotOneUrl, { signal: controller.signal })
      clearTimeout(timer)
      if (!imgRes.ok) {
        const body = await imgRes.text().catch(() => '')
        throw new Error(`ScreenshotOne ${imgRes.status}: ${body.slice(0, 200)}`)
      }
      const contentType = imgRes.headers.get('content-type') || 'image/png'
      const buf = Buffer.from(await imgRes.arrayBuffer())
      if (buf.length === 0) throw new Error('Screenshot vuoto')
      return {
        dataUrl: `data:${contentType};base64,${buf.toString('base64')}`,
        publicUrl: screenshotOneUrl,
        bytes: buf.length,
        provider: 'screenshotone',
      }
    }

    // Fallback Microlink
    const apiUrl = buildMicrolinkUrl(target, { embed: false })
    const apiRes = await fetch(apiUrl, { signal: controller.signal })
    if (!apiRes.ok) {
      const body = await apiRes.text().catch(() => '')
      throw new Error(`Microlink ${apiRes.status}: ${body.slice(0, 200)}`)
    }
    const json = await apiRes.json()
    const cdnUrl = json?.data?.screenshot?.url
    if (!cdnUrl) throw new Error(json?.message || 'Nessuno screenshot generato')

    const imgRes = await fetch(cdnUrl, { signal: controller.signal })
    clearTimeout(timer)
    if (!imgRes.ok) throw new Error(`CDN ${imgRes.status}`)
    const contentType = imgRes.headers.get('content-type') || 'image/png'
    const buf = Buffer.from(await imgRes.arrayBuffer())
    if (buf.length === 0) throw new Error('Screenshot vuoto')
    return {
      dataUrl: `data:${contentType};base64,${buf.toString('base64')}`,
      publicUrl: cdnUrl,
      bytes: buf.length,
      provider: 'microlink',
    }
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

const SYSTEM_PROMPT = `Sei un Senior CRO Specialist con 10+ anni di esperienza in ottimizzazione conversione e-commerce e landing page. Hai lavorato per brand DTC con fatturati 7-8 figure. La tua analisi è basata su:

- Heuristic evaluation framework (Nielsen, ConversionXL, Baymard Institute)
- Persuasion principles (Cialdini: reciprocity, scarcity, authority, social proof, commitment, liking)
- Cognitive load theory (Hick's Law, Fitts' Law, F-pattern reading)
- E-commerce best practices: above-the-fold value proposition, trust signals, friction reduction, CTA hierarchy, urgency, social proof, FAQ posizionate, prezzi chiari, garanzie
- Mobile-first patterns (anche se lo screenshot è desktop, considera implicazioni mobile)
- UX writing e copywriting persuasivo
- Visual hierarchy, white space, typography, color contrast (WCAG)
- Page speed signals visibili (immagini ottimizzate, layout shift)
- Conversion funnel design

## Compito
Analizzi lo SCREENSHOT di una landing page o pagina prodotto fornito da Marino, founder di STMN Fitness (e-commerce accessori CrossFit). Restituisci un'analisi CRO PROFESSIONALE, AZIONABILE, CON ESEMPI CONCRETI. Marino deve poter modificare la pagina basandosi sui tuoi insight senza dover chiedere chiarimenti.

## Output (DEVE essere JSON valido con questa struttura esatta)
{
  "overallScore": <numero 0-100 score CRO complessivo>,
  "scoreLabel": "<etichetta breve: 'Eccellente' / 'Buono' / 'Da ottimizzare' / 'Critico'>",
  "summary": "<2-3 frasi panoramica generale onesta>",
  "firstImpression": "<descrivi cosa vede un visitatore nei primi 3 secondi: hero, claim, CTA principale, trust signals visibili>",
  "works": [
    {
      "title": "<elemento che funziona>",
      "details": "<perché funziona dal punto di vista CRO, riferimento al principio (es. social proof, F-pattern, ecc.)>",
      "impact": "<low|medium|high>"
    }
  ],
  "improve": [
    {
      "title": "<elemento da migliorare>",
      "current": "<descrizione precisa di cosa c'è ora nella pagina>",
      "suggestion": "<azione concreta e specifica con valori reali — es. 'Cambia CTA da \\"Compra ora\\" a \\"Compra ora con il 15% di sconto · Spedizione gratis\\" e usa #FF3B30 invece del grigio attuale'>",
      "example": "<esempio testuale del nuovo copy / del nuovo elemento>",
      "priority": "<low|medium|high|critical>",
      "expectedImpact": "<stima realistica: es. '+0.5-1.5pp CR' / '+15% click-through CTA' / '-20% bounce rate'>"
    }
  ],
  "remove": [
    {
      "title": "<elemento da rimuovere o ridurre>",
      "reason": "<perché aumenta friction o cognitive load o riduce conversione>",
      "alternative": "<cosa metterci al posto, se serve qualcosa>"
    }
  ],
  "quickWins": [
    "<azione veloce e ad alto impatto, max 1 frase>",
    "<azione 2>",
    "<azione 3>",
    "<azione 4>",
    "<azione 5>"
  ],
  "ctaAnalysis": {
    "primaryCta": "<copy attuale del CTA principale, se visibile>",
    "position": "<sopra/sotto la fold + commento posizione>",
    "contrast": "<basso/medio/alto>",
    "verdict": "<2 frasi sulla qualità complessiva del CTA>"
  },
  "trustSignals": {
    "present": ["<lista trust signals visibili nello screenshot>"],
    "missing": ["<lista trust signals importanti che non vedi e dovrebbero esserci>"]
  },
  "copyAnalysis": {
    "headline": "<copy dell'headline principale + verdetto>",
    "valueProposition": "<chiara | confusa | assente + spiegazione>",
    "tone": "<descrivi il tono e se è coerente con il target>"
  }
}

## Regole inviolabili
- TUTTI gli esempi devono essere SPECIFICI (con copy preciso, colori esadecimali, posizioni esatte, numeri reali)
- MAI generico ("migliora il CTA"). SEMPRE "Cambia il CTA 'X' in 'Y' perché Z, aspettati impatto W"
- Identifica SEMPRE almeno 3 cose che funzionano, 3 da migliorare, 1-3 da rimuovere
- L'overallScore deve essere onesto: solo le pagine eccellenti meritano >85
- Concentrati su CRO, NON su SEO, performance tecnica o branding generico
- Se vedi placeholder/lorem ipsum/immagini stock generiche, evidenziali
- Considera il target STMN: atleti CrossFit, functional fitness, home gym intermedio/avanzato. NIENTE supplementi
- Italiano professionale, asciutto, da consulente senior

## OUTPUT FORMAT — CRITICO
RITORNA SOLO JSON RAW. Niente \`\`\`json. Niente \`\`\`. Niente testo prima o dopo. Inizia direttamente con { e termina con }. Esempio del primo carattere: \`{\` non \`\\\`\` ne \` \` ne nulla.`

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const targetUrl = (body?.url || '').trim()
  if (!targetUrl) {
    return NextResponse.json({ error: 'URL mancante.' }, { status: 400 })
  }

  // Validazione URL minimale
  let normalized = targetUrl
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized
  try { new URL(normalized) } catch {
    return NextResponse.json({ error: 'URL non valido.' }, { status: 400 })
  }

  // Scarico io l'immagine e la passo a OpenAI come base64 → niente timeout.
  let dataUrl, previewUrl, provider
  try {
    const shot = await fetchScreenshotAsDataUrl(normalized)
    dataUrl = shot.dataUrl
    previewUrl = shot.publicUrl
    provider = shot.provider
  } catch (err) {
    return NextResponse.json({
      error: `Impossibile catturare lo screenshot: ${err?.message || 'errore'}. Verifica che l'URL sia accessibile pubblicamente.`,
    }, { status: 502 })
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        top_p: 0.9,
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analizza CRO questa landing page.\nURL: ${normalized}\nCliente: STMN Fitness — e-commerce accessori CrossFit (paracalli, polsiere, corde da salto, tape adesivo nero, ginocchiere). Target: atleti CrossFit intermedio/avanzato, home gym.\n\nLo screenshot in allegato è la versione desktop italiana della pagina. Fornisci analisi dettagliata in JSON secondo lo schema specificato.`,
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'high' },
              },
            ],
          },
        ],
      }),
    })

    if (!r.ok) {
      const text = await r.text()
      return NextResponse.json({
        error: `OpenAI ${r.status}: ${text.slice(0, 300)}`,
        screenshotUrl: previewUrl,
      }, { status: 502 })
    }

    const json = await r.json()
    let raw = json?.choices?.[0]?.message?.content || ''
    // OpenAI a volte wrappa il JSON in markdown ```json ... ```
    // anche con response_format json_object. Stripping difensivo.
    raw = raw.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let analysis = null
    try { analysis = JSON.parse(raw) } catch {}

    return NextResponse.json({
      url: normalized,
      screenshotUrl: previewUrl,
      // Lo stesso screenshot usato per l'analisi (data URL base64) →
      // il client lo mostra al posto del preview Microlink US-based
      screenshotDataUrl: dataUrl,
      provider,
      analysis,
      rawText: analysis ? undefined : raw,
      error: analysis ? undefined : 'Analisi non parseable come JSON',
      usage: json?.usage || null,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({
      error: err?.message || 'Errore scansione',
      screenshotUrl: previewUrl,
      screenshotDataUrl: dataUrl,
      provider,
    }, { status: 500 })
  }
}
