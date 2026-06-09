export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../../lib/supabase/server'
import { resolveWorkspace } from '../../../../../lib/team/workspace'
import { withTenantContext } from '../../../../../lib/tenant/credentials'
import { periodStats } from '../../../../../lib/agent/shopifyWeeks'

// "Innesca" i dati reali per la call: il browser dell'owner (autenticato) chiama
// questo endpoint prima di avviare la call. Qui carichiamo l'agent-context con il
// COOKIE di sessione (percorso provato → dati reali) e lo salviamo in call_context.
// Il cervello della call (server-to-server, senza sessione) lo legge da lì.
export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'no db' }, { status: 500 })

  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''
  // Retry: ShopifyQL (shopify.weekly) a volte torna a ZERO sulle settimane recenti
  // (rate-limit/cost). Ritento finché questa/scorsa settimana hanno valori reali,
  // così matchano ESATTAMENTE la tab Weekly. Altrimenti tengo l'ultimo dato.
  const mon = off => { const x = new Date(); const dd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dd - off * 7); return x.toISOString().slice(0, 10) }
  const thisMon = mon(0), lastMon = mon(1)
  const weeklyOk = d => {
    const wk = d?.shopify?.weekly
    if (!Array.isArray(wk)) return false
    return wk.some(w => [thisMon, lastMon].includes(String(w.date || '').slice(0, 10)) && (Number(w.ordini) || Number(w.fatturato)))
  }
  let data = null
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, { cache: 'no-store', headers: cookie ? { cookie } : {} })
      if (r.ok) {
        const d = await r.json()
        if (d) data = d
        if (weeklyOk(d)) break
      }
    } catch {}
    if (i < 3) await new Promise(r => setTimeout(r, 1500))
  }
  if (!data) return NextResponse.json({ ok: false, error: 'agent-context non disponibile' })

  // Time frame Shopify ESATTI via Admin GraphQL (oggi/ieri/settimana/mese/30g).
  try {
    data._periods = await withTenantContext(req, () => periodStats())
  } catch {}

  // Klaviyo per periodo (this week = giorni da lunedì, this month = giorni dal 1°, 30g).
  try {
    const now2 = new Date(); const dd2 = (now2.getUTCDay() + 6) % 7; const daysMonth = now2.getUTCDate() - 1
    const kf = days => fetch(`${origin}/api/klaviyo?days=${days}`, { cache: 'no-store', headers: cookie ? { cookie } : {} }).then(r => r.ok ? r.json() : null).catch(() => null)
    const [kWeek, kMonth, k30] = await Promise.all([kf(dd2), kf(daysMonth), kf(30)])
    data._klaviyo = { this_week: kWeek?.kpis || null, this_month: kMonth?.kpis || null, last_30d: k30?.kpis || null }
  } catch {}

  // Google Search Console per periodo (7g + settimana prec, 30g + mese prec).
  try {
    const sites = await fetch(`${origin}/api/gsc?action=sites`, { cache: 'no-store', headers: cookie ? { cookie } : {} }).then(r => r.ok ? r.json() : null).catch(() => null)
    const list = sites?.sites || []
    const site = list[0]?.siteUrl || list[0]?.url || list[0] || null
    if (site) {
      const gf = days => fetch(`${origin}/api/gsc?site=${encodeURIComponent(site)}&days=${days}`, { cache: 'no-store', headers: cookie ? { cookie } : {} }).then(r => r.ok ? r.json() : null).catch(() => null)
      const [g7, g30] = await Promise.all([gf(7), gf(30)])
      data._gsc = { last_7d: g7, last_30d: g30 }
    }
  } catch {}

  try {
    await admin.from('call_context').upsert({ workspace_id: ws.workspaceId, data, updated_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'upsert fallito' })
  }
  return NextResponse.json({ ok: true, hasData: !!(data?.shopify || data?.metaAds || data?.creatives) })
}
