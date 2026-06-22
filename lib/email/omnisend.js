// Adapter Omnisend → contratto normalizzato della tab "Email Marketing".
// Omnisend API v3 (https://api.omnisend.com/v3), header X-API-KEY.
// La key arriva dalla connection Nango (API-key auth) → credentials.js.
import { getOmnisend } from '../tenant/credentials'

const BASE = 'https://api.omnisend.com/v3'

export async function fetchOmnisend(days = 30) {
  const { apiKey } = getOmnisend()
  if (!apiKey) return null
  const headers = { 'X-API-KEY': apiKey, Accept: 'application/json' }
  const get = (p) => fetch(`${BASE}${p}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    .then(r => r.ok ? r.json() : null).catch(() => null)

  const sinceMs = Date.now() - days * 86400000
  const res = await get('/campaigns?limit=100')
  const list = Array.isArray(res?.campaigns) ? res.campaigns : (Array.isArray(res) ? res : [])

  let sent = 0, opens = 0, clicks = 0, unsub = 0, bounce = 0, rev = 0
  const campaigns = list
    .filter(c => {
      const t = c.sentAt || c.sendAt || c.startDate || c.createdAt
      return !t || new Date(t).getTime() >= sinceMs
    })
    .map(c => {
      // Le metriche Omnisend vivono in un sotto-oggetto stats/statistics a seconda
      // della versione: leggiamo difensivamente con fallback a null.
      const s = c.statistics || c.stats || c.metrics || {}
      const recipients = num(s.sent ?? s.sentCount ?? s.recipients)
      const o = num(s.opened ?? s.opens ?? s.uniqueOpens)
      const cl = num(s.clicked ?? s.clicks ?? s.uniqueClicks)
      const u = num(s.unsubscribed ?? s.unsubscribes)
      const b = num(s.bounced ?? s.bounces)
      const money = s.sales ?? s.revenue ?? c.revenue
      sent += recipients; opens += o; clicks += cl; unsub += u; bounce += b
      if (typeof money === 'number') rev += money
      return {
        id: c.campaignID || c.id,
        name: c.name || c.title || c.subject || (c.campaignID || c.id),
        sentAt: c.sentAt || c.sendAt || c.startDate || c.createdAt || null,
        recipients: recipients || null,
        openRate: recipients > 0 ? (o / recipients) * 100 : null,
        clickRate: recipients > 0 ? (cl / recipients) * 100 : null,
        revenue: typeof money === 'number' ? money : null,
      }
    })
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0) || (b.recipients || 0) - (a.recipients || 0))

  const kpis = {
    sent,
    opened: opens,
    clicked: clicks,
    unsubscribed: unsub,
    bounced: bounce,
    openRate: sent > 0 ? (opens / sent) * 100 : 0,
    clickRate: sent > 0 ? (clicks / sent) * 100 : 0,
    revenue: rev || null,
  }

  return {
    provider: 'omnisend',
    range: { days },
    kpis,
    campaigns,
    flows: [],
    notes: ['Omnisend: la copertura delle metriche via API può variare; i campi non esposti restano "—".'],
  }
}

function num(v) { return typeof v === 'number' ? v : (parseInt(v, 10) || 0) }
