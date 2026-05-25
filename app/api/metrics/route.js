export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN
const META_TOKEN    = process.env.META_ACCESS_TOKEN
const META_ACCOUNT  = process.env.META_AD_ACCOUNT_ID
const START_DATE    = '2026-04-01'

function shopifyAuth() {
  return { 'X-Shopify-Access-Token': SHOPIFY_TOKEN || '' }
}

// ── AOV: ultimi 30 giorni (veloce, per riferimento) ────────────
async function fetchAOV() {
  try {
    const since = subDays(new Date(), 30).toISOString()
    const res   = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&financial_status=paid&created_at_min=${since}&limit=250&fields=total_price`,
      { headers: shopifyAuth() }
    )
    if (!res.ok) return { aov: 0, orders: 0 }
    const data = await res.json()
    const ords = data.orders || []
    const rev  = ords.reduce((s,o) => s + parseFloat(o.total_price||0), 0)
    return { aov: ords.length > 0 ? rev/ords.length : 0, orders: ords.length }
  } catch { return { aov: 0, orders: 0 } }
}

// ── Meta insights settimanali (CTR, CPC, CPM, Freq, Reach) ───
async function fetchMetaWeekly() {
  if (!META_TOKEN || !META_ACCOUNT) return []
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since    = '2025-12-29'
  const until    = format(new Date(), 'yyyy-MM-dd')
  const fields   = 'spend,impressions,reach,frequency,cpm,ctr,outbound_clicks,cost_per_outbound_click'
  try {
    const results = await Promise.all(accounts.map(async id => {
      const url  = `https://graph.facebook.com/v19.0/${id}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&time_increment=7&access_token=${META_TOKEN}`
      const res  = await fetch(url)
      const data = await res.json()
      if (data.error) { console.log('Meta weekly:', data.error.message); return [] }
      return (data.data || []).map(d => ({
        date:        d.date_start,
        spend:       parseFloat(d.spend || 0),
        impressions: parseInt(d.impressions || 0),
        reach:       parseInt(d.reach || 0),
        frequency:   parseFloat(d.frequency || 0),
        cpm:         parseFloat(d.cpm || 0),
        ctr:         parseFloat(d.ctr || 0),
        // outbound clicks (link clicks)
        linkClicks:  Array.isArray(d.outbound_clicks)
          ? parseInt(d.outbound_clicks.find(x=>x.action_type==='outbound_click')?.value||0)
          : 0,
        cpcLink:     Array.isArray(d.cost_per_outbound_click)
          ? parseFloat(d.cost_per_outbound_click.find(x=>x.action_type==='outbound_click')?.value||0)
          : 0,
      }))
    }))

    // Aggrega più account per settimana
    const map = {}
    for (const rows of results) {
      for (const r of rows) {
        if (!map[r.date]) map[r.date] = { date:r.date, spend:0, impressions:0, reach:0, freq:[], cpm:[], ctr:[], linkClicks:0, cpcLink:[] }
        map[r.date].spend       += r.spend
        map[r.date].impressions += r.impressions
        map[r.date].reach       += r.reach
        map[r.date].linkClicks  += r.linkClicks
        if (r.frequency > 0) map[r.date].freq.push(r.frequency)
        if (r.cpm       > 0) map[r.date].cpm.push(r.cpm)
        if (r.ctr       > 0) map[r.date].ctr.push(r.ctr)
        if (r.cpcLink   > 0) map[r.date].cpcLink.push(r.cpcLink)
      }
    }

    const avg = arr => arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0
    return Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)).map(w => ({
      date:       w.date,
      spend:      Math.round(w.spend*100)/100,
      impressions: w.impressions,
      reach:      w.reach,
      frequency:  Math.round(avg(w.freq)*100)/100,
      cpm:        Math.round(avg(w.cpm)*100)/100,
      ctr:        Math.round(avg(w.ctr)*1000)/1000,
      linkClicks: w.linkClicks,
      cpcLink:    Math.round(avg(w.cpcLink)*100)/100,
    }))
  } catch(e) { console.log('Meta weekly error:', e.message); return [] }
}

// ── Meta spesa mensile ─────────────────────────────────────────
async function fetchMeta() {
  if (!META_TOKEN || !META_ACCOUNT) return []
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  try {
    const results = await Promise.all(accounts.map(async id => {
      const res  = await fetch(`https://graph.facebook.com/v19.0/${id}/insights?fields=spend&time_range={"since":"${START_DATE}","until":"${format(new Date(),'yyyy-MM-dd')}"}&time_increment=monthly&access_token=${META_TOKEN}`)
      const data = await res.json()
      if (data.error) { console.log('Meta:', data.error.message); return [] }
      return data.data || []
    }))
    const map = {}
    for (const rows of results)
      for (const d of rows) {
        const m = d.date_start?.slice(0,7)
        if (m) map[m] = (map[m]||0) + parseFloat(d.spend||0)
      }
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
      .map(([month,spend]) => ({ month, spend: Math.round(spend*100)/100 }))
  } catch { return [] }
}

export async function GET() {
  try {
    const [aovData, metaMonthly, metaWeekly] = await Promise.all([fetchAOV(), fetchMeta(), fetchMetaWeekly()])
    const metaTotal = metaMonthly.reduce((s,m) => s+m.spend, 0)
    return NextResponse.json({
      aovLive:    Math.round(aovData.aov*100)/100,
      ordersLive: aovData.orders,
      metaSpend:  Math.round(metaTotal*100)/100,
      metaMonthly,
      metaWeekly,
      sources: { shopify: aovData.orders > 0, meta: metaMonthly.length > 0 },
      metaWeekly,
      updatedAt: new Date().toISOString(),
    })
  } catch(err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Meta dati settimanali (CTR, CPC, CPM, Frequenza) ─────────
async function fetchMetaWeekly() {
  if (!META_TOKEN || !META_ACCOUNT) return []
  const accounts = META_ACCOUNT.split(',').map(s => s.trim()).filter(Boolean)
  const since    = '2025-12-29'
  const until    = format(new Date(), 'yyyy-MM-dd')
  try {
    const results = await Promise.all(accounts.map(async id => {
      const fields = 'spend,cpm,frequency,impressions,reach,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click'
      const url = `https://graph.facebook.com/v19.0/${id}/insights?fields=${fields}&time_range={"since":"${since}","until":"${until}"}&time_increment=7&access_token=${META_TOKEN}`
      const res  = await fetch(url)
      const data = await res.json()
      if (data.error) { console.log('Meta weekly:', data.error.message); return [] }
      return data.data || []
    }))
    // Aggrega per settimana (date_start = lunedì della settimana)
    const map = {}
    for (const rows of results) {
      for (const d of rows) {
        const k = d.date_start // ISO: 2025-12-29
        if (!map[k]) map[k] = { spend:0, impressions:0, reach:0, clicks:0, ctrSum:0, cpcSum:0, cpmSum:0, freqSum:0, count:0 }
        map[k].spend       += parseFloat(d.spend||0)
        map[k].impressions += parseInt(d.impressions||0)
        map[k].reach       += parseInt(d.reach||0)
        map[k].clicks      += parseInt(d.inline_link_clicks||0)
        map[k].ctrSum      += parseFloat(d.inline_link_click_ctr||0)
        map[k].cpcSum      += parseFloat(d.cost_per_inline_link_click||0)
        map[k].cpmSum      += parseFloat(d.cpm||0)
        map[k].freqSum     += parseFloat(d.frequency||0)
        map[k].count       += 1
      }
    }
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([week, m]) => ({
      week,
      spend:       Math.round(m.spend*100)/100,
      impressions: m.impressions,
      reach:       m.reach,
      clicks:      m.clicks,
      ctr:         m.count>0 ? Math.round(m.ctrSum/m.count*100)/100 : 0,   // CTR link %
      cpc:         m.count>0 ? Math.round(m.cpcSum/m.count*100)/100 : 0,   // CPC link €
      cpm:         m.count>0 ? Math.round(m.cpmSum/m.count*100)/100 : 0,   // CPM €
      frequency:   m.count>0 ? Math.round(m.freqSum/m.count*100)/100 : 0,  // Frequenza
    }))
  } catch(e) { console.log('Meta weekly error:', e.message); return [] }
}
