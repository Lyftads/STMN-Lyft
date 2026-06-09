export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

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
  const H = cookie ? { cookie } : {}

  // ── In PARALLELO (non dipendono da agent-context) ──────────────────────────
  // 1) Periodi Shopify esatti (Admin GraphQL).
  const periodsP = withTenantContext(req, () => periodStats()).catch(() => null)
  // 2) Klaviyo per periodo: questa settimana (giorni da lun), questo mese (dal 1°), 30g.
  const klaviyoP = (async () => {
    const now2 = new Date(); const dd2 = (now2.getUTCDay() + 6) % 7; const daysMonth = now2.getUTCDate() - 1
    const kf = days => fetch(`${origin}/api/klaviyo?days=${days}`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)
    const [kWeek, kMonth, k30] = await Promise.all([kf(Math.max(dd2, 1)), kf(Math.max(daysMonth, 1)), kf(30)])
    return { this_week: kWeek?.kpis || null, this_month: kMonth?.kpis || null, last_30d: k30?.kpis || null }
  })().catch(() => null)
  // 3) GSC per periodo (7g + prec, 30g + prec) — sito del BRAND, non lyftai.io.
  const gscP = (async () => {
    const sites = await fetch(`${origin}/api/gsc?action=sites`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)
    const list = (sites?.sites || []).map(s => (typeof s === 'string' ? s : s.siteUrl || s.url)).filter(Boolean)
    const site = list.find(s => /stmn/i.test(s)) || list.find(s => !/lyftai/i.test(s)) || list[0] || null
    if (!site) return null
    const gf = days => fetch(`${origin}/api/gsc?site=${encodeURIComponent(site)}&days=${days}`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)
    const [g7, g30] = await Promise.all([gf(7), gf(30)])
    return { site, last_7d: g7, last_30d: g30 }
  })().catch(() => null)

  // 4) GA4 per periodo (sessioni → conversion rate per periodo).
  const ga4P = (async () => {
    const now2 = new Date(); const dd2 = (now2.getUTCDay() + 6) % 7; const daysMonth = now2.getUTCDate() - 1
    const gf = days => fetch(`${origin}/api/ga4?days=${days}`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)
    const [w, m, d30] = await Promise.all([gf(Math.max(dd2, 1)), gf(Math.max(daysMonth, 1)), gf(30)])
    return { this_week: w?.summary || null, this_month: m?.summary || null, last_30d: d30?.summary || null }
  })().catch(() => null)
  // 5) P&L mensile (marginalità: ricavi netti, COGS, utile lordo, margine).
  const pnlP = fetch(`${origin}/api/pnl?months=3`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)
  // 6) Task, Lyftimer, Competitor (per gli strumenti live degli agent).
  const tasksP = fetch(`${origin}/api/tasks`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)
  const lyftimerP = fetch(`${origin}/api/time-entries`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)
  const compP = fetch(`${origin}/api/competitor-intel`, { cache: 'no-store', headers: H }).then(r => r.ok ? r.json() : null).catch(() => null)

  // ── agent-context con retry (la weekly ShopifyQL a volte torna a zero) ─────
  let data = null
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, { cache: 'no-store', headers: H })
      if (r.ok) { const d = await r.json(); if (d) data = d; if (weeklyOk(d)) break }
    } catch {}
    if (i < 3) await new Promise(r => setTimeout(r, 1500))
  }
  if (!data) return NextResponse.json({ ok: false, error: 'agent-context non disponibile' })

  const [periods, klaviyo, gsc, ga4p, pnl, tasks, lyftimer, comp] = await Promise.all([periodsP, klaviyoP, gscP, ga4P, pnlP, tasksP, lyftimerP, compP])
  if (periods) data._periods = periods
  if (klaviyo) data._klaviyo = klaviyo
  if (gsc) data._gsc = gsc
  if (ga4p) data._ga4 = ga4p
  if (pnl?.series) data._pnl = { series: pnl.series, cogsByMonth: pnl.cogsByMonth || null }
  if (tasks?.tasks) data._tasks = tasks.tasks.slice(0, 60)
  if (lyftimer) data._lyftimer = { entries: (lyftimer.entries || []).slice(0, 40), summary: lyftimer.summary || null }
  if (comp) data._competitors = comp

  // Preserva la weekly BUONA precedente: se ShopifyQL ora torna a ZERO su una
  // settimana, riusa il valore non-zero dello snapshot precedente → Shopify resta
  // sempre allineato alle tab (niente "in aggiornamento"/zero intermittenti).
  try {
    const { data: prev } = await admin.from('call_context').select('data').eq('workspace_id', ws.workspaceId).maybeSingle()
    const prevWk = prev?.data?.shopify?.weekly
    if (Array.isArray(prevWk) && Array.isArray(data?.shopify?.weekly)) {
      data.shopify.weekly = data.shopify.weekly.map(w => {
        if (Number(w.ordini) || Number(w.fatturato)) return w
        const k = String(w.date || '').slice(0, 10)
        const old = prevWk.find(o => String(o.date || '').slice(0, 10) === k && (Number(o.ordini) || Number(o.fatturato)))
        return old || w
      })
    }
  } catch {}

  try {
    await admin.from('call_context').upsert({ workspace_id: ws.workspaceId, data, updated_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'upsert fallito' })
  }
  return NextResponse.json({ ok: true, hasData: !!(data?.shopify || data?.metaAds || data?.creatives) })
}
