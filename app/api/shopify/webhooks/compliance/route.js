export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import crypto from 'crypto'

// ── Webhook di conformità GDPR Shopify (obbligatori per la App Review) ──────
// Un solo endpoint per i 3 topic richiesti:
//   - customers/data_request → il merchant chiede i dati di un cliente
//   - customers/redact       → cancellare i dati di un cliente
//   - shop/redact            → cancellare i dati di uno shop (48h dopo disinstall)
// Verifica l'HMAC con il Client Secret dell'app Shopify (SHOPIFY_APP_API_SECRET).
// Risponde 200 se valido, 401 altrimenti. LyftAI non persiste PII dei clienti
// (i dati vengono letti live), quindi qui logghiamo e confermiamo; eventuale
// purge dei dati locali del tenant va agganciato qui.

const APP_SECRET = process.env.SHOPIFY_APP_API_SECRET || ''

function verifyHmac(rawBody, hmacHeader) {
  if (!APP_SECRET || !hmacHeader) return false
  const digest = crypto.createHmac('sha256', APP_SECRET).update(rawBody, 'utf8').digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))
  } catch { return false }
}

export async function POST(req) {
  const raw = await req.text()
  const hmac = req.headers.get('x-shopify-hmac-sha256')
  if (!verifyHmac(raw, hmac)) {
    return new NextResponse('Invalid HMAC', { status: 401 })
  }

  const topic = req.headers.get('x-shopify-topic') || 'unknown'
  const shop = req.headers.get('x-shopify-shop-domain') || 'unknown'
  let payload = {}
  try { payload = JSON.parse(raw || '{}') } catch {}

  // Log per audit (Vercel logs). In futuro: purge dati del tenant/cliente.
  console.log('[shopify-compliance]', topic, 'shop=', shop, 'keys=', Object.keys(payload))

  switch (topic) {
    case 'customers/data_request':
      // LyftAI non archivia PII dei clienti: i dati sono letti live da Shopify.
      // Nessun export da fornire oltre a quanto già nello store del merchant.
      break
    case 'customers/redact':
      // Nessuna PII cliente persistita lato LyftAI → niente da cancellare.
      break
    case 'shop/redact':
      // TODO (multi-tenant): rimuovere connection/credenziali del tenant `shop`.
      break
    default:
      break
  }

  return NextResponse.json({ ok: true })
}
