export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext, getEffectiveTenantId, getCurrentUserId } from '../../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../../lib/supabase/server'

const COLS = 'id,name,channel,status,source,unit,metric,test_regions,control_regions,lift_pct,planned_days,expected_mde,start_date,end_date,ended_at,readout,readout_at,readout_engine,created_at'

// Lista i test geo del workspace (più recenti prima).
export async function GET(req) {
  return withTenantContext(req, async () => {
    const ws = await getEffectiveTenantId()
    const admin = getAdminSupabase()
    if (!ws || !admin) return NextResponse.json({ ok: false, tests: [] })
    const { data, error } = await admin
      .from('geo_tests').select(COLS)
      .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(50)
    if (error) return NextResponse.json({ ok: false, reason: 'db', tests: [] })
    return NextResponse.json({ ok: true, tests: data || [] })
  })
}

// Crea (lancia) un test a partire dal disegno corrente del designer.
export async function POST(req) {
  return withTenantContext(req, async () => {
    const ws = await getEffectiveTenantId()
    const uid = await getCurrentUserId()
    const admin = getAdminSupabase()
    if (!ws || !admin) return NextResponse.json({ ok: false, reason: 'no_tenant' })

    const body = await req.json().catch(() => ({}))
    const design = body.design || {}
    if (!design.test?.regions?.length || !design.control?.regions?.length) {
      return NextResponse.json({ ok: false, reason: 'invalid_design' }, { status: 400 })
    }

    const channel = body.channel === 'google' ? 'google' : 'meta'
    const liftPct = Math.max(-100, Math.min(500, parseInt(body.liftPct ?? 50, 10) || 50))
    const days = Math.max(7, Math.min(120, parseInt(body.days ?? design.recommendedDays ?? 28, 10)))
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '') ? body.startDate : new Date().toISOString().slice(0, 10)
    const endDate = new Date(new Date(startDate + 'T00:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)

    const row = {
      workspace_id: ws, created_by: uid || null,
      name: (body.name || '').slice(0, 120) || null,
      channel, status: 'running',
      source: design.source || null, unit: design.unit || null, metric: design.metric || null,
      test_regions: design.test.regions, control_regions: design.control.regions, trimmed: design.trimmed || null,
      lift_pct: liftPct, planned_days: days, alpha: design.alpha ?? null, expected_mde: design.recommendedMde ?? null,
      start_date: startDate, end_date: endDate, design,
    }
    const { data, error } = await admin.from('geo_tests').insert(row).select('id').single()
    if (error) return NextResponse.json({ ok: false, reason: 'db_insert', detail: error.message })
    return NextResponse.json({ ok: true, id: data.id })
  })
}
