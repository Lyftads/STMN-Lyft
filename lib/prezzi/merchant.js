// ============================================================================
//  IL PREZZO DI MERCATO — Google Merchant Center, report "Competitivita' dei prezzi".
//
//  Per ogni nostro articolo Google calcola il PREZZO DI RIFERIMENTO: a quanto lo vendono gli altri
//  negozi che pubblicizzano lo stesso articolo (stesso EAN) su Google Shopping — qualunque
//  piattaforma usino. E' l'unica fonte che copre anche i marchi le cui case madri non sono su
//  Shopify (Guess, Michael Kors, Coccinelle...). In piu' il report "price insights" da' il prezzo
//  SUGGERITO e l'effetto previsto sui clic.
//
//  Accesso: un account di servizio Google aggiunto come utente nel Merchant Center
//  (GOOGLE_MERCHANT_SA_KEY = il JSON della chiave, MERCHANT_CENTER_ID = l'ID dell'account).
//  Non tocca il collegamento Google dell'app (verificato da Google con i suoi permessi).
//  Il token si firma qui con `crypto`: nessuna libreria in piu'.
// ============================================================================
import { getGoogle } from '../tenant/credentials'
import { createSign } from 'node:crypto'

const SCOPE = 'https://www.googleapis.com/auth/content'
const BASI = ['https://merchantapi.googleapis.com/reports/v1', 'https://merchantapi.googleapis.com/reports/v1beta']
let gettone = null // { valore, scade }

// L'ID dell'account Merchant Center e' del CLIENTE (companies.merchant_center_id); la chiave
// dell'account di servizio resta condivisa, come il developer token di Google Ads.
// Sul fork era tutto in variabili d'ambiente globali: qui il primo cliente che accendeva i Prezzi
// avrebbe visto i prezzi, i concorrenti e i margini di un altro negozio. Non un errore: i dati di
// qualcun altro, mostrati come suoi.
function idAccount() {
  try { return String(getGoogle()?.merchantCenterId || '').replace(/\D/g, '') } catch { return '' }
}

export function configurato() { return !!(process.env.GOOGLE_MERCHANT_SA_KEY && idAccount()) }

// Che cosa manca, per dirlo in chiaro invece di rispondere vuoto.
export function mancaCosa() {
  const m = []
  if (!process.env.GOOGLE_MERCHANT_SA_KEY) m.push('la chiave dell\'account di servizio Google')
  if (!idAccount()) m.push('l\'ID del Merchant Center di questo cliente')
  return m
}

function chiave() {
  const grezza = process.env.GOOGLE_MERCHANT_SA_KEY || ''
  let j
  try { j = JSON.parse(grezza) } catch { try { j = JSON.parse(Buffer.from(grezza, 'base64').toString('utf8')) } catch { throw new Error('GOOGLE_MERCHANT_SA_KEY non è un JSON valido') } }
  if (!j.client_email || !j.private_key) throw new Error('La chiave non contiene client_email/private_key')
  return { email: j.client_email, privata: String(j.private_key).replace(/\\n/g, '\n'), tokenUri: j.token_uri || 'https://oauth2.googleapis.com/token' }
}

async function token() {
  if (gettone && gettone.scade > Date.now() + 60_000) return gettone.valore
  const k = chiave(), ora = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const daFirmare = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: k.email, scope: SCOPE, aud: k.tokenUri, iat: ora, exp: ora + 3600 })}`
  const firma = createSign('RSA-SHA256').update(daFirmare).sign(k.privata).toString('base64url')
  const res = await fetch(k.tokenUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${daFirmare}.${firma}` }), signal: AbortSignal.timeout(15_000) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) throw new Error(`Google non ha dato il token: ${j.error_description || j.error || res.status}`)
  gettone = { valore: j.access_token, scade: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  return gettone.valore
}

// Una interrogazione al Merchant Reports API, tutte le pagine (tetto di sicurezza).
export async function cerca(query, { pagineMax = 30 } = {}) {
  const id = idAccount()
  if (!id) throw new Error('Merchant Center non configurato per questo cliente')
  const t = await token()
  let ultimoErrore = null
  for (const base of BASI) {
    const righe = []; let pageToken
    try {
      for (let n = 0; n < pagineMax; n++) {
        const res = await fetch(`${base}/accounts/${id}/reports:search`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, pageSize: 1000, ...(pageToken ? { pageToken } : {}) }), signal: AbortSignal.timeout(30_000) })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) { const e = new Error(j?.error?.message || `HTTP ${res.status}`); e.stato = res.status; throw e }
        righe.push(...(j.results || []))
        pageToken = j.nextPageToken; if (!pageToken) break
      }
      return { righe, base }
    } catch (e) { ultimoErrore = e; if (e.stato && e.stato !== 404) break }   // 404 = versione non esistente: si prova la successiva
  }
  throw ultimoErrore || new Error('Merchant API non risponde')
}

// Google chiede (dal 2025) che il progetto Cloud dell'account di servizio sia REGISTRATO sull'account
// Merchant Center, con un'email di contatto per gli avvisi sull'API. Serve che l'account di servizio
// abbia accesso AMMINISTRATORE nel Merchant Center mentre lo si fa (poi si puo' riportare a Standard).
export async function registraProgetto(email) {
  const id = idAccount()
  const t = await token()
  let ultimo = null
  for (const v of ['v1', 'v1beta']) {
    const res = await fetch(`https://merchantapi.googleapis.com/accounts/${v}/accounts/${id}/developerRegistration:registerGcp`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ developerEmail: email }), signal: AbortSignal.timeout(30_000) })
    const j = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true, versione: v }
    ultimo = new Error(j?.error?.message || `HTTP ${res.status}`); ultimo.stato = res.status
    if (res.status !== 404) break
  }
  throw ultimo
}

const euro = (p) => (p?.amountMicros != null ? Number(p.amountMicros) / 1_000_000 : null)
// offer_id dei feed Shopify: shopify_<PAESE>_<productId>_<variantId>
export const idDaOfferta = (offerId) => { const m = String(offerId || '').match(/_(\d{6,})_(\d{6,})$/); return m ? { productId: m[1], variantId: m[2] } : {} }

export async function prezziDiMercato() {
  // i clic e le impressioni degli ultimi 30 giorni su Google (annunci e schede gratuite): dicono su
  // quali articoli il prezzo CONTA davvero. Dato facoltativo: se il report non risponde si va avanti.
  const g = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
  // tre finestre (7, 30, 90 giorni chiusi a ieri): la tab le cambia senza ricaricare niente
  const FINESTRE = [7, 30, 90]
  const periodi = Object.fromEntries(FINESTRE.map(n => [n, { since: g(n), until: g(1) }]))
  const traffico = Promise.all(FINESTRE.map(n => cerca(`SELECT offer_id, clicks, impressions FROM product_performance_view WHERE date BETWEEN '${g(n)}' AND '${g(1)}'`).then(r => ({ n, righe: r.righe })).catch(e => ({ n, righe: [], errore: e.message }))))
  const [comp, sugg] = await Promise.all([
    cerca('SELECT report_country_code, id, offer_id, title, brand, price, benchmark_price FROM price_competitiveness_product_view'),
    cerca('SELECT id, offer_id, title, brand, price, suggested_price, predicted_impressions_change_fraction, predicted_clicks_change_fraction, predicted_conversions_change_fraction, effectiveness FROM price_insights_product_view').catch(e => ({ righe: [], errore: e.message })),
  ])
  const perOfferta = new Map()
  for (const r of comp.righe) {
    const v = r.priceCompetitivenessProductView || r.price_competitiveness_product_view || {}
    const mercato = euro(v.benchmarkPrice), prezzo = euro(v.price)
    if (!v.offerId || mercato == null) continue
    perOfferta.set(v.offerId, { offerId: v.offerId, ...idDaOfferta(v.offerId), paese: v.reportCountryCode || null, titolo: v.title || null, marchio: v.brand || null, prezzoFeed: prezzo, mercato: +mercato.toFixed(2), valuta: v.benchmarkPrice?.currencyCode || null })
  }
  for (const r of sugg.righe) {
    const v = r.priceInsightsProductView || r.price_insights_product_view || {}
    const s = euro(v.suggestedPrice); if (s == null || !v.offerId) continue
    // il prezzo suggerito esiste anche per articoli SENZA prezzo di mercato: entrano lo stesso
    let riga = perOfferta.get(v.offerId)
    if (!riga) { riga = { offerId: v.offerId, ...idDaOfferta(v.offerId), paese: null, titolo: v.title || null, marchio: v.brand || null, prezzoFeed: euro(v.price), mercato: null, valuta: v.suggestedPrice?.currencyCode || null }; perOfferta.set(v.offerId, riga) }
    Object.assign(riga, { suggerito: +s.toFixed(2), effettoClic: v.predictedClicksChangeFraction ?? null, effettoImpressioni: v.predictedImpressionsChangeFraction ?? null, effettoConversioni: v.predictedConversionsChangeFraction ?? null, efficacia: v.effectiveness || null })
  }
  const finestre = await traffico
  // si aggancia sull'ID di VARIANTE, non sulla stringa dell'offerta: nei report di traffico Google la
  // scrive con maiuscole/minuscole diverse (shopify_ZZ_… / shopify_zz_…)
  const perVariante = new Map([...perOfferta.values()].filter(x => x.variantId).map(x => [x.variantId, x]))
  for (const f of finestre) for (const r of f.righe) {
    const v = r.productPerformanceView || r.product_performance_view || {}
    const riga = perOfferta.get(v.offerId) || perVariante.get(idDaOfferta(v.offerId).variantId); if (!riga) continue
    riga.traffico = riga.traffico || {}
    const t = riga.traffico[f.n] = riga.traffico[f.n] || { clic: 0, impressioni: 0 }
    t.clic += Number(v.clicks) || 0; t.impressioni += Number(v.impressions) || 0
  }
  for (const riga of perOfferta.values()) if (riga.traffico?.[30]) { riga.clic = riga.traffico[30].clic; riga.impressioni = riga.traffico[30].impressioni }
  const tr = { righe: finestre.find(f => f.n === 30)?.righe || [], errore: finestre.map(f => f.errore).filter(Boolean)[0] || null }
  return { righe: [...perOfferta.values()], periodi, versione: comp.base, suggeritiErrore: sugg.errore || null, trafficoErrore: tr.errore || null, grezzi: { competitivita: comp.righe.length, competitivitaConPrezzo: comp.righe.filter(r => (r.priceCompetitivenessProductView || {}).benchmarkPrice?.amountMicros != null).length, suggerimenti: sugg.righe.length, suggerimentiConPrezzo: sugg.righe.filter(r => (r.priceInsightsProductView || {}).suggestedPrice?.amountMicros != null).length, traffico: tr.righe.length }, trafficoRighe: tr.righe.length, conTraffico: [...perOfferta.values()].filter(x => x.clic != null).length }
}
