// ============================================================================
//  Meta Ads time range helpers — usati da /api/creative-fatigue,
//  /api/budget-advisor e altre route che chiamano Meta Insights API.
// ============================================================================

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Risolve un preset Meta in { since, until }.
export function getRange(preset) {
  const today = new Date().toISOString().slice(0, 10)
  switch (preset) {
    case 'today':       return { since: today, until: today }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { since: y, until: y }
    }
    case 'last_7d':     return { since: addDays(today, -7),   until: today }
    case 'last_14d':    return { since: addDays(today, -14),  until: today }
    case 'last_28d':    return { since: addDays(today, -28),  until: today }
    case 'last_30d':    return { since: addDays(today, -30),  until: today }
    case 'last_90d':    return { since: addDays(today, -90),  until: today }
    case 'current_month':
    case 'mtd':         return { since: `${today.slice(0, 7)}-01`, until: today }
    case 'last_month': {
      const d = new Date(`${today.slice(0, 7)}-01T00:00:00`)
      d.setDate(0)
      const end = d.toISOString().slice(0, 10)
      return { since: `${end.slice(0, 7)}-01`, until: end }
    }
    default:
      return { since: addDays(today, -28), until: today }
  }
}

// Range del periodo precedente con la stessa lunghezza, per confronti period-over-period.
// Es: last_7d (1-7 maggio) → prev (24-30 aprile).
export function prevRange(range) {
  if (!range?.since || !range?.until) return null
  const since = new Date(`${range.since}T00:00:00`)
  const until = new Date(`${range.until}T00:00:00`)
  const days = Math.round((until - since) / 86400_000) + 1
  const prevUntil = new Date(since)
  prevUntil.setDate(prevUntil.getDate() - 1)
  const prevSince = new Date(prevUntil)
  prevSince.setDate(prevSince.getDate() - (days - 1))
  return {
    since: prevSince.toISOString().slice(0, 10),
    until: prevUntil.toISOString().slice(0, 10),
  }
}
