// ============================================================================
//  Incrementality engine — LyftAI (v3: realistico per e-commerce always-on).
//
//  Per un e-commerce con spesa E ricavi sempre attivi ogni giorno, NON esiste un
//  giorno "senza ads": qualsiasi metodo che stima il baseline dai giorni a bassa
//  spesa sottostima pesantemente l'incrementale (il baseline assorbe l'effetto
//  paid). Quindi usiamo l'approccio pragmatico standard del settore:
//
//   incrementale_canale = ricavo_RIPORTATO × fattore_di_incrementalità
//
//  dove il fattore parte da un prior per canale (Meta ~0.60, Google ~0.50 — la
//  search è alta-intenzione → meno incrementale) e viene ridotto dalla
//  saturazione. Il baseline organico = ricavo totale − Σ incrementale (con un
//  floor minimo per l'e-commerce). Curva/mROAS/carryover restano via adstock+Hill.
//
//  I fattori sono PRIOR: la prova causale resta il geo-lift. Ma il LIVELLO è
//  realistico (iROAS tipicamente 1.5–2.5× vs reported 3–4×), non un lower bound.
// ============================================================================

export function adstock(series, lambda) {
  const out = new Array(series.length); let carry = 0
  for (let i = 0; i < series.length; i++) { carry = (series[i] || 0) + lambda * carry; out[i] = carry }
  return out
}
export function hill(x, k, slope = 1) { if (x <= 0) return 0; const xa = Math.pow(x, slope); return xa / (Math.pow(k, slope) + xa) }
export function carryoverWeights(lambda, days = 14) { const w = []; let cum = 0; for (let i = 0; i < days; i++) { const v = Math.pow(lambda, i); w.push(v); cum += v } return w.map(v => v / (cum || 1)) }
export function carryoverDaysFor(lambda, frac = 0.9) { if (lambda <= 0) return 1; let cum = 0; const total = 1 / (1 - lambda); for (let i = 0; i < 60; i++) { cum += Math.pow(lambda, i); if (cum / total >= frac) return i + 1 } return 60 }

const percentile = (arr, p) => { const a = arr.filter(x => x > 0).sort((x, y) => x - y); if (!a.length) return 1; return a[Math.min(a.length - 1, Math.floor(a.length * p))] }
const corr = (a, b) => {
  const n = a.length; if (!n) return 0
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y }
  return da && db ? num / Math.sqrt(da * db) : 0
}

// Prior di incrementalità (quota del ricavo riportato che è davvero incrementale).
const BASE_FACTOR = { meta: 0.70, google: 0.62 }
// ROAS riportato di ripiego, se la piattaforma non passa il valore conversione
// (es. Google Ads senza conversion value importato). La Search rende molto.
const DEFAULT_REPORTED_ROAS = { meta: 3.0, google: 5.5 }
const MIN_BASELINE_SHARE = 0.20 // un e-commerce ha sempre una quota organica
// Carryover (adstock λ) — FLOOR per canale: i dati steady sotto-stimano il
// carryover, ma molte vendite arrivano 5-15 giorni dopo (finestre di attribuzione).
// Social = lungo (awareness/consideration), Search = breve (alta intenzione).
const LAMBDA_FLOOR = { meta: 0.72, google: 0.35 }
const LAMBDA_CAP = 0.85

export function fitIncrementality(rows, channels, opts = {}) {
  const n = rows.length
  if (n < 21) return { ok: false, reason: 'not_enough_data', days: n }

  const y = rows.map(r => Math.max(0, Number(r.revenue) || 0))
  const totalRevenue = y.reduce((s, v) => s + v, 0)

  const LAMBDAS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
  const cfg = {}
  const totAd = new Array(n).fill(0)
  for (const c of channels) {
    const spend = rows.map(r => Math.max(0, Number(r.channels?.[c]) || 0))
    let best = { lambda: 0.4, score: -2 }
    for (const lam of LAMBDAS) { const s = Math.abs(corr(adstock(spend, lam), y)); if (s > best.score) best = { lambda: lam, score: s } }
    // carryover realistico: mai sotto il floor del canale, cap a 0.85
    const lambda = Math.min(LAMBDA_CAP, Math.max(best.lambda, LAMBDA_FLOOR[c] ?? 0.5))
    const ad = adstock(spend, lambda)
    const k = percentile(ad, 0.8)
    cfg[c] = { lambda, k, spend, ad, active: ad.map(v => hill(v, k)) }
    for (let i = 0; i < n; i++) totAd[i] += ad[i]
  }
  const confidence = Math.max(0, Math.min(1, corr(totAd, y) ** 2))

  // Per canale: ricavo riportato → fattore di incrementalità (saturation-adjusted)
  const pre = []
  for (const c of channels) {
    const cf = cfg[c]
    const spendTot = cf.spend.reduce((s, v) => s + v, 0)
    const avgSpend = spendTot / n
    let reported = rows.reduce((s, r) => s + (Number(r.attributed?.[c]) || 0), 0)
    const reportedMissing = !(reported > 0)
    if (reportedMissing && spendTot > 0) reported = spendTot * (DEFAULT_REPORTED_ROAS[c] ?? 3.0)
    const adSteadyAvg = avgSpend / (1 - cf.lambda || 1)
    const saturation = hill(adSteadyAvg, cf.k)
    const factor = Math.max(0.1, (BASE_FACTOR[c] ?? 0.55) * (1 - 0.25 * saturation))
    pre.push({ c, cf, spendTot, avgSpend, reported, reportedMissing, saturation, adSteadyAvg, factor, incremental: reported * factor })
  }

  // Vincolo: l'incrementale totale non può superare (1 − quota baseline minima).
  const cap = (1 - MIN_BASELINE_SHARE) * totalRevenue
  let sumInc = pre.reduce((s, p) => s + p.incremental, 0)
  if (sumInc > cap && sumInc > 0) { const r = cap / sumInc; for (const p of pre) p.incremental *= r; sumInc = cap }
  const baselineDay = Math.max(0, (totalRevenue - sumInc) / n)

  const out = { ok: true, days: n, r2: confidence, totalRevenue, baselineRevenue: baselineDay * n, channels: [], daily: [] }
  const incrDaily = {}
  for (const c of channels) incrDaily[c] = new Array(n).fill(0)

  for (const p of pre) {
    const c = p.c, cf = p.cf
    const wsum = cf.active.reduce((s, v) => s + v, 0) || 1
    for (let i = 0; i < n; i++) incrDaily[c][i] = p.incremental * (cf.active[i] / wsum)

    const avgDailyIncr = p.incremental / n
    const hAvg = hill(p.adSteadyAvg, cf.k) || 1e-6
    const beta = avgDailyIncr / hAvg
    cf.beta = beta; cf.adSteadyAvg = p.adSteadyAvg
    const eps = Math.max(1, p.avgSpend * 0.05)
    const dResp = (hill((p.avgSpend + eps) / (1 - cf.lambda || 1), cf.k) - hill(p.adSteadyAvg, cf.k)) / eps
    const mRoas = Math.max(0, beta * dResp)

    out.channels.push({
      key: c, lambda: cf.lambda, k: cf.k, spend: p.spendTot, avgSpend: p.avgSpend,
      attributedRevenue: p.reported,
      reportedEstimated: p.reportedMissing,
      incrementalRevenue: p.incremental,
      incrementalShare: totalRevenue > 0 ? p.incremental / totalRevenue : 0,
      incrementalVsAttributed: (!p.reportedMissing && p.reported > 0) ? p.incremental / p.reported : null,
      roasReported: p.spendTot > 0 ? p.reported / p.spendTot : 0,
      iRoas: p.spendTot > 0 ? p.incremental / p.spendTot : 0,
      mRoas, saturation: p.saturation, factor: p.factor,
      carryover: carryoverWeights(cf.lambda), carryoverDays90: carryoverDaysFor(cf.lambda, 0.9),
      contribDaily: incrDaily[c],
    })
  }

  out.daily = rows.map((r, i) => {
    const o = { date: r.date, revenue: y[i], baseline: Math.round(baselineDay) }
    for (const c of channels) o[c] = Math.round(incrDaily[c][i])
    return o
  })

  out._cfg = cfg
  return out
}

export function responseCurve(fit, channelKey, points = 40) {
  const ch = fit.channels.find(c => c.key === channelKey)
  const cf = fit._cfg?.[channelKey]
  if (!ch || !cf) return []
  const maxSpend = Math.max(ch.avgSpend * 3, ch.avgSpend + cf.k)
  const curve = []
  for (let i = 0; i <= points; i++) {
    const s = (maxSpend / points) * i
    const resp = Math.max(0, cf.beta * hill(s / (1 - cf.lambda || 1), cf.k))
    curve.push({ spend: Math.round(s), revenue: Math.round(resp), roas: s > 0 ? resp / s : 0 })
  }
  return curve
}

export function forecast(fit, planDailySpendByChannel, weeks = 4) {
  const days = weeks * 7
  let incremental = 0
  const perChannel = {}
  for (const ch of fit.channels) {
    const cf = fit._cfg?.[ch.key]
    const spend = planDailySpendByChannel[ch.key] ?? ch.avgSpend
    const resp = Math.max(0, cf.beta * hill(spend / (1 - cf.lambda || 1), cf.k))
    const total = resp * days
    perChannel[ch.key] = { dailySpend: spend, incremental: total, iRoas: spend > 0 ? resp / spend : 0 }
    incremental += total
  }
  const baselineDaily = fit.baselineRevenue / fit.days
  return { weeks, days, incremental, baseline: baselineDaily * days, total: incremental + baselineDaily * days, perChannel }
}
