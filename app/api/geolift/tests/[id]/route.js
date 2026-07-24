export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getEffectiveTenantId, getShopify, getGoogle } from '../../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../../lib/supabase/server'
import { provinceSeries, ga4Regions, alignGroups } from '../../../../../lib/incrementality/geodata'
import { computeReadout } from '../../../../../lib/incrementality/readout'

// Dettaglio di un test.
export async function GET(req, { params }) {
  return withTenantContext(req, async () => {
    const ws = await getEffectiveTenantId()
    const admin = getAdminSupabase()
    if (!ws || !admin) return NextResponse.json({ ok: false })
    const { data, error } = await admin.from('geo_tests').select('*').eq('workspace_id', ws).eq('id', params.id).single()
    if (error || !data) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, test: data })
  })
}

// Chiude un test: 'cancel' lo annulla, 'stop' (default) calcola il readout causale.
export async function PATCH(req, { params }) {
  return withTenantContext(req, async () => {
    const ws = await getEffectiveTenantId()
    const admin = getAdminSupabase()
    if (!ws || !admin) return NextResponse.json({ ok: false })

    const body = await req.json().catch(() => ({}))
    const { data: test } = await admin.from('geo_tests').select('*').eq('workspace_id', ws).eq('id', params.id).single()
    if (!test) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })

    const now = new Date().toISOString()
    if (body.action === 'cancel') {
      await admin.from('geo_tests').update({ status: 'cancelled', ended_at: now, updated_at: now }).eq('id', test.id).eq('workspace_id', ws)
      return NextResponse.json({ ok: true, status: 'cancelled' })
    }

    // 'stop': misura il lift causale e chiude.
    const readout = await computeTestReadout(test)
    const upd = { status: 'completed', ended_at: now, updated_at: now }
    if (readout?.ok) { upd.readout = readout; upd.readout_at = now; upd.readout_engine = readout.method || 'tbr' }
    await admin.from('geo_tests').update(upd).eq('id', test.id).eq('workspace_id', ws)
    return NextResponse.json({ ok: true, status: 'completed', readout })
  })
}

// Ricostruisce le serie test/control del test e ne misura l'incrementale.
// Ibrido: usa il worker R GeoLift se GEOLIFT_R_URL è configurato, altrimenti il
// fallback JS Time-Based Regression (sempre disponibile).
async function computeTestReadout(test) {
  const start = test.start_date
  const testDays = test.planned_days || 28
  const preDays = Math.max(28, testDays * 2) // pre-periodo ampio per un buon fit
  const since = new Date(new Date(start + 'T00:00:00Z').getTime() - preDays * 86400000).toISOString().slice(0, 10)
  const until = new Date().toISOString().slice(0, 10)
  const testRegions = test.test_regions || []
  const controlRegions = test.control_regions || []
  const all = [...testRegions, ...controlRegions]
  if (all.length < 2) return { ok: false, reason: 'no_regions' }

  // Ricava le serie giornaliere delle regioni coinvolte dalla stessa sorgente del disegno.
  let regions = []
  if (test.source === 'shopify_province') {
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) return { ok: false, reason: 'shopify_missing' }
    regions = await provinceSeries(storeUrl, adminToken, all, since, until)
  } else {
    const g = getGoogle()
    if (!g.ga4PropertyId) return { ok: false, reason: 'ga4_missing' }
    const span = Math.min(180, Math.ceil((Date.now() - new Date(since + 'T00:00:00Z').getTime()) / 86400000))
    const { regions: r } = await ga4Regions(g, span, test.metric)
    regions = (r || []).filter(x => all.includes(x.region))
  }
  if (regions.length < 2) return { ok: false, reason: 'no_data' }

  const { dailyTest, dailyControl, testStartIdx } = alignGroups(regions, testRegions, controlRegions, start)
  const alpha = Number(test.alpha) || 0.10

  // Readout certificato via worker R GeoLift (se configurato).
  if (process.env.GEOLIFT_R_URL) {
    try {
      const res = await fetch(`${process.env.GEOLIFT_R_URL.replace(/\/$/, '')}/readout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions, testRegions, controlRegions, startDate: start, alpha }),
      })
      if (res.ok) { const j = await res.json().catch(() => null); if (j?.ok) return { ...j, method: 'geolift' } }
    } catch { /* cade sul fallback JS */ }
  }

  return computeReadout(dailyTest, dailyControl, testStartIdx, { alpha })
}
