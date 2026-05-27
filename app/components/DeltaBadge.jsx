'use client'

export default function DeltaBadge({ current, previous }) {
  if (current == null || previous == null || previous === 0) return null

  const c = Number(current)
  const p = Number(previous)
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null

  const pct = ((c - p) / Math.abs(p)) * 100
  if (!Number.isFinite(pct)) return null

  const isUp = pct >= 0
  const color = isUp ? '#22c55e' : '#ef4444'
  const bg = isUp ? '#22c55e18' : '#ef444418'
  const sign = isUp ? '+' : ''
  const display = Math.abs(pct) >= 100
    ? `${sign}${Math.round(pct)}%`
    : `${sign}${pct.toFixed(2).replace('.', ',')}%`

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 800,
        color,
        background: bg,
        borderRadius: 999,
        padding: '4px 9px',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {display}
    </span>
  )
}
