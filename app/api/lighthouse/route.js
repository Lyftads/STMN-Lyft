export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Lighthouse — Alert Center (stile Triple Whale Lighthouse)
//
//  Detecta anomalie statistiche sui KPI Meta giornalieri:
//   - CPM spike (>+25% vs baseline)
//   - CTR drop (<-25% vs baseline)
//   - ROAS drop (<-30% vs baseline)
//   - Frequency overshoot (>4.0 assoluto, o >+50% vs baseline)
//   - CPO spike (>+30% vs baseline)
//
//  Output:
//   - alerts: [{ id, severity, metric, current, baseline, deviation_pct,
//                date, cause, suggestion }]
//   - summary: { high, medium, low, total }
//
//  GET ?preset=last_28d&baseline_window=14
// ============================================================================

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_14d'
    const baseline_window = Math.min(30, Math.max(7, parseInt(searchParams.get('baseline_window') || '14', 10)))
    const range = getRange(preset)

    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const cookieHeader = req.headers.get('cookie') || ''
      const res = await fetch(`${origin}/api/meta-kpi?preset=${preset}`, {
        cache: 'no-store',
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      })
      const kpi = await res.json()
      const daily = Array.isArray(kpi?.daily) ? kpi.daily : []
      if (daily.length < baseline_window + 1) {
        return NextResponse.json({
          preset, range,
          alerts: [],
          summary: { high: 0, medium: 0, low: 0, total: 0 },
          warning: `Dati insufficienti: servono almeno ${baseline_window + 1} giorni`,
          updatedAt: new Date().toISOString(),
        })
      }

      const alerts = detectAnomalies(daily, baseline_window)
      const summary = summarize(alerts)
      return NextResponse.json({
        preset, range,
        alerts,
        summary,
        baseline_window,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({
        error: err?.message || 'Errore',
        alerts: [], summary: { high: 0, medium: 0, low: 0, total: 0 },
      }, { status: 200 })
    }
  })
}

const METRICS = [
  { key: 'cpm',       label: 'CPM',          higherIsWorse: true,  fmt: v => `€${(+v).toFixed(2)}`,  threshold: 25 },
  { key: 'ctr_link',  label: 'CTR link',     higherIsWorse: false, fmt: v => `${(+v).toFixed(2)}%`,  threshold: 25 },
  { key: 'roas',      label: 'ROAS',         higherIsWorse: false, fmt: v => `${(+v).toFixed(2)}x`,  threshold: 30 },
  { key: 'cpo',       label: 'CPO',          higherIsWorse: true,  fmt: v => `€${(+v).toFixed(2)}`,  threshold: 30 },
  { key: 'cpc_link',  label: 'CPC link',     higherIsWorse: true,  fmt: v => `€${(+v).toFixed(2)}`,  threshold: 25 },
  { key: 'frequency', label: 'Frequenza',    higherIsWorse: true,  fmt: v => (+v).toFixed(2),        threshold: 50, absoluteCap: 4.0 },
]

function detectAnomalies(daily, baselineWindow) {
  const alerts = []
  // Per ogni giorno (a partire dal giorno baselineWindow+1) calcola anomalia
  // vs media dei `baselineWindow` giorni precedenti.
  for (let i = baselineWindow; i < daily.length; i++) {
    const current = daily[i]
    const baseline = daily.slice(Math.max(0, i - baselineWindow), i)
    for (const m of METRICS) {
      const cur = Number(current[m.key] ?? 0)
      const base = avg(baseline.map(d => Number(d[m.key] ?? 0)).filter(v => v > 0))
      if (!base || base === 0) continue

      const deviation = ((cur - base) / base) * 100
      const absDev = Math.abs(deviation)

      // Absolute cap (es. frequency > 4 sempre alert)
      let triggeredByCap = false
      if (m.absoluteCap && cur > m.absoluteCap) triggeredByCap = true

      if (absDev < m.threshold && !triggeredByCap) continue

      const isNegativeDirection = m.higherIsWorse ? deviation > 0 : deviation < 0
      if (!isNegativeDirection && !triggeredByCap) continue

      const severity = severityFor(absDev, triggeredByCap)
      const cause = guessCause(m.key, deviation, current, baseline)

      alerts.push({
        id: `${current.date}-${m.key}`,
        date: current.date,
        metric: m.label,
        metric_key: m.key,
        current: cur,
        baseline: +base.toFixed(2),
        current_fmt: m.fmt(cur),
        baseline_fmt: m.fmt(base),
        deviation_pct: +deviation.toFixed(1),
        severity,
        higher_is_worse: m.higherIsWorse,
        cause,
        suggestion: suggestionFor(m.key, deviation, triggeredByCap),
      })
    }
  }
  // Ordina per data desc + severity (high prima)
  return alerts.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return sevWeight(b.severity) - sevWeight(a.severity)
  })
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function severityFor(absDev, cap) {
  if (cap) return 'high'
  if (absDev >= 40) return 'high'
  if (absDev >= 25) return 'medium'
  return 'low'
}

function sevWeight(s) {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1
}

function guessCause(metric, dev, current, baseline) {
  if (metric === 'cpm' && dev > 0) {
    return 'Asta più competitiva (saldi competitor, picco stagionale) o creative bruciata (frequenza alta)'
  }
  if (metric === 'ctr_link' && dev < 0) {
    return 'Creative fatigue (frequenza alta) o audience saturata'
  }
  if (metric === 'roas' && dev < 0) {
    return 'Creative fatigue oppure shift sui prodotti meno performanti'
  }
  if (metric === 'cpo' && dev > 0) {
    return 'Conversion rate landing page in calo o audience meno qualificata'
  }
  if (metric === 'cpc_link' && dev > 0) {
    return 'CPM alto + CTR debole → click costa di più'
  }
  if (metric === 'frequency') {
    return 'Audience troppo piccola oppure budget alto su pool ristretto'
  }
  return 'Variazione anomala da indagare'
}

function suggestionFor(metric, dev, cap) {
  if (metric === 'frequency' && cap) {
    return 'Pause adset con frequency > 4 oppure espandi audience (broad/LAL)'
  }
  if (metric === 'cpm' && dev > 0) {
    return 'Refresh creative dei top adset + verifica audience overlap'
  }
  if (metric === 'ctr_link' && dev < 0) {
    return 'Test nuovi angle/hook + pause creative con frequency > 3'
  }
  if (metric === 'roas' && dev < 0) {
    return 'Verifica budget reallocation + identifica creative winner del periodo'
  }
  if (metric === 'cpo' && dev > 0) {
    return 'Check landing page / audit checkout funnel'
  }
  return 'Indaga la causa con audit account o anomaly detector'
}

function summarize(alerts) {
  const out = { high: 0, medium: 0, low: 0, total: alerts.length }
  for (const a of alerts) out[a.severity] = (out[a.severity] || 0) + 1
  return out
}
