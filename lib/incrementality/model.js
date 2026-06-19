// ============================================================================
//  Incrementality engine — LyftAI (v2: baseline-da-bassa-spesa).
//
//  Una regressione MMM libera, su un singolo brand con spesa/ricavo quasi
//  costanti, è MAL IDENTIFICATA: collassa tutto sul baseline (ROAS→0, R²→0).
//  Usiamo invece un metodo quasi-sperimentale, robusto e spiegabile:
//
//   1) baseline = ricavo "di base" stimato sui giorni a BASSA spesa totale
//      (il pavimento delle vendite che arrivano comunque).
//   2) incrementale totale = Σ_t max(0, ricavo_t − baseline).
//   3) lo distribuiamo ai canali in proporzione alla loro "media attiva"
//      giornaliera = saturazione(adstock(spesa_canale)).
//   4) curve di risposta / mROAS / saturazione: Hill calibrata in modo che al
//      livello di spesa attuale la risposta = l'incrementale stimato.
//
//  È DIREZIONALE (osservazionale, non causale). La prova vera è il geo-lift.
//  "confidence" = quanto la variazione di spesa spiega quella del ricavo.
// ============================================================================

export function adstock(series, lambda) {
  const out = new Array(series.length)
  let carry = 0
  for (let i = 0; i < series.length; i++) { carry = (series[i] || 0) + lambda * carry; out[i] = carry }
  return out
}

export function hill(x, k, slope = 1) {
  if (x <= 0) return 0
  const xa = Math.pow(x, slope)
  return xa / (Math.pow(k, slope) + xa)
}

export function carryoverWeights(lambda, days = 14) {
  const w = []; let cum = 0
  for (let i = 0; i < days; i++) { const v = Math.pow(lambda, i); w.push(v); cum += v }
  return w.map(v => v / (cum || 1))
}

export function carryoverDaysFor(lambda, frac = 0.9) {
  if (lambda <= 0) return 1
  let cum = 0; const total = 1 / (1 - lambda)
  for (let i = 0; i < 60; i++) { cum += Math.pow(lambda, i); if (cum / total >= frac) return i + 1 }
  return 60
}

const median = (arr) => { const a = arr.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0 }
const percentile = (arr, p) => { const a = arr.filter(x => x > 0).sort((x, y) => x - y); if (!a.length) return 1; return a[Math.min(a.length - 1, Math.floor(a.length * p))] }
const corr = (a, b) => {
  const n = a.length; if (!n) return 0
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y }
  return da && db ? num / Math.sqrt(da * db) : 0
}

export function fitIncrementality(rows, channels, opts = {}) {
  const n = rows.length
  if (n < 21) return { ok: false, reason: 'not_enough_data', days: n }

  const y = rows.map(r => Math.max(0, Number(r.revenue) || 0))

  // Config per canale: λ (carryover) + k (mezza-saturazione) + media attiva.
  const LAMBDAS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
  const cfg = {}
  const totalSpendDay = new Array(n).fill(0)
  for (const c of channels) {
    const spend = rows.map(r => Math.max(0, Number(r.channels?.[c]) || 0))
    let best = { lambda: 0.4, score: -2 }
    for (const lam of LAMBDAS) { const s = Math.abs(corr(adstock(spend, lam), y)); if (s > best.score) best = { lambda: lam, score: s } }
    const ad = adstock(spend, best.lambda)
    const k = percentile(ad, 0.8)
    const active = ad.map(v => hill(v, k)) // "media attiva" 0..1
    cfg[c] = { lambda: best.lambda, k, spend, ad, active }
    for (let i = 0; i < n; i++) totalSpendDay[i] += spend[i]
  }

  // 1) Baseline = mediana del ricavo sui giorni a più bassa spesa totale (≈30%).
  const order = [...Array(n).keys()].sort((a, b) => totalSpendDay[a] - totalSpendDay[b])
  const lowCount = Math.max(5, Math.round(n * 0.3))
  const lowRev = order.slice(0, lowCount).map(i => y[i])
  let baseline = median(lowRev)
  const overallMed = median(y)
  // cap: il baseline non può superare ~l'85% della mediana complessiva
  if (baseline > overallMed * 0.85) baseline = overallMed * 0.85
  if (!(baseline >= 0)) baseline = 0

  // 2) Incrementale totale giornaliero (sopra il baseline).
  const incrTot = y.map(v => Math.max(0, v - baseline))

  // 3) Distribuzione ai canali ∝ media attiva del giorno.
  const incrDaily = {} // c → [perDay]
  for (const c of channels) incrDaily[c] = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let w = 0
    for (const c of channels) w += cfg[c].active[i]
    if (w <= 0) continue
    for (const c of channels) incrDaily[c][i] = incrTot[i] * (cfg[c].active[i] / w)
  }

  // 4) Confidenza = quanto la spesa (adstock totale) spiega il ricavo.
  const totAd = (() => { const s = new Array(n).fill(0); for (const c of channels) for (let i = 0; i < n; i++) s[i] += cfg[c].ad[i]; return s })()
  const confidence = Math.max(0, Math.min(1, corr(totAd, y) ** 2))

  const totalRevenue = y.reduce((s, v) => s + v, 0)
  const out = { ok: true, days: n, r2: confidence, totalRevenue, baselineRevenue: baseline * n, channels: [], daily: [] }

  for (const c of channels) {
    const cf = cfg[c]
    const spendTot = cf.spend.reduce((s, v) => s + v, 0)
    const incremental = incrDaily[c].reduce((s, v) => s + v, 0)
    const attributed = rows.reduce((s, r) => s + (Number(r.attributed?.[c]) || 0), 0)
    const avgSpend = spendTot / n
    const avgDailyIncr = incremental / n

    // Calibra β della Hill: al livello attuale, risposta = incrementale medio.
    const adSteadyAvg = avgSpend / (1 - cf.lambda || 1)
    const hAvg = hill(adSteadyAvg, cf.k) || 1e-6
    const beta = avgDailyIncr / hAvg
    cf.beta = beta; cf.adSteadyAvg = adSteadyAvg

    // mROAS = derivata della risposta giornaliera rispetto alla spesa giornaliera.
    const eps = Math.max(1, avgSpend * 0.05)
    const dResp = (hill((avgSpend + eps) / (1 - cf.lambda || 1), cf.k) - hill(adSteadyAvg, cf.k)) / eps
    const mRoas = Math.max(0, beta * dResp)
    const saturation = hill(adSteadyAvg, cf.k)

    out.channels.push({
      key: c, lambda: cf.lambda, k: cf.k, spend: spendTot, avgSpend,
      attributedRevenue: attributed,
      incrementalRevenue: incremental,
      incrementalShare: totalRevenue > 0 ? incremental / totalRevenue : 0,
      incrementalVsAttributed: attributed > 0 ? incremental / attributed : null,
      roasReported: spendTot > 0 ? attributed / spendTot : 0,
      iRoas: spendTot > 0 ? incremental / spendTot : 0,
      mRoas, saturation,
      carryover: carryoverWeights(cf.lambda),
      carryoverDays90: carryoverDaysFor(cf.lambda, 0.9),
      contribDaily: incrDaily[c],
    })
  }

  out.daily = rows.map((r, i) => {
    const o = { date: r.date, revenue: y[i], baseline: Math.round(baseline) }
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
