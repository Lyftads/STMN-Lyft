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
    const range = getRange(preset, searchParams)

    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const cookieHeader = req.headers.get('cookie') || ''
      // Fetchiamo SEMPRE last_30d come daily series per avere abbastanza
      // storia per il baseline, indipendentemente dal range selezionato.
      const res = await fetch(`${origin}/api/meta-kpi?preset=last_30d`, {
        cache: 'no-store',
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      })
      const kpi = await res.json()
      const allDaily = Array.isArray(kpi?.daily) ? kpi.daily : []
      // Filtra solo i giorni del range selezionato (today, last_7d, etc.)
      const inRange = allDaily.filter(d => d.date >= range.since && d.date <= range.until)
      if (allDaily.length < 7) {
        return NextResponse.json({
          preset, range,
          alerts: [],
          proposals: [],
          summary: { high: 0, medium: 0, low: 0, total: 0 },
          warning: 'Dati insufficienti: servono almeno 7 giorni di storia Meta',
          updatedAt: new Date().toISOString(),
        })
      }

      // Baseline window dinamico: usa min(baseline_window, storia disponibile - giorni nel range)
      const effectiveBaseline = Math.min(baseline_window, allDaily.length - inRange.length)
      const usableBaseline = Math.max(3, effectiveBaseline)

      const alerts = detectAnomalies(allDaily, usableBaseline, range)
      const proposals = buildProposals(alerts, inRange)
      const summary = summarize(alerts)
      return NextResponse.json({
        preset, range,
        alerts,
        proposals,
        summary,
        baseline_window: usableBaseline,
        days_analyzed: inRange.length,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({
        error: err?.message || 'Errore',
        alerts: [], proposals: [], summary: { high: 0, medium: 0, low: 0, total: 0 },
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

function detectAnomalies(daily, baselineWindow, rangeFilter = null) {
  const alerts = []
  // Per ogni giorno (a partire dal giorno baselineWindow+1) calcola anomalia
  // vs media dei `baselineWindow` giorni precedenti.
  for (let i = baselineWindow; i < daily.length; i++) {
    const current = daily[i]
    // Se rangeFilter e' presente, analizza SOLO i giorni nel range richiesto.
    if (rangeFilter && (current.date < rangeFilter.since || current.date > rangeFilter.until)) continue
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

// ── Proposte proattive ─────────────────────────────────────────
//  Pattern detection sulle alert per generare macro-azioni aggregate
//  ("cosa fare adesso") con why + how + priority.
function buildProposals(alerts, inRange) {
  const proposals = []

  const countBy = (key) => alerts.filter(a => a.metric_key === key).length
  const hasRecent = (key) => alerts.some(a => a.metric_key === key && a.severity !== 'low')
  const recentDaysWithSpend = inRange.filter(d => (d.spend || 0) > 0)
  const totalSpend = recentDaysWithSpend.reduce((s, d) => s + (d.spend || 0), 0)
  const avgSpendPerDay = recentDaysWithSpend.length > 0 ? totalSpend / recentDaysWithSpend.length : 0

  // 1) Creative fatigue (freq alta + CTR drop simultanei)
  const freqAlerts = countBy('frequency')
  const ctrDrops = countBy('ctr_link')
  if (freqAlerts >= 1 && ctrDrops >= 1) {
    const lostBudgetEstimate = Math.round(avgSpendPerDay * 0.2 * Math.max(freqAlerts, ctrDrops))
    proposals.push({
      id: 'creative-fatigue',
      priority: 'high',
      icon: '🔥',
      title: 'Creative fatigue in corso',
      what: 'Refresh delle creative top-spending nelle prossime 48h.',
      why: `${freqAlerts} alert frequenza + ${ctrDrops} alert CTR link → utenti vedono troppe volte le stesse creative e cliccano meno. Stima burn ${lostBudgetEstimate > 0 ? '€' + lostBudgetEstimate : 'significativo'} se non agisci.`,
      how: [
        'Apri Creative Fatigue tab → filtra ad con frequency > 3 e ROAS < media',
        'Pause questi ad. Brief 2-3 nuove varianti su angle vincenti (Identify Winning Angle skill)',
        'Lancia con stesso budget in adset esistenti (no nuova adset → preserva learning)',
      ],
    })
  }

  // 2) Audience saturation (frequency > 4 isolato)
  const freqHigh = alerts.filter(a => a.metric_key === 'frequency' && a.current >= 4).length
  if (freqHigh >= 1) {
    proposals.push({
      id: 'audience-saturation',
      priority: 'high',
      icon: '◯',
      title: 'Audience saturata',
      what: 'Espandi il pubblico target o crea nuove audience prospecting.',
      why: `Frequency ≥ 4 in ${freqHigh} giorno/i → stessi utenti raggiunti ${freqHigh > 1 ? 'ripetutamente' : 'molte volte'}. Meta non ha più nuova domanda da intercettare.`,
      how: [
        'Crea nuove Lookalike audience (1-3% e 3-5% LAL) basate su Buyers 180d',
        'Allarga age range (es. 25-54 → 25-65) o geo (più paesi UE)',
        'Test broad audience con detailed targeting expansion ON',
      ],
    })
  }

  // 3) Cost competition (CPM spike senza CTR drop)
  const cpmSpikes = alerts.filter(a => a.metric_key === 'cpm' && a.deviation_pct > 0).length
  const ctrStable = ctrDrops === 0
  if (cpmSpikes >= 1 && ctrStable) {
    proposals.push({
      id: 'cost-competition',
      priority: 'medium',
      icon: '⚡',
      title: 'Asta più competitiva',
      what: 'Difendi la quota di reach senza cambiare creative.',
      why: `CPM in salita ${cpmSpikes} giorno/i ma CTR stabile → competitor stanno bidding alto (saldi, picco stagionale, lancio prodotto). Non è un problema tuo creative.`,
      how: [
        'Verifica calendario competitor (Brand Identity → Competitor Intel)',
        'Se è promo competitor: aumenta bid CBO temporaneamente (+15%) per non perdere reach',
        'Se è picco stagionale: pianifica scaling preventivo per i prossimi giorni',
      ],
    })
  }

  // 4) Conversion problem (CPO spike senza CPC drop)
  const cpoSpikes = alerts.filter(a => a.metric_key === 'cpo' && a.deviation_pct > 0).length
  const cpcStable = countBy('cpc_link') === 0
  if (cpoSpikes >= 1 && cpcStable) {
    proposals.push({
      id: 'conversion-problem',
      priority: 'high',
      icon: '↓',
      title: 'Problema conversion rate landing',
      what: 'Audit checkout funnel: i click costano uguale ma convertono meno.',
      why: `CPO in salita ${cpoSpikes} giorno/i ma CPC stabile → traffico arriva, paga uguale, ma non compra. Problema downstream (LP, prezzo, stock).`,
      how: [
        'Apri tab CRO → controlla drop-off per step (Session → ATC → Checkout → Payment)',
        'Verifica stock prodotti top-seller (se out-of-stock, conv crolla)',
        'Test A/B headline LP o offerta (free shipping threshold, sconto first-order)',
      ],
    })
  }

  // 5) ROAS collapse (ROAS drop multiplo)
  const roasDrops = countBy('roas')
  if (roasDrops >= 2) {
    proposals.push({
      id: 'roas-collapse',
      priority: 'high',
      icon: '!',
      title: 'ROAS in calo strutturale',
      what: 'Riallocazione urgente budget verso canali/campagne più efficienti.',
      why: `${roasDrops} giorni con ROAS sotto baseline → non è rumore. Trend negativo da invertire.`,
      how: [
        'Apri Budget Advisor → identifica campagne TOP ROAS da scalare (+30%)',
        'Cut/Reduce campagne con ROAS < 50% media account',
        'Lancia analisi MER blended (skill mer-blended-attribution) per vedere se Google/Email assorbono budget Meta',
      ],
    })
  }

  // 6) Click cost spike (CPC spike isolato)
  const cpcSpikes = alerts.filter(a => a.metric_key === 'cpc_link' && a.deviation_pct > 0).length
  if (cpcSpikes >= 1 && cpmSpikes === 0) {
    proposals.push({
      id: 'click-cost-spike',
      priority: 'medium',
      icon: '€',
      title: 'CPC link in salita',
      what: 'CPM stabile ma click costano di più → CTR sta scendendo.',
      why: `${cpcSpikes} alert CPC con CPM stabile = perdiamo capacità di catturare attenzione (creative meno coinvolgente).`,
      how: [
        'Pause creative con CTR sotto la mediana account',
        'Test nuovo hook nelle prime 3 parole della copy',
        'Verifica thumbnail video / immagine statica (test A/B vs winner)',
      ],
    })
  }

  // 7) Stato positivo: nessuna alert significativa
  if (proposals.length === 0 && alerts.filter(a => a.severity !== 'low').length === 0) {
    proposals.push({
      id: 'all-good',
      priority: 'low',
      icon: '✓',
      title: 'Account stabile, sfrutta il momentum',
      what: 'Scala progressivamente: nessuna anomalia significativa nel periodo.',
      why: 'KPI dentro la baseline. È il momento giusto per testing strutturato senza rischio di confondere segnali.',
      how: [
        'Aumenta budget campagne winner del 20-30% per la prossima settimana',
        'Lancia 1-2 esperimenti creative nuovi (max 20% del budget)',
        'Documenta cosa sta funzionando (Brand Identity → Winning angles)',
      ],
    })
  }

  return proposals.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })
}
