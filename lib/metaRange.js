// ============================================================================
//  Meta Ads time range helpers — usati da /api/creative-fatigue,
//  /api/budget-advisor e altre route che chiamano Meta Insights API.
// ============================================================================

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Lunedì della settimana di `date` (settimana lun→dom, come il BM di Meta).
function mondayOf(date) {
  const d = new Date(`${date}T00:00:00`)
  const dow = (d.getDay() + 6) % 7 // 0 = lunedì
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}

// Risolve un preset Meta in { since, until }.
//  sp (opzionale) = URLSearchParams: con preset 'custom' legge since/until.
export function getRange(preset, sp = null) {
  const today = new Date().toISOString().slice(0, 10)

  // Range custom dal date-picker (BM-style): preset 'custom' + since/until.
  if (preset === 'custom' && sp && typeof sp.get === 'function') {
    const since = sp.get('since'), until = sp.get('until')
    if (since && until) return { since, until }
  }

  switch (preset) {
    case 'today':       return { since: today, until: today }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { since: y, until: y }
    }
    case 'today_yesterday': return { since: addDays(today, -1), until: today }
    case 'last_7d':     return { since: addDays(today, -7),   until: today }
    case 'last_14d':    return { since: addDays(today, -14),  until: today }
    case 'last_28d':    return { since: addDays(today, -28),  until: today }
    case 'last_30d':    return { since: addDays(today, -30),  until: today }
    case 'last_90d':    return { since: addDays(today, -90),  until: today }
    case 'this_week':   return { since: mondayOf(today), until: today }
    case 'last_week': {
      const lwEnd = addDays(mondayOf(today), -1)
      return { since: addDays(lwEnd, -6), until: lwEnd }
    }
    case 'this_month':
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
