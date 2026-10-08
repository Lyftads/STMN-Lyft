// Lettura AI del CONTENUTO di una creativita' Meta (testo + immagine, o
// fotogrammi del video) per lo stadio del funnel, secondo la griglia di
// Marino «Classificazione di immagini e video per il funnel Meta Ads»
// (8 ott 2026): TOFU = far scoprire, MOFU = spiegare perche' scegliere,
// BOFU = motivi concreti per acquistare (non serve per forza uno sconto),
// remarketing = creativita' adattata all'azione precedente.
//
// POST { ads: [{ ad_id, testo, immagine, video_id }] }
// → { ok, stadi: { ad_id: { stadio, offerta, tipo } }, restanti, letture }
//   stadio  = 'top' | 'middle' | 'lower' | 'riattivazione'
//   offerta = true se c'e' un'offerta EVIDENTE (prezzo barrato, sconto,
//             codice, spedizione gratis, urgenza): per Marino e' «pura
//             conversione» a prescindere dal pubblico.
//   tipo    = la tipologia della griglia (es. «Offerta diretta», «UGC di
//             scoperta», «Recensioni / social proof»).
//
// VIDEO. Il token Meta non ha i permessi di pagina: /{video_id}/thumbnails e
// `source` rispondono «(#10) Application does not have permission». Si passa
// dall'ANTEPRIMA dell'inserzione (/{ad_id}/previews, basta ads_read): dentro
// l'iframe c'e' l'indirizzo mp4 su fbcdn. Su Vercel non c'e' ffmpeg: i
// fotogrammi li scatta Browserless (lo stesso dei PDF) caricando il video in
// una pagina e fotografandolo a tempi diversi. E' lo scraping del video.
//
// Le immagini si scaricano QUI e si passano incorporate (base64): OpenAI non
// legge gli indirizzi firmati di Meta e risponde 400 per tutto il lotto.
// Una creativita' si legge UNA volta: la risposta sta nello snapshot del
// workspace con l'impronta di testo e video (gli indirizzi fbcdn cambiano
// firma, quindi dell'immagine conta solo che ci sia). Lotti da 8 per chiamata
// AI, 5 lotti in parallelo per richiesta; `restanti` dice quante mancano e
// il client richiama.

import { NextResponse } from 'next/server'
import { withTenantContext, getEffectiveTenantId, getMeta } from '../../../lib/tenant/credentials'
import { getSnapshotStale, setSnapshot } from '../../../lib/cache/snapshot'
import { STADI } from '../../../lib/creative/stadio'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const TAB = 'creativeStadioAI4'
const GRAPH = process.env.META_GRAPH_VERSION || 'v20.0'
const PER_LOTTO = 6
const LOTTI_PER_CHIAMATA = 5
const FOTOGRAMMI = 5
const OPENAI_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

function impronta(a) {
  const s = `${a.testo || ''}|${a.immagine ? 'img' : ''}|${a.video_id || ''}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return String(h)
}

const SYSTEM = `Sei un media buyer esperto di Meta Ads. Per ogni inserzione ricevi il testo (copy, titolo, descrizione, CTA) e, quando c'e', l'immagine oppure alcuni fotogrammi del video in ordine di tempo (giudica il video da TUTTI i fotogrammi: un prezzo o uno sconto che compare anche in uno solo conta).
Classifica ogni creativita' in base al COMPITO che svolge, con questa griglia:

TOP (TOFU — far scoprire il brand e suscitare interesse). Tipologie: "Lifestyle / aspirazionale" (prodotto ambientato, indossato, scene di vita), "Problema → soluzione" (situazione riconoscibile, headline sul problema), "UGC di scoperta" (foto o creator spontaneo che presenta una scoperta), "Intrattenimento / meme" (meme, POV, sketch), "Visual di impatto" (still life originale, macro, texture, sequenze sensoriali), "Educativo introduttivo" (errori comuni, consigli, tutorial breve). Messaggio: «questo prodotto riguarda te».

MIDDLE (MOFU — spiegare perche' scegliere il prodotto). Tipologie: "Benefici e caratteristiche" (prodotto con annotazioni, spiegazione attraverso l'uso), "Dimostrazione" (demo, prova pratica, passo passo), "Confronto" (tabella o test comparativo), "Recensioni / social proof" (recensione o testimonianza con motivazioni), "Unboxing", "Dietro le quinte" (materiali, lavorazione, fondatore), "Versatilita'" (piu' usi, abbinamenti, occasioni). Messaggio: «ecco come funziona e perche' e' la scelta giusta».

LOWER (BOFU — dare motivi concreti per acquistare; NON richiede per forza uno sconto). Tipologie: "Offerta diretta" (prodotto, prezzo, eventuale sconto e condizioni), "Bundle / convenienza" (pacchetto e risparmio), "Prodotto protagonista" (still life pulito con beneficio principale e CTA all'acquisto), "Gestione delle obiezioni" (FAQ su taglie, compatibilita', consegna), "Rassicurazione" (reso, assistenza, spedizione), "Urgenza reale" (scadenza o disponibilita'), "Prova + offerta" (recensione + proposta commerciale). Messaggio: «ecco cosa acquisti e a quali condizioni».

RIATTIVAZIONE: rivolta a chi ha GIA' comprato: "bentornato", "ci manchi", riordino, ricompra, fedelta'.

Regole: still life pulito con prezzo o CTA = LOWER; still life con dettagli e qualita' senza prezzo = MIDDLE; lifestyle senza prezzo = TOP; un'estetica (UGC, smartphone, carosello, catalogo) da sola NON decide la fase, decide il messaggio.
"offerta" = true SOLO se c'e' un'offerta EVIDENTE: prezzo barrato o scontato, percentuale di sconto, codice, spedizione gratis, "solo oggi" — anche se compare solo nell'immagine o nei fotogrammi.
Rispondi SOLO con JSON: {"ads": {"<ad_id>": {"stadio": "top|middle|lower|riattivazione", "offerta": true|false, "tipo": "<tipologia della griglia>"}, ...}}. Nessun altro testo.`

async function scarica(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' })
    if (!res.ok) return null
    const tipo = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
    if (!/^image\//.test(tipo)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 1500000) return null
    return `data:${tipo};base64,${buf.toString('base64')}`
  } catch { return null }
}

// Indirizzo mp4 del video dall'anteprima dell'inserzione.
async function videoDaAnteprima(adId, token) {
  try {
    const u = new URL(`https://graph.facebook.com/${GRAPH}/${adId}/previews`)
    u.searchParams.set('ad_format', 'MOBILE_FEED_STANDARD')
    u.searchParams.set('access_token', token)
    const d = await (await fetch(u.toString(), { cache: 'no-store', signal: AbortSignal.timeout(8000) })).json()
    const body = d?.data?.[0]?.body || ''
    const src = /src="([^"]+)"/.exec(body)?.[1]?.replace(/&amp;/g, '&')
    if (!src) return null
    const html = await (await fetch(src, { cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0' } })).text()
    const cand = (html.match(/https?:\\?\/\\?\/[^"'\s]*fbcdn[^"'\s]*/g) || []).map(x => x.replace(/\\\//g, '/')).filter(x => /video|\.mp4/.test(x))
    return cand[0] || null
  } catch { return null }
}

// Fotogrammi scattati da Browserless: il video in una pagina, cercato a
// tempi distribuiti, fotografato. Un browser per richiesta, una pagina per
// video. Base64 jpeg a 540 px di larghezza: all'AI basta e avanza.
async function fotogrammiBrowserless(browser, url, diag) {
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 560, height: 1000 })
    await page.setContent(`<html><body style="margin:0;background:#000"><video id="v" src="${url}" muted playsinline preload="auto" style="width:540px;display:block"></video></body></html>`, { waitUntil: 'load', timeout: 15000 }).catch(() => {})
    const durata = await page.evaluate(() => new Promise(res => {
      const v = document.getElementById('v')
      const fine = () => res(v.duration || 0)
      if (v.readyState >= 1) return fine()
      v.addEventListener('loadedmetadata', fine, { once: true })
      v.addEventListener('error', () => res(-1), { once: true })
      setTimeout(() => res(v.duration || 0), 12000)
    }))
    if (!(durata > 0)) { if (diag) diag.errore = durata === -1 ? 'video non caricato' : 'durata ignota'; return [] }
    if (diag) diag.durata = Math.round(durata)
    const tempi = []
    for (let i = 0; i < FOTOGRAMMI; i++) tempi.push(Math.min(durata - 0.2, Math.max(0.1, durata * (i + 0.5) / FOTOGRAMMI)))
    const out = []
    const el = await page.$('#v')
    for (const t of tempi) {
      const ok = await page.evaluate((t) => new Promise(res => {
        const v = document.getElementById('v')
        v.addEventListener('seeked', () => res(true), { once: true })
        v.currentTime = t
        setTimeout(() => res(false), 6000)
      }), t)
      if (!ok) continue
      const b64 = await el.screenshot({ type: 'jpeg', quality: 60, encoding: 'base64' }).catch(() => null)
      if (b64) out.push(`data:image/jpeg;base64,${b64}`)
    }
    return out
  } catch (e) { if (diag) diag.errore = e?.message || 'browserless'; return [] }
  finally { await page.close().catch(() => {}) }
}

async function apriBrowser() {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) return null
  try {
    const { default: puppeteer } = await import('puppeteer-core')
    const endpoint = process.env.BROWSERLESS_ENDPOINT || 'production-lon.browserless.io'
    return await puppeteer.connect({ browserWSEndpoint: `wss://${endpoint}/?token=${encodeURIComponent(token)}` })
  } catch { return null }
}

async function fotogrammi(a, browser, diag) {
  const token = getMeta()?.accessToken
  if (!a.video_id || !token) return []
  const url = await videoDaAnteprima(a.ad_id, token)
  if (!url) { if (diag) diag.errore = 'video non trovato nell\'anteprima'; return [] }
  if (!browser) { if (diag) diag.errore = 'Browserless non disponibile'; return [] }
  return fotogrammiBrowserless(browser, url, diag)
}

async function leggiLotto(lotto, browser, letture = {}) {
  const foto = await Promise.all(lotto.map(a => (a.immagine ? scarica(a.immagine) : Promise.resolve(null))))
  const diagVideo = lotto.map(() => ({}))
  // i video uno alla volta dentro il lotto (i lotti vanno in parallelo)
  const video = []
  for (let i = 0; i < lotto.length; i++) video.push(lotto[i].video_id && /^\d+$/.test(String(lotto[i].ad_id)) ? await fotogrammi(lotto[i], browser, diagVideo[i]) : [])
  lotto = lotto.map((a, i) => ({ ...a, immagine: foto[i], fotogrammi: video[i], diagVideo: diagVideo[i] }))
  for (const a of lotto) letture[a.ad_id] = { fotogrammi: a.fotogrammi?.length || 0, immagine: !!a.immagine, ...(a.video_id ? { video: a.diagVideo } : {}) }

  const content = [{ type: 'text', text: 'Inserzioni:\n' + lotto.map(a => `[ad_id ${a.ad_id}] testo: ${a.testo || '(nessun testo)'}${a.fotogrammi?.length ? ` — video: ${a.fotogrammi.length} fotogrammi allegati qui sotto` : a.immagine ? ' — immagine allegata qui sotto' : ''}`).join('\n\n') }]
  for (const a of lotto) {
    if (a.fotogrammi?.length) {
      content.push({ type: 'text', text: `fotogrammi del video di ad_id ${a.ad_id} (in ordine di tempo):` })
      for (const f of a.fotogrammi) content.push({ type: 'image_url', image_url: { url: f, detail: 'low' } })
    } else if (a.immagine) {
      content.push({ type: 'text', text: `immagine di ad_id ${a.ad_id}:` }, { type: 'image_url', image_url: { url: a.immagine, detail: 'low' } })
    }
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL, temperature: 0, max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    let msg = ''
    try { msg = (await res.json())?.error?.message || '' } catch {}
    throw new Error(`OpenAI ${res.status}${msg ? ': ' + msg.slice(0, 160) : ''}`)
  }
  const data = await res.json()
  let parsed = null
  try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}') } catch { parsed = null }
  return parsed?.ads && typeof parsed.ads === 'object' ? parsed.ads : {}
}

export async function POST(request) {
  return withTenantContext(request, async () => {
    let body
    try { body = await request.json() } catch { body = null }
    const ads = Array.isArray(body?.ads) ? body.ads.filter(a => a && a.ad_id && (String(a.testo || '').trim() || a.immagine || a.video_id)) : []
    if (!ads.length) return NextResponse.json({ ok: true, stadi: {}, restanti: 0 })

    const wsId = await getEffectiveTenantId().catch(() => null)
    const salvato = wsId ? (await getSnapshotStale(wsId, TAB))?.payload : null
    const memoria = (salvato && typeof salvato === 'object') ? { ...salvato } : {}

    const stadi = {}
    const daChiedere = []
    for (const a of ads) {
      const k = String(a.ad_id)
      const imp = impronta(a)
      const m = memoria[k]
      if (m && m.impronta === imp && STADI.includes(m.stadio)) stadi[k] = { stadio: m.stadio, offerta: !!m.offerta, tipo: m.tipo || '' }
      else daChiedere.push({ ...a, ad_id: k, impronta: imp })
    }

    let errore = null
    const letture = {}
    if (daChiedere.length && OPENAI_KEY) {
      const lotti = []
      for (let i = 0; i < daChiedere.length && lotti.length < LOTTI_PER_CHIAMATA; i += PER_LOTTO) lotti.push(daChiedere.slice(i, i + PER_LOTTO))
      const serveBrowser = lotti.some(l => l.some(a => a.video_id))
      const browser = serveBrowser ? await apriBrowser() : null
      try {
        const risposte = await Promise.all(lotti.map(l => leggiLotto(l, browser, letture).catch(e => { errore = e?.message || 'AI'; return {} })))
        lotti.forEach((lotto, i) => {
          for (const a of lotto) {
            const r = risposte[i][a.ad_id]
            const st = r?.stadio
            if (STADI.includes(st)) {
              const v = { stadio: st, offerta: !!r.offerta, tipo: String(r.tipo || '').slice(0, 60) }
              stadi[a.ad_id] = v
              memoria[a.ad_id] = { ...v, impronta: a.impronta }
            }
          }
        })
      } finally { if (browser) await browser.disconnect().catch(() => {}) }
      if (wsId) await setSnapshot(wsId, TAB, memoria)
    }

    const restanti = Math.max(0, daChiedere.length - LOTTI_PER_CHIAMATA * PER_LOTTO)
    const video = ads.filter(a => a.video_id).length
    return NextResponse.json({ ok: true, stadi, restanti, video, letture, ...(errore ? { error: errore } : {}) })
  })
}
