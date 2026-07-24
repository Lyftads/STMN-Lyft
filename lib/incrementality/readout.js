// ============================================================================
//  Geo-lift READOUT — LyftAI (fallback JS, stile Time-Based Regression).
//
//  Quando un test geo è concluso, misura il lift causale confrontando il gruppo
//  TEST con il suo controfattuale, stimato dal gruppo CONTROL. Metodo TBR (lo
//  stesso di Google GeoexperimentsResearch): si fitta una regressione lineare
//  test~control SOLO nel pre-periodo, poi si proietta il controfattuale durante
//  il test; la differenza cumulata = incrementale.
//
//  È il fallback SEMPRE disponibile dell'ibrido: il readout "certificato" gira
//  su GeoLift (worker R) quando GEOLIFT_R_URL è configurato — vedi l'API.
//  Input: serie giornaliere allineate per data di test e control + l'indice da
//  cui parte il trattamento. Output: lift %, intervallo, incrementale, iROAS.
// ============================================================================

const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1)
const sum = (a) => a.reduce((s, v) => s + v, 0)

// Errore standard z per un livello di confidenza (default 90% = alpha 0.10).
const zFor = (alpha) => (alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : alpha <= 0.10 ? 1.645 : 1.282)

// Normale cumulativa (approssimazione Abramowitz-Stegun) per il p-value.
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp(-x * x / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

// dailyTest / dailyControl: array numerici ALLINEATI per data (stesso indice = stesso giorno).
// testStartIdx: primo indice del periodo di trattamento (i precedenti = pre-periodo).
// opts.spendIncremental: spesa incrementale nelle regioni test durante il test (per l'iROAS).
// opts.alpha: livello di significatività (default 0.10, come il designer).
export function computeReadout(dailyTest, dailyControl, testStartIdx, opts = {}) {
  const alpha = opts.alpha ?? 0.10
  const n = Math.min(dailyTest.length, dailyControl.length)
  const preN = testStartIdx
  const postN = n - testStartIdx
  if (preN < 7 || postN < 3) return { ok: false, reason: 'not_enough_data', preN, postN }

  const yPre = dailyTest.slice(0, preN)
  const xPre = dailyControl.slice(0, preN)
  const yPost = dailyTest.slice(preN, n)
  const xPost = dailyControl.slice(preN, n)

  // ── OLS test ~ control sul pre-periodo (controfattuale) ────────────────────
  const mx = mean(xPre), my = mean(yPre)
  let sxx = 0, sxy = 0
  for (let i = 0; i < preN; i++) { const dx = xPre[i] - mx; sxx += dx * dx; sxy += dx * (yPre[i] - my) }
  const b = sxx > 0 ? sxy / sxx : 0
  const a = my - b * mx

  // Residui pre → sigma (rumore giornaliero del fit). Usa i gradi di libertà.
  let sse = 0
  for (let i = 0; i < preN; i++) { const e = yPre[i] - (a + b * xPre[i]); sse += e * e }
  const dof = Math.max(1, preN - 2)
  const sigma = Math.sqrt(sse / dof)

  // Bontà del fit pre (R²) — quanto il control spiega il test prima del test.
  const sstot = yPre.reduce((s, v) => s + (v - my) ** 2, 0)
  const r2 = sstot > 0 ? Math.max(0, 1 - sse / sstot) : 0

  // ── Proiezione del controfattuale durante il test ──────────────────────────
  let cumObserved = 0, cumCounter = 0
  const daily = []
  for (let i = 0; i < postN; i++) {
    const pred = a + b * xPost[i]
    const obs = yPost[i]
    cumObserved += obs
    cumCounter += pred
    daily.push({ observed: Math.round(obs), counterfactual: Math.round(pred), effect: Math.round(obs - pred) })
  }
  const incremental = cumObserved - cumCounter
  const lift = cumCounter > 0 ? incremental / cumCounter : 0

  // SE dell'incrementale cumulato: rumore iid → sigma·sqrt(postN).
  const se = sigma * Math.sqrt(postN)
  const z = zFor(alpha)
  const ciLo = incremental - z * se
  const ciHi = incremental + z * se
  const liftLo = cumCounter > 0 ? ciLo / cumCounter : 0
  const liftHi = cumCounter > 0 ? ciHi / cumCounter : 0

  // p-value a due code: probabilità di un effetto così grande se il vero fosse 0.
  const zStat = se > 0 ? incremental / se : 0
  const pValue = 2 * (1 - normCdf(Math.abs(zStat)))
  const significant = pValue < alpha

  // iROAS: revenue incrementale / spesa incrementale nel test (se fornita).
  const spend = Number(opts.spendIncremental) || 0
  const iRoas = spend > 0 ? incremental / spend : null

  return {
    ok: true,
    method: 'tbr',
    alpha,
    preDays: preN,
    testDays: postN,
    fitR2: r2,
    observed: Math.round(cumObserved),
    counterfactual: Math.round(cumCounter),
    incremental: Math.round(incremental),
    lift,
    liftCi: [liftLo, liftHi],
    incrementalCi: [Math.round(ciLo), Math.round(ciHi)],
    pValue,
    significant,
    iRoas,
    daily,
  }
}
