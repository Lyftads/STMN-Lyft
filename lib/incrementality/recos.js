// Generatori di raccomandazioni proattive (data-driven) per il modulo Incrementalità.
// h = { t, eur, x, pct, names }  (t per i18n + formatter dal componente).

export function contributionRecos(data, h) {
  const { t, x, pct, names } = h
  const chs = data?.channels || []
  const nm = (k) => names?.[k] || k
  const out = []

  for (const c of chs) {
    if (c.mRoas < 1) out.push({ level: 'urgent', text: t('reco.cut', { c: nm(c.key), x: x(c.mRoas) }, `Hold ${nm(c.key)}: the next euro returns ${x(c.mRoas)} (below 1× = losing at the margin). Don't add budget here.`) })
    else if (c.mRoas >= 1.2 && c.saturation < 0.65) out.push({ level: 'high', text: t('reco.scale', { c: nm(c.key), x: x(c.mRoas), s: pct(c.saturation) }, `Scale ${nm(c.key)}: the next euro returns ${x(c.mRoas)} and you're only ${pct(c.saturation)} saturated — room to grow.`) })
    if (!c.reportedEstimated && c.incrementalVsAttributed != null && c.incrementalVsAttributed < 0.7) out.push({ level: 'high', text: t('reco.overclaim', { c: nm(c.key), rep: x(c.roasReported), ir: x(c.iRoas), p: pct(1 - c.incrementalVsAttributed) }, `Don't trust ${nm(c.key)}'s ROAS: it reports ${x(c.roasReported)} but the real incremental is ${x(c.iRoas)} (inflated ~${pct(1 - c.incrementalVsAttributed)}). Decide on incremental, not platform ROAS.`) })
  }

  if (chs.length >= 2) {
    const best = [...chs].sort((a, b) => b.mRoas - a.mRoas)[0]
    const worst = [...chs].sort((a, b) => b.saturation - a.saturation)[0]
    if (best.key !== worst.key && best.mRoas > worst.mRoas * 1.25) out.push({ level: 'high', text: t('reco.realloc', { from: nm(worst.key), to: nm(best.key), x: x(best.mRoas) }, `Shift budget from ${nm(worst.key)} (low marginal) to ${nm(best.key)} (next-€ ${x(best.mRoas)}): same budget, more incremental revenue.`) })
  }

  if (chs.some(c => c.reportedEstimated)) out.push({ level: 'info', text: t('reco.importGoogle', null, 'Import Google Ads conversion value: its revenue is currently estimated — the real value makes the analysis precise.') })
  if (data?.r2 != null && data.r2 < 0.35) out.push({ level: 'info', text: t('reco.lowConf', { r2: data.r2.toFixed(2) }, `Low reliability (R² ${data.r2.toFixed(2)}): the total is solid but the channel split is uncertain — validate with a geo-lift before big budget shifts.`) })

  return out
}

export function curvesRecos(data, h) {
  const { t, x, pct, names } = h
  const nm = (k) => names?.[k] || k
  const out = []
  for (const c of data?.channels || []) {
    if (c.saturation >= 0.7 || c.mRoas < 1) out.push({ level: c.mRoas < 1 ? 'urgent' : 'high', text: t('reco.curveSat', { c: nm(c.key), s: pct(c.saturation) }, `${nm(c.key)} is past the efficient point (${pct(c.saturation)} saturated): cutting spend would improve efficiency, not hurt it.`) })
    else if (c.mRoas >= 1.2 && c.saturation < 0.6) out.push({ level: 'high', text: t('reco.curveRoom', { c: nm(c.key), x: x(c.mRoas) }, `${nm(c.key)} has room on the curve (next-€ ${x(c.mRoas)}): increase gradually and re-measure.`) })
    out.push({ level: 'info', text: t('reco.carry', { c: nm(c.key), d: c.carryoverDays90 }, `${nm(c.key)} carryover = ${c.carryoverDays90} days: don't judge ${nm(c.key)} campaigns before ${c.carryoverDays90} days — sales arrive later.`) })
  }
  return out
}
