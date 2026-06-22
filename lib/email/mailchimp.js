// Adapter Mailchimp → contratto normalizzato della tab "Email Marketing".
// Mailchimp Marketing API (https://{dc}.api.mailchimp.com/3.0), OAuth Bearer.
// dc/server arriva dalla connection Nango (credentials.js → getMailchimp).
import { getMailchimp } from '../tenant/credentials'

export async function fetchMailchimp(days = 30) {
  const { accessToken, server } = getMailchimp()
  if (!accessToken || !server) return null
  const base = `https://${server}.api.mailchimp.com/3.0`
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const headers = { Authorization: `Bearer ${accessToken}` }
  const get = (p) => fetch(`${base}${p}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    .then(r => r.ok ? r.json() : null).catch(() => null)

  const rep = await get(`/reports?since_send_time=${encodeURIComponent(since)}&count=200`)
  const reports = Array.isArray(rep?.reports) ? rep.reports : []

  let sent = 0, opens = 0, clicks = 0, unsub = 0, bounce = 0, rev = 0
  const campaigns = reports.map(r => {
    const es = r.emails_sent || 0
    sent += es
    opens += r.opens?.unique_opens || 0
    clicks += r.clicks?.unique_clicks || 0
    unsub += r.unsubscribed || 0
    bounce += (r.bounces?.hard_bounces || 0) + (r.bounces?.soft_bounces || 0)
    const cr = r.ecommerce?.total_revenue
    if (typeof cr === 'number') rev += cr
    return {
      id: r.id,
      name: r.campaign_title || r.subject_line || r.id,
      sentAt: r.send_time || null,
      recipients: es,
      openRate: (r.opens?.open_rate || 0) * 100,
      clickRate: (r.clicks?.click_rate || 0) * 100,
      revenue: typeof cr === 'number' ? cr : null,
    }
  }).sort((a, b) => (b.revenue || 0) - (a.revenue || 0) || b.recipients - a.recipients)

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
    provider: 'mailchimp',
    range: { days },
    kpis,
    campaigns,
    flows: [],
    notes: [
      'Mailchimp: il revenue per campagna richiede lo store ecommerce collegato a Mailchimp.',
      'Le automazioni (Customer Journeys) non espongono report completi via API.',
    ],
  }
}
