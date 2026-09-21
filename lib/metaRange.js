import { oggiNegozio, piuGiorni, lunediDi, fineMeseScorso, periodoPrima } from './periodi'
// ============================================================================
//  Meta Ads time range helpers — usati da /api/creative-fatigue,
//  /api/budget-advisor e altre route che chiamano Meta Insights API.
// ============================================================================

// Date "nude" (YYYY-MM-DD) e aritmetica in UTC (lib/periodi.js): prima si partiva dalla
// mezzanotte LOCALE e si leggeva in UTC, e su un server non in UTC i giorni slittavano.
const addDays = (date, days) => piuGiorni(date, days)

// Lunedì della settimana di `date` (settimana lun→dom, come il BM di Meta).
const mondayOf = (date) => lunediDi(date)

// Risolve un preset Meta in { since, until }.
//  sp (opzionale) = URLSearchParams: con preset 'custom' legge since/until.
export function getRange(preset, sp = null) {
  // Il giorno del NEGOZIO: in UTC fra mezzanotte e le 2 italiane era ancora ieri.
  const today = oggiNegozio()

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
      const end = fineMeseScorso(today)
      return { since: `${end.slice(0, 7)}-01`, until: end }
    }
    case 'ytd':
    case 'this_year':   return { since: `${today.slice(0, 4)}-01-01`, until: today }
    default:
      return { since: addDays(today, -28), until: today }
  }
}

// Range del periodo precedente con la stessa lunghezza, per confronti period-over-period.
// Es: last_7d (1-7 maggio) → prev (24-30 aprile).
export function prevRange(range) {
  if (!range?.since || !range?.until) return null
  return periodoPrima(range)
}
