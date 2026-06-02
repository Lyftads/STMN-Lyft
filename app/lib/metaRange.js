// Risoluzione preset → finestra + periodo precedente (lato server, per gli
// endpoint Meta: creative-fatigue, budget-advisor). Periodo precedente =
// finestra di pari lunghezza immediatamente prima.

function iso(d) { return d.toISOString().slice(0, 10) }
function addDays(dateStr, n) { const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d) }

export function getRange(preset) {
  const today = iso(new Date())

  if (typeof preset === 'string' && preset.startsWith('month_')) {
    const [y, mm] = preset.slice(6).split('-').map(Number)
    if (y && mm) { const start = `${preset.slice(6)}-01`; const lastDay = new Date(Date.UTC(y, mm, 0)).getUTCDate(); const end = `${preset.slice(6)}-${String(lastDay).padStart(2, '0')}`; return { since: start, until: end > today ? today : end } }
  }
  if (typeof preset === 'string' && preset.startsWith('quarter_')) {
    const mt = preset.slice(8).match(/^(\d{4})-Q([1-4])$/)
    if (mt) { const y = +mt[1], q = +mt[2]; const sM = (q - 1) * 3 + 1, eM = sM + 2; const start = `${y}-${String(sM).padStart(2, '0')}-01`; const lastDay = new Date(Date.UTC(y, eM, 0)).getUTCDate(); const end = `${y}-${String(eM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`; return { since: start, until: end > today ? today : end } }
  }
  if (typeof preset === 'string' && preset.startsWith('year_')) {
    const y = preset.slice(5); if (/^\d{4}$/.test(y)) { const end = `${y}-12-31`; return { since: `${y}-01-01`, until: end > today ? today : end } }
  }

  switch (preset) {
    case 'today': return { since: today, until: today }
    case 'yesterday': { const y = addDays(today, -1); return { since: y, until: y } }
    case 'last_7d': return { since: addDays(today, -7), until: today }
    case 'last_14d': return { since: addDays(today, -14), until: today }
    case 'last_30d': return { since: addDays(today, -30), until: today }
    case 'last_90d': return { since: addDays(today, -90), until: today }
    case 'current_month': case 'mtd': return { since: `${today.slice(0, 7)}-01`, until: today }
    case 'ytd': return { since: `${today.slice(0, 4)}-01-01`, until: today }
    case 'last_month': { const first = `${today.slice(0, 7)}-01`; const end = addDays(first, -1); return { since: `${end.slice(0, 7)}-01`, until: end } }
    case 'last_28d': default: return { since: addDays(today, -28), until: today }
  }
}

export function prevRange(range) {
  const s = new Date(`${range.since}T00:00:00Z`), u = new Date(`${range.until}T00:00:00Z`)
  const days = Math.max(1, Math.round((u - s) / 86400000) + 1)
  const prevUntil = addDays(range.since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))
  return { since: prevSince, until: prevUntil }
}
