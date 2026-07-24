// ============================================================================
//  Geo-lift designer — LyftAI.
//
//  Progetta un test causale geografico: divide le regioni in TEST e CONTROL
//  bilanciati, e stima quanto piccolo può essere il lift ancora rilevabile
//  (MDE = Minimum Detectable Effect) per varie durate. È la PROVA causale che
//  valida le stime osservazionali dell'incrementalità (R² basso → geo-lift).
//
//  Input: regions = [{ region, daily: [{date, value}], total }] (es. ricavo GA4
//  per regione e giorno). Output: matching + qualità + MDE per durata + piano.
// ============================================================================

const corr = (a, b) => {
  const n = Math.min(a.length, b.length); if (!n) return 0
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i] }
  ma /= n; mb /= n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y }
  return da && db ? num / Math.sqrt(da * db) : 0
}
const std = (arr) => { const n = arr.length; if (n < 2) return 0; const m = arr.reduce((s, v) => s + v, 0) / n; return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) }

// Allinea le serie per data comune → matrice region×day + asse date.
function alignSeries(regions) {
  const dates = [...new Set(regions.flatMap(r => r.daily.map(d => d.date)))].sort()
  const series = regions.map(r => {
    const map = new Map(r.daily.map(d => [d.date, Number(d.value) || 0]))
    return { region: r.region, total: r.total, vec: dates.map(d => map.get(d) || 0) }
  })
  return { dates, series }
}

// Somma vettoriale di un gruppo di serie.
const sumVec = (group, len) => { const out = new Array(len).fill(0); for (const g of group) for (let i = 0; i < len; i++) out[i] += g.vec[i]; return out }

// Z = z(α/2) + z(power). Default α=0.10 (allineato a GeoLift, non 0.05) e power 0.80.
const Z_BY_ALPHA = { 0.10: 2.49, 0.05: 2.80, 0.20: 2.10, 0.01: 3.42 }

export function designGeoLift(regions, opts = {}) {
  const minRegions = opts.minRegions || 4
  const alpha = opts.alpha ?? 0.10
  const dominantShare = opts.dominantShare ?? 0.22
  const usable = (regions || []).filter(r => r.total > 0 && r.daily?.length >= 14)
  if (usable.length < minRegions) return { ok: false, reason: 'not_enough_regions', regions: usable.length }

  // ── Trimming dei geo dominanti (idea da Trimmed Match) ──────────────────────
  // Un geo che pesa troppo (es. Lombardia ~1/6 del mercato IT) non ha un match
  // bilanciato dal pool di controllo e gonfia la varianza della stima. Toglierlo
  // dal disegno riduce molto l'errore (nel paper: -5 coppie su 50 → RMSE ~-50%).
  // Se togliendolo scendiamo sotto il minimo, lo teniamo ma lo segnaliamo.
  const grandTotal = usable.reduce((s, r) => s + r.total, 0) || 1
  const dominant = usable
    .filter(r => r.total / grandTotal > dominantShare)
    .map(r => ({ region: r.region, share: r.total / grandTotal }))
    .sort((a, b) => b.share - a.share)
  const domSet = new Set(dominant.map(d => d.region))
  let pool = usable.filter(r => !domSet.has(r.region))
  let trimmed = dominant
  if (pool.length < minRegions) { pool = usable; trimmed = [] } // trim impossibile senza scendere sotto il minimo

  // Tieni le top regioni per volume (coprono il grosso ed evitano rumore).
  const topK = Math.min(opts.topK || 16, pool.length)
  const top = [...pool].sort((a, b) => b.total - a.total).slice(0, topK)
  const { dates, series } = alignSeries(top)
  const nDays = dates.length

  // Matching: snake-draft sul volume → due gruppi bilanciati per fatturato.
  const sorted = [...series].sort((a, b) => b.total - a.total)
  const test = [], control = []
  let sumT = 0, sumC = 0
  for (const s of sorted) {
    if (sumT <= sumC) { test.push(s); sumT += s.total } else { control.push(s); sumC += s.total }
  }

  const tVec = sumVec(test, nDays), cVec = sumVec(control, nDays)
  const matchQuality = corr(tVec, cVec) // quanto il control "predice" il test

  // Rapporto giornaliero test/control → la sua volatilità guida la potenza.
  const ratio = []
  for (let i = 0; i < nDays; i++) { if (cVec[i] > 0) ratio.push(tVec[i] / cVec[i]) }
  const ratioMean = ratio.reduce((s, v) => s + v, 0) / (ratio.length || 1)
  const ratioStd = std(ratio)
  const cvRatio = ratioMean > 0 ? ratioStd / ratioMean : 0.25 // coeff. di variazione del rapporto

  // Placebo bias-at-zero: nel pre-periodo il lift vero è ZERO. Se il rapporto
  // test/control deriva tra prima e seconda metà della storia, il disegno
  // introduce un bias sistematico (il control non è un buon controfattuale).
  // Basso (≤10%) = ok; alto = baseline instabile, il test darà falsi segnali.
  const half = Math.floor(ratio.length / 2)
  const meanOf = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1)
  const biasAtZero = ratioMean > 0 && half >= 3
    ? Math.abs(meanOf(ratio.slice(half)) - meanOf(ratio.slice(0, half))) / ratioMean
    : null

  // MDE relativo (lift minimo rilevabile) per durata D giorni.
  // SE del lift ≈ cvRatio / sqrt(D); MDE = (z_α/2 + z_power) * SE.
  const Z = Z_BY_ALPHA[alpha] ?? 2.49
  const mdeFor = (D) => Z * cvRatio / Math.sqrt(D)
  const durations = [14, 21, 28, 35]
  const mde = durations.map(D => ({ days: D, weeks: Math.round(D / 7), mde: mdeFor(D) }))

  // Durata consigliata: la più breve con MDE ≤ target (default 10%), altrimenti 28.
  const target = opts.targetMde || 0.10
  const rec = mde.find(m => m.mde <= target) || mde[2]

  const totalTest = test.reduce((s, r) => s + r.total, 0)
  const totalControl = control.reduce((s, r) => s + r.total, 0)

  // Gate di fattibilità: dice onestamente se il test è statisticamente sensato
  // col profilo di dati del cliente, PRIMA di lanciarlo (evita design deboli).
  const maxMde = opts.maxMde || 0.25
  const feasible = rec.mde <= maxMde && matchQuality >= 0.6 && (biasAtZero == null || biasAtZero <= 0.10)
  const feasibilityReason = feasible ? null
    : matchQuality < 0.6 ? 'weak_match'
      : (biasAtZero != null && biasAtZero > 0.10) ? 'unstable_baseline'
        : 'mde_too_high'

  return {
    ok: true,
    days: nDays,
    metricNote: opts.metricNote || null,
    matchQuality,
    cvRatio,
    alpha,
    biasAtZero,
    trimmed,          // geo dominanti esclusi dal disegno per ridurre la varianza
    feasible,
    feasibilityReason,
    test: { regions: test.map(r => r.region), totalRevenue: totalTest },
    control: { regions: control.map(r => r.region), totalRevenue: totalControl },
    mde,
    recommendedDays: rec.days,
    recommendedWeeks: rec.weeks,
    recommendedMde: rec.mde,
    // serie giornaliere normalizzate (indice 100) per il grafico test vs control
    daily: dates.map((d, i) => ({
      date: d,
      test: tVec[i],
      control: cVec[i],
    })),
  }
}
