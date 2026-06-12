// Spesa pubblicitaria a livello CAMPAGNA (Meta + Google) nel range indicato.
// Usata da /api/campaign-map (mappatura) e /api/product-performance (attribuzione
// precisa). Va chiamata dentro withTenantContext (getMeta/getGoogle leggono il
// contesto-tenant corrente).

import { getMeta, getGoogle } from '../tenant/credentials'

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// ── Meta: campagne con spesa nel range ──
export async function fetchMetaCampaignSpend(since, until) {
  const { accessToken, adAccountId } = getMeta()
  if (!accessToken || !adAccountId) return []
  const accounts = String(adAccountId).split(',').map(s => s.trim()).filter(Boolean).map(a => a.startsWith('act_') ? a : `act_${a}`)
  const out = []
  for (const acc of accounts) {
    try {
      let url = `https://graph.facebook.com/v19.0/${acc}/insights?level=campaign&fields=campaign_id,campaign_name,spend&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&limit=500&access_token=${encodeURIComponent(accessToken)}`
      for (let p = 0; p < 20 && url; p++) {
        const j = await fetch(url, { cache: 'no-store' }).then(r => r.json())
        for (const r of (j?.data || [])) out.push({ platform: 'meta', campaign_id: String(r.campaign_id), campaign_name: r.campaign_name || r.campaign_id, spend: num(r.spend) })
        url = j?.paging?.next || null
      }
    } catch {}
  }
  return out
}

// ── Google Ads: campagne con spesa nel range (REST searchStream, no grpc) ──
export async function fetchGoogleCampaignSpend(since, until) {
  const g = getGoogle()
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (g.adsCustomerId || '').replace(/-/g, '')
  const mcc = (g.adsMccId || '').replace(/-/g, '')
  if (!devToken || !customerId || !g.refreshToken || !g.clientId || !g.clientSecret) return []
  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
    }).then(r => r.json())
    if (!tok.access_token) return []
    const headers = { Authorization: `Bearer ${tok.access_token}`, 'developer-token': devToken, 'Content-Type': 'application/json' }
    if (mcc) headers['login-customer-id'] = mcc
    const res = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST', headers, cache: 'no-store',
      body: JSON.stringify({ query: `SELECT campaign.id, campaign.name, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'` }),
    })
    if (!res.ok) return []
    const arr = await res.json()
    const agg = new Map()
    for (const chunk of (Array.isArray(arr) ? arr : [])) for (const row of (chunk.results || [])) {
      const id = String(row.campaign?.id ?? '')
      if (!id) continue
      const micros = num(row.metrics?.costMicros ?? row.metrics?.cost_micros)
      const prev = agg.get(id) || { platform: 'google', campaign_id: id, campaign_name: row.campaign?.name || id, spend: 0 }
      prev.spend += micros / 1e6
      agg.set(id, prev)
    }
    return [...agg.values()]
  } catch { return [] }
}

export async function fetchAllCampaignSpend(since, until) {
  const [meta, google] = await Promise.all([fetchMetaCampaignSpend(since, until), fetchGoogleCampaignSpend(since, until)])
  return [...meta, ...google]
}

// ── Auto-suggerimento campagna → prodotto per nome ──
export function normalizeName(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}
export function suggestProduct(campaignName, products) {
  const c = normalizeName(campaignName)
  if (!c) return null
  let best = null, bestScore = 0
  for (const p of products) {
    const pt = normalizeName(p.title)
    if (!pt) continue
    const tokens = pt.split(' ').filter(w => w.length >= 3)
    if (!tokens.length) continue
    const hit = tokens.filter(w => c.includes(w)).length
    let score = hit / tokens.length
    if (c.includes(pt)) score = Math.max(score, 0.95) // titolo intero presente
    if (score > bestScore) { bestScore = score; best = p }
  }
  return bestScore >= 0.6 ? { ...best, score: Math.round(bestScore * 100) } : null
}
