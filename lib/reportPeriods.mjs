// Table windows are calendar-based so empty history never removes columns.
export function weeklyReportKeys(endDate) {
  const monday = new Date(`${endDate}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return Array.from({ length: 8 }, (_, i) => {
    const date = new Date(monday)
    date.setUTCDate(date.getUTCDate() - i * 7)
    return date.toISOString().slice(0, 10)
  })
}

export function monthlyReportKeys(month) {
  const [year, number] = month.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year, number - 1 - i, 1))
    return date.toISOString().slice(0, 7)
  })
}

export function quarterReportKeys(quarter) {
  const [year, number] = quarter.split('-Q')
  return Array.from({ length: Number(number) }, (_, i) => `${year}-Q${Number(number) - i}`)
}
