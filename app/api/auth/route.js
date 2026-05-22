// app/api/auth/route.js
// Gestisce OAuth Shopify: redirect + callback + mostra token
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import crypto from 'crypto'

const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET
const SHOP          = process.env.SHOPIFY_STORE_URL
const SCOPES        = 'read_orders,read_customers,read_analytics'
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://stmn-lyft.vercel.app'}/api/auth`

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const hmac  = searchParams.get('hmac')
  const shop  = searchParams.get('shop') || SHOP

  // ── STEP 2: Callback da Shopify con code ─────────────────────
  if (code && hmac) {
    try {
      // Verifica HMAC
      const params = Object.fromEntries(searchParams)
      delete params.hmac
      const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
      const digest  = crypto.createHmac('sha256', CLIENT_SECRET).update(message).digest('hex')
      if (digest !== hmac) {
        return NextResponse.json({ error: 'HMAC non valido' }, { status: 403 })
      }

      // Scambia code per access token
      const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code })
      })
      const data = await res.json()

      if (!data.access_token) {
        return NextResponse.json({ error: 'Token non ricevuto', details: data }, { status: 400 })
      }

      // Mostra il token all'utente con istruzioni
      const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>STMN Dashboard — Token ottenuto!</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1A1A2E; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: #16213E; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; }
    h1 { color: #E94560; margin-top: 0; }
    .token { background: #0F3460; border-radius: 8px; padding: 1rem; font-family: monospace; word-break: break-all; font-size: 13px; margin: 1rem 0; }
    .step { background: #0A1628; border-radius: 8px; padding: 1rem; margin: 0.5rem 0; }
    .step b { color: #E94560; }
    button { background: #E94560; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 15px; margin-top: 0.5rem; }
    button:hover { background: #c73450; }
    .success { color: #27AE60; font-size: 1.5rem; }
  </style>
</head>
<body>
  <div class="box">
    <p class="success">✅ Connessione riuscita!</p>
    <h1>Token Shopify ottenuto</h1>
    <p>Copia questo token e incollalo in Vercel come variabile d'ambiente.</p>
    <div class="token" id="token">${data.access_token}</div>
    <button onclick="navigator.clipboard.writeText('${data.access_token}').then(()=>this.textContent='✅ Copiato!')">📋 Copia token</button>
    <br><br>
    <div class="step"><b>STEP 1:</b> Vai su Vercel → Settings → Environment Variables</div>
    <div class="step"><b>STEP 2:</b> Modifica <code>SHOPIFY_ADMIN_TOKEN</code> → incolla il token qui sopra</div>
    <div class="step"><b>STEP 3:</b> Vai su Deployments → Redeploy</div>
    <div class="step"><b>STEP 4:</b> Apri la dashboard — i dati appariranno automaticamente 🎉</div>
  </div>
</body>
</html>`
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // ── STEP 1: Redirect verso Shopify per autorizzazione ────────
  if (!CLIENT_ID || !SHOP) {
    return NextResponse.json({
      error: 'Variabili mancanti',
      missing: { SHOPIFY_CLIENT_ID: !CLIENT_ID, SHOPIFY_STORE_URL: !SHOP }
    }, { status: 500 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const authUrl = `https://${SHOP}/admin/oauth/authorize?` +
    `client_id=${CLIENT_ID}&` +
    `scope=${SCOPES}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `state=${state}&` +
    `grant_options[]=offline`

  return NextResponse.redirect(authUrl)
}
