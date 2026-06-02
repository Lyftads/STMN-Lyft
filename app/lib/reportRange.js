// Risolve un preset (o una finestra esplicita) in { since, until, prevSince,
// prevUntil, label }. Il periodo precedente è la finestra di pari lunghezza
// immediatamente precedente. Usato dal bottone "Scarica report PDF".

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

function iso(d) { return d.toISOString().slice(0, 10) }
function addDays(dateStr, n) { const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d) }

function withPrev(since, until, label) {
  const s = new Date(`${since}T00:00:00Z`)
  const u = new Date(`${until}T00:00:00Z`)
  const days = Math.max(1, Math.round((u - s) / 86400000) + 1)
  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))
  return { since, until, prevSince, prevUntil, label }
}

export function presetToRange(preset, custom) {
  const today = iso(new Date())

  if (custom?.since && custom?.until) return withPrev(custom.since, custom.until, custom.label || `${custom.since} → ${custom.until}`)

  if (typeof preset === 'string' && preset.startsWith('month_')) {
    const m = preset.slice(6); const [y, mm] = m.split('-').map(Number)
    if (y && mm) {
      const start = `${m}-01`; const lastDay = new Date(Date.UTC(y, mm, 0)).getUTCDate()
      const end = `${m}-${String(lastDay).padStart(2, '0')}`
      return withPrev(start, end > today ? today : end, `${MONTHS[mm - 1]} ${y}`)
    }
  }
  if (typeof preset === 'string' && preset.startsWith('quarter_')) {
    const mt = preset.slice(8).match(/^(\d{4})-Q([1-4])$/)
    if (mt) {
      const y = +mt[1], q = +mt[2]; const sM = (q - 1) * 3 + 1, eM = sM + 2
      const start = `${y}-${String(sM).padStart(2, '0')}-01`
      const lastDay = new Date(Date.UTC(y, eM, 0)).getUTCDate()
      const end = `${y}-${String(eM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      return withPrev(start, end > today ? today : end, `Q${q} ${y}`)
    }
  }
  if (typeof preset === 'string' && preset.startsWith('year_')) {
    const y = preset.slice(5)
    if (/^\d{4}$/.test(y)) { const end = `${y}-12-31`; return withPrev(`${y}-01-01`, end > today ? today : end, `Anno ${y}`) }
  }

  switch (preset) {
    case 'today': return withPrev(today, today, 'Oggi')
    case 'yesterday': { const y = addDays(today, -1); return withPrev(y, y, 'Ieri') }
    case 'last_7d': return withPrev(addDays(today, -7), today, 'Ultimi 7 giorni')
    case 'last_14d': return withPrev(addDays(today, -14), today, 'Ultimi 14 giorni')
    case 'last_28d': return withPrev(addDays(today, -28), today, 'Ultimi 28 giorni')
    case 'last_30d': return withPrev(addDays(today, -30), today, 'Ultimi 30 giorni')
    case 'last_90d': return withPrev(addDays(today, -90), today, 'Ultimi 90 giorni')
    case 'this_month': case 'current_month': case 'mtd': return withPrev(`${today.slice(0, 7)}-01`, today, 'Mese corrente')
    case 'ytd': return withPrev(`${today.slice(0, 4)}-01-01`, today, 'Anno corrente')
    case 'this_week': {
      const d = new Date(`${today}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7 // lun=0
      const since = addDays(today, -dow); return withPrev(since, today, 'Questa settimana')
    }
    case 'last_week': {
      const d = new Date(`${today}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7
      const thisMon = addDays(today, -dow); const lastMon = addDays(thisMon, -7); const lastSun = addDays(thisMon, -1)
      return withPrev(lastMon, lastSun, 'Settimana scorsa')
    }
    case 'last_month': {
      const first = `${today.slice(0, 7)}-01`; const end = addDays(first, -1)
      return withPrev(`${end.slice(0, 7)}-01`, end, 'Mese scorso')
    }
    default: return withPrev(addDays(today, -28), today, 'Ultimi 28 giorni')
  }
}
