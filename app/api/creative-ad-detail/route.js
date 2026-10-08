// Dettaglio di UNA creativita' Meta, per il pannello della tab Creative:
//   - daily: spesa, ricavi, ROAS e ordini giorno per giorno nel periodo;
//   - placements: quota di spesa per posizionamento (publisher_platform ×
//     platform_position), con ordini, ROAS e CPA.
// GET ?ad_id=…&preset=last_7d | &preset=custom&since=&until=
// Due chiamate Graph sull'annuncio; risposta nello snapshot del workspace
// per 30 minuti (chiave con annuncio e periodo: il wrapper SWR non conosce
// ad_id, quindi si va diretti su tab_snapshots).

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { getSnapshotStale, setSnapshot } from '../../../lib/cache/snapshot'

const GRAPH = 'v19.0'
const TTL = 30 * 60 * 1000
const PURCHASE = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

function actVal(arr, names) {
  if (!Array.isArray(arr)) return 0
  for (const n of names) { const f = arr.find(a => a.action_type === n); if (f) return num(f.value) }
  return 0
}

async function fb(path, params) {
  const url = new URL(`https://graph.facebook.com/${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null && v !== '') url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  url.searchParams.set('access_token', getMeta().accessToken)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (data?.error) throw new Error(data.error.message || 'Meta API')
  return Array.isArray(data?.data) ? data.data : []
}

function kpi(row) {
  const spend = num(row.spend)
  const revenue = actVal(row.action_values, PURCHASE)
  const purchases = actVal(row.actions, PURCHASE)
  return {
    spend: r2(spend), revenue: r2(revenue), purchases: Math.round(purchases),
    roas: spend > 0 ? r2(revenue / spend) : 0,
    cpa: purchases > 0 ? r2(spend / purchases) : null,
    impressions: Math.round(num(row.impressions)),
    link_clicks: Math.round(num(row.inline_link_clicks)),
  }
}

// "instagram" + "instagram_reels" → "Instagram · Reels". Si toglie il nome
// della piattaforma ripetuto nella posizione e si mettono le maiuscole.
const PIATTAFORMA = { facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network', messenger: 'Messenger', threads: 'Threads', unknown: '—' }
function etichetta(pp, pos) {
  const p = PIATTAFORMA[pp] || String(pp || '').replace(/_/g, ' ')
  let s = String(pos || '').replace(/^(facebook|instagram|messenger|audience_network|threads)_/, '').replace(/_/g, ' ').trim()
  s = s.replace(/\b\w/g, c => c.toUpperCase())
  return s ? `${p} · ${s}` : p
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { accessToken } = getMeta()
    if (!accessToken) return NextResponse.json({ ok: false, configured: false, error: 'Meta non configurato' })
    const { searchParams } = new URL(req.url)
    const adId = String(searchParams.get('ad_id') || '').replace(/[^0-9]/g, '')
    if (!adId) return NextResponse.json({ ok: false, error: 'ad_id mancante' }, { status: 400 })
    const range = getRange(searchParams.get('preset') || 'last_7d', searchParams)
    const chiave = `creativeAdDetail:${adId}:${range.since}:${range.until}`
    const wsId = await getEffectiveTenantId().catch(() => null)

    const salvato = wsId ? await getSnapshotStale(wsId, chiave) : null
    if (salvato?.payload && salvato.ageMs < TTL) return NextResponse.json(salvato.payload)

    const time_range = JSON.stringify({ since: range.since, until: range.until })
    const fields = 'date_start,spend,impressions,inline_link_clicks,actions,action_values'
    const errors = []
    const [giorni, posizioni] = await Promise.all([
      fb(`${adId}/insights`, { time_range, time_increment: 1, fields, limit: '500' }).catch(e => { errors.push(e.message); return [] }),
      fb(`${adId}/insights`, { time_range, breakdowns: 'publisher_platform,platform_position', fields, limit: '500' }).catch(e => { errors.push(e.message); return [] }),
    ])

    const daily = giorni.map(r => ({ date: r.date_start, ...kpi(r) })).sort((a, b) => a.date.localeCompare(b.date))
    const tot = posizioni.reduce((s, r) => s + num(r.spend), 0)
    const placements = posizioni.map(r => ({
      platform: r.publisher_platform, position: r.platform_position,
      label: etichetta(r.publisher_platform, r.platform_position),
      ...kpi(r), share: tot > 0 ? r2((num(r.spend) / tot) * 100) : 0,
    })).filter(p => p.spend >= 0.5).sort((a, b) => b.spend - a.spend)

    const payload = { ok: true, ad_id: adId, range, daily, placements, ...(errors.length ? { error: errors[0] } : {}), updatedAt: new Date().toISOString() }
    if (wsId && !errors.length) await setSnapshot(wsId, chiave, payload)
    return NextResponse.json(payload)
  })
}
