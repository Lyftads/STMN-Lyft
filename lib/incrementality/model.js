// ============================================================================
//  Incrementality engine — MMM-lite per LyftAI.
//
//  Stima il contributo INCREMENTALE di ciascun canale (Meta, Google) al ricavo
//  Shopify totale, isolando il baseline (vendite organiche/brand). Risponde a:
//   - "cosa porta davvero un canale"  → incrementalRevenue (vs platform-reported)
//   - "per quanto tempo"              → carryover/adstock (decadimento)
//   - "il prossimo euro quanto rende" → mRoas + responseCurve (saturazione)
//   - "da qui a tot tempo"            → forecast
//
//  Metodo (pragmatico, gira in JS, nessuna dipendenza):
//   y_t = baseline(intercept + dow + trend) + Σ_c β_c · hill( adstock(spend_c) )
//   - adstock λ scelto per canale via grid (max corr con y detrendizzato)
//   - hill k = mediana spesa positiva, slope=1 (rendimenti decrescenti)
//   - β stimati con ridge regression (coeff. canale forzati ≥ 0)
//
//  ⚠️ Su un singolo brand è DIREZIONALE, non causale: collinearità, dati
//  limitati, eventi esogeni. Esporre sempre fitQuality + intervalli, e spingere
//  il geo-lift come validazione. Non promettere "certezza".
// ============================================================================

// ── Trasformazioni ──────────────────────────────────────────────────────────

// Adstock geometrico: l'effetto della spesa persiste nel tempo.
export function adstock(series, lambda) {
  const out = new Array(series.length)
  let carry = 0
  for (let i = 0; i < series.length; i++) {
    carry = (series[i] || 0) + lambda * carry
    out[i] = carry
  }
  return out
}

// Saturazione Hill: response 0→1 con rendimenti decrescenti. k = half-saturation.
export function hill(x, k, slope = 1) {
  if (x <= 0) return 0
  const xa = Math.pow(x, slope)
  return xa / (Math.pow(k, slope) + xa)
}

// Pesi di carryover normalizzati: quota dell'effetto al giorno 0,1,2,… (da λ).
export function carryoverWeights(lambda, days = 14) {
  const w = []
  let cum = 0
  for (let i = 0; i < days; i++) { const v = Math.pow(lambda, i); w.push(v); cum += v }
  return w.map(v => v / cum)
}

// Giorni per raggiungere una quota cumulata dell'effetto (es. 0.9 → 90%).
export function carryoverDaysFor(lambda, frac = 0.9) {
  if (lambda <= 0) return 1
  // somma geometrica: cumulata fino a n = (1-λ^(n+1)) → cerca n
  let cum = 0, total = 1 / (1 - lambda)
  for (let i = 0; i < 60; i++) { cum += Math.pow(lambda, i); if (cum / total >= frac) return i + 1 }
  return 60
}

// ── Algebra lineare minima (sistemi piccoli) ────────────────────────────────

function transpose(M) { return M[0].map((_, j) => M.map(r => r[j])) }
function matmul(A, B) {
  const out = A.map(r => new Array(B[0].length).fill(0))
  for (let i = 0; i < A.length; i++) for (let k = 0; k < B.length; k++) { const a = A[i][k]; if (!a) continue; for (let j = 0; j < B[0].length; j++) out[i][j] += a * B[k][j] }
  return out
}
function matvec(A, v) { return A.map(r => r.reduce((s, x, j) => s + x * v[j], 0)) }

// Risolve (A)x = b con eliminazione di Gauss + pivoting parziale. A: p×p.
function solve(A, b) {
  const n = A.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-12) continue
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  return M.map((r, i) => Math.abs(M[i][i]) < 1e-12 ? 0 : r[n] / M[i][i])
}

// Ridge regression: minimizza ||Xβ − y||² + α||β||² (no penalità sull'intercetta).
function ridge(X, y, alpha) {
  const Xt = transpose(X)
  const XtX = matmul(Xt, X)
  const p = XtX.length
  for (let i = 1; i < p; i++) XtX[i][i] += alpha // intercetta = col 0, non penalizzata
  const Xty = matvec(Xt, y)
  return solve(XtX, Xty)
}

const median = (arr) => { const a = arr.filter(x => x > 0).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 1 }
const corr = (a, b) => {
  const n = a.length; if (!n) return 0
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y }
  return da && db ? num / Math.sqrt(da * db) : 0
}

// ── Modello principale ──────────────────────────────────────────────────────
//
//  rows: [{ date, revenue, channels: { meta: spend, google: spend, ... },
//           attributed: { meta: rev, google: rev } }]
//  channels: ['meta','google'] (chiavi presenti)
//  Ritorna struttura pronta per UI.
export function fitIncrementality(rows, channels, opts = {}) {
  const n = rows.length
  if (n < 21) return { ok: false, reason: 'not_enough_data', days: n }

  const y = rows.map(r => Math.max(0, Number(r.revenue) || 0))
  const dow = rows.map(r => new Date(r.date + 'T00:00:00').getDay()) // 0=dom

  // λ per canale: scegli quello che massimizza |corr| dell'adstock con y.
  const LAMBDAS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]
  const chCfg = {}
  for (const c of channels) {
    const spend = rows.map(r => Math.max(0, Number(r.channels?.[c]) || 0))
    let best = { lambda: 0.3, score: -2 }
    for (const lam of LAMBDAS) { const s = Math.abs(corr(adstock(spend, lam), y)); if (s > best.score) best = { lambda: lam, score: s } }
    const ad = adstock(spend, best.lambda)
    const k = median(ad)
    chCfg[c] = { lambda: best.lambda, k, spend, adstock: ad, transformed: ad.map(v => hill(v, k)) }
  }

  // Design matrix: [intercept, dow(1..6), trend, ...canali]
  const trendMax = n - 1
  const X = rows.map((_, i) => {
    const row = [1]
    for (let d = 1; d <= 6; d++) row.push(dow[i] === d ? 1 : 0) // dom = baseline
    row.push(i / trendMax)
    for (const c of channels) row.push(chCfg[c].transformed[i])
    return row
  })

  // Ridge α scalato sulla varianza di y (robusto a magnitudini diverse).
  const yVar = (() => { const m = y.reduce((s, v) => s + v, 0) / n; return y.reduce((s, v) => s + (v - m) ** 2, 0) / n })()
  let beta = ridge(X, y, (opts.ridge ?? 1.0) * Math.sqrt(yVar + 1))

  // Forza i coefficienti canale ≥ 0 (una spesa non può ridurre il ricavo nel modello):
  // se negativo, azzera il regressore e rifitta.
  const chStart = 8 // 1 + 6 + 1
  let dropped = false
  for (let it = 0; it < channels.length; it++) {
    let changed = false
    for (let ci = 0; ci < channels.length; ci++) {
      if (beta[chStart + ci] < 0 && X[0][chStart + ci] !== null) {
        for (let i = 0; i < n; i++) X[i][chStart + ci] = 0
        changed = true; dropped = true
      }
    }
    if (!changed) break
    beta = ridge(X, y, (opts.ridge ?? 1.0) * Math.sqrt(yVar + 1))
  }

  // Predizione + R²
  const yhat = X.map(r => r.reduce((s, x, j) => s + x * beta[j], 0))
  const ssRes = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0)
  const ssTot = (() => { const m = y.reduce((s, v) => s + v, 0) / n; return y.reduce((s, v) => s + (v - m) ** 2, 0) })()
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0

  // Contributo incrementale per canale (β · transformed), per giorno e totale.
  const totalRevenue = y.reduce((s, v) => s + v, 0)
  const out = { ok: true, days: n, r2, dropped, totalRevenue, channels: [], baselineRevenue: 0, daily: [] }

  const baselineDaily = X.map((r) => {
    let b = beta[0] + beta[7] * r[7]
    for (let d = 1; d <= 6; d++) b += beta[d] * r[d]
    return Math.max(0, b)
  })
  out.baselineRevenue = baselineDaily.reduce((s, v) => s + v, 0)

  for (let ci = 0; ci < channels.length; ci++) {
    const c = channels[ci]
    const b = beta[chStart + ci]
    const cfg = chCfg[c]
    const contribDaily = cfg.transformed.map(t => Math.max(0, b * t))
    const incremental = contribDaily.reduce((s, v) => s + v, 0)
    const spendTot = cfg.spend.reduce((s, v) => s + v, 0)
    const attributed = rows.reduce((s, r) => s + (Number(r.attributed?.[c]) || 0), 0)

    // mROAS: derivata del contributo rispetto alla spesa al livello medio attuale.
    const avgSpend = spendTot / n
    const eps = Math.max(1, avgSpend * 0.05)
    const adAvg = avgSpend / (1 - cfg.lambda || 1) // adstock a regime ≈ spend/(1-λ)
    const dResp = (hill(adAvg + eps, cfg.k) - hill(adAvg, cfg.k)) / eps
    const mRoas = b * dResp / (1 - (cfg.lambda || 0) || 1) // catena adstock→hill→β

    const satPct = adAvg > 0 ? hill(adAvg, cfg.k) : 0 // 0..1 (asintoto = 1)

    out.channels.push({
      key: c,
      lambda: cfg.lambda,
      k: cfg.k,
      spend: spendTot,
      avgSpend,
      attributedRevenue: attributed,
      incrementalRevenue: incremental,
      incrementalShare: totalRevenue > 0 ? incremental / totalRevenue : 0,
      // quanto del ricavo platform-reported è "vero" incrementale
      incrementalVsAttributed: attributed > 0 ? incremental / attributed : null,
      roasReported: spendTot > 0 ? attributed / spendTot : 0,
      iRoas: spendTot > 0 ? incremental / spendTot : 0, // ROAS incrementale medio
      mRoas: Math.max(0, mRoas),
      saturation: satPct,
      carryover: carryoverWeights(cfg.lambda),
      carryoverDays90: carryoverDaysFor(cfg.lambda, 0.9),
      contribDaily,
    })
  }

  // Serie giornaliera per grafico stacked (baseline + canali).
  out.daily = rows.map((r, i) => {
    const o = { date: r.date, revenue: y[i], baseline: Math.round(baselineDaily[i]) }
    for (let ci = 0; ci < channels.length; ci++) o[channels[ci]] = Math.round(out.channels[ci].contribDaily[i])
    return o
  })

  out._cfg = chCfg // per responseCurve/forecast
  out._beta = beta
  return out
}

// Curva di risposta: per un canale, spesa-giornaliera → ricavo incrementale/giorno.
// Tiene la spesa attuale come punto di riferimento.
export function responseCurve(fit, channelKey, points = 40) {
  const ch = fit.channels.find(c => c.key === channelKey)
  const cfg = fit._cfg?.[channelKey]
  if (!ch || !cfg) return []
  const b = fit._beta[8 + fit.channels.findIndex(c => c.key === channelKey)]
  const maxSpend = Math.max(ch.avgSpend * 3, ch.avgSpend + cfg.k)
  const curve = []
  for (let i = 0; i <= points; i++) {
    const dailySpend = (maxSpend / points) * i
    const adSteady = dailySpend / (1 - (cfg.lambda || 0) || 1)
    const dailyResp = Math.max(0, b * hill(adSteady, cfg.k))
    curve.push({ spend: Math.round(dailySpend), revenue: Math.round(dailyResp), roas: dailySpend > 0 ? dailyResp / dailySpend : 0 })
  }
  return curve
}

// Forecast: dato uno spend giornaliero pianificato per canale, ricavo incrementale
// atteso nelle prossime `weeks` settimane (a regime, con carryover già incluso).
export function forecast(fit, planDailySpendByChannel, weeks = 4) {
  const days = weeks * 7
  let incremental = 0
  const perChannel = {}
  for (const ch of fit.channels) {
    const cfg = fit._cfg?.[ch.key]
    const spend = planDailySpendByChannel[ch.key] ?? ch.avgSpend
    const b = fit._beta[8 + fit.channels.findIndex(c => c.key === ch.key)]
    const adSteady = spend / (1 - (cfg.lambda || 0) || 1)
    const dailyResp = Math.max(0, b * hill(adSteady, cfg.k))
    const total = dailyResp * days
    perChannel[ch.key] = { dailySpend: spend, incremental: total, iRoas: spend > 0 ? dailyResp / spend : 0 }
    incremental += total
  }
  const baselineDaily = fit.baselineRevenue / fit.days
  return { weeks, days, incremental, baseline: baselineDaily * days, total: incremental + baselineDaily * days, perChannel }
}
