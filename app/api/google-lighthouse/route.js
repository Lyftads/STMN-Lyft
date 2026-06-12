export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { getRange } from '../../../lib/metaRange'

// ============================================================================
//  Google Lighthouse — Alert Center per Google Ads (gemella di /api/lighthouse).
//  Rileva anomalie statistiche sui KPI Google giornalieri vs baseline:
//   - CPM spike, CTR drop, ROAS drop, CPA spike, CPC spike, Conv. rate drop
//  Output: { alerts, proposals, summary }. Multi-tenant (legge /api/google-kpi).
//  GET ?preset=last_14d&baseline_window=14
// ============================================================================

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_14d'
    const baseline_window = Math.min(30, Math.max(7, parseInt(searchParams.get('baseline_window') || '14', 10)))
    const range = getRange(preset, searchParams)

    return swrSnapshot(req, { tab: 'googleLighthouse', compute: async () => {
    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const cookieHeader = req.headers.get('cookie') || ''
      const res = await fetch(`${origin}/api/google-kpi?preset=last_30d`, {
        cache: 'no-store',
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      })
      const kpi = await res.json()
      const allDaily = Array.isArray(kpi?.daily) ? kpi.daily : []
      const inRange = allDaily.filter(d => d.date >= range.since && d.date <= range.until)

      if (allDaily.length < 7) {
        return {
          preset, range, alerts: [], proposals: [],
          summary: { high: 0, medium: 0, low: 0, total: 0 },
          warning: 'Dati insufficienti: servono almeno 7 giorni di storia Google Ads',
          updatedAt: new Date().toISOString(),
        }
      }

      const effectiveBaseline = Math.min(baseline_window, allDaily.length - inRange.length)
      const usableBaseline = Math.max(3, effectiveBaseline)

      const alerts = detectAnomalies(allDaily, usableBaseline, range)
      const proposals = buildProposals(alerts, inRange)
      const summary = summarize(alerts)
      return {
        preset, range, alerts, proposals, summary,
        baseline_window: usableBaseline, days_analyzed: inRange.length,
        updatedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        __noCache: true,
        error: err?.message || 'Errore', alerts: [], proposals: [],
        summary: { high: 0, medium: 0, low: 0, total: 0 },
      }
    }
    } })
  })
}

const METRICS = [
  { key: 'cpm',      label: 'CPM',         higherIsWorse: true,  fmt: v => `€${(+v).toFixed(2)}`, threshold: 25 },
  { key: 'ctr',      label: 'CTR',         higherIsWorse: false, fmt: v => `${(+v).toFixed(2)}%`, threshold: 25 },
  { key: 'roas',     label: 'ROAS',        higherIsWorse: false, fmt: v => `${(+v).toFixed(2)}x`, threshold: 30 },
  { key: 'cpa',      label: 'CPA',         higherIsWorse: true,  fmt: v => `€${(+v).toFixed(2)}`, threshold: 30 },
  { key: 'cpc',      label: 'CPC',         higherIsWorse: true,  fmt: v => `€${(+v).toFixed(2)}`, threshold: 25 },
  { key: 'convRate', label: 'Conv. rate',  higherIsWorse: false, fmt: v => `${(+v).toFixed(2)}%`, threshold: 25 },
]

function detectAnomalies(daily, baselineWindow, rangeFilter = null) {
  const alerts = []
  for (let i = baselineWindow; i < daily.length; i++) {
    const current = daily[i]
    if (rangeFilter && (current.date < rangeFilter.since || current.date > rangeFilter.until)) continue
    const baseline = daily.slice(Math.max(0, i - baselineWindow), i)
    for (const m of METRICS) {
      const cur = Number(current[m.key] ?? 0)
      const base = avg(baseline.map(d => Number(d[m.key] ?? 0)).filter(v => v > 0))
      if (!base || base === 0) continue
      const deviation = ((cur - base) / base) * 100
      const absDev = Math.abs(deviation)
      if (absDev < m.threshold) continue
      const isNegativeDirection = m.higherIsWorse ? deviation > 0 : deviation < 0
      if (!isNegativeDirection) continue
      const severity = severityFor(absDev)
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
        cause: guessCause(m.key, deviation),
        suggestion: suggestionFor(m.key),
      })
    }
  }
  return alerts.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return sevWeight(b.severity) - sevWeight(a.severity)
  })
}

function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0 }
function severityFor(absDev) { return absDev >= 40 ? 'high' : absDev >= 25 ? 'medium' : 'low' }
function sevWeight(s) { return s === 'high' ? 3 : s === 'medium' ? 2 : 1 }

function guessCause(metric, dev) {
  if (metric === 'cpm' && dev > 0) return 'Aste più competitive (concorrenti, stagionalità) o Quality Score in calo'
  if (metric === 'ctr' && dev < 0) return 'Annunci poco pertinenti o maggiore concorrenza sulle SERP'
  if (metric === 'roas' && dev < 0) return 'Search terms poco qualificati o shift su prodotti/keyword meno performanti'
  if (metric === 'cpa' && dev > 0) return 'Conversion rate landing in calo o keyword meno qualificate'
  if (metric === 'cpc' && dev > 0) return 'CPM alto + Quality Score basso → il click costa di più'
  if (metric === 'convRate' && dev < 0) return 'Landing page o intent delle keyword in calo'
  return 'Variazione anomala da indagare'
}

function suggestionFor(metric) {
  if (metric === 'cpm') return 'Rivedi keyword/offerte e migliora il Quality Score (annunci + landing)'
  if (metric === 'ctr') return 'Testa nuovi titoli/descrizioni RSA, rivedi keyword e match type'
  if (metric === 'roas') return 'Aggiungi negative keywords, rivedi offerte e prodotti in Shopping'
  if (metric === 'cpa') return 'Audit landing/checkout + negative keywords + strategia di offerta'
  if (metric === 'cpc') return 'Migliora Quality Score, rivedi keyword broad costose'
  if (metric === 'convRate') return 'Ottimizza landing + rivedi match type e search terms'
  return 'Indaga la causa con audit account'
}

function summarize(alerts) {
  const out = { high: 0, medium: 0, low: 0, total: alerts.length }
  for (const a of alerts) out[a.severity] = (out[a.severity] || 0) + 1
  return out
}

// ── Proposte proattive (pattern detection sulle alert) ──────────
function buildProposals(alerts, inRange) {
  const proposals = []
  const countBy = (key) => alerts.filter(a => a.metric_key === key).length
  const days = inRange.filter(d => (d.spend || 0) > 0)
  const totalSpend = days.reduce((s, d) => s + (d.spend || 0), 0)
  const avgSpendPerDay = days.length ? totalSpend / days.length : 0

  const roasDrops = countBy('roas')
  const cpaSpikes = countBy('cpa')
  const cpcSpikes = countBy('cpc')
  const ctrDrops = countBy('ctr')

  if (roasDrops >= 1 || cpaSpikes >= 1) {
    const burn = Math.round(avgSpendPerDay * 0.2 * Math.max(roasDrops, cpaSpikes))
    proposals.push({
      id: 'roas-cpa',
      priority: roasDrops + cpaSpikes >= 3 ? 'high' : 'medium',
      icon: '📉',
      title: 'Efficienza Google in calo',
      what: 'Audit search terms e negative keywords nelle prossime 48h.',
      why: `${roasDrops} alert ROAS + ${cpaSpikes} alert CPA → la spesa rende meno. Stima spreco ${burn > 0 ? '€' + burn : 'significativo'} se non agisci.`,
      how: [
        'Apri Google Detail → ordina per spesa e individua campagne con ROAS sotto media',
        'Rapporto sui termini di ricerca → aggiungi come negative le query non pertinenti',
        'Rivedi le offerte (target CPA/ROAS) sulle campagne meno efficienti',
      ],
    })
  }

  if (cpcSpikes >= 1 || ctrDrops >= 1) {
    proposals.push({
      id: 'cpc-ctr',
      priority: cpcSpikes + ctrDrops >= 3 ? 'high' : 'medium',
      icon: '🔍',
      title: 'CPC su / CTR giù — Quality Score',
      what: 'Migliora pertinenza annunci e Quality Score.',
      why: `${cpcSpikes} alert CPC + ${ctrDrops} alert CTR → annunci meno pertinenti o aste più care.`,
      how: [
        'Testa nuovi titoli/descrizioni negli RSA con keyword in target',
        'Allinea keyword → annuncio → landing (gruppi tematici più stretti)',
        'Metti in pausa keyword broad costose con CTR basso',
      ],
    })
  }

  return proposals
}
